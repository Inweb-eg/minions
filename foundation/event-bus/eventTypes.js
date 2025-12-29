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
  ...SystemEvents
};

export default EventTypes;
