import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ArchitectureParser, { getArchitectureParser } from '../../parsers/docs-parser/architecture-parser.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ArchitectureParser', () => {
  let parser;
  let cache;
  const fixturesDir = path.join(__dirname, '../fixtures');
  const testArchFile = path.join(fixturesDir, 'test-architecture.md');

  beforeEach(async () => {
    parser = new ArchitectureParser();
    await parser.initialize();
    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newParser = new ArchitectureParser();
      await newParser.initialize();
      expect(newParser.initialized).toBe(true);
    });

    test('should initialize cache', async () => {
      expect(cache.initialized).toBe(true);
    });

    test('should get singleton instance', () => {
      const instance1 = getArchitectureParser();
      const instance2 = getArchitectureParser();
      expect(instance1).toBe(instance2);
    });

    test('should have predefined patterns', () => {
      expect(parser.patterns).toBeDefined();
      expect(parser.patterns.length).toBeGreaterThan(0);
      expect(parser.patterns).toContain('microservices');
      expect(parser.patterns).toContain('mvc');
    });

    test('should have predefined tech categories', () => {
      expect(parser.techCategories).toBeDefined();
      expect(parser.techCategories).toContain('frontend');
      expect(parser.techCategories).toContain('backend');
      expect(parser.techCategories).toContain('database');
    });
  });

  describe('Architecture Parsing', () => {
    test('should parse architecture document successfully', async () => {
      const result = await parser.parse(testArchFile);

      expect(result).toBeDefined();
      expect(result.type).toBe('architecture');
      expect(result.title).toBe('TukTuk System Architecture');
      expect(result.version).toBe('2.0.0');
    });

    test('should extract frontmatter metadata', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.description).toBe('System architecture and design documentation');
      expect(result.lastUpdated).toBe('2024-01-15');
    });

    test('should extract layers', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.layers).toBeDefined();
      expect(result.layers.length).toBeGreaterThan(0);

      const layerNames = result.layers.map(l => l.name.toLowerCase());
      expect(layerNames.some(n => n.includes('presentation'))).toBe(true);
      expect(layerNames.some(n => n.includes('application'))).toBe(true);
    });

    test('should extract layer descriptions', async () => {
      const result = await parser.parse(testArchFile);

      const presentationLayer = result.layers.find(l =>
        l.name.toLowerCase().includes('presentation')
      );

      expect(presentationLayer).toBeDefined();
      expect(presentationLayer.description).toBeDefined();
      expect(presentationLayer.description.length).toBeGreaterThan(0);
    });
  });

  describe('Component Extraction', () => {
    test('should extract components', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.components).toBeDefined();
      expect(result.components.length).toBeGreaterThan(0);

      const componentNames = result.components.map(c => c.name);
      expect(componentNames.some(n => n.includes('User Service'))).toBe(true);
      expect(componentNames.some(n => n.includes('Ride Service'))).toBe(true);
    });

    test('should detect component types', async () => {
      const result = await parser.parse(testArchFile);

      const userService = result.components.find(c => c.name.includes('User Service'));
      expect(userService).toBeDefined();
      expect(userService.type).toBe('service');
    });

    test('should extract component descriptions', async () => {
      const result = await parser.parse(testArchFile);

      const userService = result.components.find(c => c.name.includes('User Service'));
      expect(userService.description).toBeDefined();
      expect(userService.description.length).toBeGreaterThan(0);
    });

    test('should extract component responsibilities', async () => {
      const result = await parser.parse(testArchFile);

      const userService = result.components.find(c => c.name.includes('User Service'));
      expect(userService.responsibilities).toBeDefined();
      expect(userService.responsibilities.length).toBeGreaterThan(0);
    });

    test('should extract component interfaces', async () => {
      const result = await parser.parse(testArchFile);

      const userService = result.components.find(c => c.name.includes('User Service'));
      expect(userService.interfaces).toBeDefined();
    });

    test('should detect various component types', () => {
      expect(parser.detectComponentType('User Service')).toBe('service');
      expect(parser.detectComponentType('Auth Controller')).toBe('controller');
      expect(parser.detectComponentType('User Repository')).toBe('repository');
      expect(parser.detectComponentType('User Model')).toBe('model');
      expect(parser.detectComponentType('Auth Middleware')).toBe('middleware');
      expect(parser.detectComponentType('API Gateway')).toBe('gateway');
    });
  });

  describe('Pattern Detection', () => {
    test('should detect architecture patterns', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.patterns).toBeDefined();
      expect(result.patterns.length).toBeGreaterThan(0);

      const patternNames = result.patterns.map(p => p.name);
      expect(patternNames).toContain('microservices');
      expect(patternNames).toContain('repository pattern');
    });

    test('should include context for patterns', async () => {
      const result = await parser.parse(testArchFile);

      const microservices = result.patterns.find(p => p.name === 'microservices');
      expect(microservices).toBeDefined();
      expect(microservices.context).toBeDefined();
      expect(microservices.context.length).toBeGreaterThan(0);
    });

    test('should detect patterns in text', () => {
      const text1 = 'We use a microservices architecture with REST APIs';
      const patterns1 = parser.detectPatterns(text1);
      expect(patterns1).toContain('microservices');
      expect(patterns1).toContain('rest');

      const text2 = 'The system implements MVC pattern with Repository Pattern';
      const patterns2 = parser.detectPatterns(text2);
      expect(patterns2).toContain('mvc');
      expect(patterns2).toContain('repository pattern');
    });

    test('should not duplicate patterns', async () => {
      const result = await parser.parse(testArchFile);

      const patternNames = result.patterns.map(p => p.name);
      const uniquePatterns = new Set(patternNames);

      expect(patternNames.length).toBe(uniquePatterns.size);
    });
  });

  describe('Technology Extraction', () => {
    test('should extract technologies', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.technologies).toBeDefined();
      expect(Object.keys(result.technologies).length).toBeGreaterThan(0);
    });

    test('should categorize technologies correctly', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.technologies.frontend).toBeDefined();
      expect(result.technologies.backend).toBeDefined();
      expect(result.technologies.infrastructure).toBeDefined();
      expect(result.technologies.monitoring).toBeDefined();
    });

    test('should extract technology details', async () => {
      const result = await parser.parse(testArchFile);

      const frontendTechs = result.technologies.frontend || [];
      expect(frontendTechs.length).toBeGreaterThan(0);

      const flutter = frontendTechs.find(t => t.name.includes('Flutter'));
      expect(flutter).toBeDefined();
    });

    test('should handle technology list items', () => {
      const items = [
        'Frontend: React, Redux',
        'Backend: Node.js, Express',
        'Database: PostgreSQL'
      ];

      const result = {
        technologies: {}
      };

      parser.extractTechnologies(items, result);

      expect(result.technologies.frontend).toBeDefined();
      expect(result.technologies.backend).toBeDefined();
      expect(result.technologies.database).toBeDefined();
    });
  });

  describe('Dependency Extraction', () => {
    test('should extract dependencies', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.length).toBeGreaterThan(0);
    });

    test('should parse arrow notation dependencies', () => {
      const items = [
        'UserService -> AuthService',
        'RideService -> LocationService'
      ];

      const result = {
        dependencies: []
      };

      parser.extractDependencies(items, result);

      expect(result.dependencies.length).toBe(2);
      expect(result.dependencies[0].from).toBe('UserService');
      expect(result.dependencies[0].to).toBe('AuthService');
    });

    test('should parse "depends on" notation', () => {
      const items = ['UserService depends on AuthService'];

      const result = {
        dependencies: []
      };

      parser.extractDependencies(items, result);

      expect(result.dependencies.length).toBe(1);
      expect(result.dependencies[0].from).toBe('UserService');
      expect(result.dependencies[0].to).toBe('AuthService');
    });
  });

  describe('Constraints Extraction', () => {
    test('should extract constraints', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.constraints).toBeDefined();
      expect(result.constraints.length).toBeGreaterThan(0);
    });

    test('should include all constraint text', async () => {
      const result = await parser.parse(testArchFile);

      const statelessConstraint = result.constraints.find(c =>
        c.toLowerCase().includes('stateless')
      );

      expect(statelessConstraint).toBeDefined();
    });
  });

  describe('Architecture Decision Records (ADRs)', () => {
    test('should extract ADRs', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.decisions).toBeDefined();
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    test('should extract ADR details', async () => {
      const result = await parser.parse(testArchFile);

      const microservicesADR = result.decisions.find(d =>
        d.title.includes('Microservices')
      );

      expect(microservicesADR).toBeDefined();
      expect(microservicesADR.status).toBeDefined();
      expect(microservicesADR.context).toBeDefined();
      expect(microservicesADR.decision).toBeDefined();
    });

    test('should extract ADR consequences', async () => {
      const result = await parser.parse(testArchFile);

      const microservicesADR = result.decisions.find(d =>
        d.title.includes('Microservices')
      );

      expect(microservicesADR.consequences).toBeDefined();
      expect(microservicesADR.consequences.length).toBeGreaterThan(0);
    });
  });

  describe('Dependency Graph Generation', () => {
    test('should generate dependency graph', async () => {
      const result = await parser.parse(testArchFile);
      const graph = parser.generateDependencyGraph(result);

      expect(graph).toBeDefined();
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
    });

    test('should include components as nodes', async () => {
      const result = await parser.parse(testArchFile);
      const graph = parser.generateDependencyGraph(result);

      expect(graph.nodes.length).toBe(result.components.length);
    });

    test('should include dependencies as edges', async () => {
      const result = await parser.parse(testArchFile);
      const graph = parser.generateDependencyGraph(result);

      expect(graph.edges.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    test('should cache parsed results', async () => {
      // First parse
      const result1 = await parser.parse(testArchFile);
      expect(result1.cached).toBeUndefined();

      // Second parse - should be cached
      const result2 = await parser.parse(testArchFile);
      expect(result2.cached).toBe(true);
    });

    test('should invalidate cache when cleared', async () => {
      await parser.parse(testArchFile);
      await cache.clear(testArchFile);

      const result = await parser.parse(testArchFile);
      expect(result.cached).toBeUndefined();
    });
  });

  describe('Multiple File Parsing', () => {
    test('should parse multiple files', async () => {
      const result = await parser.parseMultiple([testArchFile]);

      expect(result).toBeDefined();
      expect(result.type).toBe('merged-architecture');
      expect(result.sources).toHaveLength(1);
    });

    test('should merge components from multiple sources', async () => {
      const result = await parser.parseMultiple([testArchFile]);

      expect(result.components).toBeDefined();
      expect(result.components.length).toBeGreaterThan(0);
    });

    test('should merge patterns without duplicates', async () => {
      const result = await parser.parseMultiple([testArchFile]);

      const patternNames = result.patterns.map(p => p.name);
      const uniquePatterns = new Set(patternNames);

      expect(patternNames.length).toBe(uniquePatterns.size);
    });

    test('should deduplicate components', () => {
      const components = [
        { name: 'UserService', type: 'service' },
        { name: 'UserService', type: 'service' },
        { name: 'RideService', type: 'service' }
      ];

      const deduplicated = parser.deduplicateComponents(components);

      expect(deduplicated.length).toBe(2);
    });

    test('should deduplicate layers', () => {
      const layers = [
        { name: 'Presentation Layer' },
        { name: 'Presentation Layer' },
        { name: 'Application Layer' }
      ];

      const deduplicated = parser.deduplicateLayers(layers);

      expect(deduplicated.length).toBe(2);
    });
  });

  describe('Metadata', () => {
    test('should add parsing metadata', async () => {
      const result = await parser.parse(testArchFile);

      expect(result.filePath).toBe(testArchFile);
      expect(result.parsedAt).toBeDefined();
      expect(result.parser).toBe('ArchitectureParser');
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
      await parser.parse(testArchFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    test('should benefit from caching', async () => {
      const start1 = Date.now();
      await parser.parse(testArchFile);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await parser.parse(testArchFile);
      const duration2 = Date.now() - start2;

      expect(duration2).toBeLessThan(duration1);
    });
  });
});
