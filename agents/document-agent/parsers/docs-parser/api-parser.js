import yaml from 'js-yaml';
import { marked } from 'marked';
import matter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('APIParser');

/**
 * APIParser - Parses API documentation from OpenAPI specs and Markdown files
 *
 * Supports:
 * - OpenAPI/Swagger YAML specs (v2 and v3)
 * - API Markdown documentation
 * - Incremental parsing with DocumentCache
 *
 * Output format: Structured API digest with endpoints, models, auth, etc.
 */
class APIParser {
  constructor() {
    this.cache = getDocumentCache();
    this.logger = createLogger('APIParser');
    this.initialized = false;
  }

  /**
   * Initialize the parser
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.initialized = true;
    this.logger.info('APIParser initialized');
  }

  /**
   * Parse an API documentation file
   * Automatically detects file type and uses appropriate parser
   *
   * @param {string} filePath - Path to the API documentation file
   * @returns {Promise<Object>} Parsed API digest
   */
  async parse(filePath) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    const cached = await this.cache.get(filePath);
    if (cached) {
      this.logger.debug(`Using cached version of ${filePath}`);
      return cached;
    }

    const ext = path.extname(filePath).toLowerCase();
    let result;

    try {
      if (ext === '.yaml' || ext === '.yml') {
        result = await this.parseOpenAPI(filePath);
      } else if (ext === '.md') {
        result = await this.parseMarkdown(filePath);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      // Add metadata
      result.filePath = filePath;
      result.parsedAt = new Date().toISOString();
      result.parser = 'APIParser';

      // Cache the result
      await this.cache.set(filePath, result);

      this.logger.info(`Parsed ${filePath}: ${result.endpoints?.length || 0} endpoints`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Parse OpenAPI/Swagger YAML specification
   *
   * @param {string} filePath - Path to the OpenAPI YAML file
   * @returns {Promise<Object>} Structured API digest
   */
  async parseOpenAPI(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const spec = yaml.load(content);

    const result = {
      type: 'openapi',
      version: spec.openapi || spec.swagger || 'unknown',
      title: spec.info?.title || 'Untitled API',
      description: spec.info?.description || '',
      apiVersion: spec.info?.version || '1.0.0',
      baseUrl: this.extractBaseUrl(spec),
      endpoints: [],
      models: [],
      security: [],
      tags: spec.tags || []
    };

    // Extract security schemes
    if (spec.components?.securitySchemes || spec.securityDefinitions) {
      result.security = this.extractSecuritySchemes(spec);
    }

    // Extract endpoints from paths
    if (spec.paths) {
      result.endpoints = this.extractEndpoints(spec.paths, spec);
    }

    // Extract models/schemas
    if (spec.components?.schemas || spec.definitions) {
      result.models = this.extractModels(spec);
    }

    return result;
  }

  /**
   * Extract base URL from OpenAPI spec
   */
  extractBaseUrl(spec) {
    // OpenAPI 3.x
    if (spec.servers && spec.servers.length > 0) {
      return spec.servers[0].url;
    }

    // Swagger 2.0
    if (spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      const basePath = spec.basePath || '';
      return `${scheme}://${spec.host}${basePath}`;
    }

    return '';
  }

  /**
   * Extract security schemes
   */
  extractSecuritySchemes(spec) {
    const schemes = spec.components?.securitySchemes || spec.securityDefinitions || {};

    return Object.entries(schemes).map(([name, scheme]) => ({
      name,
      type: scheme.type,
      description: scheme.description || '',
      in: scheme.in,
      scheme: scheme.scheme,
      bearerFormat: scheme.bearerFormat
    }));
  }

  /**
   * Extract endpoints from OpenAPI paths
   */
  extractEndpoints(paths, spec) {
    const endpoints = [];

    for (const [pathStr, pathItem] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method];

          endpoints.push({
            path: pathStr,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary || '',
            description: operation.description || '',
            tags: operation.tags || [],
            parameters: this.extractParameters(operation.parameters, pathItem.parameters),
            requestBody: this.extractRequestBody(operation.requestBody),
            responses: this.extractResponses(operation.responses),
            security: operation.security || spec.security || [],
            deprecated: operation.deprecated || false
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Extract parameters from operation
   */
  extractParameters(operationParams = [], pathParams = []) {
    const allParams = [...(pathParams || []), ...(operationParams || [])];

    return allParams.map(param => ({
      name: param.name,
      in: param.in,
      description: param.description || '',
      required: param.required || false,
      schema: param.schema || { type: param.type },
      example: param.example
    }));
  }

  /**
   * Extract request body schema
   */
  extractRequestBody(requestBody) {
    if (!requestBody) return null;

    const content = requestBody.content || {};
    const contentType = Object.keys(content)[0];

    if (!contentType) return null;

    return {
      description: requestBody.description || '',
      required: requestBody.required || false,
      contentType,
      schema: content[contentType].schema
    };
  }

  /**
   * Extract response schemas
   */
  extractResponses(responses) {
    if (!responses) return {};

    const result = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      const content = response.content || {};
      const contentType = Object.keys(content)[0];

      result[statusCode] = {
        description: response.description || '',
        contentType,
        schema: contentType ? content[contentType].schema : null
      };
    }

    return result;
  }

  /**
   * Extract models/schemas
   */
  extractModels(spec) {
    const schemas = spec.components?.schemas || spec.definitions || {};

    return Object.entries(schemas).map(([name, schema]) => ({
      name,
      type: schema.type,
      description: schema.description || '',
      properties: schema.properties || {},
      required: schema.required || [],
      example: schema.example
    }));
  }

  /**
   * Parse API Markdown documentation
   *
   * @param {string} filePath - Path to the Markdown file
   * @returns {Promise<Object>} Structured API digest
   */
  async parseMarkdown(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data: frontmatter, content: markdown } = matter(content);

    const result = {
      type: 'markdown',
      title: frontmatter.title || path.basename(filePath, '.md'),
      description: frontmatter.description || '',
      baseUrl: frontmatter.baseUrl || '',
      endpoints: [],
      models: [],
      security: []
    };

    // Parse markdown content using marked
    const tokens = marked.lexer(markdown);

    // Extract API endpoints from markdown structure
    let currentEndpoint = null;
    let currentSection = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        const text = token.text;

        // Detect endpoint definitions (e.g., "GET /api/users")
        const endpointMatch = text.match(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(.+)$/i);

        if (endpointMatch) {
          // Save previous endpoint
          if (currentEndpoint) {
            result.endpoints.push(currentEndpoint);
          }

          currentEndpoint = {
            method: endpointMatch[1].toUpperCase(),
            path: endpointMatch[2].trim(),
            summary: '',
            description: '',
            parameters: [],
            requestBody: null,
            responses: {},
            security: []
          };
          currentSection = null;
        } else if (currentEndpoint) {
          // Track sections within endpoint documentation
          const sectionLower = text.toLowerCase();
          if (sectionLower.includes('parameter')) {
            currentSection = 'parameters';
          } else if (sectionLower.includes('request')) {
            currentSection = 'request';
          } else if (sectionLower.includes('response')) {
            currentSection = 'response';
          } else if (sectionLower.includes('auth')) {
            currentSection = 'auth';
          }
        }
      } else if (token.type === 'paragraph' && currentEndpoint && !currentSection) {
        // Use first paragraph as description
        if (!currentEndpoint.description) {
          currentEndpoint.description = token.text;
        }
      } else if (token.type === 'code' && currentEndpoint) {
        // Extract code blocks as examples
        if (currentSection === 'request' && token.lang === 'json') {
          try {
            currentEndpoint.requestBody = {
              contentType: 'application/json',
              example: JSON.parse(token.text)
            };
          } catch (e) {
            currentEndpoint.requestBody = {
              contentType: 'application/json',
              example: token.text
            };
          }
        } else if (currentSection === 'response' && token.lang === 'json') {
          try {
            currentEndpoint.responses['200'] = {
              description: 'Success',
              contentType: 'application/json',
              example: JSON.parse(token.text)
            };
          } catch (e) {
            currentEndpoint.responses['200'] = {
              description: 'Success',
              contentType: 'application/json',
              example: token.text
            };
          }
        }
      } else if (token.type === 'list' && currentEndpoint && currentSection === 'parameters') {
        // Extract parameters from lists
        for (const item of token.items) {
          const paramMatch = item.text.match(/`?(\w+)`?\s*(?:\(([^)]+)\))?\s*-?\s*(.+)?/);
          if (paramMatch) {
            currentEndpoint.parameters.push({
              name: paramMatch[1],
              type: paramMatch[2] || 'string',
              description: paramMatch[3] || '',
              required: item.text.toLowerCase().includes('required')
            });
          }
        }
      }
    }

    // Add last endpoint
    if (currentEndpoint) {
      result.endpoints.push(currentEndpoint);
    }

    return result;
  }

  /**
   * Parse multiple API files and merge results
   *
   * @param {string[]} filePaths - Array of file paths to parse
   * @returns {Promise<Object>} Merged API digest
   */
  async parseMultiple(filePaths) {
    const results = await Promise.all(
      filePaths.map(filePath => this.parse(filePath))
    );

    // Merge all results
    const merged = {
      type: 'merged',
      sources: filePaths,
      endpoints: [],
      models: [],
      security: [],
      parsedAt: new Date().toISOString()
    };

    for (const result of results) {
      merged.endpoints.push(...(result.endpoints || []));
      merged.models.push(...(result.models || []));
      merged.security.push(...(result.security || []));
    }

    // Remove duplicates
    merged.endpoints = this.deduplicateEndpoints(merged.endpoints);
    merged.models = this.deduplicateModels(merged.models);

    return merged;
  }

  /**
   * Remove duplicate endpoints
   */
  deduplicateEndpoints(endpoints) {
    const seen = new Set();
    return endpoints.filter(endpoint => {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Remove duplicate models
   */
  deduplicateModels(models) {
    const seen = new Set();
    return models.filter(model => {
      if (seen.has(model.name)) {
        return false;
      }
      seen.add(model.name);
      return true;
    });
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of APIParser
 * @returns {APIParser}
 */
export function getAPIParser() {
  if (!instance) {
    instance = new APIParser();
  }
  return instance;
}

export { APIParser };
export default APIParser;
