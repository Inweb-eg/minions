import matter from 'gray-matter';
import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('ReactParser');

/**
 * ReactParser - Parses React-specific documentation
 *
 * Supports:
 * - Component documentation (Class and Functional)
 * - Hooks usage patterns
 * - Context and State management
 * - Routing configuration
 * - API integration patterns
 * - Package dependencies
 *
 * Output format: Structured React digest with components, hooks, routes, etc.
 */
class ReactParser {
  constructor() {
    this.cache = getDocumentCache();
    this.logger = createLogger('ReactParser');
    this.initialized = false;

    // React-specific patterns
    this.componentTypes = [
      'functional',
      'class',
      'hook',
      'hoc',
      'render prop'
    ];

    this.hooks = [
      'useState',
      'useEffect',
      'useContext',
      'useReducer',
      'useCallback',
      'useMemo',
      'useRef',
      'useImperativeHandle',
      'useLayoutEffect',
      'useDebugValue'
    ];

    this.stateManagementLibraries = [
      'redux',
      'mobx',
      'zustand',
      'recoil',
      'jotai',
      'context api',
      'react query',
      'swr'
    ];

    this.routingLibraries = [
      'react-router',
      'react-router-dom',
      'next.js',
      'reach router',
      'wouter'
    ];

    this.uiLibraries = [
      'material-ui',
      'mui',
      'ant design',
      'chakra ui',
      'tailwind',
      'bootstrap',
      'semantic ui',
      'styled-components',
      'emotion'
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
    this.logger.info('ReactParser initialized');
  }

  /**
   * Parse a React documentation file
   *
   * @param {string} filePath - Path to the React documentation file
   * @returns {Promise<Object>} Parsed React digest
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
        type: 'react',
        title: frontmatter.title || path.basename(filePath, '.md'),
        description: frontmatter.description || '',
        framework: frontmatter.framework || 'react',
        reactVersion: frontmatter.reactVersion || 'latest',

        // React components
        pages: [],
        components: [],
        hooks: [],
        contexts: [],
        routes: [],
        services: [],
        utilities: [],
        packages: [],
        stateManagement: {},
        routing: {},
        uiFramework: {},

        // Metadata
        filePath,
        parsedAt: new Date().toISOString(),
        parser: 'ReactParser'
      };

      // Parse markdown content
      const tokens = marked.lexer(markdown);
      await this.extractReactInfo(tokens, result);

      // Cache the result
      await this.cache.set(filePath, result);

      this.logger.info(
        `Parsed ${filePath}: ${result.pages.length} pages, ` +
        `${result.components.length} components`
      );

      return result;

    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract React information from markdown tokens
   */
  async extractReactInfo(tokens, result) {
    let currentSection = null;
    let currentPage = null;
    let currentComponent = null;
    let currentHook = null;
    let currentContext = null;
    let currentService = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        const text = token.text;
        const textLower = text.toLowerCase();
        const level = token.depth;

        // Save previous items
        if (currentPage) {
          result.pages.push(currentPage);
          currentPage = null;
        }
        if (currentComponent) {
          result.components.push(currentComponent);
          currentComponent = null;
        }
        if (currentHook) {
          result.hooks.push(currentHook);
          currentHook = null;
        }
        if (currentContext) {
          result.contexts.push(currentContext);
          currentContext = null;
        }
        if (currentService) {
          result.services.push(currentService);
          currentService = null;
        }

        // Detect section types
        if (level === 1 || level === 2) {
          if (textLower.includes('page') || textLower.includes('view')) {
            currentSection = 'pages';
          } else if (textLower.includes('component')) {
            currentSection = 'components';
          } else if (textLower.includes('hook') || textLower.includes('custom hook')) {
            currentSection = 'hooks';
          } else if (textLower.includes('context')) {
            currentSection = 'contexts';
          } else if (textLower.includes('route') || textLower.includes('routing')) {
            currentSection = 'routes';
          } else if (textLower.includes('service') || textLower.includes('api')) {
            currentSection = 'services';
          } else if (textLower.includes('util') || textLower.includes('helper')) {
            currentSection = 'utilities';
          } else if (textLower.includes('package') || textLower.includes('dependenc')) {
            currentSection = 'packages';
          } else if (textLower.includes('state management')) {
            currentSection = 'stateManagement';
          }
        }

        // Extract pages (level 3)
        if (level === 3 && currentSection === 'pages') {
          currentPage = {
            name: text,
            description: '',
            componentType: this.detectComponentType(text),
            route: this.extractRoute(text),
            components: [],
            hooks: [],
            stateManagement: this.detectStateManagement(text)
          };
        }

        // Extract components (level 3)
        if (level === 3 && currentSection === 'components') {
          currentComponent = {
            name: text,
            description: '',
            type: this.detectComponentType(text),
            props: [],
            hooks: this.detectHooks(text),
            usedIn: []
          };
        }

        // Extract custom hooks (level 3)
        if (level === 3 && currentSection === 'hooks') {
          currentHook = {
            name: text,
            description: '',
            parameters: [],
            returns: '',
            dependencies: []
          };
        }

        // Extract contexts (level 3)
        if (level === 3 && currentSection === 'contexts') {
          currentContext = {
            name: text,
            description: '',
            provides: [],
            consumers: []
          };
        }

        // Extract services (level 3)
        if (level === 3 && currentSection === 'services') {
          currentService = {
            name: text,
            description: '',
            type: this.detectServiceType(textLower),
            methods: []
          };
        }

      } else if (token.type === 'paragraph') {
        const text = token.text;

        // Add to current page description
        if (currentPage && !currentPage.description) {
          currentPage.description = text;
        }

        // Add to current component description
        if (currentComponent && !currentComponent.description) {
          currentComponent.description = text;
        }

        // Add to current hook description
        if (currentHook && !currentHook.description) {
          currentHook.description = text;
        }

        // Add to current context description
        if (currentContext && !currentContext.description) {
          currentContext.description = text;
        }

        // Add to current service description
        if (currentService && !currentService.description) {
          currentService.description = text;
        }

        // Detect state management libraries
        const stateLib = this.detectStateManagement(text);
        if (stateLib && !result.stateManagement.library) {
          result.stateManagement.library = stateLib;
        }

        // Detect routing library
        const routingLib = this.detectRoutingLibrary(text);
        if (routingLib && !result.routing.library) {
          result.routing.library = routingLib;
        }

        // Extract hooks from text
        const detectedHooks = this.detectHooks(text);
        if (currentPage && detectedHooks.length > 0) {
          currentPage.hooks.push(...detectedHooks.filter(h => !currentPage.hooks.includes(h)));
        }

        // Detect UI framework
        const uiLib = this.detectUILibrary(text);
        if (uiLib && !result.uiFramework.library) {
          result.uiFramework.library = uiLib;
        }

      } else if (token.type === 'list') {
        const listItems = token.items.map(item => item.text);

        // Add to appropriate section
        if (currentSection === 'packages') {
          this.extractPackages(listItems, result);
        } else if (currentSection === 'routes') {
          this.extractRoutes(listItems, result);
        } else if (currentSection === 'utilities') {
          result.utilities.push(...listItems);
        } else if (currentComponent) {
          // Extract component props
          for (const item of listItems) {
            if (item.includes(':') || item.includes('-')) {
              currentComponent.props.push(item);
            }
          }
        } else if (currentHook) {
          // Extract hook parameters or dependencies
          if (listItems[0] && listItems[0].toLowerCase().includes('parameter')) {
            currentHook.parameters.push(...listItems.slice(1));
          } else {
            currentHook.dependencies.push(...listItems);
          }
        } else if (currentContext) {
          // Extract context provides
          currentContext.provides.push(...listItems);
        } else if (currentService) {
          // Extract service methods
          currentService.methods.push(...listItems);
        } else if (currentPage) {
          // Extract page components or hooks
          currentPage.components.push(...listItems);
        }

      } else if (token.type === 'code') {
        // Extract code examples
        const lang = token.lang || '';
        const code = token.text;

        if (lang === 'jsx' || lang === 'tsx' || lang === 'javascript' || lang === 'typescript') {
          // Analyze React code
          this.analyzeReactCode(code, result, currentPage, currentComponent, currentHook);
        } else if (lang === 'json' && code.includes('dependencies')) {
          // Parse package.json
          this.parsePackageJson(code, result);
        }
      }
    }

