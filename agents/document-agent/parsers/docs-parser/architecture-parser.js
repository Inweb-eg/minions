import matter from 'gray-matter';
import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('ArchitectureParser');

/**
 * ArchitectureParser - Parses architecture and design documentation
 *
 * Supports:
 * - System design documents
 * - Architecture Decision Records (ADRs)
 * - Component diagrams in Markdown
 * - Technology stack documentation
 *
 * Output format: Structured architecture digest with patterns, components, relationships
 */
class ArchitectureParser {
  constructor() {
    this.cache = getDocumentCache();
    this.logger = createLogger('ArchitectureParser');
    this.initialized = false;

    // Common architecture patterns to detect
    this.patterns = [
      'microservices',
      'monolith',
      'mvc',
      'mvvm',
      'clean architecture',
      'hexagonal',
      'layered',
      'event-driven',
      'cqrs',
      'saga',
      'repository pattern',
      'factory pattern',
      'singleton',
      'observer',
      'pub/sub',
      'rest',
      'graphql',
      'websocket'
    ];

    // Technology categories
    this.techCategories = [
      'frontend',
      'backend',
      'database',
      'cache',
      'messaging',
      'storage',
      'authentication',
      'deployment',
      'monitoring',
      'testing'
    ];
  }

  /**
   * Initialize the parser
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.initialized = true;
    this.logger.info('ArchitectureParser initialized');
  }

  /**
   * Parse an architecture documentation file
   *
   * @param {string} filePath - Path to the architecture documentation file
   * @returns {Promise<Object>} Parsed architecture digest
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
      const { data: frontmatter, content: markdown } = matter(content);

      const result = {
        type: 'architecture',
        title: frontmatter.title || path.basename(filePath, '.md'),
        description: frontmatter.description || '',
        version: frontmatter.version || '1.0.0',
        lastUpdated: frontmatter.lastUpdated
          ? (frontmatter.lastUpdated instanceof Date
            ? frontmatter.lastUpdated.toISOString().split('T')[0]
            : frontmatter.lastUpdated)
          : new Date().toISOString().split('T')[0],

        // Architecture components
        layers: [],
        components: [],
        patterns: [],
        technologies: {},
        dependencies: [],
        constraints: [],
        decisions: [],

        // Metadata
        filePath,
        parsedAt: new Date().toISOString(),
        parser: 'ArchitectureParser'
      };

      // Parse markdown content
      const tokens = marked.lexer(markdown);
      await this.extractArchitectureInfo(tokens, result);

      // Cache the result
      await this.cache.set(filePath, result);

      this.logger.info(
        `Parsed ${filePath}: ${result.components.length} components, ` +
        `${result.patterns.length} patterns`
      );

      return result;

    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract architecture information from markdown tokens
   */
  async extractArchitectureInfo(tokens, result) {
    let currentSection = null;
    let currentComponent = null;
    let currentDecision = null;
    let currentTechCategory = null;
    let currentADRSection = null;
    let listItems = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        const text = token.text.toLowerCase();
        const level = token.depth;

        // Save previous component if exists
        if (currentComponent) {
          result.components.push(currentComponent);
          currentComponent = null;
        }

        // Save previous decision if exists
        if (currentDecision) {
          result.decisions.push(currentDecision);
          currentDecision = null;
        }

        // Detect section types
        if (level === 1 || level === 2) {
          if (text.includes('layer') || text.includes('tier')) {
            currentSection = 'layers';
          } else if (text.includes('component')) {
            currentSection = 'components';
          } else if (text.includes('pattern')) {
            currentSection = 'patterns';
          } else if (text.includes('technology') || text.includes('tech stack') || text.includes('stack')) {
            currentSection = 'technologies';
          } else if (text.includes('dependency') || text.includes('dependencies')) {
            currentSection = 'dependencies';
          } else if (text.includes('constraint')) {
            currentSection = 'constraints';
          } else if (text.includes('decision') || text.includes('adr')) {
            currentSection = 'decisions';
          }
        }

        // Extract ADR headings (level 3)
        if (level === 3 && currentSection === 'decisions') {
          // Start new ADR
          currentDecision = {
            title: token.text,
            status: 'accepted',
            context: '',
            decision: '',
            consequences: []
          };
        }

        // Extract status from heading level 4 under decisions
        if (level === 4 && currentDecision) {
          const statusText = token.text.toLowerCase();
          if (statusText.includes('status')) {
            currentADRSection = 'status';
          } else if (statusText.includes('context')) {
            currentADRSection = 'context';
          } else if (statusText.includes('decision')) {
            currentADRSection = 'decision';
          } else if (statusText.includes('consequence')) {
            currentADRSection = 'consequences';
          }
        }

        // Extract components from headings
        if (level === 3 && currentSection === 'components') {
          currentComponent = {
            name: token.text,
            description: '',
            type: this.detectComponentType(token.text),
            responsibilities: [],
            interfaces: [],
            dependencies: []
          };
        }

        // Extract layers
        if (level === 3 && currentSection === 'layers') {
          result.layers.push({
            name: token.text,
            description: '',
            components: []
          });
        }

        // Extract technology categories
        if (level === 3 && currentSection === 'technologies') {
          const categoryName = token.text.toLowerCase();
          currentTechCategory = categoryName;
          if (!result.technologies[categoryName]) {
            result.technologies[categoryName] = [];
          }
        }

      } else if (token.type === 'paragraph') {
        const text = token.text;

        // Detect and extract patterns
        const detectedPatterns = this.detectPatterns(text);
        for (const pattern of detectedPatterns) {
          if (!result.patterns.find(p => p.name === pattern)) {
            result.patterns.push({
              name: pattern,
              context: text
            });
          }
        }

        // Add to current component description
        if (currentComponent && !currentComponent.description) {
          currentComponent.description = text;
        }

        // Add to current layer description
        if (currentSection === 'layers' && result.layers.length > 0) {
          const lastLayer = result.layers[result.layers.length - 1];
          if (!lastLayer.description) {
            lastLayer.description = text;
          }
        }

        // Add to current decision based on section
        if (currentDecision) {
          const textLower = text.toLowerCase();
          if (textLower.includes('status:')) {
            const statusMatch = text.match(/status:\s*(\w+)/i);
            if (statusMatch) {
              currentDecision.status = statusMatch[1].toLowerCase();
            }
          } else if (textLower.includes('context:')) {
            currentADRSection = 'context';
          } else if (textLower.includes('decision:')) {
            currentADRSection = 'decision';
          } else if (textLower.includes('consequence')) {
            currentADRSection = 'consequences';
          } else if (currentADRSection === 'context') {
            if (currentDecision.context) {
              currentDecision.context += ' ' + text;
            } else {
              currentDecision.context = text;
            }
          } else if (currentADRSection === 'decision') {
            if (currentDecision.decision) {
              currentDecision.decision += ' ' + text;
            } else {
              currentDecision.decision = text;
            }
          } else if (!currentDecision.context) {
            currentDecision.context = text;
          } else if (!currentDecision.decision) {
            currentDecision.decision = text;
          }
        }

      } else if (token.type === 'list') {
        listItems = token.items.map(item => item.text);

        // Extract based on current section
        if (currentSection === 'technologies' && currentTechCategory) {
          // Extract technologies under current category
          for (const item of listItems) {
            const match = item.match(/^([^(]+)(?:\((.+)\))?/);
            if (match) {
              result.technologies[currentTechCategory].push({
                name: match[1].trim(),
                details: match[2] || '',
                raw: item
              });
            }
          }
        } else if (currentSection === 'dependencies') {
          this.extractDependencies(listItems, result);
        } else if (currentSection === 'constraints') {
          result.constraints.push(...listItems);
        } else if (currentComponent) {
          // Add to component responsibilities
          currentComponent.responsibilities.push(...listItems);
        } else if (currentDecision && currentADRSection === 'consequences') {
          // Add to decision consequences
          currentDecision.consequences.push(...listItems);
        }

      } else if (token.type === 'code') {
        // Extract component interfaces or code examples
        if (currentComponent) {
          currentComponent.interfaces.push({
            type: token.lang || 'code',
            code: token.text
          });
        }
      }
    }

