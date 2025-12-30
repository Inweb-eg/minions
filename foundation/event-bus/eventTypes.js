/**
 * Event Types
 * -----------
 * Centralized event type constants for the Minions framework.
 * All agents should use these constants for publish/subscribe.
 */

// Core Agent Lifecycle Events
export const AgentEvents = {
  AGENT_STARTED: 'agent:started',
  AGENT_COMPLETED: 'agent:completed',
  AGENT_FAILED: 'agent:failed',
  AGENT_PAUSED: 'agent:paused',
  AGENT_RESUMED: 'agent:resumed'
};

// Test Events
export const TestEvents = {
  TESTS_STARTED: 'tests:started',
  TESTS_COMPLETED: 'tests:completed',
  TESTS_FAILED: 'tests:failed'
};

// Code Generation Events
export const CodeEvents = {
  CODE_GENERATED: 'code:generated',
  CODE_REVIEWED: 'code:reviewed',
  AUTO_FIX_REQUESTED: 'code:autofix:requested',
  FIX_COMPLETED: 'code:fix:completed'
};

// Project Manager Events (Silas)
export const ProjectManagerEvents = {
  PROJECT_CONNECT: 'project:connect',
  PROJECT_CONNECTED: 'project:connected',
  PROJECT_DISCONNECT: 'project:disconnect',
  PROJECT_DISCONNECTED: 'project:disconnected',
  PROJECT_SCAN: 'project:scan',
  PROJECT_SCANNED: 'project:scanned',
  PROJECT_SYNC: 'project:sync',
  PROJECT_SYNCED: 'project:synced',
  PROJECT_LIST: 'project:list',
  PROJECT_ERROR: 'project:error',
  PROJECT_STRUCTURE_CREATED: 'project:structure:created'
};

// Project Completion Events (Lucy)
export const CompletionEvents = {
  COMPLETION_START: 'completion:start',
  COMPLETION_STARTED: 'completion:started',
  COMPLETION_PAUSE: 'completion:pause',
  COMPLETION_PAUSED: 'completion:paused',
  COMPLETION_RESUME: 'completion:resume',
  COMPLETION_RESUMED: 'completion:resumed',
  COMPLETION_STOP: 'completion:stop',
  COMPLETION_FINISHED: 'completion:finished',
  COMPLETION_ITERATION_STARTED: 'completion:iteration:started',
  COMPLETION_ITERATION_COMPLETED: 'completion:iteration:completed',
  COMPLETION_GAP_DETECTED: 'completion:gap:detected',
  COMPLETION_GAP_RESOLVED: 'completion:gap:resolved',
  COMPLETION_PROGRESS_UPDATED: 'completion:progress:updated',
  COMPLETION_ERROR: 'completion:error'
};

// Security & Risk Events (Tom)
export const SecurityEvents = {
  // Scanning
  SCAN_STARTED: 'security:scan:started',
  SCAN_COMPLETED: 'security:scan:completed',
  VULNERABILITY_FOUND: 'security:vulnerability:found',
  SECRET_DETECTED: 'security:secret:detected',

  // Risk management
  RISK_IDENTIFIED: 'security:risk:identified',
  RISK_MITIGATED: 'security:risk:mitigated',
  RISK_UPDATED: 'security:risk:updated',
  RISK_ESCALATED: 'security:risk:escalated',

  // Threat modeling
  THREAT_ADDED: 'security:threat:added',
  THREAT_UPDATED: 'security:threat:updated',
  THREAT_MITIGATED: 'security:threat:mitigated',

  // Validation
  VALIDATION_STARTED: 'security:validation:started',
  VALIDATION_PASSED: 'security:validation:passed',
  VALIDATION_FAILED: 'security:validation:failed',

  // Audit
  AUDIT_ENTRY: 'security:audit:entry',
  AUDIT_ALERT: 'security:audit:alert',

  // Ops
  OPS_VALIDATED: 'security:ops:validated',
  OPS_ISSUE_FOUND: 'security:ops:issue',

  // General
  SECURITY_ERROR: 'security:error'
};

// Gru (Client Interface) Events
export const GruEvents = {
  GRU_START: 'gru:start',
  GRU_STARTED: 'gru:started',
  CLIENT_CONNECTED: 'gru:client:connected',
  CLIENT_DISCONNECTED: 'gru:client:disconnected',
  CONVERSATION_MESSAGE: 'gru:conversation:message',
  PROJECT_NEW: 'gru:project:new',
  PLAN_READY: 'gru:plan:ready',
  EXECUTION_STARTED: 'gru:execution:started',
  EXECUTION_PAUSED: 'gru:execution:paused',
  EXECUTION_COMPLETED: 'gru:execution:completed'
};

// Nefario (Planner) Events
export const PlannerEvents = {
  PLAN_GENERATED: 'planner:plan:generated',
  PLAN_APPROVED: 'planner:plan:approved',
  PLAN_REJECTED: 'planner:plan:rejected',
  ARCHITECTURE_UPDATED: 'planner:architecture:updated'
};

// Orchestrator Events
export const OrchestratorEvents = {
  EXECUTION_STARTED: 'orchestrator:execution:started',
  EXECUTION_COMPLETED: 'orchestrator:execution:completed',
  EXECUTION_FAILED: 'orchestrator:execution:failed',
  CHECKPOINT_CREATED: 'orchestrator:checkpoint:created',
  ROLLBACK_INITIATED: 'orchestrator:rollback:initiated',
  PRE_EXECUTION_VALIDATION: 'orchestrator:validation:pre',
  POST_EXECUTION_VALIDATION: 'orchestrator:validation:post'
};

