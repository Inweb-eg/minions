import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';
import path from 'path';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('BackendCodeParser');

/**
 * BackendCodeParser - Parses Node.js/Express backend code to extract API structure
 *
 * Supports:
 * - Express route definitions (app.get, router.post, etc.)
 * - Controller methods
 * - Mongoose models
 * - Service methods
 * - Middleware functions
 *
 * Output format: Structured API information for OpenAPI generation
 */
class BackendCodeParser {
  constructor() {
    this.cache = getDocumentCache();
    this.logger = createLogger('BackendCodeParser');
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
    this.logger.info('BackendCodeParser initialized');
  }

  /**
   * Parse a JavaScript/TypeScript file
   *
   * @param {string} filePath - Path to the source file
   * @returns {Promise<Object>} Parsed code structure
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

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Parse with Babel
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'dynamicImport'
        ]
      });

      const result = {
        type: 'backend-code',
        filePath,
        parsedAt: new Date().toISOString(),
        routes: [],
        controllers: [],
        models: [],
        services: [],
        middleware: [],
        imports: [],
        exports: []
      };

      // Traverse AST and extract information
      this.traverseAST(ast, result, content);

      // Cache the result
      await this.cache.set(filePath, result);

      this.logger.info(
        `Parsed ${filePath}: ${result.routes.length} routes, ` +
        `${result.controllers.length} controllers, ${result.models.length} models`
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Traverse AST and extract code structures
   */
  traverseAST(ast, result, sourceCode) {
    const self = this;

    traverse.default(ast, {
      // Extract imports
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const specifiers = path.node.specifiers.map(spec => {
          if (spec.type === 'ImportDefaultSpecifier') {
            return { type: 'default', name: spec.local.name };
          } else if (spec.type === 'ImportSpecifier') {
            return { type: 'named', name: spec.local.name, imported: spec.imported.name };
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            return { type: 'namespace', name: spec.local.name };
          }
          return null;
        }).filter(Boolean);

        result.imports.push({ source, specifiers });
      },

      // Extract exports
      ExportNamedDeclaration(path) {
        // Handle: export { name1, name2 }
        if (path.node.specifiers && path.node.specifiers.length > 0) {
          path.node.specifiers.forEach(spec => {
            result.exports.push({
              type: 'specifier',
              name: spec.exported.name,
              local: spec.local.name
            });
          });
        }

        // Handle: export const/function/class declaration
        if (path.node.declaration) {
          const declaration = path.node.declaration;
          if (declaration.type === 'FunctionDeclaration') {
            result.exports.push({
              type: 'function',
              name: declaration.id?.name,
              async: declaration.async
            });
          } else if (declaration.type === 'ClassDeclaration') {
            result.exports.push({
              type: 'class',
              name: declaration.id?.name
            });
          } else if (declaration.type === 'VariableDeclaration') {
            declaration.declarations.forEach(decl => {
              result.exports.push({
                type: 'variable',
                name: decl.id?.name
              });
            });
          }
        }
      },

      // Extract Express routes
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;

        // Detect app.get(), app.post(), router.get(), etc.
        if (callee.type === 'MemberExpression') {
          const objectName = callee.object.name;
          const method = callee.property.name;

          if ((objectName === 'app' || objectName === 'router') &&
              ['get', 'post', 'put', 'delete', 'patch'].includes(method)) {

            const routeInfo = {
              method: method.toUpperCase(),
              path: null,
              handler: null,
              middleware: [],
              location: {
                line: node.loc?.start.line,
                column: node.loc?.start.column
              }
            };

            // Extract route path (first argument)
            if (node.arguments.length > 0 && node.arguments[0].type === 'StringLiteral') {
              routeInfo.path = node.arguments[0].value;
            }

            // Extract middleware and handler
            for (let i = 1; i < node.arguments.length; i++) {
              const arg = node.arguments[i];

              if (arg.type === 'Identifier') {
                if (i === node.arguments.length - 1) {
                  routeInfo.handler = arg.name;
                } else {
                  routeInfo.middleware.push(arg.name);
                }
              } else if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
                // Inline handler
                routeInfo.handler = 'inline';
                routeInfo.handlerParams = arg.params.map(p => p.name || 'unknown');
              }
            }

            if (routeInfo.path) {
              result.routes.push(routeInfo);
            }
          }
        }
      },

      // Extract controller functions
      FunctionDeclaration(path) {
        const node = path.node;
        const name = node.id?.name;

        if (!name) return;

        const params = node.params.map(p => p.name);

        // Controller pattern: functions with req, res parameters
        if (node.params.length >= 2 && params.includes('req') && params.includes('res')) {
          result.controllers.push({
            name,
            async: node.async,
            params,
            location: {
              line: node.loc?.start.line,
              column: node.loc?.start.column
            }
          });
        } else {
          // Service pattern: other business logic functions
          const description = self.extractJSDoc(path);
          result.services.push({
            name,
            async: node.async,
            params,
            description,
            location: {
              line: node.loc?.start.line,
              column: node.loc?.start.column
            }
          });
        }
      },

