import { describe, test, expect, beforeEach } from '@jest/globals';
import DependencyGraph, { getDependencyGraph } from '../../agents/manager-agent/dependency-graph.js';

describe('DependencyGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  test('should add agents to graph', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', ['agent-1']);

    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.has('agent-1')).toBe(true);
    expect(graph.nodes.has('agent-2')).toBe(true);
  });

  test('should build correct execution order', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', ['agent-1']);
    graph.addAgent('agent-3', ['agent-2']);

    const order = graph.buildExecutionOrder();

    expect(order).toEqual(['agent-1', 'agent-2', 'agent-3']);
  });

  test('should detect circular dependencies', () => {
    graph.addAgent('agent-1', ['agent-2']);
    graph.addAgent('agent-2', ['agent-1']);

    expect(graph.hasCircularDependencies()).toBe(true);
  });

  test('should calculate parallel execution levels', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', []);
    graph.addAgent('agent-3', ['agent-1', 'agent-2']);

    graph.buildExecutionOrder();
    const groups = graph.getParallelGroups();

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].agents).toContain('agent-1');
    expect(groups[0].agents).toContain('agent-2');
    expect(groups[1].agents).toContain('agent-3');
  });

  test('should get agent dependencies', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', ['agent-1']);

    const deps = graph.getDependencies('agent-2');
    expect(deps).toEqual(['agent-1']);
  });

  test('should get agent dependents', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', ['agent-1']);

    const dependents = graph.getDependents('agent-1');
    expect(dependents).toContain('agent-2');
  });

  test('should determine affected agents by changed files', () => {
    graph.addAgent('document-agent', []);
    graph.addAgent('backend-agent', ['document-agent']);
    graph.addAgent('tester-agent', ['backend-agent']);

    const affected = graph.getAffectedAgents(['backend/src/test.js']);

    expect(affected).toContain('backend-agent');
    expect(affected).toContain('tester-agent');
  });

  test('should clear graph', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', []);

    graph.clear();

    expect(graph.nodes.size).toBe(0);
    expect(graph.executionOrder.length).toBe(0);
  });

  test('should provide graph statistics', () => {
    graph.addAgent('agent-1', []);
    graph.addAgent('agent-2', ['agent-1']);
    graph.buildExecutionOrder();

    const stats = graph.getStats();

    expect(stats.totalAgents).toBe(2);
    expect(stats.maxLevel).toBeGreaterThanOrEqual(0);
  });

  test('should handle complex dependency chains', () => {
    // Create a realistic agent dependency structure
    graph.addAgent('document-agent', []);
    graph.addAgent('backend-agent', ['document-agent']);
    graph.addAgent('users-agent', ['document-agent', 'backend-agent']);
    graph.addAgent('tester-agent', ['backend-agent', 'users-agent']);

    const order = graph.buildExecutionOrder();

    // document-agent should come first
    expect(order.indexOf('document-agent')).toBeLessThan(order.indexOf('backend-agent'));
    // backend-agent before users-agent
    expect(order.indexOf('backend-agent')).toBeLessThan(order.indexOf('users-agent'));
    // users-agent before tester-agent
    expect(order.indexOf('users-agent')).toBeLessThan(order.indexOf('tester-agent'));
  });

  test('singleton should return same instance', () => {
    const graph1 = getDependencyGraph();
    const graph2 = getDependencyGraph();
    expect(graph1).toBe(graph2);
  });
});
