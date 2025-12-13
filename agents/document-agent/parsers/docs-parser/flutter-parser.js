import matter from 'gray-matter';
import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('FlutterParser');

/**
 * FlutterParser - Parses Flutter-specific documentation
 *
 * Supports:
 * - Widget documentation
 * - State management patterns
 * - Routing configuration
 * - API integration patterns
 * - Platform-specific features
 * - Package dependencies
 *
 * Output format: Structured Flutter digest with widgets, screens, state, etc.
 */
class FlutterParser {
  constructor() {
    this.cache = getDocumentCache();
    this.logger = createLogger('FlutterParser');
    this.initialized = false;

    // Flutter-specific patterns
    this.widgetTypes = [
      'stateless',
      'stateful',
      'inherited',
      'provider',
      'consumer',
      'builder'
    ];

    this.stateManagementPatterns = [
      'provider',
      'riverpod',
      'bloc',
      'redux',
      'getx',
      'mobx',
      'setstate',
      'inheritedwidget'
    ];

    this.navigationPatterns = [
      'navigator',
      'go_router',
      'auto_route',
      'beamer',
      'named routes'
    ];

    this.platformFeatures = [
      'android',
      'ios',
      'web',
      'desktop',
      'platform channel',
      'native code'
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
    this.logger.info('FlutterParser initialized');
  }

  /**
   * Parse a Flutter documentation file
   *
   * @param {string} filePath - Path to the Flutter documentation file
   * @returns {Promise<Object>} Parsed Flutter digest
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
        type: 'flutter',
        title: frontmatter.title || path.basename(filePath, '.md'),
        description: frontmatter.description || '',
        platform: frontmatter.platform || 'mobile',
        flutterVersion: frontmatter.flutterVersion || 'latest',

        // Flutter components
        screens: [],
        widgets: [],
        models: [],
        services: [],
        providers: [],
        routes: [],
        packages: [],
        stateManagement: {},
        platformFeatures: [],
        apiIntegration: {},

        // Metadata
        filePath,
        parsedAt: new Date().toISOString(),
        parser: 'FlutterParser'
      };

      // Parse markdown content
      const tokens = marked.lexer(markdown);
      await this.extractFlutterInfo(tokens, result);

      // Cache the result
      await this.cache.set(filePath, result);

      this.logger.info(
        `Parsed ${filePath}: ${result.screens.length} screens, ` +
        `${result.widgets.length} widgets`
      );

      return result;

    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract Flutter information from markdown tokens
   */
  async extractFlutterInfo(tokens, result) {
    let currentSection = null;
    let currentScreen = null;
    let currentWidget = null;
    let currentService = null;
    let currentModel = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        const text = token.text;
        const textLower = text.toLowerCase();
        const level = token.depth;

        // Save previous items
        if (currentScreen) {
          result.screens.push(currentScreen);
          currentScreen = null;
        }
        if (currentWidget) {
          result.widgets.push(currentWidget);
          currentWidget = null;
        }
        if (currentService) {
          result.services.push(currentService);
          currentService = null;
        }
        if (currentModel) {
          result.models.push(currentModel);
          currentModel = null;
        }

        // Detect section types
        if (level === 1 || level === 2) {
          if (textLower.includes('screen') || textLower.includes('page')) {
            currentSection = 'screens';
          } else if (textLower.includes('widget')) {
            currentSection = 'widgets';
          } else if (textLower.includes('model') || textLower.includes('data model')) {
            currentSection = 'models';
          } else if (textLower.includes('service')) {
            currentSection = 'services';
          } else if (textLower.includes('provider') || textLower.includes('state')) {
            currentSection = 'providers';
          } else if (textLower.includes('route') || textLower.includes('navigation')) {
            currentSection = 'routes';
          } else if (textLower.includes('package') || textLower.includes('dependenc')) {
            currentSection = 'packages';
          } else if (textLower.includes('api') || textLower.includes('integration')) {
            currentSection = 'apiIntegration';
          } else if (textLower.includes('platform')) {
            currentSection = 'platformFeatures';
          }
        }

        // Extract screens (level 3)
        if (level === 3 && currentSection === 'screens') {
          currentScreen = {
            name: text,
            description: '',
            widgetType: this.detectWidgetType(text),
            route: this.extractRoute(text),
            widgets: [],
            stateManagement: this.detectStateManagement(text),
            dependencies: []
          };
        }

        // Extract widgets (level 3)
        if (level === 3 && currentSection === 'widgets') {
          currentWidget = {
            name: text,
            description: '',
            type: this.detectWidgetType(text),
            properties: [],
            methods: [],
            usedIn: []
          };
        }

        // Extract services (level 3)
        if (level === 3 && currentSection === 'services') {
          currentService = {
            name: text,
            description: '',
            type: this.detectServiceType(textLower),
            methods: [],
            dependencies: []
          };
        }

        // Extract models (level 3)
        if (level === 3 && currentSection === 'models') {
          currentModel = {
            name: text,
            description: '',
            fields: [],
            methods: []
          };
        }

      } else if (token.type === 'paragraph') {
        const text = token.text;

        // Add to current screen description
        if (currentScreen && !currentScreen.description) {
          currentScreen.description = text;
        }

        // Add to current widget description
        if (currentWidget && !currentWidget.description) {
          currentWidget.description = text;
        }

        // Add to current service description
        if (currentService && !currentService.description) {
          currentService.description = text;
        }

        // Add to current model description
        if (currentModel && !currentModel.description) {
          currentModel.description = text;
        }

        // Detect state management patterns
        const statePatterns = this.detectStateManagement(text);
        if (statePatterns && !result.stateManagement.primary) {
          result.stateManagement.primary = statePatterns;
        }

        // Detect navigation patterns
        const navPattern = this.detectNavigationPattern(text);
        if (navPattern && !result.stateManagement.navigation) {
          result.stateManagement.navigation = navPattern;
        }

      } else if (token.type === 'list') {
        const listItems = token.items.map(item => item.text);

        // Add to appropriate section
        if (currentSection === 'packages') {
          this.extractPackages(listItems, result);
        } else if (currentSection === 'routes') {
          this.extractRoutes(listItems, result);
        } else if (currentSection === 'platformFeatures') {
          result.platformFeatures.push(...listItems);
        } else if (currentWidget) {
          // Extract widget properties or methods
          for (const item of listItems) {
            if (item.toLowerCase().includes('property') || item.includes(':')) {
              currentWidget.properties.push(item);
            } else if (item.toLowerCase().includes('method') || item.includes('()')) {
              currentWidget.methods.push(item);
            }
          }
        } else if (currentModel) {
          // Extract model fields
          currentModel.fields.push(...listItems);
        } else if (currentService) {
          // Extract service methods
          currentService.methods.push(...listItems);
        } else if (currentScreen) {
          // Extract screen widgets or dependencies
          currentScreen.widgets.push(...listItems);
        }

      } else if (token.type === 'code') {
        // Extract code examples
        const lang = token.lang || '';
        const code = token.text;

        if (lang === 'dart' || lang === 'flutter') {
          // Analyze Dart/Flutter code
          this.analyzeFlutterCode(code, result, currentScreen, currentWidget, currentService);
        } else if (lang === 'yaml') {
          // Parse pubspec.yaml or route configuration
          if (code.includes('dependencies:')) {
            this.parsePubspecYaml(code, result);
          }
        }
      }
    }

