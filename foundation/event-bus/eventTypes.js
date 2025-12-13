/**
 * Standard event types used across all agents
 */

export const EventTypes = {
  // Code generation events
  CODE_GENERATED: 'CODE_GENERATED',
  CODE_UPDATED: 'CODE_UPDATED',
  CODE_DELETED: 'CODE_DELETED',

  // Code analysis events
  CODE_ANALYZED: 'CODE_ANALYZED',
  QUALITY_SCORED: 'QUALITY_SCORED',
  ISSUE_DETECTED: 'ISSUE_DETECTED',

  // Testing events
  TESTS_STARTED: 'TESTS_STARTED',
  TESTS_COMPLETED: 'TESTS_COMPLETED',
  TESTS_FAILED: 'TESTS_FAILED',
  TESTS_GENERATED: 'TESTS_GENERATED',
  COVERAGE_UPDATED: 'COVERAGE_UPDATED',

  // Build & deployment events
  BUILD_STARTED: 'BUILD_STARTED',
  BUILD_COMPLETED: 'BUILD_COMPLETED',
  BUILD_FAILED: 'BUILD_FAILED',
  DEPLOYMENT_STARTED: 'DEPLOYMENT_STARTED',
  DEPLOYMENT_COMPLETED: 'DEPLOYMENT_COMPLETED',

  // PR & Git events
  PR_CREATED: 'PR_CREATED',
  PR_UPDATED: 'PR_UPDATED',
  PR_MERGED: 'PR_MERGED',
  PR_CLOSED: 'PR_CLOSED',

  // Documentation events
  DOCS_UPDATED: 'DOCS_UPDATED',
  DOCS_SYNCED: 'DOCS_SYNCED',

  // Error & recovery events
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  ROLLBACK_REQUESTED: 'ROLLBACK_REQUESTED',
  ROLLBACK_COMPLETED: 'ROLLBACK_COMPLETED',

  // Agent lifecycle events
  AGENT_STARTED: 'AGENT_STARTED',
  AGENT_COMPLETED: 'AGENT_COMPLETED',
  AGENT_FAILED: 'AGENT_FAILED',
  AGENT_HEALTH_CHECK: 'AGENT_HEALTH_CHECK',

  // Metrics events
  METRICS_COLLECTED: 'METRICS_COLLECTED',
  ALERT_TRIGGERED: 'ALERT_TRIGGERED',

  // Change detection events
  CHANGE_DETECTED: 'CHANGE_DETECTED',

  // Auto-fix events (for agent coordination)
  AUTO_FIX_REQUESTED: 'AUTO_FIX_REQUESTED',
  FIX_COMPLETED: 'FIX_COMPLETED',
  FIX_FAILED: 'FIX_FAILED',

  // Code review events
  REVIEW_REQUESTED: 'REVIEW_REQUESTED',
  REVIEW_COMPLETED: 'REVIEW_COMPLETED',

  // Security scan events
  SECURITY_SCAN_REQUESTED: 'SECURITY_SCAN_REQUESTED',
  SECURITY_SCAN_COMPLETED: 'SECURITY_SCAN_COMPLETED',

  // Dependency analysis events
  ANALYZE_DEPENDENCIES: 'ANALYZE_DEPENDENCIES',
  DEPENDENCIES_ANALYZED: 'DEPENDENCIES_ANALYZED',
  UPDATE_DEPENDENCIES: 'UPDATE_DEPENDENCIES',
  DEPENDENCIES_UPDATED: 'DEPENDENCIES_UPDATED',

  // Test generation events
  GENERATE_TESTS: 'GENERATE_TESTS',

  // Skill lifecycle events
  SKILL_READY: 'SKILL_READY',

  // Vision Agent events (Phase 1)
  // Incoming events (requests to Vision-Agent)
  PARSE_README: 'vision:parse:readme',
  DECOMPOSE_FEATURE: 'vision:decompose:feature',
  GET_PRODUCT_STATE: 'vision:state:get',
  GENERATE_ACCEPTANCE: 'vision:acceptance:generate',

  // Outgoing events (Vision-Agent outputs)
  README_PARSED: 'vision:readme:parsed',
  FEATURE_DECOMPOSED: 'vision:feature:decomposed',
  PRODUCT_STATE_UPDATED: 'vision:state:updated',
  ACCEPTANCE_GENERATED: 'vision:acceptance:generated',
  IMPLICIT_REQUIREMENTS_DETECTED: 'vision:implicit:detected',

  // Architect Agent events (Phase 2)
  // Incoming events (from other agents to Architect)
  REQUIREMENTS_READY: 'vision:requirements:ready',
  ARCHITECTURE_REQUEST: 'architect:request',
  VALIDATE_CODE_REQUEST: 'architect:validate:code',

  // Outgoing events (from Architect to other agents)
  BLUEPRINT_CREATED: 'architect:blueprint:created',
  BLUEPRINT_UPDATED: 'architect:blueprint:updated',
  CONTRACT_DEFINED: 'architect:contract:defined',
  CONTRACT_VIOLATION: 'architect:contract:violation',
  DRIFT_DETECTED: 'architect:drift:detected',
  TECH_STACK_SELECTED: 'architect:techstack:selected',
  VALIDATION_PASSED: 'architect:validation:passed',
  VALIDATION_FAILED: 'architect:validation:failed',
  DECISION_LOGGED: 'architect:decision:logged'
};

export default EventTypes;