    // Save last component
    if (currentComponent) {
      result.components.push(currentComponent);
    }

    // Save last decision
    if (currentDecision) {
      result.decisions.push(currentDecision);
    }
  }

  /**
   * Detect component type from name
   */
  detectComponentType(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('service')) return 'service';
    if (nameLower.includes('controller')) return 'controller';
    if (nameLower.includes('repository')) return 'repository';
    if (nameLower.includes('model')) return 'model';
    if (nameLower.includes('view')) return 'view';
    if (nameLower.includes('component')) return 'ui-component';
    if (nameLower.includes('middleware')) return 'middleware';
    if (nameLower.includes('handler')) return 'handler';
    if (nameLower.includes('gateway')) return 'gateway';
    if (nameLower.includes('adapter')) return 'adapter';
    if (nameLower.includes('factory')) return 'factory';
    if (nameLower.includes('builder')) return 'builder';
    if (nameLower.includes('manager')) return 'manager';
    if (nameLower.includes('provider')) return 'provider';

    return 'component';
  }

  /**
   * Detect architecture patterns in text
   */
  detectPatterns(text) {
    const textLower = text.toLowerCase();
    const detected = [];

    for (const pattern of this.patterns) {
      if (textLower.includes(pattern)) {
        detected.push(pattern);
      }
    }

    return detected;
  }

  /**
   * Extract technologies from list items
   */
  extractTechnologies(items, result) {
    for (const item of items) {
      const itemLower = item.toLowerCase();

      // Try to categorize technology
      let category = 'other';
      for (const cat of this.techCategories) {
        if (itemLower.includes(cat)) {
          category = cat;
          break;
        }
      }

      // Extract technology name and version
      const match = item.match(/^([^:(-]+)(?:\s*[:(](.+?)[)])?/);
      if (match) {
        const name = match[1].trim();
        const details = match[2] || '';

        if (!result.technologies[category]) {
          result.technologies[category] = [];
        }

        result.technologies[category].push({
          name,
          details,
          raw: item
        });
      }
    }
  }

  /**
   * Extract dependencies from list items
   */
  extractDependencies(items, result) {
    for (const item of items) {
      // Parse dependency format: "ComponentA -> ComponentB" or "ComponentA depends on ComponentB"
      const arrowMatch = item.match(/(.+?)\s*->\s*(.+)/);
      const dependsMatch = item.match(/(.+?)\s+depends on\s+(.+)/i);

      if (arrowMatch) {
        result.dependencies.push({
          from: arrowMatch[1].trim(),
          to: arrowMatch[2].trim(),
          type: 'dependency'
        });
      } else if (dependsMatch) {
        result.dependencies.push({
          from: dependsMatch[1].trim(),
          to: dependsMatch[2].trim(),
          type: 'dependency'
        });
      } else {
        // General dependency
        result.dependencies.push({
          name: item,
          type: 'general'
        });
      }
    }
  }

  /**
   * Parse multiple architecture files and merge results
   *
   * @param {string[]} filePaths - Array of file paths to parse
   * @returns {Promise<Object>} Merged architecture digest
   */
  async parseMultiple(filePaths) {
    const results = await Promise.all(
      filePaths.map(filePath => this.parse(filePath))
    );

    const merged = {
      type: 'merged-architecture',
      sources: filePaths,
      layers: [],
      components: [],
      patterns: [],
      technologies: {},
      dependencies: [],
      constraints: [],
      decisions: [],
      parsedAt: new Date().toISOString()
    };

    for (const result of results) {
      merged.layers.push(...(result.layers || []));
      merged.components.push(...(result.components || []));
      merged.dependencies.push(...(result.dependencies || []));
      merged.constraints.push(...(result.constraints || []));
      merged.decisions.push(...(result.decisions || []));

      // Merge patterns
      for (const pattern of result.patterns || []) {
        if (!merged.patterns.find(p => p.name === pattern.name)) {
          merged.patterns.push(pattern);
        }
      }

      // Merge technologies
      for (const [category, techs] of Object.entries(result.technologies || {})) {
        if (!merged.technologies[category]) {
          merged.technologies[category] = [];
        }
        merged.technologies[category].push(...techs);
      }
    }

    // Deduplicate
    merged.components = this.deduplicateComponents(merged.components);
    merged.layers = this.deduplicateLayers(merged.layers);

    return merged;
  }

  /**
   * Remove duplicate components
   */
  deduplicateComponents(components) {
    const seen = new Set();
    return components.filter(component => {
      if (seen.has(component.name)) {
        return false;
      }
      seen.add(component.name);
      return true;
    });
  }

  /**
   * Remove duplicate layers
   */
  deduplicateLayers(layers) {
    const seen = new Set();
    return layers.filter(layer => {
      if (seen.has(layer.name)) {
        return false;
      }
      seen.add(layer.name);
      return true;
    });
  }

  /**
   * Generate component dependency graph
   */
  generateDependencyGraph(result) {
    const graph = {
      nodes: [],
      edges: []
    };

    // Add components as nodes
    for (const component of result.components) {
      graph.nodes.push({
        id: component.name,
        type: component.type,
        label: component.name
      });
    }

    // Add dependencies as edges
    for (const dep of result.dependencies) {
      if (dep.from && dep.to) {
        graph.edges.push({
          from: dep.from,
          to: dep.to,
          type: dep.type || 'dependency'
        });
      }
    }

    return graph;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ArchitectureParser
 * @returns {ArchitectureParser}
 */
export function getArchitectureParser() {
  if (!instance) {
    instance = new ArchitectureParser();
  }
  return instance;
}

export { ArchitectureParser };
export default ArchitectureParser;