    // Save last items
    if (currentScreen) {
      result.screens.push(currentScreen);
    }
    if (currentWidget) {
      result.widgets.push(currentWidget);
    }
    if (currentService) {
      result.services.push(currentService);
    }
    if (currentModel) {
      result.models.push(currentModel);
    }
  }

  /**
   * Detect widget type from text
   */
  detectWidgetType(text) {
    const textLower = text.toLowerCase();

    for (const type of this.widgetTypes) {
      if (textLower.includes(type)) {
        return type;
      }
    }

    // Check for specific widget classes
    if (textLower.includes('stateless')) return 'stateless';
    if (textLower.includes('stateful')) return 'stateful';

    return 'custom';
  }

  /**
   * Detect state management pattern
   */
  detectStateManagement(text) {
    const textLower = text.toLowerCase();

    for (const pattern of this.stateManagementPatterns) {
      if (textLower.includes(pattern)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Detect navigation pattern
   */
  detectNavigationPattern(text) {
    const textLower = text.toLowerCase();

    for (const pattern of this.navigationPatterns) {
      // Handle variations like "GoRouter" -> "go_router"
      const patternVariant = pattern.replace(/_/g, '');
      if (textLower.includes(pattern) || textLower.includes(patternVariant)) {
        return pattern;
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
    if (textLower.includes('storage') || textLower.includes('database')) return 'storage';
    if (textLower.includes('location')) return 'location';
    if (textLower.includes('notification')) return 'notification';
    if (textLower.includes('payment')) return 'payment';
    return 'general';
  }

  /**
   * Extract route from text
   */
  extractRoute(text) {
    // Look for route patterns like /home, /profile, etc.
    const routeMatch = text.match(/\/[\w-/]+/);
    if (routeMatch) {
      return routeMatch[0];
    }

    // Generate route from screen name
    const name = text.toLowerCase()
      .replace(/screen|page/gi, '')
      .trim()
      .replace(/\s+/g, '-');

    return `/${name}`;
  }

  /**
   * Extract packages from list items
   */
  extractPackages(items, result) {
    for (const item of items) {
      // Parse package format: "package_name: ^version" or "package_name - description"
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
      // Parse route format: "/path - ScreenName" or "/path: ScreenName"
      const match = item.match(/^(\/[\w-/]+)\s*[-:]\s*(.+)/);

      if (match) {
        result.routes.push({
          path: match[1].trim(),
          screen: match[2].trim()
        });
      } else if (item.startsWith('/')) {
        result.routes.push({
          path: item.trim(),
          screen: ''
        });
      }
    }
  }

  /**
   * Analyze Flutter/Dart code
   */
  analyzeFlutterCode(code, result, currentScreen, currentWidget, currentService) {
    const lines = code.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect widget classes
      if (trimmed.includes('class') && trimmed.includes('Widget')) {
        const classMatch = trimmed.match(/class\s+(\w+)\s+extends\s+(\w+)/);
        if (classMatch && !currentWidget) {
          const widgetType = classMatch[2].toLowerCase().includes('stateless') ? 'stateless' :
                           classMatch[2].toLowerCase().includes('stateful') ? 'stateful' : 'custom';

          // Only add if not already in widgets
          const exists = result.widgets.find(w => w.name === classMatch[1]);
          if (!exists) {
            result.widgets.push({
              name: classMatch[1],
              description: '',
              type: widgetType,
              properties: [],
              methods: [],
              usedIn: []
            });
          }
        }
      }

      // Detect Provider usage
      if (trimmed.includes('Provider') || trimmed.includes('ChangeNotifier')) {
        if (!result.stateManagement.primary) {
          result.stateManagement.primary = 'provider';
        }
      }

      // Detect API calls
      if (trimmed.includes('http.') || trimmed.includes('dio.') || trimmed.includes('api.')) {
        result.apiIntegration.hasHttpClient = true;
      }
    }
  }

  /**
   * Parse pubspec.yaml content
   */
  parsePubspecYaml(yamlContent, result) {
    const lines = yamlContent.split('\n');
    let inDependencies = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'dependencies:') {
        inDependencies = true;
        continue;
      }

      if (inDependencies && trimmed && !trimmed.startsWith('#')) {
        if (trimmed.match(/^[a-z]/)) {
          // New section started
          if (!trimmed.includes(':')) {
            inDependencies = false;
            continue;
          }

          const match = trimmed.match(/^([^:]+):\s*(.+)?/);
          if (match) {
            const name = match[1].trim();
            const version = match[2]?.trim() || '';

            // Skip flutter SDK
            if (name !== 'flutter' || version !== 'sdk: flutter') {
              result.packages.push({
                name,
                version,
                description: ''
              });
            }
          }
        }
      }
    }
  }

  /**
   * Parse multiple Flutter files and merge results
   *
   * @param {string[]} filePaths - Array of file paths to parse
   * @returns {Promise<Object>} Merged Flutter digest
   */
  async parseMultiple(filePaths) {
    const results = await Promise.all(
      filePaths.map(filePath => this.parse(filePath))
    );

    const merged = {
      type: 'merged-flutter',
      sources: filePaths,
      screens: [],
      widgets: [],
      models: [],
      services: [],
      providers: [],
      routes: [],
      packages: [],
      stateManagement: {},
      platformFeatures: [],
      apiIntegration: {},
      parsedAt: new Date().toISOString()
    };

    for (const result of results) {
      merged.screens.push(...(result.screens || []));
      merged.widgets.push(...(result.widgets || []));
      merged.models.push(...(result.models || []));
      merged.services.push(...(result.services || []));
      merged.providers.push(...(result.providers || []));
      merged.routes.push(...(result.routes || []));
      merged.platformFeatures.push(...(result.platformFeatures || []));

      // Merge packages (deduplicate)
      for (const pkg of result.packages || []) {
        if (!merged.packages.find(p => p.name === pkg.name)) {
          merged.packages.push(pkg);
        }
      }

      // Merge state management
      if (result.stateManagement?.primary && !merged.stateManagement.primary) {
        merged.stateManagement.primary = result.stateManagement.primary;
      }

      // Merge API integration
      Object.assign(merged.apiIntegration, result.apiIntegration || {});
    }

    // Deduplicate
    merged.screens = this.deduplicateByName(merged.screens);
    merged.widgets = this.deduplicateByName(merged.widgets);
    merged.models = this.deduplicateByName(merged.models);
    merged.services = this.deduplicateByName(merged.services);
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
 * Get singleton instance of FlutterParser
 * @returns {FlutterParser}
 */
export function getFlutterParser() {
  if (!instance) {
    instance = new FlutterParser();
  }
  return instance;
}

export { FlutterParser };
export default FlutterParser;
