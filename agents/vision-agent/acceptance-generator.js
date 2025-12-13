/**
 * Acceptance Criteria Generator
 * =============================
 * Auto-generates testable acceptance criteria for features, epics, and stories.
 * Uses templates and heuristics based on item type and category.
 */

import EventEmitter from 'events';

// Acceptance criteria formats
export const CriteriaFormat = {
  GIVEN_WHEN_THEN: 'given_when_then',
  SHOULD_BE_ABLE: 'should_be_able',
  CHECKLIST: 'checklist',
  USER_STORY: 'user_story'
};

// Criteria categories
export const CriteriaCategory = {
  FUNCTIONAL: 'functional',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  USABILITY: 'usability',
  ACCESSIBILITY: 'accessibility',
  COMPATIBILITY: 'compatibility',
  ERROR_HANDLING: 'error_handling'
};

export class AcceptanceGenerator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      defaultFormat: config.defaultFormat || CriteriaFormat.GIVEN_WHEN_THEN,
      includeNonFunctional: config.includeNonFunctional ?? true,
      maxCriteriaPerItem: config.maxCriteriaPerItem || 10,
      ...config
    };

    // Templates for different categories
    this.templates = this._initializeTemplates();

    // Common patterns that trigger specific criteria
    this.patterns = this._initializePatterns();
  }

  /**
   * Generate acceptance criteria for an item
   */
  async generate(item, itemType = 'feature') {
    const criteria = [];

    // Generate functional criteria based on item
    const functionalCriteria = this._generateFunctionalCriteria(item, itemType);
    criteria.push(...functionalCriteria);

    // Generate non-functional criteria if enabled
    if (this.config.includeNonFunctional) {
      const nonFunctionalCriteria = this._generateNonFunctionalCriteria(item, itemType);
      criteria.push(...nonFunctionalCriteria);
    }

    // Deduplicate and limit
    const uniqueCriteria = this._deduplicateCriteria(criteria);
    const limitedCriteria = uniqueCriteria.slice(0, this.config.maxCriteriaPerItem);

    // Add IDs and metadata
    return limitedCriteria.map((c, index) => ({
      id: `ac-${item.id}-${index + 1}`,
      ...c,
      itemId: item.id,
      itemType,
      generatedAt: new Date().toISOString()
    }));
  }

  /**
   * Generate functional acceptance criteria
   */
  _generateFunctionalCriteria(item, itemType) {
    const criteria = [];
    const name = item.name || '';
    const description = item.description || '';
    const text = `${name} ${description}`.toLowerCase();

    // Analyze item to determine appropriate criteria
    const analysis = this._analyzeItem(text);

    // Generate based on detected patterns
    if (analysis.hasUserAction) {
      criteria.push(...this._generateUserActionCriteria(item, analysis));
    }

    if (analysis.hasDataOperation) {
      criteria.push(...this._generateDataCriteria(item, analysis));
    }

    if (analysis.hasIntegration) {
      criteria.push(...this._generateIntegrationCriteria(item, analysis));
    }

    if (analysis.hasDisplay) {
      criteria.push(...this._generateDisplayCriteria(item, analysis));
    }

    // Add generic criteria if none generated
    if (criteria.length === 0) {
      criteria.push(...this._generateGenericCriteria(item, itemType));
    }

    return criteria;
  }

  /**
   * Generate non-functional acceptance criteria
   */
  _generateNonFunctionalCriteria(item, itemType) {
    const criteria = [];
    const text = `${item.name} ${item.description || ''}`.toLowerCase();

    // Performance criteria
    if (this._needsPerformanceCriteria(text)) {
      criteria.push(this._formatCriteria({
        category: CriteriaCategory.PERFORMANCE,
        criterion: `The ${item.name} should respond within acceptable time limits`,
        testable: 'Response time should be under 2 seconds for 95% of requests',
        priority: 'should'
      }));
    }

    // Security criteria
    if (this._needsSecurityCriteria(text)) {
      criteria.push(this._formatCriteria({
        category: CriteriaCategory.SECURITY,
        criterion: `The ${item.name} should implement proper security measures`,
        testable: 'Input validation, authentication, and authorization are enforced',
        priority: 'must'
      }));
    }

    // Error handling criteria
    criteria.push(this._formatCriteria({
      category: CriteriaCategory.ERROR_HANDLING,
      criterion: `The ${item.name} should handle errors gracefully`,
      testable: 'User receives meaningful error messages and system recovers gracefully',
      priority: 'should'
    }));

    // Usability criteria for UI features
    if (this._isUIFeature(text)) {
      criteria.push(this._formatCriteria({
        category: CriteriaCategory.USABILITY,
        criterion: `The ${item.name} should be intuitive and easy to use`,
        testable: 'User can complete the action without additional guidance',
        priority: 'should'
      }));
    }

    return criteria;
  }

  /**
   * Analyze item text for patterns
   */
  _analyzeItem(text) {
    return {
      hasUserAction: /click|submit|select|enter|choose|drag|drop|upload|download/i.test(text),
      hasDataOperation: /save|store|create|update|delete|edit|modify|add|remove/i.test(text),
      hasIntegration: /integrat|connect|sync|import|export|api|webhook/i.test(text),
      hasDisplay: /display|show|view|list|render|present|format/i.test(text),
      hasAuth: /auth|login|logout|register|password|permission|role/i.test(text),
      hasSearch: /search|find|filter|query|sort/i.test(text),
      hasNotification: /notif|alert|email|message|send/i.test(text),
      hasPayment: /pay|purchase|checkout|cart|order|invoice/i.test(text),
      hasFile: /upload|download|file|document|attachment|image/i.test(text)
    };
  }

  /**
   * Generate user action criteria
   */
  _generateUserActionCriteria(item, analysis) {
    const criteria = [];
    const name = item.name;

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.FUNCTIONAL,
      given: `a user with appropriate permissions`,
      when: `they attempt to ${name.toLowerCase()}`,
      then: `the action should complete successfully`,
      testable: `Verify the expected outcome occurs`,
      priority: 'must'
    }));

    if (analysis.hasAuth) {
      criteria.push(this._formatCriteria({
        category: CriteriaCategory.FUNCTIONAL,
        given: `an unauthenticated user`,
        when: `they attempt to ${name.toLowerCase()}`,
        then: `they should be redirected to login or shown an appropriate message`,
        testable: `Verify access is properly restricted`,
        priority: 'must'
      }));
    }

    return criteria;
  }

  /**
   * Generate data operation criteria
   */
  _generateDataCriteria(item, analysis) {
    const criteria = [];
    const name = item.name;

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.FUNCTIONAL,
      given: `valid input data`,
      when: `the ${name.toLowerCase()} operation is performed`,
      then: `the data should be persisted correctly`,
      testable: `Verify data is stored and retrievable`,
      priority: 'must'
    }));

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.FUNCTIONAL,
      given: `invalid input data`,
      when: `the ${name.toLowerCase()} operation is attempted`,
      then: `validation errors should be displayed`,
      testable: `Submit invalid data and verify error messages`,
      priority: 'must'
    }));

    return criteria;
  }

  /**
   * Generate integration criteria
   */
  _generateIntegrationCriteria(item, analysis) {
    const criteria = [];
    const name = item.name;

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.FUNCTIONAL,
      given: `the external service is available`,
      when: `the ${name.toLowerCase()} integration is triggered`,
      then: `data should be exchanged correctly`,
      testable: `Verify data flows correctly between systems`,
      priority: 'must'
    }));

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.ERROR_HANDLING,
      given: `the external service is unavailable`,
      when: `the ${name.toLowerCase()} integration is triggered`,
      then: `the system should handle the failure gracefully`,
      testable: `Simulate service failure and verify fallback behavior`,
      priority: 'should'
    }));

    return criteria;
  }

  /**
   * Generate display criteria
   */
  _generateDisplayCriteria(item, analysis) {
    const criteria = [];
    const name = item.name;

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.FUNCTIONAL,
      given: `data exists to display`,
      when: `the user views ${name.toLowerCase()}`,
      then: `the data should be displayed correctly`,
      testable: `Verify all expected data elements are shown`,
      priority: 'must'
    }));

    criteria.push(this._formatCriteria({
      category: CriteriaCategory.FUNCTIONAL,
      given: `no data exists`,
      when: `the user views ${name.toLowerCase()}`,
      then: `an appropriate empty state should be shown`,
      testable: `Verify empty state message is displayed`,
      priority: 'should'
    }));

    return criteria;
  }

  /**
   * Generate generic criteria
   */
  _generateGenericCriteria(item, itemType) {
    const name = item.name;

    return [
      this._formatCriteria({
        category: CriteriaCategory.FUNCTIONAL,
        criterion: `${name} should function as specified`,
        testable: `Verify the feature works according to requirements`,
        priority: 'must'
      }),
      this._formatCriteria({
        category: CriteriaCategory.FUNCTIONAL,
        criterion: `${name} should provide feedback on success/failure`,
        testable: `Verify appropriate feedback is shown to user`,
        priority: 'should'
      })
    ];
  }

  /**
   * Format criteria in configured format
   */
  _formatCriteria(data) {
    const format = this.config.defaultFormat;

    const base = {
      category: data.category || CriteriaCategory.FUNCTIONAL,
      priority: data.priority || 'should',
      testable: data.testable
    };

    switch (format) {
      case CriteriaFormat.GIVEN_WHEN_THEN:
        if (data.given && data.when && data.then) {
          return {
            ...base,
            format: CriteriaFormat.GIVEN_WHEN_THEN,
            given: data.given,
            when: data.when,
            then: data.then,
            description: `Given ${data.given}, when ${data.when}, then ${data.then}`
          };
        }
        // Fall through to default if GWT not available
        return {
          ...base,
          format: CriteriaFormat.CHECKLIST,
          description: data.criterion || data.then
        };

      case CriteriaFormat.SHOULD_BE_ABLE:
        return {
          ...base,
          format: CriteriaFormat.SHOULD_BE_ABLE,
          description: `User should be able to: ${data.criterion || data.then}`
        };

      case CriteriaFormat.USER_STORY:
        return {
          ...base,
          format: CriteriaFormat.USER_STORY,
          description: `As a user, I want ${data.criterion || data.then}`
        };

      case CriteriaFormat.CHECKLIST:
      default:
        return {
          ...base,
          format: CriteriaFormat.CHECKLIST,
          description: data.criterion || data.then || data.description
        };
    }
  }

  /**
   * Check if item needs performance criteria
   */
  _needsPerformanceCriteria(text) {
    return /search|list|load|fetch|query|report|export|import|large|bulk/i.test(text);
  }

  /**
   * Check if item needs security criteria
   */
  _needsSecurityCriteria(text) {
    return /auth|login|password|user|admin|permission|role|pay|personal|private|sensitive/i.test(text);
  }

  /**
   * Check if item is a UI feature
   */
  _isUIFeature(text) {
    return /ui|ux|page|view|screen|form|button|modal|component|display|show/i.test(text);
  }

  /**
   * Deduplicate criteria based on description similarity
   */
  _deduplicateCriteria(criteria) {
    const seen = new Set();
    const unique = [];

    for (const c of criteria) {
      const key = c.description?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }

    return unique;
  }

  /**
   * Initialize templates
   */
  _initializeTemplates() {
    return {
      crud: {
        create: [
          { given: 'valid data', when: 'create is submitted', then: 'item is created' },
          { given: 'invalid data', when: 'create is submitted', then: 'validation errors shown' },
          { given: 'duplicate data', when: 'create is submitted', then: 'duplicate error shown' }
        ],
        read: [
          { given: 'item exists', when: 'view is requested', then: 'item details are shown' },
          { given: 'item does not exist', when: 'view is requested', then: '404 error shown' }
        ],
        update: [
          { given: 'valid changes', when: 'update is submitted', then: 'item is updated' },
          { given: 'invalid changes', when: 'update is submitted', then: 'validation errors shown' }
        ],
        delete: [
          { given: 'item exists', when: 'delete is confirmed', then: 'item is removed' },
          { given: 'item has dependencies', when: 'delete is attempted', then: 'warning shown' }
        ]
      },
      auth: {
        login: [
          { given: 'valid credentials', when: 'login submitted', then: 'user is authenticated' },
          { given: 'invalid credentials', when: 'login submitted', then: 'error message shown' },
          { given: 'account locked', when: 'login attempted', then: 'lockout message shown' }
        ],
        logout: [
          { given: 'user is logged in', when: 'logout clicked', then: 'session is ended' }
        ]
      },
      search: [
        { given: 'matching items exist', when: 'search performed', then: 'results are displayed' },
        { given: 'no matching items', when: 'search performed', then: 'no results message shown' },
        { given: 'invalid search query', when: 'search performed', then: 'helpful message shown' }
      ]
    };
  }

  /**
   * Initialize patterns
   */
  _initializePatterns() {
    return {
      action: {
        create: /create|add|new|register|sign up/i,
        read: /view|show|display|get|fetch|list/i,
        update: /edit|update|modify|change/i,
        delete: /delete|remove|cancel/i
      },
      subject: {
        user: /user|account|profile/i,
        item: /item|product|record|entry/i,
        file: /file|document|image|upload/i,
        message: /message|notification|email/i
      }
    };
  }

  /**
   * Get templates for a specific pattern
   */
  getTemplatesFor(pattern) {
    return this.templates[pattern] || [];
  }
}

export default AcceptanceGenerator;
