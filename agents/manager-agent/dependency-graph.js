import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('DependencyGraph');

/**
 * Manages dependencies between agents
 * Determines execution order based on agent relationships
 */
class DependencyGraph {
  constructor() {
    this.nodes = new Map(); // agent name -> { dependencies: [], dependents: [] }
    this.executionOrder = [];
  }

  /**
   * Add an agent to the dependency graph
   */
  addAgent(agentName, dependencies = []) {
    if (!this.nodes.has(agentName)) {
      this.nodes.set(agentName, {
        name: agentName,
        dependencies: [],
        dependents: [],
        level: 0
      });
    }

    const node = this.nodes.get(agentName);
    node.dependencies = dependencies;

    // Update dependents
    dependencies.forEach(depName => {
      if (!this.nodes.has(depName)) {
        this.addAgent(depName, []);
      }
      const depNode = this.nodes.get(depName);
      if (!depNode.dependents.includes(agentName)) {
        depNode.dependents.push(agentName);
      }
    });

    logger.debug(`Agent added to graph: ${agentName} with ${dependencies.length} dependencies`);
  }

  /**
   * Build execution order based on dependencies
   */
  buildExecutionOrder() {
    this.executionOrder = [];
    const visited = new Set();
    const visiting = new Set();

    // Topological sort with DFS
    const visit = (agentName) => {
      if (visited.has(agentName)) return;
      if (visiting.has(agentName)) {
        throw new Error(`Circular dependency detected involving ${agentName}`);
      }

      visiting.add(agentName);

      const node = this.nodes.get(agentName);
      if (node) {
        // Visit all dependencies first
        node.dependencies.forEach(dep => visit(dep));
      }

      visiting.delete(agentName);
      visited.add(agentName);
      this.executionOrder.push(agentName);
    };

    // Visit all nodes
    for (const agentName of this.nodes.keys()) {
      visit(agentName);
    }

    // Calculate levels for parallel execution
    this.calculateLevels();

    logger.info(`Execution order built: ${this.executionOrder.length} agents`);
    return this.executionOrder;
  }

  /**
   * Calculate execution levels for parallel execution
   * Agents at the same level can run in parallel
   * Level 1 = root nodes (no dependencies), Level 2+ = dependent nodes
   */
  calculateLevels() {
    const levels = new Map();

    // Initialize all agents with level 1 (root level)
    this.nodes.forEach((node, name) => {
      levels.set(name, 1);
      node.level = 1;
    });

    // Calculate levels based on dependencies
    // Nodes with dependencies get level = max(dependency levels) + 1
    let changed = true;
    while (changed) {
      changed = false;
      this.nodes.forEach((node, name) => {
        if (node.dependencies.length === 0) {
          // Root nodes stay at level 1
          return;
        }

        const currentLevel = levels.get(name);
        const maxDepLevel = Math.max(
          ...node.dependencies.map(dep => levels.get(dep) || 1)
        );
        const newLevel = maxDepLevel + 1;

        if (newLevel > currentLevel) {
          levels.set(name, newLevel);
          node.level = newLevel;
          changed = true;
        }
      });
    }

    logger.debug('Execution levels calculated');
  }

  /**
   * Get agents that can run in parallel at each level
   */
  getParallelGroups() {
    const groups = new Map();

    this.nodes.forEach((node, name) => {
      const level = node.level;
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level).push(name);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, agents]) => ({ level, agents }));
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependencies() {
    try {
      this.buildExecutionOrder();
      return false;
    } catch (error) {
      if (error.message.includes('Circular dependency')) {
        return true;
      }
      throw error;
    }
  }

  /**
   * Get agents that depend on a specific agent
   */
  getDependents(agentName) {
    const node = this.nodes.get(agentName);
    return node ? node.dependents : [];
  }

  /**
   * Get dependencies of a specific agent
   */
  getDependencies(agentName) {
    const node = this.nodes.get(agentName);
    return node ? node.dependencies : [];
  }

  /**
   * Determine which agents need to run based on changed files
   */
  getAffectedAgents(changedFiles) {
    const affected = new Set();

    // Map file patterns to agents
    const filePatterns = {
      'document-agent': [/docs\/.*\.md$/, /\.claude\/.*\.md$/],
      'backend-agent': [/backend\/.*\.(js|ts)$/, /backend\/.*\.json$/],
      'users-agent': [/users-app\/.*\.(dart|yaml)$/],
      'drivers-agent': [/drivers-app\/.*\.(dart|yaml)$/],
      'admin-agent': [/admin-dashboard\/.*\.(jsx?|tsx?)$/],
      'tester-agent': [/tests\/.*\.(js|ts|dart)$/],
      'docker-agent': [/Dockerfile$/, /docker-compose\.ya?ml$/],
      'codebase-analyzer-agent': [/.*\.(js|ts|dart)$/]
    };

    // Check which agents are affected by changed files
    changedFiles.forEach(file => {
      Object.entries(filePatterns).forEach(([agent, patterns]) => {
        if (patterns.some(pattern => pattern.test(file))) {
          affected.add(agent);

          // Add all dependent agents
          const dependents = this.getDependents(agent);
          dependents.forEach(dep => affected.add(dep));
        }
      });
    });

    logger.info(`${affected.size} agents affected by ${changedFiles.length} changed files`);
    return Array.from(affected);
  }

  /**
   * Clear the dependency graph
   */
  clear() {
    this.nodes.clear();
    this.executionOrder = [];
    logger.debug('Dependency graph cleared');
  }

  /**
   * Get graph statistics
   */
  getStats() {
    return {
      totalAgents: this.nodes.size,
      maxLevel: Math.max(...Array.from(this.nodes.values()).map(n => n.level)),
      parallelGroups: this.getParallelGroups().length
    };
  }
}

// Singleton instance
let instance = null;

export function getDependencyGraph() {
  if (!instance) {
    instance = new DependencyGraph();
  }
  return instance;
}

export default DependencyGraph;
