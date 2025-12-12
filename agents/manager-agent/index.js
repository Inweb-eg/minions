/**
 * Manager Agent - Main Entry Point
 *
 * Phase 1: Manager-Agent (Orchestration Framework)
 * Coordinates execution of all agents with dependency resolution, parallel execution, and autonomous loops
 *
 * Exports:
 * - Orchestrator - Main orchestration engine
 * - Agent Pool - Agent lifecycle management
 * - Dependency Graph - Dependency resolution and execution order
 * - Autonomous Loop Manager - Test-fix-verify loops
 * - Autonomous Build Manager - Continuous project building
 * - Change Detector - Git monitoring and impact analysis
 */

// Main orchestration components
import Orchestrator, { getOrchestrator } from './orchestrator.js';
import AgentPool, { getAgentPool } from './agent-pool.js';
import DependencyGraph, { getDependencyGraph } from './dependency-graph.js';
import AutonomousLoopManager, { getAutonomousLoopManager } from './autonomous-loop-manager.js';
import AutonomousBuildManager, { getAutonomousBuildManager } from './autonomous-build-manager.js';
import ChangeDetector, { getChangeDetector } from './change-detector.js';

export {
  Orchestrator,
  getOrchestrator,
  AgentPool,
  getAgentPool,
  DependencyGraph,
  getDependencyGraph,
  AutonomousLoopManager,
  getAutonomousLoopManager,
  AutonomousBuildManager,
  getAutonomousBuildManager,
  ChangeDetector,
  getChangeDetector
};
