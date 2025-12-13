/**
 * Feature Decomposition Engine
 * ============================
 * Decomposes features into Epics → Stories → Tasks
 * Estimates complexity and identifies dependencies.
 */

import EventEmitter from 'events';

// Complexity levels (Fibonacci-like for estimation)
export const ComplexityLevel = {
  TRIVIAL: 1,
  SIMPLE: 2,
  MODERATE: 3,
  COMPLEX: 5,
  VERY_COMPLEX: 8,
  EPIC: 13
};

// Work item types
export const WorkItemType = {
  EPIC: 'EPIC',
  STORY: 'STORY',
  TASK: 'TASK',
  BUG: 'BUG',
  SPIKE: 'SPIKE'
};

// Story categories
export const StoryCategory = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DATABASE: 'database',
  INTEGRATION: 'integration',
  TESTING: 'testing',
  DEVOPS: 'devops',
  DOCUMENTATION: 'documentation'
};

export class FeatureDecomposer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      complexityThresholds: config.complexityThresholds || {
        simple: 3,    // <= 3 points = simple
        medium: 8,    // 4-8 points = medium
        complex: 13   // > 8 points = complex
      },
      maxTasksPerStory: config.maxTasksPerStory || 10,
      maxStoriesPerEpic: config.maxStoriesPerEpic || 15,
      ...config
    };

    // Complexity indicators
    this.complexityIndicators = {
      high: [
        /integrat/i, /real-?time/i, /security/i, /auth/i, /payment/i,
        /encrypt/i, /scale/i, /distributed/i, /microservice/i,
        /machine\s*learning/i, /ai\b/i, /complex/i
      ],
      medium: [
        /api/i, /database/i, /cache/i, /upload/i, /download/i,
        /search/i, /filter/i, /sort/i, /paginate/i, /validate/i,
        /email/i, /notification/i
      ],
      low: [
        /display/i, /show/i, /list/i, /view/i, /style/i, /format/i,
        /document/i, /readme/i, /comment/i, /log/i
      ]
    };

    // Dependency keywords
    this.dependencyKeywords = {
      requires: ['requires', 'depends on', 'needs', 'after'],
      blocks: ['blocks', 'before', 'prerequisite for'],
      related: ['related to', 'similar to', 'see also']
    };

    // Story templates per category
    this.storyTemplates = {
      [StoryCategory.FRONTEND]: [
        'Design UI/UX for {feature}',
        'Implement {feature} component',
        'Add {feature} state management',
        'Create {feature} unit tests'
      ],
      [StoryCategory.BACKEND]: [
        'Design API for {feature}',
        'Implement {feature} service',
        'Add {feature} validation',
        'Create {feature} tests'
      ],
      [StoryCategory.DATABASE]: [
        'Design {feature} data model',
        'Create {feature} migrations',
        'Implement {feature} repository',
        'Add {feature} indexes/optimization'
      ],
      [StoryCategory.INTEGRATION]: [
        'Research {feature} integration options',
        'Implement {feature} connector',
        'Handle {feature} error cases',
        'Test {feature} integration'
      ],
      [StoryCategory.TESTING]: [
        'Write {feature} unit tests',
        'Write {feature} integration tests',
        'Create {feature} E2E tests',
        'Add {feature} to CI pipeline'
      ],
      [StoryCategory.DEVOPS]: [
        'Configure {feature} infrastructure',
        'Set up {feature} deployment',
        'Add {feature} monitoring',
        'Document {feature} runbook'
      ]
    };
  }

  /**
   * Create an Epic from a feature
   */
  async createEpic(feature, options = {}) {
    const id = `epic-${feature.id}-${Date.now()}`;

    // Determine categories this epic touches
    const categories = this._determineCategories(feature);

    // Estimate complexity
    const complexity = this._estimateComplexity(feature);

    // Identify dependencies
    const dependencies = this._identifyDependencies(feature, options.existingFeatures || []);

    const epic = {
      id,
      type: WorkItemType.EPIC,
      featureId: feature.id,
      name: feature.name,
      description: feature.description || `Implement ${feature.name}`,
      categories,
      complexity,
      complexityLevel: this._getComplexityLevel(complexity),
      dependencies,
      status: 'planned',
      stories: [],
      metadata: {
        source: feature.source,
        createdAt: new Date().toISOString(),
        estimatedEffort: this._estimateEffort(complexity)
      }
    };

    // Emit warning if complexity is high
    if (complexity >= this.config.complexityThresholds.complex) {
      this.emit('complexity:high', {
        epic: epic.id,
        complexity,
        recommendation: 'Consider breaking this epic into smaller features'
      });
    }

    return epic;
  }

  /**
   * Create Stories from an Epic
   */
  async createStories(epic, options = {}) {
    const stories = [];
    let storyIndex = 0;

    // Generate stories for each category
    for (const category of epic.categories) {
      const categoryStories = this._generateCategoryStories(
        epic,
        category,
        storyIndex,
        options
      );

      stories.push(...categoryStories);
      storyIndex += categoryStories.length;
    }

    // Limit stories per epic
    const limitedStories = stories.slice(0, this.config.maxStoriesPerEpic);

    if (stories.length > this.config.maxStoriesPerEpic) {
      this.emit('warning', {
        message: `Epic ${epic.id} generated ${stories.length} stories, limited to ${this.config.maxStoriesPerEpic}`
      });
    }

    // Update epic with story references
    epic.stories = limitedStories.map(s => s.id);

    return limitedStories;
  }

  /**
   * Create Tasks from a Story
   */
  async createTasks(story, options = {}) {
    const tasks = [];

    // Generate tasks based on story category and complexity
    const taskTemplates = this._getTaskTemplates(story.category);

    for (let i = 0; i < taskTemplates.length; i++) {
      const template = taskTemplates[i];
      const taskComplexity = Math.ceil(story.complexity / taskTemplates.length);

      tasks.push({
        id: `task-${story.id}-${i + 1}`,
        type: WorkItemType.TASK,
        storyId: story.id,
        epicId: story.epicId,
        name: template.replace('{story}', story.name),
        description: `Part of: ${story.name}`,
        category: story.category,
        complexity: taskComplexity,
        status: 'pending',
        metadata: {
          createdAt: new Date().toISOString(),
          estimatedHours: taskComplexity * 2 // Rough estimate
        }
      });
    }

    // Limit tasks per story
    const limitedTasks = tasks.slice(0, this.config.maxTasksPerStory);

    // Update story with task references
    story.tasks = limitedTasks.map(t => t.id);

    return limitedTasks;
  }

  /**
   * Determine which categories a feature touches
   */
  _determineCategories(feature) {
    const categories = new Set();
    const text = `${feature.name} ${feature.description || ''}`.toLowerCase();

    // Frontend indicators
    if (/ui|ux|component|page|view|display|interface|button|form|modal|style|css/i.test(text)) {
      categories.add(StoryCategory.FRONTEND);
    }

    // Backend indicators
    if (/api|service|endpoint|controller|logic|process|calculate|validate/i.test(text)) {
      categories.add(StoryCategory.BACKEND);
    }

    // Database indicators
    if (/database|db|store|persist|model|schema|migration|query|table/i.test(text)) {
      categories.add(StoryCategory.DATABASE);
    }

    // Integration indicators
    if (/integrat|connect|external|third-?party|import|export|sync/i.test(text)) {
      categories.add(StoryCategory.INTEGRATION);
    }

    // DevOps indicators
    if (/deploy|docker|ci|cd|pipeline|kubernetes|infra|monitor/i.test(text)) {
      categories.add(StoryCategory.DEVOPS);
    }

    // Default: assume at least backend and frontend
    if (categories.size === 0) {
      categories.add(StoryCategory.BACKEND);
      categories.add(StoryCategory.FRONTEND);
    }

    // Always include testing
    categories.add(StoryCategory.TESTING);

    return Array.from(categories);
  }

  /**
   * Estimate complexity of a feature
   */
  _estimateComplexity(feature) {
    let complexity = ComplexityLevel.MODERATE; // Base complexity
    const text = `${feature.name} ${feature.description || ''}`.toLowerCase();

    // Check high complexity indicators
    for (const pattern of this.complexityIndicators.high) {
      if (pattern.test(text)) {
        complexity += 3;
      }
    }

    // Check medium complexity indicators
    for (const pattern of this.complexityIndicators.medium) {
      if (pattern.test(text)) {
        complexity += 1;
      }
    }

    // Check low complexity indicators (reduce complexity)
    let lowMatches = 0;
    for (const pattern of this.complexityIndicators.low) {
      if (pattern.test(text)) {
        lowMatches++;
      }
    }
    if (lowMatches > 2 && complexity > ComplexityLevel.SIMPLE) {
      complexity -= 2;
    }

    // Factor in feature type
    if (feature.type === 'ENHANCEMENT') {
      complexity = Math.max(complexity - 1, ComplexityLevel.TRIVIAL);
    } else if (feature.type === 'INFRASTRUCTURE') {
      complexity += 2;
    }

    // Cap complexity
    return Math.min(Math.max(complexity, ComplexityLevel.TRIVIAL), ComplexityLevel.EPIC);
  }

  /**
   * Get complexity level label
   */
  _getComplexityLevel(complexity) {
    if (complexity <= this.config.complexityThresholds.simple) {
      return 'simple';
    } else if (complexity <= this.config.complexityThresholds.medium) {
      return 'medium';
    }
    return 'complex';
  }

  /**
   * Estimate effort based on complexity
   */
  _estimateEffort(complexity) {
    // Rough mapping: complexity points to effort categories
    if (complexity <= 3) return 'hours';
    if (complexity <= 8) return 'days';
    return 'weeks';
  }

  /**
   * Identify dependencies from feature text
   */
  _identifyDependencies(feature, existingFeatures) {
    const dependencies = {
      requires: [],
      blocks: [],
      related: []
    };

    const text = `${feature.name} ${feature.description || ''}`.toLowerCase();

    // Check for dependency keywords
    for (const [type, keywords] of Object.entries(this.dependencyKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          // Try to find referenced feature
          const match = this._findReferencedFeature(text, keyword, existingFeatures);
          if (match && !dependencies[type].includes(match.id)) {
            dependencies[type].push(match.id);
          }
        }
      }
    }

    // Infer implicit dependencies based on category
    if (/api|endpoint/i.test(text)) {
      const dbFeature = existingFeatures.find(f =>
        /database|model|schema/i.test(f.name)
      );
      if (dbFeature && !dependencies.requires.includes(dbFeature.id)) {
        dependencies.requires.push(dbFeature.id);
      }
    }

    return dependencies;
  }

  /**
   * Find feature referenced in text
   */
  _findReferencedFeature(text, keyword, features) {
    const keywordIndex = text.indexOf(keyword);
    if (keywordIndex === -1) return null;

    // Look for feature name after keyword
    const afterKeyword = text.slice(keywordIndex + keyword.length);

    for (const feature of features) {
      const featureNameLower = feature.name.toLowerCase();
      if (afterKeyword.includes(featureNameLower)) {
        return feature;
      }
    }

    return null;
  }

  /**
   * Generate stories for a specific category
   */
  _generateCategoryStories(epic, category, startIndex, options) {
    const stories = [];
    const templates = this.storyTemplates[category] || [];

    // Adjust number of stories based on complexity
    const numStories = Math.min(
      Math.ceil(epic.complexity / 3),
      templates.length
    );

    for (let i = 0; i < numStories; i++) {
      const template = templates[i];
      const storyComplexity = Math.ceil(epic.complexity / numStories);

      stories.push({
        id: `story-${epic.id}-${startIndex + i + 1}`,
        type: WorkItemType.STORY,
        epicId: epic.id,
        featureId: epic.featureId,
        name: template.replace('{feature}', epic.name),
        description: `Story for ${epic.name} (${category})`,
        category,
        complexity: storyComplexity,
        complexityLevel: this._getComplexityLevel(storyComplexity),
        status: 'planned',
        tasks: [],
        acceptanceCriteria: [],
        metadata: {
          createdAt: new Date().toISOString(),
          estimatedEffort: this._estimateEffort(storyComplexity)
        }
      });
    }

    return stories;
  }

  /**
   * Get task templates for a category
   */
  _getTaskTemplates(category) {
    const templates = {
      [StoryCategory.FRONTEND]: [
        'Create component structure for {story}',
        'Implement UI logic for {story}',
        'Add styles/CSS for {story}',
        'Write unit tests for {story}',
        'Handle edge cases for {story}'
      ],
      [StoryCategory.BACKEND]: [
        'Define interfaces for {story}',
        'Implement business logic for {story}',
        'Add input validation for {story}',
        'Handle errors for {story}',
        'Write unit tests for {story}'
      ],
      [StoryCategory.DATABASE]: [
        'Design schema for {story}',
        'Create migration for {story}',
        'Implement queries for {story}',
        'Add indexes for {story}',
        'Test data operations for {story}'
      ],
      [StoryCategory.INTEGRATION]: [
        'Research options for {story}',
        'Implement client for {story}',
        'Handle authentication for {story}',
        'Add error handling for {story}',
        'Test integration for {story}'
      ],
      [StoryCategory.TESTING]: [
        'Set up test fixtures for {story}',
        'Write test cases for {story}',
        'Add mocks/stubs for {story}',
        'Run and verify {story}'
      ],
      [StoryCategory.DEVOPS]: [
        'Configure environment for {story}',
        'Set up deployment for {story}',
        'Add monitoring for {story}',
        'Document operations for {story}'
      ],
      [StoryCategory.DOCUMENTATION]: [
        'Write documentation for {story}',
        'Add code examples for {story}',
        'Review and finalize {story}'
      ]
    };

    return templates[category] || templates[StoryCategory.BACKEND];
  }

  /**
   * Re-estimate complexity after decomposition
   */
  recalculateComplexity(epic) {
    // Sum of story complexities
    let totalComplexity = 0;

    // This would need the stories to be passed in
    // For now, return the original estimate
    return epic.complexity;
  }
}

export default FeatureDecomposer;
