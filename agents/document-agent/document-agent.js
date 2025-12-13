/**
 * Document Agent - Main Entry Point
 *
 * Bidirectional Code ↔ Documentation Synchronization Engine
 * Orchestrates document parsing, code analysis, and digest generation
 * Integrates with EventBus for autonomous loop participation
 *
 * Architecture Pattern: Event-Driven Agent
 * Follows: Singleton pattern, EventBus integration
 *
 * Capabilities:
 * 1. Code → Docs: Parse code and update documentation (OpenAPI, CHANGELOG, etc.)
 * 2. Docs → Code: Parse docs and generate code digests for platform agents
 * 3. Validation: Ensure document quality and code-doc consistency
 * 4. Caching: Incremental parsing with DocumentCache
 */

import { createLogger } from '../../foundation/common/logger.js';

// Code Parsers
import { getBackendCodeParser } from './parsers/code-parser/backend-code-parser.js';
import { getDocumentVersioner } from './parsers/code-parser/document-versioner.js';
import { getBreakingChangeDetector } from './parsers/code-parser/breaking-change-detector.js';
import { getImpactAnalyzer } from './parsers/code-parser/impact-analyzer.js';
import { getOpenAPIUpdater } from './parsers/code-parser/openapi-updater.js';
import { getChangelogUpdater } from './parsers/code-parser/changelog-updater.js';
import { getIntegrationDocsUpdater } from './parsers/code-parser/integration-docs-updater.js';
import { getConflictDetector } from './parsers/code-parser/conflict-detector.js';

// Docs Parsers
import { getAPIParser } from './parsers/docs-parser/api-parser.js';
import { getFeatureParser } from './parsers/docs-parser/feature-parser.js';
import { getArchitectureParser } from './parsers/docs-parser/architecture-parser.js';
import { getReactParser } from './parsers/docs-parser/react-parser.js';
import { getFlutterParser } from './parsers/docs-parser/flutter-parser.js';

// Digest Generators
import { getBackendDigest } from './digest-generators/backend-digest.js';
import { getAdminDigest } from './digest-generators/admin-digest.js';
import { getUserDigest } from './digest-generators/user-digest.js';
import { getDriverDigest } from './digest-generators/driver-digest.js';

// Validators
import { getDocumentValidator } from './validators/document-validator.js';
import { getDigestValidator } from './validators/digest-validator.js';

// Cache
import { getDocumentCache } from './cache/DocumentCache.js';

const logger = createLogger('DocumentAgent');

// EventBus integration
let getEventBus, EventTypes;
try {
  const eventBusModule = await import('../../foundation/event-bus/AgentEventBus.js');
  const eventTypesModule = await import('../../foundation/event-bus/eventTypes.js');
  getEventBus = eventBusModule.getEventBus;
  EventTypes = eventTypesModule.EventTypes;
} catch (error) {
  // Fallback if foundation not available
  getEventBus = null;
  EventTypes = null;
}

/**
 * Document Agent
 * Main orchestrator for bidirectional code-documentation synchronization
 */
export class DocumentAgent {
  constructor() {
    this.logger = logger;
    this.initialized = false;

    // Code Parsers (Code → Docs Pipeline)
    this.backendCodeParser = getBackendCodeParser();
    this.documentVersioner = getDocumentVersioner();
    this.breakingChangeDetector = getBreakingChangeDetector();
    this.impactAnalyzer = getImpactAnalyzer();
    this.openAPIUpdater = getOpenAPIUpdater();
    this.changelogUpdater = getChangelogUpdater();
    this.integrationDocsUpdater = getIntegrationDocsUpdater();
    this.conflictDetector = getConflictDetector();

    // Docs Parsers (Docs → Code Pipeline)
    this.apiParser = getAPIParser();
    this.featureParser = getFeatureParser();
    this.architectureParser = getArchitectureParser();
    this.reactParser = getReactParser();
    this.flutterParser = getFlutterParser();

    // Digest Generators
    this.backendDigest = getBackendDigest();
    this.adminDigest = getAdminDigest();
    this.userDigest = getUserDigest();
    this.driverDigest = getDriverDigest();

    // Validators
    this.documentValidator = getDocumentValidator();
    this.digestValidator = getDigestValidator();

    // Cache
    this.cache = getDocumentCache();

    // EventBus integration
    this.eventBus = getEventBus ? getEventBus() : null;
    this.EventTypes = EventTypes;
    this.unsubscribers = [];

    if (this.eventBus) {
      this.subscribeToEvents();
    }
  }