      // Extract Mongoose models and middleware
      VariableDeclarator(path) {
        const node = path.node;
        const init = node.init;

        if (!init) return;

        // Pattern: const Model = mongoose.model('ModelName', schema)
        if (init.type === 'CallExpression' &&
            init.callee.type === 'MemberExpression' &&
            init.callee.property.name === 'model') {

          const modelName = init.arguments[0]?.value;
          if (modelName) {
            result.models.push({
              name: modelName,
              variable: node.id?.name,
              type: 'mongoose',
              location: {
                line: node.loc?.start.line,
                column: node.loc?.start.column
              }
            });
          }
        }

        // Pattern: const schema = new mongoose.Schema({...}) or new Schema({...})
        if (init.type === 'NewExpression') {
          const calleeName = init.callee.type === 'MemberExpression'
            ? init.callee.property.name
            : init.callee.name;

          if (calleeName === 'Schema') {
            const schemaFields = self.extractSchemaFields(init.arguments[0]);
            result.models.push({
              name: node.id?.name,
              type: 'schema',
              fields: schemaFields,
              location: {
                line: node.loc?.start.line,
                column: node.loc?.start.column
              }
            });
          }
        }

        // Pattern: const middleware = (req, res, next) => {...}
        if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
          const params = init.params.map(p => p.name);
          if (params.includes('req') && params.includes('res') && params.includes('next')) {
            result.middleware.push({
              name: node.id?.name,
              async: init.async,
              location: {
                line: node.loc?.start.line,
                column: node.loc?.start.column
              }
            });
          }
        }
      }
    });
  }

  /**
   * Extract JSDoc comments
   */
  extractJSDoc(path) {
    const comments = path.node.leadingComments;
    if (!comments || comments.length === 0) return null;

    const lastComment = comments[comments.length - 1];
    if (lastComment.type === 'CommentBlock') {
      return lastComment.value.trim();
    }
    return null;
  }

  /**
   * Extract schema fields from Mongoose schema definition
   */
  extractSchemaFields(schemaArg) {
    if (!schemaArg || schemaArg.type !== 'ObjectExpression') {
      return [];
    }

    const fields = [];
    for (const prop of schemaArg.properties) {
      if (prop.type === 'ObjectProperty' && prop.key) {
        const fieldName = prop.key.name || prop.key.value;
        const fieldInfo = { name: fieldName };

        // Try to extract type
        if (prop.value.type === 'Identifier') {
          fieldInfo.type = prop.value.name;
        } else if (prop.value.type === 'ObjectExpression') {
          // Schema with options: { type: String, required: true }
          for (const fieldProp of prop.value.properties) {
            if (fieldProp.key.name === 'type' && fieldProp.value.type === 'Identifier') {
              fieldInfo.type = fieldProp.value.name;
            } else if (fieldProp.key.name === 'required' && fieldProp.value.type === 'BooleanLiteral') {
              fieldInfo.required = fieldProp.value.value;
            }
          }
        }

        fields.push(fieldInfo);
      }
    }

    return fields;
  }

  /**
   * Parse multiple files
   *
   * @param {string[]} filePaths - Array of file paths to parse
   * @returns {Promise<Object>} Merged results from all files
   */
  async parseMultiple(filePaths) {
    const results = await Promise.all(
      filePaths.map(filePath => this.parse(filePath))
    );

    return this.mergeResults(results);
  }

  /**
   * Merge results from multiple files
   */
  mergeResults(results) {
    const merged = {
      type: 'backend-code',
      parsedAt: new Date().toISOString(),
      files: results.map(r => r.filePath),
      routes: [],
      controllers: [],
      models: [],
      services: [],
      middleware: [],
      imports: [],
      exports: []
    };

    for (const result of results) {
      merged.routes.push(...result.routes);
      merged.controllers.push(...result.controllers);
      merged.models.push(...result.models);
      merged.services.push(...result.services);
      merged.middleware.push(...result.middleware);
      merged.imports.push(...result.imports);
      merged.exports.push(...result.exports);
    }

    // Deduplicate
    merged.routes = this.deduplicateByPath(merged.routes);
    merged.controllers = this.deduplicateByName(merged.controllers);
    merged.models = this.deduplicateByName(merged.models);
    merged.services = this.deduplicateByName(merged.services);
    merged.middleware = this.deduplicateByName(merged.middleware);

    return merged;
  }

  /**
   * Deduplicate array by path
   */
  deduplicateByPath(arr) {
    const seen = new Set();
    return arr.filter(item => {
      const key = `${item.method}:${item.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Deduplicate array by name
   */
  deduplicateByName(arr) {
    const seen = new Set();
    return arr.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of BackendCodeParser
 * @returns {BackendCodeParser}
 */
export function getBackendCodeParser() {
  if (!instance) {
    instance = new BackendCodeParser();
  }
  return instance;
}

export { BackendCodeParser };
export default BackendCodeParser;
