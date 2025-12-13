import matter from 'gray-matter';
import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('FeatureParser');

/**
 * FeatureParser - Parses feature specifications and requirements documentation
 *
 * Supports:
 * - User stories in various formats
 * - Feature specifications
 * - Acceptance criteria
 * - Use cases
 * - Business rules
 *
 * Output format: Structured feature digest with stories, requirements, rules
 */
class FeatureParser {
  constructor() {
    this.cache = getDocumentCache();
    this.logger = createLogger('FeatureParser');
    this.initialized = false;

    // User story patterns
    this.userStoryPattern = /^(?:as (?:a|an)\s+(.+?),?\s+)?(?:i want to|i need to|i can)\s+(.+?)(?:\s+so that\s+(.+))?$/i;

    // Priority levels
    this.priorityLevels = ['critical', 'high', 'medium', 'low', 'optional'];

    // Status values
    this.statusValues = ['planned', 'in progress', 'completed', 'cancelled', 'blocked'];
  }

  /**
   * Initialize the parser
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.initialized = true;
    this.logger.info('FeatureParser initialized');
  }

  /**
   * Parse a feature documentation file
   *
   * @param {string} filePath - Path to the feature documentation file
   * @returns {Promise<Object>} Parsed feature digest
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
        type: 'feature',
        title: frontmatter.title || path.basename(filePath, '.md'),
        description: frontmatter.description || '',
        epic: frontmatter.epic || '',
        priority: frontmatter.priority || 'medium',
        status: frontmatter.status || 'planned',

        // Feature components
        userStories: [],
        features: [],
        requirements: [],
        acceptanceCriteria: [],
        businessRules: [],
        useCases: [],
        scenarios: [],

        // Metadata
        filePath,
        parsedAt: new Date().toISOString(),
        parser: 'FeatureParser'
      };

      // Parse markdown content
      const tokens = marked.lexer(markdown);
      await this.extractFeatureInfo(tokens, result);

      // Cache the result
      await this.cache.set(filePath, result);

      this.logger.info(
        `Parsed ${filePath}: ${result.userStories.length} stories, ` +
        `${result.features.length} features`
      );

      return result;

    } catch (error) {
      this.logger.error(`Failed to parse ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract feature information from markdown tokens
   */
  async extractFeatureInfo(tokens, result) {
    let currentSection = null;
    let currentFeature = null;
    let currentStory = null;
    let currentUseCase = null;
    let currentScenario = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        const text = token.text;
        const textLower = text.toLowerCase();
        const level = token.depth;

        // Save previous feature
        if (currentFeature) {
          result.features.push(currentFeature);
          currentFeature = null;
        }

        // Save previous story
        if (currentStory) {
          result.userStories.push(currentStory);
          currentStory = null;
        }

        // Save previous use case
        if (currentUseCase) {
          result.useCases.push(currentUseCase);
          currentUseCase = null;
        }

        // Save previous scenario
        if (currentScenario) {
          result.scenarios.push(currentScenario);
          currentScenario = null;
        }

        // Detect section types
        if (level === 1 || level === 2) {
          if (textLower.includes('user stor')) {
            currentSection = 'userStories';
          } else if (textLower.includes('feature')) {
            currentSection = 'features';
          } else if (textLower.includes('requirement')) {
            currentSection = 'requirements';
          } else if (textLower.includes('acceptance') || textLower.includes('criteria')) {
            currentSection = 'acceptanceCriteria';
          } else if (textLower.includes('business rule')) {
            currentSection = 'businessRules';
          } else if (textLower.includes('use case')) {
            currentSection = 'useCases';
          } else if (textLower.includes('scenario')) {
            currentSection = 'scenarios';
          }
        }

        // Extract features (level 3)
        if (level === 3 && currentSection === 'features') {
          currentFeature = {
            name: text,
            description: '',
            priority: this.extractPriority(text),
            status: this.extractStatus(text),
            requirements: [],
            acceptanceCriteria: []
          };
        }

        // Extract user stories (level 3)
        if (level === 3 && currentSection === 'userStories') {
          const storyMatch = this.parseUserStory(text);
          if (storyMatch) {
            currentStory = storyMatch;
          } else {
            currentStory = {
              title: text,
              role: '',
              action: '',
              benefit: '',
              acceptanceCriteria: [],
              priority: this.extractPriority(text),
              status: this.extractStatus(text)
            };
          }
        }

        // Extract use cases (level 3)
        if (level === 3 && currentSection === 'useCases') {
          currentUseCase = {
            name: text,
            description: '',
            actors: [],
            preconditions: [],
            steps: [],
            postconditions: []
          };
        }

        // Extract scenarios (level 3)
        if (level === 3 && currentSection === 'scenarios') {
          currentScenario = {
            name: text,
            description: '',
            given: [],
            when: [],
            then: []
          };
        }

      } else if (token.type === 'paragraph') {
        const text = token.text;

        // Try to parse as user story
        const storyMatch = this.parseUserStory(text);
        if (storyMatch && currentSection === 'userStories' && !currentStory) {
          result.userStories.push(storyMatch);
        }

        // Add to current feature description
        if (currentFeature && !currentFeature.description) {
          currentFeature.description = text;
        }

        // Add to current story description/details
        if (currentStory && !currentStory.action && !storyMatch) {
          const storyInText = this.parseUserStory(text);
          if (storyInText) {
            currentStory.role = storyInText.role;
            currentStory.action = storyInText.action;
            currentStory.benefit = storyInText.benefit;
          }
        }

        // Add to current use case description
        if (currentUseCase && !currentUseCase.description) {
          currentUseCase.description = text;
        }

        // Add to current scenario description
        if (currentScenario && !currentScenario.description) {
          currentScenario.description = text;
        }

        // Parse Given/When/Then for scenarios
        if (currentScenario) {
          if (text.toLowerCase().startsWith('given ')) {
            currentScenario.given.push(text.substring(6).trim());
          } else if (text.toLowerCase().startsWith('when ')) {
            currentScenario.when.push(text.substring(5).trim());
          } else if (text.toLowerCase().startsWith('then ')) {
            currentScenario.then.push(text.substring(5).trim());
          }
        }

      } else if (token.type === 'list') {
        const listItems = token.items.map(item => item.text);

        // Add to appropriate section
        if (currentSection === 'requirements') {
          result.requirements.push(...listItems);
        } else if (currentSection === 'acceptanceCriteria') {
          if (currentFeature) {
            currentFeature.acceptanceCriteria.push(...listItems);
          } else if (currentStory) {
            currentStory.acceptanceCriteria.push(...listItems);
          } else {
            result.acceptanceCriteria.push(...listItems);
          }
        } else if (currentSection === 'businessRules') {
          result.businessRules.push(...listItems);
        } else if (currentFeature) {
          // Add to current feature requirements
          currentFeature.requirements.push(...listItems);
        } else if (currentUseCase) {
          // Check for specific use case sections
          const firstItem = listItems[0]?.toLowerCase() || '';
          if (firstItem.includes('actor') || firstItem.includes('role')) {
            currentUseCase.actors.push(...listItems);
          } else if (firstItem.includes('precondition')) {
            currentUseCase.preconditions.push(...listItems);
          } else if (firstItem.includes('postcondition')) {
            currentUseCase.postconditions.push(...listItems);
          } else {
            currentUseCase.steps.push(...listItems);
          }
        } else if (currentScenario) {
          // Parse Given/When/Then from list items
          for (const item of listItems) {
            const itemLower = item.toLowerCase();
            if (itemLower.startsWith('given ')) {
              currentScenario.given.push(item.substring(6).trim());
            } else if (itemLower.startsWith('when ')) {
              currentScenario.when.push(item.substring(5).trim());
            } else if (itemLower.startsWith('then ')) {
              currentScenario.then.push(item.substring(5).trim());
            }
          }
        }
      }
    }

    // Save last items
    if (currentFeature) {
      result.features.push(currentFeature);
    }
    if (currentStory) {
      result.userStories.push(currentStory);
    }
    if (currentUseCase) {
      result.useCases.push(currentUseCase);
    }
    if (currentScenario) {
      result.scenarios.push(currentScenario);
    }
  }

  /**
   * Parse user story from text
   * Supports formats:
   * - "As a [role], I want to [action] so that [benefit]"
   * - "As a [role], I can [action]"
   * - "I want to [action] so that [benefit]"
   */
  parseUserStory(text) {
    const match = text.match(this.userStoryPattern);

    if (match) {
      return {
        role: match[1] || 'user',
        action: match[2].trim(),
        benefit: match[3]?.trim() || '',
        acceptanceCriteria: [],
        priority: this.extractPriority(text),
        status: this.extractStatus(text)
      };
    }

    return null;
  }

  /**
   * Extract priority from text
   */
  extractPriority(text) {
    const textLower = text.toLowerCase();

    for (const priority of this.priorityLevels) {
      if (textLower.includes(priority)) {
        return priority;
      }
    }

    return 'medium';
  }

  /**
   * Extract status from text
   */
  extractStatus(text) {
    const textLower = text.toLowerCase();

    for (const status of this.statusValues) {
      if (textLower.includes(status)) {
        return status;
      }
    }

    return 'planned';
  }

  /**
   * Parse multiple feature files and merge results
   *
   * @param {string[]} filePaths - Array of file paths to parse
   * @returns {Promise<Object>} Merged feature digest
   */
  async parseMultiple(filePaths) {
    const results = await Promise.all(
      filePaths.map(filePath => this.parse(filePath))
    );

    const merged = {
      type: 'merged-features',
      sources: filePaths,
      userStories: [],
      features: [],
      requirements: [],
      acceptanceCriteria: [],
      businessRules: [],
      useCases: [],
      scenarios: [],
      parsedAt: new Date().toISOString()
    };

    for (const result of results) {
      merged.userStories.push(...(result.userStories || []));
      merged.features.push(...(result.features || []));
      merged.requirements.push(...(result.requirements || []));
      merged.acceptanceCriteria.push(...(result.acceptanceCriteria || []));
      merged.businessRules.push(...(result.businessRules || []));
      merged.useCases.push(...(result.useCases || []));
      merged.scenarios.push(...(result.scenarios || []));
    }

    return merged;
  }

  /**
   * Generate feature summary statistics
   */
  generateStats(result) {
    const stats = {
      totalStories: result.userStories.length,
      totalFeatures: result.features.length,
      totalRequirements: result.requirements.length,
      totalUseCases: result.useCases.length,
      totalScenarios: result.scenarios.length,

      byPriority: {},
      byStatus: {}
    };

    // Count by priority
    for (const story of result.userStories) {
      const priority = story.priority || 'medium';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
    }

    // Count by status
    for (const story of result.userStories) {
      const status = story.status || 'planned';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of FeatureParser
 * @returns {FeatureParser}
 */
export function getFeatureParser() {
  if (!instance) {
    instance = new FeatureParser();
  }
  return instance;
}

export { FeatureParser };
export default FeatureParser;