    // Save last items
    if (currentPage) {
      result.pages.push(currentPage);
    }
    if (currentComponent) {
      result.components.push(currentComponent);
    }
    if (currentHook) {
      result.hooks.push(currentHook);
    }
    if (currentContext) {
      result.contexts.push(currentContext);
    }
    if (currentService) {
      result.services.push(currentService);
    }
  }

  /**
   * Detect component type from text
   */
  detectComponentType(text) {
    const textLower = text.toLowerCase();

    if (textLower.includes('functional') || textLower.includes('function')) return 'functional';
    if (textLower.includes('class')) return 'class';
    if (textLower.includes('hook')) return 'hook';
    if (textLower.includes('hoc') || textLower.includes('higher-order')) return 'hoc';
    if (textLower.includes('render prop')) return 'render prop';

    return 'functional'; // Default to functional components
  }

  /**
   * Detect React hooks in text
   */
  detectHooks(text) {
    const textLower = text.toLowerCase();
    const detected = [];

    for (const hook of this.hooks) {
      if (textLower.includes(hook.toLowerCase())) {
        detected.push(hook);
      }
    }

    return detected;
  }

  /**
   * Detect state management library
   */
  detectStateManagement(text) {
    const textLower = text.toLowerCase();

    for (const lib of this.stateManagementLibraries) {
      if (textLower.includes(lib)) {
        return lib;
      }
    }

    return null;
  }

  /**
   * Detect routing library
   */
  detectRoutingLibrary(text) {
    const textLower = text.toLowerCase();

    for (const lib of this.routingLibraries) {
      // Handle variations like "React Router" -> "react-router"
      const libVariant = lib.replace(/-/g, ' ');
      if (textLower.includes(lib) || textLower.includes(libVariant)) {
        return lib;
      }
    }

    return null;
  }

  /**
   * Detect UI framework/library
   */
  detectUILibrary(text) {
    const textLower = text.toLowerCase();

    for (const lib of this.uiLibraries) {
      if (textLower.includes(lib)) {
        return lib;
      }
    }

    return null;
  }

  /**
   * Detect service type
   */
  detectServiceType(textLower) {
    if (textLower.includes('api') || textLower.includes('http')) return 'api';
    if (textLower.includes('auth')) return 'authentication';
    if (textLower.includes('storage')) return 'storage';
    if (textLower.includes('websocket') || textLower.includes('socket')) return 'websocket';
    return 'general';
  }

  /**
   * Extract route from text
   */
  extractRoute(text) {
    // Look for route patterns
    const routeMatch = text.match(/(\/[\w-/]+)/);
    if (routeMatch) {
      return routeMatch[1];
    }

    // Generate route from page name (remove type annotations like (Functional))
    const name = text.toLowerCase()
      .replace(/page|view|\(.*?\)/gi, '')
      .trim()
      .replace(/\s+/g, '-');

    return `/${name}`;
  }

  /**
   * Extract packages from list items
   */
  extractPackages(items, result) {
    for (const item of items) {
      const colonMatch = item.match(/^([^:]+):\s*(.+)/);
      const dashMatch = item.match(/^([^-]+)\s*-\s*(.+)/);

      if (colonMatch) {
        result.packages.push({
          name: colonMatch[1].trim(),
          version: colonMatch[2].trim(),
          description: ''
        });
      } else if (dashMatch) {
        result.packages.push({
          name: dashMatch[1].trim(),
          version: '',
          description: dashMatch[2].trim()
        });
      } else {
        result.packages.push({
          name: item.trim(),
          version: '',
          description: ''
        });
      }
    }
  }

  /**
   * Extract routes from list items
   */
  extractRoutes(items, result) {
    for (const item of items) {
      const match = item.match(/^(\/[\w-/]+)\s*[-:]\s*(.+)/);

      if (match) {
        result.routes.push({
          path: match[1].trim(),
          component: match[2].trim()
        });
      } else if (item.startsWith('/')) {
        result.routes.push({
          path: item.trim(),
          component: ''
        });
      }
    }
  }

  /**
   * Analyze React/JSX code
   */
  analyzeReactCode(code, result, currentPage, currentComponent, currentHook) {
    const lines = code.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect component declarations
      if (trimmed.includes('function') && (trimmed.includes('()') || trimmed.includes('(props'))) {
        const funcMatch = trimmed.match(/function\s+(\w+)/);
        if (funcMatch && !currentComponent) {
          const exists = result.components.find(c => c.name === funcMatch[1]);
          if (!exists) {
            result.components.push({
              name: funcMatch[1],
              description: '',
              type: 'functional',
              props: [],
              hooks: [],
              usedIn: []
            });
          }
        }
      }

      // Detect arrow function components
      if (trimmed.includes('=>') && trimmed.includes('const')) {
        const arrowMatch = trimmed.match(/const\s+(\w+)\s*=/);
        if (arrowMatch && !currentComponent) {
          const exists = result.components.find(c => c.name === arrowMatch[1]);
          if (!exists && arrowMatch[1][0] === arrowMatch[1][0].toUpperCase()) {
            result.components.push({
              name: arrowMatch[1],
              description: '',
              type: 'functional',
              props: [],
              hooks: [],
              usedIn: []
            });
          }
        }
      }

      // Detect hooks usage
      for (const hook of this.hooks) {
        if (trimmed.includes(hook)) {
          if (currentComponent && !currentComponent.hooks.includes(hook)) {
            currentComponent.hooks.push(hook);
          }
          if (currentPage && !currentPage.hooks.includes(hook)) {
            currentPage.hooks.push(hook);
          }
        }
      }

      // Detect Redux usage
      if (trimmed.includes('useSelector') || trimmed.includes('useDispatch') || trimmed.includes('connect(')) {
        result.stateManagement.library = 'redux';
      }
    }
  }

  /**
   * Parse package.json content
   */
  parsePackageJson(jsonContent, result) {
    try {
      const parsed = JSON.parse(jsonContent);

      if (parsed.dependencies) {
        for (const [name, version] of Object.entries(parsed.dependencies)) {
          result.packages.push({
            name,
            version,
            description: ''
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse package.json content:', error.message);
    }
  }

  /**
   * Parse multiple React files and merge results
   */
  async parseMultiple(filePaths) {
    const results = await Promise.all(
      filePaths.map(filePath => this.parse(filePath))
    );

    const merged = {
      type: 'merged-react',
      sources: filePaths,
      pages: [],
      components: [],
      hooks: [],
      contexts: [],
      routes: [],
      services: [],
      utilities: [],
      packages: [],
      stateManagement: {},
      routing: {},
      uiFramework: {},
      parsedAt: new Date().toISOString()
    };

    for (const result of results) {
      merged.pages.push(...(result.pages || []));
      merged.components.push(...(result.components || []));
      merged.hooks.push(...(result.hooks || []));
      merged.contexts.push(...(result.contexts || []));
      merged.routes.push(...(result.routes || []));
      merged.services.push(...(result.services || []));
      merged.utilities.push(...(result.utilities || []));

      // Merge packages (deduplicate)
      for (const pkg of result.packages || []) {
        if (!merged.packages.find(p => p.name === pkg.name)) {
          merged.packages.push(pkg);
        }
      }

      // Merge state management
      Object.assign(merged.stateManagement, result.stateManagement || {});
      Object.assign(merged.routing, result.routing || {});
      Object.assign(merged.uiFramework, result.uiFramework || {});
    }

    // Deduplicate
    merged.pages = this.deduplicateByName(merged.pages);
    merged.components = this.deduplicateByName(merged.components);
    merged.hooks = this.deduplicateByName(merged.hooks);
    merged.contexts = this.deduplicateByName(merged.contexts);
    merged.routes = this.deduplicateRoutes(merged.routes);

    return merged;
  }

  /**
   * Remove duplicates by name
   */
  deduplicateByName(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.name)) {
        return false;
      }
      seen.add(item.name);
      return true;
    });
  }

  /**
   * Remove duplicate routes
   */
  deduplicateRoutes(routes) {
    const seen = new Set();
    return routes.filter(route => {
      if (seen.has(route.path)) {
        return false;
      }
      seen.add(route.path);
      return true;
    });
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ReactParser
 * @returns {ReactParser}
 */
export function getReactParser() {
  if (!instance) {
    instance = new ReactParser();
  }
  return instance;
}

export { ReactParser };
export default ReactParser;
