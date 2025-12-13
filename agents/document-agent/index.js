/**
 * Document Agent - Main Entry Point
 *
 * Phase 2: Document-Agent
 * Bidirectional Code ↔ Documentation Synchronization Engine
 *
 * Exports:
 * - Main DocumentAgent orchestrator
 * - Code parsers (Code → Docs pipeline)
 * - Docs parsers (Docs → Code pipeline)
 * - Digest generators
 * - Validators
 * - Cache system
 */

export { DocumentAgent, getDocumentAgent } from './document-agent.js';

// Default export
export { default } from './document-agent.js';

// Foundation exports (for consistency with other agents)
export { BaseAnalyzer, SEVERITY, CATEGORY } from '../../foundation/analyzers/index.js';

// Code Parsers (Code → Docs Pipeline)
export { BackendCodeParser, getBackendCodeParser } from './parsers/code-parser/backend-code-parser.js';
export { DocumentVersioner, getDocumentVersioner } from './parsers/code-parser/document-versioner.js';
export { BreakingChangeDetector, getBreakingChangeDetector } from './parsers/code-parser/breaking-change-detector.js';
export { ImpactAnalyzer, getImpactAnalyzer } from './parsers/code-parser/impact-analyzer.js';
export { OpenAPIUpdater, getOpenAPIUpdater } from './parsers/code-parser/openapi-updater.js';
export { ChangelogUpdater, getChangelogUpdater } from './parsers/code-parser/changelog-updater.js';
export { IntegrationDocsUpdater, getIntegrationDocsUpdater } from './parsers/code-parser/integration-docs-updater.js';
export { ConflictDetector, getConflictDetector } from './parsers/code-parser/conflict-detector.js';

// Docs Parsers (Docs → Code Pipeline)
export { APIParser, getAPIParser } from './parsers/docs-parser/api-parser.js';
export { FeatureParser, getFeatureParser } from './parsers/docs-parser/feature-parser.js';
export { ArchitectureParser, getArchitectureParser } from './parsers/docs-parser/architecture-parser.js';
export { ReactParser, getReactParser } from './parsers/docs-parser/react-parser.js';
export { FlutterParser, getFlutterParser } from './parsers/docs-parser/flutter-parser.js';

// Digest Generators
export { BackendDigest, getBackendDigest } from './digest-generators/backend-digest.js';
export { AdminDigest, getAdminDigest } from './digest-generators/admin-digest.js';
export { UserDigest, getUserDigest } from './digest-generators/user-digest.js';
export { DriverDigest, getDriverDigest } from './digest-generators/driver-digest.js';

// Validators
export { DocumentValidator, getDocumentValidator } from './validators/document-validator.js';
export { DigestValidator, getDigestValidator } from './validators/digest-validator.js';

// Cache
export { DocumentCache, getDocumentCache } from './cache/DocumentCache.js';
