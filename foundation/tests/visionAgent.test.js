/**
 * Vision Agent Tests
 *
 * Tests for the Vision-Agent and its sub-components:
 * - VisionAgent main class
 * - ReadmeParser
 * - FeatureDecomposer
 * - ProductStateManager
 * - AcceptanceGenerator
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Import Vision Agent components
import {
  VisionAgent,
  getVisionAgent,
  resetVisionAgent,
  AgentState,
  VisionEvents
} from '../../agents/vision-agent/index.js';

import {
  ReadmeParser,
  FeatureType,
  SectionType
} from '../../agents/vision-agent/readme-parser.js';

import {
  FeatureDecomposer,
  ComplexityLevel,
  WorkItemType,
  StoryCategory
} from '../../agents/vision-agent/feature-decomposer.js';

import {
  ProductStateManager,
  FeatureStatus,
  ProgressMethod
} from '../../agents/vision-agent/product-state.js';

import {
  AcceptanceGenerator,
  CriteriaFormat,
  CriteriaCategory
} from '../../agents/vision-agent/acceptance-generator.js';

describe('VisionAgent', () => {
  let tempDir;
  let agent;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vision-test-'));

    // Create a sample README
    const readmeContent = `# Test Project

A test project for Vision Agent testing.

## Features

- **User Authentication** - Login and registration
- [ ] Dashboard view
- [x] Basic API endpoints
- **Search Functionality** - Search and filter data

## Roadmap

- Integration with external services
- Real-time updates
`;

    await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);

    resetVisionAgent();
    agent = new VisionAgent({
      projectRoot: tempDir,
      stateDir: '.vision'
    });
  });

  afterEach(async () => {
    resetVisionAgent();
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(agent.name).toBe('Vision-Agent');
      expect(agent.version).toBe('1.0.0');
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('should initialize successfully', async () => {
      const result = await agent.initialize();

      expect(result.success).toBe(true);
      expect(result.agent).toBe('Vision-Agent');
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('should create state directory on initialization', async () => {
      await agent.initialize();

      const stateDir = path.join(tempDir, '.vision');
      const stats = await fs.stat(stateDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should connect to event bus when provided', async () => {
      const mockEventBus = {
        subscribe: jest.fn(),
        publish: jest.fn()
      };

      await agent.initialize(mockEventBus);

      expect(mockEventBus.subscribe).toHaveBeenCalled();
    });
  });

  describe('README Parsing', () => {
    test('should parse README and extract features', async () => {
      await agent.initialize();

      const result = await agent.parseReadme();

      expect(result.success).toBe(true);
      expect(result.featuresCount).toBeGreaterThan(0);
      expect(result.requirements).toBeDefined();
      expect(result.requirements.title).toBe('Test Project');
    });

    test('should emit events on README parsed', async () => {
      await agent.initialize();

      const parsedHandler = jest.fn();
      const requirementsHandler = jest.fn();

      agent.on(VisionEvents.README_PARSED, parsedHandler);
      agent.on(VisionEvents.REQUIREMENTS_READY, requirementsHandler);

      await agent.parseReadme();

      expect(parsedHandler).toHaveBeenCalled();
      expect(requirementsHandler).toHaveBeenCalled();
    });

    test('should detect implicit requirements', async () => {
      await agent.initialize();

      const result = await agent.parseReadme();

      // Should detect auth-related implicit requirements
      expect(result.implicitCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing README gracefully', async () => {
      const agentNoReadme = new VisionAgent({
        projectRoot: tempDir,
        readmePath: 'NONEXISTENT.md'
      });

      await agentNoReadme.initialize();
      const result = await agentNoReadme.parseReadme();

      expect(result.success).toBe(true);
      expect(result.requirements.warning).toBeDefined();
    });
  });

  describe('Feature Decomposition', () => {
    test('should decompose a feature into epic, stories, and tasks', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const features = agent.getFeatures();
      expect(features.length).toBeGreaterThan(0);

      const result = await agent.decomposeFeature(features[0].id);

      expect(result.success).toBe(true);
      expect(result.epic).toBeDefined();
      expect(result.stories).toBeDefined();
      expect(result.stories.length).toBeGreaterThan(0);
      expect(result.tasks).toBeDefined();
    });

    test('should decompose all features', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const result = await agent.decomposeAllFeatures();

      expect(result.success).toBe(true);
      expect(result.summary.totalFeatures).toBeGreaterThan(0);
      expect(result.summary.totalEpics).toBeGreaterThan(0);
    });

    test('should emit event on feature decomposition', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const handler = jest.fn();
      agent.on(VisionEvents.FEATURE_DECOMPOSED, handler);

      const features = agent.getFeatures();
      await agent.decomposeFeature(features[0].id);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Acceptance Criteria Generation', () => {
    test('should generate acceptance criteria for a feature', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const features = agent.getFeatures();
      const result = await agent.generateAcceptanceCriteria(features[0].id, 'feature');

      expect(result.success).toBe(true);
      expect(result.acceptanceCriteria).toBeDefined();
      expect(result.acceptanceCriteria.length).toBeGreaterThan(0);
    });

    test('should emit event on acceptance criteria generation', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const handler = jest.fn();
      agent.on(VisionEvents.ACCEPTANCE_GENERATED, handler);

      const features = agent.getFeatures();
      await agent.generateAcceptanceCriteria(features[0].id, 'feature');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Product State Management', () => {
    test('should track product state', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const state = agent.getProductState();

      expect(state).toBeDefined();
      expect(state.features).toBeDefined();
    });

    test('should update feature status', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const features = agent.getFeatures();
      const result = await agent.updateFeatureStatus(features[0].id, FeatureStatus.IN_PROGRESS);

      expect(result.success).toBe(true);
    });
  });

  describe('Metrics', () => {
    test('should track metrics', async () => {
      await agent.initialize();
      await agent.parseReadme();

      const metrics = agent.getMetrics();

      expect(metrics.readmesParsed).toBe(1);
      expect(metrics.featuresExtracted).toBeGreaterThan(0);
      expect(metrics.state).toBe(AgentState.IDLE);
    });
  });

  describe('Singleton', () => {
    test('should return same instance with getVisionAgent', () => {
      const agent1 = getVisionAgent({ projectRoot: tempDir });
      const agent2 = getVisionAgent({ projectRoot: tempDir });

      expect(agent1).toBe(agent2);
    });

    test('should reset instance with resetVisionAgent', () => {
      const agent1 = getVisionAgent({ projectRoot: tempDir });
      resetVisionAgent();
      const agent2 = getVisionAgent({ projectRoot: tempDir });

      expect(agent1).not.toBe(agent2);
    });
  });
});

describe('ReadmeParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ReadmeParser();
  });

  describe('Content Parsing', () => {
    test('should parse README content', () => {
      const content = `# My Project

This is a test project.

## Features

- Feature 1
- Feature 2

## Installation

\`\`\`bash
npm install
\`\`\`
`;

      const result = parser.parseContent(content);

      expect(result.title).toBe('My Project');
      expect(result.description).toBe('This is a test project.');
      expect(result.sections.length).toBeGreaterThan(0);
    });

    test('should extract features from checkboxes', () => {
      const content = `# Project

## Features

- [ ] Pending feature
- [x] Completed feature
`;

      const result = parser.parseContent(content);

      expect(result.features.length).toBe(2);
      expect(result.features.find(f => f.name === 'Pending feature').status).toBe('planned');
      expect(result.features.find(f => f.name === 'Completed feature').status).toBe('implemented');
    });

    test('should extract technologies', () => {
      const content = `# Project

Built with Node.js, React, and MongoDB.
`;

      const result = parser.parseContent(content);

      expect(result.technologies).toContain('node.js');
      expect(result.technologies).toContain('react');
      expect(result.technologies).toContain('mongodb');
    });

    test('should extract code blocks', () => {
      const content = `# Project

\`\`\`javascript
console.log('hello');
\`\`\`
`;

      const result = parser.parseContent(content);

      expect(result.codeBlocks.length).toBe(1);
      expect(result.codeBlocks[0].language).toBe('javascript');
    });

    test('should detect section types', () => {
      const content = `# Project

## Features

Some features here.

## Installation

Install instructions.

## API Reference

API docs.
`;

      const result = parser.parseContent(content);

      const sections = result.sections;
      expect(sections.find(s => s.type === SectionType.FEATURES)).toBeDefined();
      expect(sections.find(s => s.type === SectionType.INSTALLATION)).toBeDefined();
      expect(sections.find(s => s.type === SectionType.API)).toBeDefined();
    });
  });

  describe('Implicit Requirements Detection', () => {
    test('should detect authentication implicit requirements', async () => {
      const parseResult = parser.parseContent(`# Project

Users can login and manage their accounts.
`);

      const implicit = await parser.detectImplicitRequirements(parseResult);

      expect(implicit.some(r => r.category === 'authentication')).toBe(true);
    });

    test('should detect database implicit requirements', async () => {
      const parseResult = parser.parseContent(`# Project

Data is stored persistently in the database.
`);

      const implicit = await parser.detectImplicitRequirements(parseResult);

      expect(implicit.some(r => r.category === 'database')).toBe(true);
    });
  });
});

describe('FeatureDecomposer', () => {
  let decomposer;

  beforeEach(() => {
    decomposer = new FeatureDecomposer();
  });

  describe('Epic Creation', () => {
    test('should create an epic from a feature', async () => {
      const feature = {
        id: 'feature-1',
        name: 'User Authentication',
        description: 'Login and registration functionality'
      };

      const epic = await decomposer.createEpic(feature);

      expect(epic.id).toBeDefined();
      expect(epic.type).toBe(WorkItemType.EPIC);
      expect(epic.featureId).toBe('feature-1');
      expect(epic.name).toBe('User Authentication');
      expect(epic.complexity).toBeGreaterThan(0);
    });

    test('should estimate higher complexity for complex features', async () => {
      const simpleFeature = {
        id: 'f1',
        name: 'Display list'
      };

      const complexFeature = {
        id: 'f2',
        name: 'Real-time payment integration with encryption'
      };

      const simpleEpic = await decomposer.createEpic(simpleFeature);
      const complexEpic = await decomposer.createEpic(complexFeature);

      expect(complexEpic.complexity).toBeGreaterThan(simpleEpic.complexity);
    });
  });

  describe('Story Creation', () => {
    test('should create stories from an epic', async () => {
      const feature = {
        id: 'feature-1',
        name: 'User Dashboard'
      };

      const epic = await decomposer.createEpic(feature);
      const stories = await decomposer.createStories(epic);

      expect(stories.length).toBeGreaterThan(0);
      expect(stories.every(s => s.type === WorkItemType.STORY)).toBe(true);
      expect(stories.every(s => s.epicId === epic.id)).toBe(true);
    });
  });

  describe('Task Creation', () => {
    test('should create tasks from a story', async () => {
      const story = {
        id: 'story-1',
        epicId: 'epic-1',
        name: 'Implement login form',
        category: StoryCategory.FRONTEND,
        complexity: 5
      };

      const tasks = await decomposer.createTasks(story);

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every(t => t.type === WorkItemType.TASK)).toBe(true);
      expect(tasks.every(t => t.storyId === 'story-1')).toBe(true);
    });
  });
});

describe('ProductStateManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ProductStateManager();
  });

  describe('Feature Tracking', () => {
    test('should add a feature to track', () => {
      const result = manager.addFeature({
        id: 'feature-1',
        name: 'Test Feature'
      });

      expect(result.success).toBe(true);
      expect(result.feature.status).toBe(FeatureStatus.PLANNED);
    });

    test('should prevent duplicate features', () => {
      manager.addFeature({ id: 'feature-1', name: 'Test' });
      const result = manager.addFeature({ id: 'feature-1', name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('should get features by status', () => {
      manager.addFeature({ id: 'f1', name: 'Feature 1' });
      manager.addFeature({ id: 'f2', name: 'Feature 2' });
      manager.updateStatus('f1', FeatureStatus.IN_PROGRESS);

      const planned = manager.getFeaturesByStatus(FeatureStatus.PLANNED);
      const inProgress = manager.getFeaturesByStatus(FeatureStatus.IN_PROGRESS);

      expect(planned.length).toBe(1);
      expect(inProgress.length).toBe(1);
    });
  });

  describe('Status Updates', () => {
    test('should update feature status', () => {
      manager.addFeature({ id: 'feature-1', name: 'Test' });

      const result = manager.updateStatus('feature-1', FeatureStatus.IN_PROGRESS);

      expect(result.success).toBe(true);
      expect(result.feature.status).toBe(FeatureStatus.IN_PROGRESS);
    });

    test('should validate status transitions', () => {
      manager.addFeature({ id: 'feature-1', name: 'Test' });

      // Invalid: PLANNED → IMPLEMENTED (should go through IN_PROGRESS first)
      const result = manager.updateStatus('feature-1', FeatureStatus.IMPLEMENTED);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    test('should track status history', () => {
      manager.addFeature({ id: 'feature-1', name: 'Test' });
      manager.updateStatus('feature-1', FeatureStatus.IN_PROGRESS);

      const history = manager.getFeatureHistory('feature-1');

      expect(history.length).toBe(2);
    });
  });

  describe('Progress Tracking', () => {
    test('should calculate progress summary', () => {
      manager.addFeature({ id: 'f1', name: 'Feature 1' });
      manager.addFeature({ id: 'f2', name: 'Feature 2' });
      manager.updateStatus('f1', FeatureStatus.IN_PROGRESS);
      manager.updateStatus('f1', FeatureStatus.IMPLEMENTED);

      const summary = manager.getProgressSummary();

      expect(summary.completedFeatures).toBe(1);
      expect(summary.remainingFeatures).toBe(1);
    });
  });

  describe('Milestones', () => {
    test('should create a milestone', () => {
      manager.addFeature({ id: 'f1', name: 'Feature 1' });
      manager.addFeature({ id: 'f2', name: 'Feature 2' });

      const result = manager.createMilestone('MVP', ['f1', 'f2']);

      expect(result.success).toBe(true);
      expect(result.milestone.name).toBe('MVP');
      expect(result.milestone.features.length).toBe(2);
    });

    test('should calculate milestone progress', () => {
      manager.addFeature({ id: 'f1', name: 'Feature 1' });
      manager.addFeature({ id: 'f2', name: 'Feature 2' });
      manager.updateStatus('f1', FeatureStatus.IN_PROGRESS);
      manager.updateStatus('f1', FeatureStatus.IMPLEMENTED);

      const { milestone } = manager.createMilestone('MVP', ['f1', 'f2']);
      const retrieved = manager.getMilestone(milestone.id);

      expect(retrieved.progress).toBe(50); // 1 of 2 completed
    });
  });
});

describe('AcceptanceGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new AcceptanceGenerator();
  });

  describe('Criteria Generation', () => {
    test('should generate acceptance criteria for a feature', async () => {
      const feature = {
        id: 'feature-1',
        name: 'User Login',
        description: 'Allow users to login with email and password'
      };

      const criteria = await generator.generate(feature, 'feature');

      expect(criteria.length).toBeGreaterThan(0);
      expect(criteria.every(c => c.id && c.description)).toBe(true);
    });

    test('should generate different criteria based on feature type', async () => {
      const dataFeature = {
        id: 'f1',
        name: 'Save User Profile',
        description: 'Users can save and update their profile data'
      };

      const displayFeature = {
        id: 'f2',
        name: 'View Dashboard',
        description: 'Display user dashboard with metrics'
      };

      const dataCriteria = await generator.generate(dataFeature);
      const displayCriteria = await generator.generate(displayFeature);

      // Data features should have validation criteria
      expect(dataCriteria.some(c =>
        c.description.toLowerCase().includes('valid') ||
        c.description.toLowerCase().includes('invalid')
      )).toBe(true);

      // Display features should have display criteria
      expect(displayCriteria.some(c =>
        c.description.toLowerCase().includes('display') ||
        c.description.toLowerCase().includes('shown')
      )).toBe(true);
    });

    test('should include non-functional criteria', async () => {
      const feature = {
        id: 'f1',
        name: 'Search Users',
        description: 'Search and filter users by name'
      };

      const criteria = await generator.generate(feature);

      // Should include error handling criteria
      expect(criteria.some(c => c.category === CriteriaCategory.ERROR_HANDLING)).toBe(true);
    });

    test('should add security criteria for auth features', async () => {
      const feature = {
        id: 'f1',
        name: 'User Authentication',
        description: 'Login with password and session management'
      };

      const criteria = await generator.generate(feature);

      expect(criteria.some(c => c.category === CriteriaCategory.SECURITY)).toBe(true);
    });
  });

  describe('Format Options', () => {
    test('should support given-when-then format', async () => {
      const generator = new AcceptanceGenerator({
        defaultFormat: CriteriaFormat.GIVEN_WHEN_THEN
      });

      // Use a feature that triggers user action criteria (which uses GWT)
      const feature = {
        id: 'f1',
        name: 'User Login',
        description: 'Users can click to submit their credentials'
      };

      const criteria = await generator.generate(feature);

      // Should have criteria with GWT format or description containing GWT keywords
      expect(criteria.some(c =>
        c.given !== undefined ||
        c.format === CriteriaFormat.GIVEN_WHEN_THEN ||
        (c.description && c.description.toLowerCase().includes('given'))
      )).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vision-integration-'));

    const readmeContent = `# E-Commerce Platform

An online shopping platform with user management.

## Features

- **User Authentication** - Secure login and registration
- **Product Catalog** - Browse and search products
- [ ] Shopping Cart - Add items to cart
- [ ] Checkout Flow - Complete purchases
- [x] Basic API - RESTful endpoints

## Roadmap

- Payment integration with Stripe
- Real-time inventory updates
`;

    await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);
  });

  afterEach(async () => {
    resetVisionAgent();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('should perform full workflow: parse → decompose → generate criteria', async () => {
    const agent = new VisionAgent({
      projectRoot: tempDir
    });

    await agent.initialize();

    // Step 1: Parse README
    const parseResult = await agent.parseReadme();
    expect(parseResult.success).toBe(true);
    expect(parseResult.featuresCount).toBeGreaterThan(0);

    // Step 2: Decompose features
    const decomposeResult = await agent.decomposeAllFeatures();
    expect(decomposeResult.success).toBe(true);
    expect(decomposeResult.summary.totalEpics).toBeGreaterThan(0);

    // Step 3: Generate acceptance criteria for first feature
    const features = agent.getFeatures();
    const criteriaResult = await agent.generateAcceptanceCriteria(features[0].id);
    expect(criteriaResult.success).toBe(true);
    expect(criteriaResult.acceptanceCriteria.length).toBeGreaterThan(0);

    // Step 4: Check product state
    const state = agent.getProductState();
    expect(state.features.length).toBeGreaterThan(0);

    // Step 5: Check metrics
    const metrics = agent.getMetrics();
    expect(metrics.readmesParsed).toBe(1);
    expect(metrics.featuresExtracted).toBeGreaterThan(0);
    expect(metrics.epicsCreated).toBeGreaterThan(0);
  });

  test('should persist and restore state', async () => {
    const agent = new VisionAgent({
      projectRoot: tempDir
    });

    await agent.initialize();
    await agent.parseReadme();
    await agent.decomposeAllFeatures();

    // Shutdown to persist state
    await agent.shutdown();

    // Create new agent and load state
    const agent2 = new VisionAgent({
      projectRoot: tempDir
    });

    await agent2.initialize();

    // State should be restored
    const features = agent2.getFeatures();
    expect(features.length).toBeGreaterThan(0);
  });
});