  /**
   * Initialize the Document Agent
   */
  async initialize() {
    if (this.initialized) {
      this.logger.debug('Document Agent already initialized');
      return;
    }

    try {
      this.logger.info('Initializing Document Agent...');

      // Initialize cache
      if (!this.cache.initialized) {
        await this.cache.initialize();
      }

      // Initialize parsers
      await this.apiParser.initialize();
      await this.backendCodeParser.initialize();

      this.initialized = true;
      this.logger.info('Document Agent initialized successfully');

      // Publish initialization event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
          agent: 'document-agent',
          action: 'initialize',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Document Agent:', error);
      throw error;
    }
  }

  /**
   * Subscribe to EventBus events
   */
  subscribeToEvents() {
    // Listen for code generation events to update documentation
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.CODE_GENERATED,
        'document-agent',
        this.handleCodeGenerated.bind(this)
      )
    );

    // Listen for documentation update requests from Manager-Agent
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.AGENT_STARTED,
        'document-agent',
        this.handleDocumentRequest.bind(this)
      )
    );

    this.logger.info('Document-Agent subscribed to EventBus');
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this.logger.info('Document-Agent cleaned up event subscriptions');
  }

  /**
   * Handle code generation events to update documentation
   * @param {Object} data - Event data
   */
  async handleCodeGenerated(data) {
    // Check if this event is for us
    if (data.targetAgent && data.targetAgent !== 'document-agent') {
      return;
    }

    this.logger.info('Code generation detected, updating documentation...');

    try {
      // Publish agent started event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
          agent: 'document-agent',
          action: 'update-docs',
          trigger: 'code-generated',
          filesModified: data.filesModified || []
        });
      }

      const startTime = Date.now();

      // Execute code-to-docs pipeline
      const results = await this.updateDocsFromCode({
        files: data.filesModified || [],
        agent: data.agent
      });

      const duration = Date.now() - startTime;

      // Publish completion event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_COMPLETED, {
          agent: 'document-agent',
          action: 'update-docs',
          results,
          duration
        });
      }

      this.logger.info(`Documentation updated in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error updating documentation:', error);

      // Publish error event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_FAILED, {
          agent: 'document-agent',
          action: 'update-docs',
          error: error.message,
          stack: error.stack
        });
      }
    }
  }

  /**
   * Handle documentation-related requests from Manager-Agent
   * @param {Object} data - Event data
   */
  async handleDocumentRequest(data) {
    // Only process if this is a document-agent request
    if (data.agent !== 'document-agent') {
      return;
    }

    this.logger.info(`Received document request: ${data.action}`);

    try {
      let results;

      switch (data.action) {
        case 'parse-docs':
          results = await this.parseDocumentation(data.docPaths);
          break;
        case 'generate-digests':
          results = await this.generateDigests(data.parsedDocs);
          break;
        case 'validate-docs':
          results = await this.validateDocumentation(data.documents);
          break;
        case 'detect-conflicts':
          results = await this.detectConflicts(data.codePaths, data.docPaths);
          break;
        default:
          this.logger.warn(`Unknown action: ${data.action}`);
          return;
      }

      // Publish completion event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_COMPLETED, {
          agent: 'document-agent',
          action: data.action,
          results
        });
      }
    } catch (error) {
      this.logger.error(`Error handling ${data.action}:`, error);

      // Publish error event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_FAILED, {
          agent: 'document-agent',
          action: data.action,
          error: error.message
        });
      }
    }
  }

  /**
   * Code → Docs Pipeline
   * Parse code and update documentation (OpenAPI, CHANGELOG, integration docs)
   *
   * @param {Object} options - Update options
   * @param {string[]} options.files - Modified code files
   * @param {string} options.agent - Agent that generated the code
   * @returns {Promise<Object>} Update results
   */
  async updateDocsFromCode(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Starting Code → Docs pipeline...');

    const { files = [], agent = 'unknown' } = options;

    const results = {
      parsed: 0,
      updated: 0,
      breakingChanges: [],
      conflicts: [],
      updatedFiles: []
    };

    try {
      // 1. Parse backend code
      const backendFiles = files.filter(f => f.includes('/backend/') || f.includes('/src/'));

      if (backendFiles.length > 0) {
        const codeStructure = await this.backendCodeParser.parseMultiple(backendFiles);
        results.parsed = backendFiles.length;

        // 2. Analyze impact
        const impact = await this.impactAnalyzer.analyze(codeStructure);

        // 3. Detect breaking changes
        const breakingChanges = await this.breakingChangeDetector.detect(codeStructure);
        results.breakingChanges = breakingChanges;

        // 4. Update OpenAPI specification
        const openAPIResult = await this.openAPIUpdater.update(codeStructure);
        if (openAPIResult.updated) {
          results.updatedFiles.push(openAPIResult.file);
          results.updated++;
        }

        // 5. Update CHANGELOG
        const changelogResult = await this.changelogUpdater.update({
          codeStructure,
          breakingChanges,
          impact
        });
        if (changelogResult.updated) {
          results.updatedFiles.push(changelogResult.file);
          results.updated++;
        }

        // 6. Update integration documentation
        const integrationResult = await this.integrationDocsUpdater.update(codeStructure);
        if (integrationResult.updated) {
          results.updatedFiles.push(...integrationResult.files);
          results.updated += integrationResult.files.length;
        }

        // 7. Update document version
        await this.documentVersioner.version({
          files: results.updatedFiles,
          changes: breakingChanges,
          agent
        });

        // 8. Detect conflicts
        const conflicts = await this.conflictDetector.detect({
          codeStructure,
          documentPaths: results.updatedFiles
        });
        results.conflicts = conflicts;
      }

      this.logger.info(
        `Code → Docs pipeline complete: ${results.updated} documents updated, ` +
        `${results.breakingChanges.length} breaking changes detected`
      );

      return results;
    } catch (error) {
      this.logger.error('Error in Code → Docs pipeline:', error);
      throw error;
    }
  }

  /**
   * Docs → Code Pipeline
   * Parse documentation and generate code digests for platform agents
   *
   * @param {string[]} docPaths - Documentation file paths
   * @returns {Promise<Object>} Parsed documentation and generated digests
   */
  async parseDocumentation(docPaths) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Starting Docs → Code pipeline...');

    const results = {
      parsedDocs: {
        api: null,
        architecture: null,
        features: null,
        react: null,
        flutter: null
      },
      digests: {
        backend: null,
        admin: null,
        users: null,
        drivers: null
      },
      validation: {}
    };

    try {
      // 1. Parse documentation files
      for (const docPath of docPaths) {
        if (docPath.includes('api') || docPath.includes('openapi')) {
          results.parsedDocs.api = await this.apiParser.parse(docPath);
        } else if (docPath.includes('architecture')) {
          results.parsedDocs.architecture = await this.architectureParser.parse(docPath);
        } else if (docPath.includes('feature') || docPath.includes('requirements')) {
          results.parsedDocs.features = await this.featureParser.parse(docPath);
        } else if (docPath.includes('admin') || docPath.includes('react')) {
          results.parsedDocs.react = await this.reactParser.parse(docPath);
        } else if (docPath.includes('flutter') || docPath.includes('mobile')) {
          results.parsedDocs.flutter = await this.flutterParser.parse(docPath);
        }
      }

      // 2. Generate digests
      results.digests = await this.generateDigests(results.parsedDocs);

      // 3. Validate digests
      for (const [platform, digest] of Object.entries(results.digests)) {
        if (digest) {
          results.validation[platform] = await this.digestValidator.validate(digest);
        }
      }

      this.logger.info('Docs → Code pipeline complete');

      return results;
    } catch (error) {
      this.logger.error('Error in Docs → Code pipeline:', error);
      throw error;
    }
  }

  /**
   * Generate code digests from parsed documentation
   *
   * @param {Object} parsedDocs - Parsed documentation
   * @returns {Promise<Object>} Generated digests for each platform
   */
  async generateDigests(parsedDocs) {
    this.logger.info('Generating code digests...');

    const digests = {
      backend: null,
      admin: null,
      users: null,
      drivers: null
    };

    try {
      // Generate backend digest
      if (parsedDocs.api || parsedDocs.architecture || parsedDocs.features) {
        digests.backend = this.backendDigest.generate({
          api: parsedDocs.api,
          architecture: parsedDocs.architecture,
          features: parsedDocs.features
        });
      }

      // Generate admin digest (React)
      if (parsedDocs.react || parsedDocs.api) {
        digests.admin = this.adminDigest.generate({
          react: parsedDocs.react,
          api: parsedDocs.api,
          features: parsedDocs.features
        });
      }

      // Generate users digest (Flutter)
      if (parsedDocs.flutter || parsedDocs.api) {
        digests.users = this.userDigest.generate({
          flutter: parsedDocs.flutter,
          api: parsedDocs.api,
          features: parsedDocs.features
        });
      }

      // Generate drivers digest (Flutter)
      if (parsedDocs.flutter || parsedDocs.api) {
        digests.drivers = this.driverDigest.generate({
          flutter: parsedDocs.flutter,
          api: parsedDocs.api,
          features: parsedDocs.features
        });
      }

      this.logger.info('Code digests generated successfully');

      return digests;
    } catch (error) {
      this.logger.error('Error generating digests:', error);
      throw error;
    }
  }

  /**
   * Validate documentation quality
   *
   * @param {Array} documents - Documents to validate
   * @returns {Promise<Object>} Validation results
   */
  async validateDocumentation(documents) {
    this.logger.info(`Validating ${documents.length} document(s)...`);

    const results = {
      total: documents.length,
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      for (const doc of documents) {
        const validation = this.documentValidator.validate(doc);

        results.details.push({
          document: doc.metadata?.title || 'Untitled',
          valid: validation.valid,
          score: validation.score,
          errors: validation.errors,
          warnings: validation.warnings
        });

        if (validation.valid) {
          results.passed++;
        } else {
          results.failed++;
        }
      }

      this.logger.info(
        `Validation complete: ${results.passed}/${results.total} passed`
      );

      return results;
    } catch (error) {
      this.logger.error('Error validating documentation:', error);
      throw error;
    }
  }

  /**
   * Detect conflicts between code and documentation
   *
   * @param {string[]} codePaths - Code file paths
   * @param {string[]} docPaths - Documentation file paths
   * @returns {Promise<Object>} Conflict detection results
   */
  async detectConflicts(codePaths, docPaths) {
    this.logger.info('Detecting code-documentation conflicts...');

    try {
      // Parse code
      const codeStructure = await this.backendCodeParser.parseMultiple(codePaths);

      // Parse docs
      const parsedDocs = await this.parseDocumentation(docPaths);

      // Detect conflicts
      const conflicts = await this.conflictDetector.detect({
        codeStructure,
        parsedDocs: parsedDocs.parsedDocs
      });

      this.logger.info(`Found ${conflicts.length} conflict(s)`);

      return {
        conflicts,
        codeStructure,
        parsedDocs: parsedDocs.parsedDocs
      };
    } catch (error) {
      this.logger.error('Error detecting conflicts:', error);
      throw error;
    }
  }

  /**
   * Clear document cache
   */
  async clearCache() {
    this.logger.info('Clearing document cache...');
    await this.cache.clearAll();
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

/**
 * Get singleton instance
 */
let instance = null;

export function getDocumentAgent() {
  if (!instance) {
    instance = new DocumentAgent();
  }
  return instance;
}

export default DocumentAgent;
