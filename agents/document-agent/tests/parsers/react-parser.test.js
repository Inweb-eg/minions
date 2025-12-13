import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ReactParser, { getReactParser } from '../../parsers/docs-parser/react-parser.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ReactParser', () => {
  let parser;
  let cache;
  const fixturesDir = path.join(__dirname, '../fixtures');
  const testReactFile = path.join(fixturesDir, 'test-react.md');

  beforeEach(async () => {
    parser = new ReactParser();
    await parser.initialize();
    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newParser = new ReactParser();
      await newParser.initialize();
      expect(newParser.initialized).toBe(true);
    });

    test('should get singleton instance', () => {
      const instance1 = getReactParser();
      const instance2 = getReactParser();
      expect(instance1).toBe(instance2);
    });

    test('should have predefined patterns', () => {
      expect(parser.componentTypes).toBeDefined();
      expect(parser.hooks).toBeDefined();
      expect(parser.stateManagementLibraries).toBeDefined();
      expect(parser.routingLibraries).toBeDefined();
      expect(parser.uiLibraries).toBeDefined();
    });
  });

  describe('React Parsing', () => {
    test('should parse React document successfully', async () => {
      const result = await parser.parse(testReactFile);

      expect(result).toBeDefined();
      expect(result.type).toBe('react');
      expect(result.title).toBe('React Admin Dashboard Documentation');
    });

    test('should extract frontmatter metadata', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.description).toContain('React documentation');
      expect(result.framework).toBe('react');
      expect(result.reactVersion).toBe('18.2.0');
    });
  });

  describe('Page Extraction', () => {
    test('should extract pages', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.pages).toBeDefined();
      expect(result.pages.length).toBeGreaterThan(0);
    });

    test('should extract page details', async () => {
      const result = await parser.parse(testReactFile);

      const dashboardPage = result.pages.find(p =>
        p.name.toLowerCase().includes('dashboard')
      );

      expect(dashboardPage).toBeDefined();
      if (dashboardPage) {
        expect(dashboardPage.description).toBeDefined();
        expect(dashboardPage.route).toBeDefined();
      }
    });

    test('should detect component types in pages', async () => {
      const result = await parser.parse(testReactFile);

      const functionalPage = result.pages.find(p =>
        p.componentType === 'functional'
      );

      expect(functionalPage).toBeDefined();
    });

    test('should extract page routes', async () => {
      const result = await parser.parse(testReactFile);

      const dashboardPage = result.pages.find(p =>
        p.name.toLowerCase().includes('dashboard')
      );

      if (dashboardPage) {
        expect(dashboardPage.route).toBe('/dashboard');
      }
    });

    test('should extract page hooks', async () => {
      const result = await parser.parse(testReactFile);

      // Check that pages have hooks array
      expect(result.pages.length).toBeGreaterThan(0);
      if (result.pages[0]) {
        expect(Array.isArray(result.pages[0].hooks)).toBe(true);
      }
    });
  });

  describe('Component Extraction', () => {
    test('should extract components', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.components).toBeDefined();
      expect(result.components.length).toBeGreaterThan(0);
    });

    test('should detect component types', async () => {
      const result = await parser.parse(testReactFile);

      const functionalComp = result.components.find(c => c.type === 'functional');
      expect(functionalComp).toBeDefined();
    });

    test('should extract component props', async () => {
      const result = await parser.parse(testReactFile);

      const statsCard = result.components.find(c =>
        c.name.toLowerCase().includes('statscard')
      );

      if (statsCard) {
        expect(Array.isArray(statsCard.props)).toBe(true);
      }
    });

    test('should detect hooks in components', async () => {
      const result = await parser.parse(testReactFile);

      // Check that components have hooks array
      expect(result.components.length).toBeGreaterThan(0);
      if (result.components[0]) {
        expect(Array.isArray(result.components[0].hooks)).toBe(true);
      }
    });

    test('should extract components from code', async () => {
      const result = await parser.parse(testReactFile);

      // Should have extracted components from code or documentation
      expect(result.components.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Hooks Extraction', () => {
    test('should extract custom hooks', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.hooks).toBeDefined();
      expect(result.hooks.length).toBeGreaterThan(0);
    });

    test('should extract hook details', async () => {
      const result = await parser.parse(testReactFile);

      const useAuthHook = result.hooks.find(h =>
        h.name.toLowerCase().includes('auth')
      );

      if (useAuthHook) {
        expect(useAuthHook.description).toBeDefined();
      }
    });

    test('should extract hook dependencies', async () => {
      const result = await parser.parse(testReactFile);

      const useAuthHook = result.hooks.find(h =>
        h.name.toLowerCase().includes('auth')
      );

      if (useAuthHook) {
        expect(Array.isArray(useAuthHook.dependencies)).toBe(true);
      }
    });
  });

  describe('Context Extraction', () => {
    test('should extract contexts', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.contexts).toBeDefined();
      expect(result.contexts.length).toBeGreaterThan(0);
    });

    test('should extract context provides', async () => {
      const result = await parser.parse(testReactFile);

      const authContext = result.contexts.find(c =>
        c.name.toLowerCase().includes('auth')
      );

      if (authContext) {
        expect(Array.isArray(authContext.provides)).toBe(true);
      }
    });
  });

  describe('Service Extraction', () => {
    test('should extract services', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.services).toBeDefined();
      expect(result.services.length).toBeGreaterThan(0);
    });

    test('should detect service types', async () => {
      const result = await parser.parse(testReactFile);

      const apiService = result.services.find(s => s.type === 'api');
      const authService = result.services.find(s => s.type === 'authentication');

      expect(apiService || authService).toBeDefined();
    });

    test('should extract service methods', async () => {
      const result = await parser.parse(testReactFile);

      const rideService = result.services.find(s =>
        s.name.toLowerCase().includes('ride')
      );

      if (rideService) {
        expect(Array.isArray(rideService.methods)).toBe(true);
        expect(rideService.methods.length).toBeGreaterThan(0);
      }
    });
  });

  describe('State Management Detection', () => {
    test('should detect state management library', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.stateManagement).toBeDefined();
      expect(result.stateManagement.library).toBeDefined();
    });

    test('should detect Redux', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.stateManagement.library).toBe('redux');
    });

    test('should detect various state management libraries', () => {
      expect(parser.detectStateManagement('Using Redux Toolkit')).toBe('redux');
      expect(parser.detectStateManagement('MobX state management')).toBe('mobx');
      expect(parser.detectStateManagement('Context API for state')).toBe('context api');
    });
  });

  describe('Routing Detection', () => {
    test('should detect routing library', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.routing).toBeDefined();
      // React Router should be detected from text
      expect(parser.detectRoutingLibrary('Using React Router v6')).toBe('react-router');
    });

    test('should extract routes', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThan(0);
    });

    test('should extract route paths and components', async () => {
      const result = await parser.parse(testReactFile);

      const dashboardRoute = result.routes.find(r => r.path === '/dashboard');

      if (dashboardRoute) {
        expect(dashboardRoute.component).toBeDefined();
      }
    });
  });

  describe('UI Framework Detection', () => {
    test('should detect UI framework', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.uiFramework).toBeDefined();
      expect(result.uiFramework.library).toBeDefined();
    });

    test('should detect Material-UI', async () => {
      const result = await parser.parse(testReactFile);

      // MUI or Material-UI should be detected
      expect(['material-ui', 'mui'].includes(result.uiFramework.library)).toBe(true);
    });

    test('should detect various UI libraries', () => {
      expect(parser.detectUILibrary('Using Material-UI v5')).toBe('material-ui');
      expect(parser.detectUILibrary('Built with Chakra UI')).toBe('chakra ui');
      expect(parser.detectUILibrary('Tailwind CSS styling')).toBe('tailwind');
    });
  });

  describe('Hook Detection', () => {
    test('should detect React hooks in text', () => {
      const hooks = parser.detectHooks('Using useState and useEffect hooks');

      expect(hooks).toContain('useState');
      expect(hooks).toContain('useEffect');
    });

    test('should detect all standard hooks', () => {
      expect(parser.hooks).toContain('useState');
      expect(parser.hooks).toContain('useEffect');
      expect(parser.hooks).toContain('useContext');
      expect(parser.hooks).toContain('useReducer');
    });
  });

  describe('Package Extraction', () => {
    test('should extract packages', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.packages).toBeDefined();
      expect(result.packages.length).toBeGreaterThan(0);
    });

    test('should extract package versions', async () => {
      const result = await parser.parse(testReactFile);

      const react = result.packages.find(p => p.name === 'react');

      if (react) {
        expect(react.version).toBeDefined();
      }
    });

    test('should parse package.json', async () => {
      const result = await parser.parse(testReactFile);

      // Should extract packages from package.json code block
      const redux = result.packages.find(p => p.name.includes('redux'));
      expect(redux).toBeDefined();
    });
  });

  describe('Utilities Extraction', () => {
    test('should extract utilities', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.utilities).toBeDefined();
      expect(result.utilities.length).toBeGreaterThan(0);
    });
  });

  describe('Code Analysis', () => {
    test('should analyze JSX code blocks', async () => {
      const result = await parser.parse(testReactFile);

      // Should have analyzed code and extracted components
      expect(result.components.length).toBeGreaterThan(0);
    });

    test('should detect functional components', async () => {
      const result = await parser.parse(testReactFile);

      const functionalComp = result.components.find(c =>
        c.type === 'functional'
      );

      expect(functionalComp).toBeDefined();
    });

    test('should detect Redux hooks in code', async () => {
      const result = await parser.parse(testReactFile);

      // Redux should be detected from useSelector/useDispatch
      expect(result.stateManagement.library).toBe('redux');
    });
  });

  describe('Component Type Detection', () => {
    test('should detect functional components', () => {
      expect(parser.detectComponentType('MyComponent (Functional)')).toBe('functional');
      expect(parser.detectComponentType('UserCard Function Component')).toBe('functional');
    });

    test('should detect class components', () => {
      expect(parser.detectComponentType('MyComponent (Class)')).toBe('class');
      expect(parser.detectComponentType('Class Component Example')).toBe('class');
    });

    test('should default to functional', () => {
      expect(parser.detectComponentType('MyComponent')).toBe('functional');
    });
  });

  describe('Multiple File Parsing', () => {
    test('should parse multiple files', async () => {
      const result = await parser.parseMultiple([testReactFile]);

      expect(result).toBeDefined();
      expect(result.type).toBe('merged-react');
      expect(result.sources).toHaveLength(1);
    });

    test('should merge all components', async () => {
      const result = await parser.parseMultiple([testReactFile]);

      expect(result.pages).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.hooks).toBeDefined();
      expect(result.contexts).toBeDefined();
      expect(result.services).toBeDefined();
    });

    test('should deduplicate components', () => {
      const components = [
        { name: 'Button', type: 'functional' },
        { name: 'Button', type: 'functional' },
        { name: 'Card', type: 'functional' }
      ];

      const deduplicated = parser.deduplicateByName(components);
      expect(deduplicated.length).toBe(2);
    });

    test('should deduplicate routes', () => {
      const routes = [
        { path: '/home', component: 'HomePage' },
        { path: '/home', component: 'HomePage' },
        { path: '/about', component: 'AboutPage' }
      ];

      const deduplicated = parser.deduplicateRoutes(routes);
      expect(deduplicated.length).toBe(2);
    });
  });

  describe('Caching', () => {
    test('should cache parsed results', async () => {
      const result1 = await parser.parse(testReactFile);
      expect(result1.cached).toBeUndefined();

      const result2 = await parser.parse(testReactFile);
      expect(result2.cached).toBe(true);
    });
  });

  describe('Metadata', () => {
    test('should add parsing metadata', async () => {
      const result = await parser.parse(testReactFile);

      expect(result.filePath).toBe(testReactFile);
      expect(result.parsedAt).toBeDefined();
      expect(result.parser).toBe('ReactParser');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing files gracefully', async () => {
      const missingFile = path.join(fixturesDir, 'non-existent.md');

      await expect(parser.parse(missingFile)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    test('should parse in reasonable time', async () => {
      const startTime = Date.now();
      await parser.parse(testReactFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});
