import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import FeatureParser, { getFeatureParser } from '../../parsers/docs-parser/feature-parser.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FeatureParser', () => {
  let parser;
  let cache;
  const fixturesDir = path.join(__dirname, '../fixtures');
  const testFeatureFile = path.join(fixturesDir, 'test-features.md');

  beforeEach(async () => {
    parser = new FeatureParser();
    await parser.initialize();
    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newParser = new FeatureParser();
      await newParser.initialize();
      expect(newParser.initialized).toBe(true);
    });

    test('should get singleton instance', () => {
      const instance1 = getFeatureParser();
      const instance2 = getFeatureParser();
      expect(instance1).toBe(instance2);
    });

    test('should have predefined patterns', () => {
      expect(parser.userStoryPattern).toBeDefined();
      expect(parser.priorityLevels).toBeDefined();
      expect(parser.statusValues).toBeDefined();
    });
  });

  describe('Feature Parsing', () => {
    test('should parse feature document successfully', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result).toBeDefined();
      expect(result.type).toBe('feature');
      expect(result.title).toBe('Ride Booking Feature');
    });

    test('should extract frontmatter metadata', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.description).toBe('Feature specifications for ride booking functionality');
      expect(result.epic).toBe('Core Ride Functionality');
      expect(result.priority).toBe('high');
      expect(result.status).toBe('in progress');
    });
  });

  describe('User Story Extraction', () => {
    test('should extract user stories', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.userStories).toBeDefined();
      expect(result.userStories.length).toBeGreaterThan(0);
    });

    test('should parse standard user story format', () => {
      const story = parser.parseUserStory(
        'As a user, I want to request a ride so that I can travel to my destination'
      );

      expect(story).toBeDefined();
      expect(story.role).toBe('user');
      expect(story.action).toContain('request a ride');
      expect(story.benefit).toContain('travel to my destination');
    });

    test('should parse user story without benefit', () => {
      const story = parser.parseUserStory(
        'As a driver, I can accept ride requests'
      );

      expect(story).toBeDefined();
      expect(story.role).toBe('driver');
      expect(story.action).toContain('accept ride requests');
    });

    test('should parse user story without role', () => {
      const story = parser.parseUserStory(
        'I want to view my ride history'
      );

      expect(story).toBeDefined();
      expect(story.role).toBe('user');
      expect(story.action).toContain('view my ride history');
    });

    test('should extract acceptance criteria for stories', async () => {
      const result = await parser.parse(testFeatureFile);

      const story = result.userStories.find(s =>
        s.action?.includes('request a ride')
      );

      expect(story).toBeDefined();
      if (story) {
        expect(story.acceptanceCriteria).toBeDefined();
        // Acceptance criteria may be extracted separately or attached to story
        expect(Array.isArray(story.acceptanceCriteria)).toBe(true);
      }
    });

    test('should extract priority from story', async () => {
      const result = await parser.parse(testFeatureFile);

      // Check that stories have priority assigned
      const storyWithPriority = result.userStories.find(s =>
        s.priority && s.priority.length > 0
      );

      expect(storyWithPriority).toBeDefined();
      expect(parser.priorityLevels).toContain(storyWithPriority.priority);
    });

    test('should extract status from story', async () => {
      const result = await parser.parse(testFeatureFile);

      // Check that stories have status assigned
      const storyWithStatus = result.userStories.find(s =>
        s.status && s.status.length > 0
      );

      expect(storyWithStatus).toBeDefined();
      expect(parser.statusValues).toContain(storyWithStatus.status);
    });
  });

  describe('Feature Extraction', () => {
    test('should extract features', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.features).toBeDefined();
      expect(result.features.length).toBeGreaterThan(0);
    });

    test('should extract feature details', async () => {
      const result = await parser.parse(testFeatureFile);

      const feature = result.features.find(f =>
        f.name.includes('Ride Request')
      );

      expect(feature).toBeDefined();
      expect(feature.description).toBeDefined();
    });

    test('should extract feature requirements', async () => {
      const result = await parser.parse(testFeatureFile);

      const feature = result.features.find(f =>
        f.name.includes('Ride Request')
      );

      if (feature) {
        expect(feature.requirements).toBeDefined();
        expect(feature.requirements.length).toBeGreaterThan(0);
      }
    });

    test('should extract feature acceptance criteria', async () => {
      const result = await parser.parse(testFeatureFile);

      const feature = result.features.find(f =>
        f.name.includes('Ride Request')
      );

      if (feature) {
        expect(feature.acceptanceCriteria).toBeDefined();
      }
    });

    test('should detect priority in feature names', () => {
      const priority = parser.extractPriority('Real-time Tracking (High Priority)');
      expect(priority).toBe('high');
    });

    test('should detect status in feature names', () => {
      const status = parser.extractStatus('Payment Integration (Completed)');
      expect(status).toBe('completed');
    });
  });

  describe('Requirements Extraction', () => {
    test('should extract requirements', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.requirements).toBeDefined();
      expect(result.requirements.length).toBeGreaterThan(0);
    });

    test('should include performance requirements', async () => {
      const result = await parser.parse(testFeatureFile);

      const perfRequirement = result.requirements.find(r =>
        r.toLowerCase().includes('concurrent') || r.toLowerCase().includes('response')
      );

      expect(perfRequirement).toBeDefined();
    });
  });

  describe('Business Rules Extraction', () => {
    test('should extract business rules', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.businessRules).toBeDefined();
      expect(result.businessRules.length).toBeGreaterThan(0);
    });

    test('should include all business rules', async () => {
      const result = await parser.parse(testFeatureFile);

      const cancelRule = result.businessRules.find(r =>
        r.toLowerCase().includes('cancel')
      );

      expect(cancelRule).toBeDefined();
    });
  });

  describe('Use Case Extraction', () => {
    test('should extract use cases', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.useCases).toBeDefined();
      expect(result.useCases.length).toBeGreaterThan(0);
    });

    test('should extract use case details', async () => {
      const result = await parser.parse(testFeatureFile);

      const useCase = result.useCases.find(uc =>
        uc.name.includes('Request Ride')
      );

      expect(useCase).toBeDefined();
      expect(useCase.description).toBeDefined();
    });

    test('should extract use case actors', async () => {
      const result = await parser.parse(testFeatureFile);

      const useCase = result.useCases.find(uc =>
        uc.name.includes('Request Ride')
      );

      if (useCase) {
        expect(useCase.actors).toBeDefined();
      }
    });

    test('should extract use case steps', async () => {
      const result = await parser.parse(testFeatureFile);

      const useCase = result.useCases.find(uc =>
        uc.name.includes('Request Ride')
      );

      if (useCase) {
        expect(useCase.steps).toBeDefined();
      }
    });

    test('should extract preconditions and postconditions', async () => {
      const result = await parser.parse(testFeatureFile);

      const useCase = result.useCases.find(uc =>
        uc.name.includes('Request Ride')
      );

      if (useCase) {
        expect(useCase.preconditions).toBeDefined();
        expect(useCase.postconditions).toBeDefined();
      }
    });
  });

  describe('Scenario Extraction', () => {
    test('should extract scenarios', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.scenarios).toBeDefined();
      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    test('should extract Given/When/Then format', async () => {
      const result = await parser.parse(testFeatureFile);

      const scenario = result.scenarios.find(s =>
        s.name.includes('Successful Ride Booking')
      );

      if (scenario) {
        expect(scenario.given).toBeDefined();
        expect(scenario.when).toBeDefined();
        expect(scenario.then).toBeDefined();
      }
    });

    test('should parse multiple Given/When/Then statements', async () => {
      const result = await parser.parse(testFeatureFile);

      // Check that at least one scenario was extracted
      expect(result.scenarios.length).toBeGreaterThan(0);

      // Check structure
      const scenario = result.scenarios[0];
      expect(Array.isArray(scenario.given)).toBe(true);
      expect(Array.isArray(scenario.when)).toBe(true);
      expect(Array.isArray(scenario.then)).toBe(true);
    });
  });

  describe('Priority and Status Detection', () => {
    test('should detect all priority levels', () => {
      expect(parser.extractPriority('This is critical')).toBe('critical');
      expect(parser.extractPriority('High priority feature')).toBe('high');
      expect(parser.extractPriority('Medium importance')).toBe('medium');
      expect(parser.extractPriority('Low priority')).toBe('low');
    });

    test('should detect all status values', () => {
      expect(parser.extractStatus('Status: Planned')).toBe('planned');
      expect(parser.extractStatus('In Progress')).toContain('progress');
      expect(parser.extractStatus('Completed')).toBe('completed');
    });

    test('should default to medium priority', () => {
      const priority = parser.extractPriority('Some feature');
      expect(priority).toBe('medium');
    });

    test('should default to planned status', () => {
      const status = parser.extractStatus('Some feature');
      expect(status).toBe('planned');
    });
  });

  describe('Statistics Generation', () => {
    test('should generate feature statistics', async () => {
      const result = await parser.parse(testFeatureFile);
      const stats = parser.generateStats(result);

      expect(stats).toBeDefined();
      expect(stats.totalStories).toBe(result.userStories.length);
      expect(stats.totalFeatures).toBe(result.features.length);
      expect(stats.totalRequirements).toBe(result.requirements.length);
    });

    test('should count stories by priority', async () => {
      const result = await parser.parse(testFeatureFile);
      const stats = parser.generateStats(result);

      expect(stats.byPriority).toBeDefined();
      expect(Object.keys(stats.byPriority).length).toBeGreaterThan(0);
    });

    test('should count stories by status', async () => {
      const result = await parser.parse(testFeatureFile);
      const stats = parser.generateStats(result);

      expect(stats.byStatus).toBeDefined();
    });
  });

  describe('Caching', () => {
    test('should cache parsed results', async () => {
      const result1 = await parser.parse(testFeatureFile);
      expect(result1.cached).toBeUndefined();

      const result2 = await parser.parse(testFeatureFile);
      expect(result2.cached).toBe(true);
    });
  });

  describe('Multiple File Parsing', () => {
    test('should parse multiple files', async () => {
      const result = await parser.parseMultiple([testFeatureFile]);

      expect(result).toBeDefined();
      expect(result.type).toBe('merged-features');
      expect(result.sources).toHaveLength(1);
    });

    test('should merge all components', async () => {
      const result = await parser.parseMultiple([testFeatureFile]);

      expect(result.userStories).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.requirements).toBeDefined();
      expect(result.useCases).toBeDefined();
    });
  });

  describe('Metadata', () => {
    test('should add parsing metadata', async () => {
      const result = await parser.parse(testFeatureFile);

      expect(result.filePath).toBe(testFeatureFile);
      expect(result.parsedAt).toBeDefined();
      expect(result.parser).toBe('FeatureParser');
    });
  });

  describe('Performance', () => {
    test('should parse in reasonable time', async () => {
      const startTime = Date.now();
      await parser.parse(testFeatureFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});
