/**
 * Standard event types used across all agents
 */

export const EventTypes = {
  // Code generation events
  CODE_GENERATED: 'CODE_GENERATED',
  CODE_UPDATED: 'CODE_UPDATED',
  CODE_DELETED: 'CODE_DELETED',

  // Code Writer Agent events
  CODE_GENERATION_REQUESTED: 'code:generation:requested',
  CODE_GENERATION_STARTED: 'code:generation:started',
  CODE_GENERATION_COMPLETED: 'code:generation:completed',
  CODE_GENERATION_FAILED: 'code:generation:failed',

  // Flutter code generation events
  FLUTTER_WIDGET_GENERATED: 'flutter:widget:generated',
  FLUTTER_MODEL_GENERATED: 'flutter:model:generated',
  FLUTTER_SERVICE_GENERATED: 'flutter:service:generated',
  FLUTTER_BLOC_GENERATED: 'flutter:bloc:generated',
  FLUTTER_PAGE_GENERATED: 'flutter:page:generated',
  FLUTTER_L10N_GENERATED: 'flutter:l10n:generated',

  // Backend code generation events
  BACKEND_ROUTE_GENERATED: 'backend:route:generated',
  BACKEND_MODEL_GENERATED: 'backend:model:generated',
  BACKEND_SERVICE_GENERATED: 'backend:service:generated',
  BACKEND_MIDDLEWARE_GENERATED: 'backend:middleware:generated',
  BACKEND_VALIDATOR_GENERATED: 'backend:validator:generated',
  BACKEND_CONTROLLER_GENERATED: 'backend:controller:generated',

  // Frontend code generation events
  FRONTEND_COMPONENT_GENERATED: 'frontend:component:generated',
  FRONTEND_HOOK_GENERATED: 'frontend:hook:generated',
  FRONTEND_STORE_GENERATED: 'frontend:store:generated',
  FRONTEND_FORM_GENERATED: 'frontend:form:generated',
  FRONTEND_API_GENERATED: 'frontend:api:generated',
  FRONTEND_PAGE_GENERATED: 'frontend:page:generated',

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
  AGENT_REGISTERED: 'AGENT_REGISTERED',

  // Analysis events
  ANALYSIS_COMPLETED: 'ANALYSIS_COMPLETED',

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
  DECISION_LOGGED: 'architect:decision:logged',

  // Planner Agent events (Phase 3)
  // Incoming events (requests to Planner-Agent)
  CREATE_PLAN: 'planner:plan:create',
  EXECUTE_PLAN: 'planner:plan:execute',
  PAUSE_EXECUTION: 'planner:execution:pause',
  RESUME_EXECUTION: 'planner:execution:resume',
  RUN_ITERATION: 'planner:iteration:run',
  REPORT_BLOCKER: 'planner:blocker:report',

  // Outgoing events (Planner-Agent outputs)
  PLAN_CREATED: 'planner:plan:created',
  EXECUTION_STARTED: 'planner:execution:started',
  EXECUTION_PAUSED: 'planner:execution:paused',
  EXECUTION_RESUMED: 'planner:execution:resumed',
  EXECUTION_COMPLETED: 'planner:execution:completed',
  EXECUTION_FAILED: 'planner:execution:failed',

  // Task coordination events
  TASK_ASSIGNED: 'planner:task:assigned',
  TASK_STARTED: 'planner:task:started',
  TASK_COMPLETED: 'planner:task:completed',
  TASK_FAILED: 'planner:task:failed',
  TASK_RETRYING: 'planner:task:retrying',

  // Progress events
  PROGRESS_UPDATED: 'planner:progress:updated',
  BLOCKER_DETECTED: 'planner:blocker:detected',
  BLOCKER_RESOLVED: 'planner:blocker:resolved',

  // Iteration events
  ITERATION_STARTED: 'planner:iteration:started',
  ITERATION_COMPLETED: 'planner:iteration:completed',
  ITERATION_ESCALATED: 'planner:iteration:escalated',
  PHASE_COMPLETED: 'planner:phase:completed'
};

export default EventTypes;