// System Events
export const SystemEvents = {
  ERROR_OCCURRED: 'system:error',
  SHUTDOWN_REQUESTED: 'system:shutdown',
  HEALTH_CHECK: 'system:health:check',
  METRICS_COLLECTED: 'system:metrics:collected'
};

// Database Events (Dave)
export const DatabaseEvents = {
  // Schema operations
  SCHEMA_DESIGNED: 'database:schema:designed',
  SCHEMA_VALIDATED: 'database:schema:validated',
  SCHEMA_UPDATED: 'database:schema:updated',

  // Migration operations
  MIGRATION_CREATED: 'database:migration:created',
  MIGRATION_STARTED: 'database:migration:started',
  MIGRATION_COMPLETED: 'database:migration:completed',
  MIGRATION_FAILED: 'database:migration:failed',
  MIGRATION_ROLLED_BACK: 'database:migration:rolledback',

  // Query operations
  QUERY_OPTIMIZED: 'database:query:optimized',
  QUERY_ANALYZED: 'database:query:analyzed',
  SLOW_QUERY_DETECTED: 'database:query:slow',

  // Relationship operations
  RELATIONSHIP_MAPPED: 'database:relationship:mapped',
  RELATIONSHIP_VALIDATED: 'database:relationship:validated',

  // General
  DATABASE_ERROR: 'database:error'
};

// Performance Events (Kevin)
export const PerformanceEvents = {
  // Profiling
  PROFILE_STARTED: 'performance:profile:started',
  PROFILE_COMPLETED: 'performance:profile:completed',
  HOTSPOT_DETECTED: 'performance:hotspot:detected',

  // Benchmarking
  BENCHMARK_STARTED: 'performance:benchmark:started',
  BENCHMARK_COMPLETED: 'performance:benchmark:completed',
  BENCHMARK_FAILED: 'performance:benchmark:failed',
  REGRESSION_DETECTED: 'performance:regression:detected',

  // Memory analysis
  MEMORY_ANALYZED: 'performance:memory:analyzed',
  MEMORY_LEAK_DETECTED: 'performance:memory:leak',
  MEMORY_THRESHOLD_EXCEEDED: 'performance:memory:threshold',

  // Bottleneck detection
  BOTTLENECK_DETECTED: 'performance:bottleneck:detected',
  BOTTLENECK_RESOLVED: 'performance:bottleneck:resolved',

  // Load testing
  LOAD_TEST_STARTED: 'performance:loadtest:started',
  LOAD_TEST_COMPLETED: 'performance:loadtest:completed',
  THRESHOLD_EXCEEDED: 'performance:threshold:exceeded',

  // General
  PERFORMANCE_ERROR: 'performance:error'
};

// Notification Events (Stuart - future)
export const NotificationEvents = {
  NOTIFICATION_QUEUED: 'notification:queued',
  NOTIFICATION_SENT: 'notification:sent',
  NOTIFICATION_FAILED: 'notification:failed',
  WEBHOOK_TRIGGERED: 'notification:webhook:triggered',
  WEBHOOK_FAILED: 'notification:webhook:failed',
  CHANNEL_CONFIGURED: 'notification:channel:configured'
};

// Infrastructure Events
export const InfrastructureEvents = {
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'infra:ratelimit:exceeded',
  RATE_LIMIT_WARNING: 'infra:ratelimit:warning',

  // Circuit breaker
  CIRCUIT_OPENED: 'infra:circuit:opened',
  CIRCUIT_CLOSED: 'infra:circuit:closed',
  CIRCUIT_HALF_OPEN: 'infra:circuit:halfopen',

  // State persistence
  STATE_PERSISTED: 'infra:state:persisted',
  STATE_RESTORED: 'infra:state:restored',
  STATE_CORRUPTED: 'infra:state:corrupted',

  // Authentication
  AUTH_SUCCESS: 'infra:auth:success',
  AUTH_FAILED: 'infra:auth:failed',
  TOKEN_EXPIRED: 'infra:auth:token:expired',
  TOKEN_REFRESHED: 'infra:auth:token:refreshed'
};

// Learning and Teaching Events
export const LearningEvents = {
  PATTERN_DETECTED: 'learning:pattern:detected',
  PATTERN_THRESHOLD: 'learning:pattern:threshold',
  SKILL_GENERATING: 'learning:skill:generating',
  SKILL_GENERATED: 'learning:skill:generated',
  SKILL_VALIDATED: 'learning:skill:validated',
  SKILL_DEPLOYED: 'learning:skill:deployed',
  SKILL_FAILED: 'learning:skill:failed',
  REWARD_CALCULATED: 'learning:reward:calculated',
  POLICY_UPDATED: 'learning:policy:updated',
  ACTION_SELECTED: 'learning:action:selected',
  EPISODE_ENDED: 'learning:episode:ended',
  ABTEST_STARTED: 'learning:abtest:started',
  ABTEST_COMPLETED: 'learning:abtest:completed',
  ABTEST_WINNER: 'learning:abtest:winner',
  SKILL_SHARED: 'teaching:skill:shared',
  SKILL_RECEIVED: 'teaching:skill:received',
  MASTERY_ACHIEVED: 'teaching:mastery:achieved',
  CURRICULUM_CREATED: 'teaching:curriculum:created',
  LEARNING_ERROR: 'learning:error'
};

// Aggregate all event types
export const EventTypes = {
  ...AgentEvents,
  ...TestEvents,
  ...CodeEvents,
  ...ProjectManagerEvents,
  ...CompletionEvents,
  ...SecurityEvents,
  ...GruEvents,
  ...PlannerEvents,
  ...OrchestratorEvents,
  ...SystemEvents,
  ...DatabaseEvents,
  ...PerformanceEvents,
  ...NotificationEvents,
  ...InfrastructureEvents,
  ...LearningEvents
};

export default EventTypes;
