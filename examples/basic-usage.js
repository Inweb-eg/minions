#!/usr/bin/env node
/**
 * Basic Usage Example
 *
 * This example demonstrates how to use the Minions framework
 * to create and orchestrate multiple agents.
 */

import { initializeMinions, createAgent, EventTypes } from '../index.js';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              Minions Framework - Basic Example                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Initialize the framework
  console.log('Initializing Minions framework...');
  const {
    orchestrator,
    eventBus,
    metricsCollector,
    healthMonitor
  } = await initializeMinions({
    enableMetrics: true,
    enableHealth: true,
    maxConcurrency: 3
  });

  console.log('Framework initialized!\n');

  // Create some example agents
  const dataAgent = createAgent({
    name: 'data-agent',
    execute: async () => {
      console.log('  [data-agent] Fetching and processing data...');
      await sleep(500);

      // Publish event for other agents
      eventBus.publish(EventTypes.CODE_ANALYZED, {
        agent: 'data-agent',
        results: { recordsProcessed: 100 }
      });

      console.log('  [data-agent] Data processing complete');
    }
  });

  const analyzerAgent = createAgent({
    name: 'analyzer-agent',
    execute: async () => {
      console.log('  [analyzer-agent] Running analysis...');
      await sleep(300);
      console.log('  [analyzer-agent] Analysis complete');
    }
  });

  const reportAgent = createAgent({
    name: 'report-agent',
    execute: async () => {
      console.log('  [report-agent] Generating report...');
      await sleep(200);
      console.log('  [report-agent] Report generated');
    }
  });

  // Register agents with the orchestrator
  // Note: Dependencies define execution order
  console.log('Registering agents...');

  orchestrator.registerAgent(
    'data-agent',
    async () => dataAgent,
    [] // No dependencies - runs first
  );

  orchestrator.registerAgent(
    'analyzer-agent',
    async () => analyzerAgent,
    ['data-agent'] // Depends on data-agent
  );

  orchestrator.registerAgent(
    'report-agent',
    async () => reportAgent,
    ['analyzer-agent'] // Depends on analyzer-agent
  );

  console.log('Agents registered!\n');

  // Subscribe to events
  eventBus.subscribe(EventTypes.AGENT_STARTED, 'main', (data) => {
    console.log(`  Event: ${data.agent} started`);
  });

  eventBus.subscribe(EventTypes.AGENT_COMPLETED, 'main', (data) => {
    console.log(`  Event: ${data.agent} completed in ${data.execution_time_ms}ms`);
  });

  // Execute the orchestration
  console.log('Starting orchestration...\n');
  console.log('─'.repeat(60));

  try {
    const result = await orchestrator.execute();

    console.log('─'.repeat(60));
    console.log('\nOrchestration Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Agents Executed: ${result.agentsExecuted}`);

    // Show health status
    if (healthMonitor) {
      const health = healthMonitor.getHealthSummary();
      console.log('\nHealth Summary:');
      console.log(`  Total Agents: ${health.total_agents}`);
      console.log(`  Healthy: ${health.healthy}`);
      console.log(`  Average Score: ${health.average_score}`);
    }

    // Show metrics
    if (metricsCollector) {
      const metrics = metricsCollector.getAllMetrics();
      console.log('\nAgent Metrics:');
      Object.entries(metrics).forEach(([name, m]) => {
        console.log(`  ${name}: ${m.executions?.total || 0} executions, ${m.executions?.success_rate?.toFixed(1) || 0}% success`);
      });
    }

  } catch (error) {
    console.error('\nOrchestration failed:', error.message);
    process.exit(1);
  }

  console.log('\nDone!');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
