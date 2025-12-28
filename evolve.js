#!/usr/bin/env node
/**
 * Minions Self-Evolution Runner
 *
 * This script initializes the Minions framework and runs the self-evolution
 * process using the minions-self-evolution-plan.md as input.
 *
 * Usage: node evolve.js
 */

import { initializeMinions, getEventBus, EventTypes } from './index.js';
import fs from 'fs/promises';
import path from 'path';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const log = {
  kevin: (msg) => console.log(`${colors.yellow}👑 Kevin:${colors.reset} ${msg}`),
  bob: (msg) => console.log(`${colors.cyan}🧸 Bob:${colors.reset} ${msg}`),
  stuart: (msg) => console.log(`${colors.magenta}🎸 Stuart:${colors.reset} ${msg}`),
  vision: (msg) => console.log(`${colors.green}👁️ Vision Agent:${colors.reset} ${msg}`),
  architect: (msg) => console.log(`${colors.blue}🏗️ Architect Agent:${colors.reset} ${msg}`),
  planner: (msg) => console.log(`${colors.cyan}📋 Planner Agent:${colors.reset} ${msg}`),
  system: (msg) => console.log(`${colors.bright}⚙️ System:${colors.reset} ${msg}`),
  event: (msg) => console.log(`${colors.magenta}🔔 Event:${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌ Error:${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅ Success:${colors.reset} ${msg}`)
};

// Banner
console.log(`
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.yellow}    __  __ ___ _   _ ___ ___  _   _ ____    _____          _           ${colors.reset}
${colors.yellow}   |  \\/  |_ _| \\ | |_ _/ _ \\| \\ | / ___|  | ____|_   ____| |_   _____ ${colors.reset}
${colors.yellow}   | |\\/| || ||  \\| || | | | |  \\| \\___ \\  |  _| \\ \\ / / _ \\ \\ \\ / / _ \\${colors.reset}
${colors.yellow}   | |  | || || |\\  || | |_| | |\\  |___) | | |___ \\ V / (_) | |\\ V /  __/${colors.reset}
${colors.yellow}   |_|  |_|___|_| \\_|___\\___/|_| \\_|____/  |_____| \\_/ \\___/|_| \\_/ \\___|${colors.reset}
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.cyan}                    "We Think, Therefore We Banana" 🍌${colors.reset}
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);

async function main() {
  try {
    // Step 1: Setup Event Monitoring
    log.kevin('MINIONS ASSEMBLE! 🍌');
    console.log();

    log.system('Setting up event monitoring...');
    const eventBus = getEventBus();

    // Monitor all agent events
    const eventsToWatch = [
      EventTypes.AGENT_STARTED,
      EventTypes.AGENT_COMPLETED,
      EventTypes.AGENT_FAILED,
      EventTypes.TASK_STARTED,
      EventTypes.TASK_COMPLETED,
      EventTypes.ANALYSIS_COMPLETED,
      EventTypes.AGENT_REGISTERED
    ];

    eventsToWatch.forEach(eventType => {
      eventBus.subscribe(eventType, 'EvolutionMonitor', (data) => {
        log.event(`[${eventType}] ${data?.agent || data?.name || ''} ${data?.message || ''}`);
      });
    });

    // Also monitor all events with wildcard
    eventBus.subscribe('*', 'GlobalMonitor', (data, event) => {
      if (!eventsToWatch.includes(event.type)) {
        log.event(`[${event.type}] ${data?.agent || ''}`);
      }
    });

    console.log();

    // Step 2: Initialize Minions Framework
    log.system('Initializing Minions Framework...');
    console.log();

    const minions = await initializeMinions({
      enableVisionAgent: true,
      enableArchitectAgent: true,
      enablePlannerAgent: true,
      enableMemoryStore: true,
      enableDecisionLogger: true,
      enableEnhancedEventBus: true,
      enableMetrics: true,
      enableHealth: true,
      enableAlerting: true,
      projectRoot: process.cwd(),
      maxConcurrency: 5
    });

    log.success('All agents initialized!');
    console.log();

    // Display initialized components
    console.log(`${colors.bright}Initialized Components:${colors.reset}`);
    console.log(`  - Event Bus: ✅`);
    console.log(`  - Orchestrator: ✅`);
    console.log(`  - Memory Store: ${minions.memoryStore ? '✅' : '❌'}`);
    console.log(`  - Decision Logger: ${minions.decisionLogger ? '✅' : '❌'}`);
    console.log(`  - Vision Agent: ${minions.visionAgent ? '✅' : '❌'}`);
    console.log(`  - Architect Agent: ${minions.architectAgent ? '✅' : '❌'}`);
    console.log(`  - Planner Agent: ${minions.plannerAgent ? '✅' : '❌'}`);
    console.log(`  - Health Monitor: ${minions.healthMonitor ? '✅' : '❌'}`);
    console.log(`  - Metrics Collector: ${minions.metricsCollector ? '✅' : '❌'}`);
    console.log();

    // Step 3: Load Self-Evolution Plan
    log.kevin('Loading the self-evolution plan...');

    const planPath = path.join(process.cwd(), 'minions-self-evolution-plan.md');
    const planContent = await fs.readFile(planPath, 'utf-8');

    log.success(`Loaded plan: ${planContent.length} characters`);
    console.log();

    // Step 4: Vision Agent - Analyze the Plan
    log.kevin('Phil! Analyze this README and tell me what we need to build!');
    console.log();
    log.vision('Analyzing self-evolution plan... *potato?*');

    if (minions.visionAgent) {
      // parseReadme takes a file path, not content
      const visionResult = await minions.visionAgent.parseReadme(planPath);

      console.log();
      log.vision('Analysis complete! Here\'s what I found:');
      console.log();

      // Get features from the vision agent
      const features = minions.visionAgent.getFeatures();
      const requirements = minions.visionAgent.getRequirements();

      console.log(`${colors.bright}Analysis Results:${colors.reset}`);
      console.log(`  - Features extracted: ${visionResult.featuresCount || features.length}`);
      console.log(`  - Implicit requirements: ${visionResult.implicitCount || 0}`);

      if (features.length > 0) {
        console.log();
        console.log(`${colors.bright}Extracted Features:${colors.reset}`);
        features.slice(0, 10).forEach((feature, i) => {
          console.log(`  ${i + 1}. ${feature.name || feature.title || feature.id || 'Feature'}`);
        });
        if (features.length > 10) {
          console.log(`  ... and ${features.length - 10} more`);
        }
      }

      console.log();

      // Store in memory for other agents
      if (minions.memoryStore) {
        await minions.memoryStore.set('evolution', 'vision-analysis', { features, requirements });
        log.system('Vision analysis stored in memory');
      }

      // Step 5: Architect Agent - Design the Evolution
      console.log();
      log.kevin('Tom! Design an architecture for this evolution!');
      console.log();
      log.architect('Designing fireproof architecture...');

      if (minions.architectAgent) {
        const architectResult = await minions.architectAgent.generateBlueprint({
          name: 'Minions v3.0 Evolution',
          description: 'Self-evolution from v2.0 to v3.0',
          features: features,
          requirements: requirements
        });

        console.log();
        log.architect('Blueprint complete!');

        if (architectResult.blueprint) {
          console.log();
          console.log(`${colors.bright}Architecture Blueprint:${colors.reset}`);
          const pattern = architectResult.blueprint.pattern;
          const patternName = typeof pattern === 'object'
            ? (pattern.primary || pattern.name || pattern.type || 'Modular')
            : pattern;
          console.log(`  - Pattern: ${patternName}`);

          // Layers is an object with keys like: presentation, application, domain, infrastructure
          const layers = architectResult.blueprint.layers;
          const layerNames = layers ? Object.keys(layers) : [];
          console.log(`  - Layers: ${layerNames.length > 0 ? layerNames.join(', ') : 'N/A'}`);

          // Components is an object with keys like: backend, admin, mobile, shared, infrastructure
          const components = architectResult.blueprint.components;
          const componentNames = components ? Object.keys(components).filter(k => components[k]) : [];
          console.log(`  - Components: ${componentNames.length > 0 ? componentNames.join(', ') : 'N/A'}`);
        }

        if (architectResult.techStack) {
          console.log();
          console.log(`${colors.bright}Technology Stack:${colors.reset}`);
          const stack = architectResult.techStack;
          if (stack.backend) console.log(`  - Backend: ${stack.backend.name || stack.backend.framework} (${stack.backend.language || 'js'})`);
          if (stack.database) console.log(`  - Database: ${stack.database.name || stack.database.type}`);
          if (stack.cache) console.log(`  - Cache: ${stack.cache.name || stack.cache.type}`);
          if (stack.admin) console.log(`  - Admin: ${stack.admin.name || stack.admin.framework || 'React'}`);
          if (stack.mobile) console.log(`  - Mobile: ${stack.mobile.name || stack.mobile.framework || 'Flutter'}`);
        }

        // Store blueprint
        if (minions.memoryStore) {
          await minions.memoryStore.set('evolution', 'architecture-blueprint', architectResult);
          log.system('Architecture blueprint stored in memory');
        }

        console.log();

        // Step 6: Planner Agent - Create Execution Plan
        log.kevin('Gru Jr! Create an execution plan!');
        console.log();
        log.planner('Creating execution plan with topological sort...');

        if (minions.plannerAgent) {
          // createPlan expects an array of tasks
          const tasks = features.map((feature, index) => ({
            id: feature.id || `task-${index}`,
            name: feature.name || feature.title || `Task ${index + 1}`,
            type: 'feature',
            priority: feature.priority || 'medium',
            dependencies: feature.dependencies || [],
            metadata: feature
          }));

          const plannerResult = await minions.plannerAgent.createPlan(tasks, {
            maxConcurrency: 3
          });

          console.log();
          log.planner('Execution plan ready!');

          if (plannerResult.plan) {
            console.log();
            console.log(`${colors.bright}Execution Plan:${colors.reset}`);
            console.log(`  - Total Tasks: ${plannerResult.plan.tasks?.length || tasks.length}`);
            console.log(`  - Phases: ${plannerResult.plan.phases?.length || 'N/A'}`);
            console.log(`  - Parallel Groups: ${plannerResult.plan.parallelGroups?.length || 'N/A'}`);
          }

          // Store plan
          if (minions.memoryStore) {
            await minions.memoryStore.set('evolution', 'execution-plan', plannerResult);
            log.system('Execution plan stored in memory');
          }
        }
      }
    }

    console.log();
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log.kevin('Phase 1 Analysis Complete! BANANA! 🍌');
    log.bob('*hugs teddy* The plan looks good!');
    log.stuart('*plays victory guitar riff* 🎸');
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log();

    // Summary
    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`  The Minions have analyzed the self-evolution plan and created:`);
    console.log(`  1. Vision Analysis - Features and requirements extracted`);
    console.log(`  2. Architecture Blueprint - System design for v3.0`);
    console.log(`  3. Execution Plan - Step-by-step implementation roadmap`);
    console.log();
    console.log(`  Next steps: Run the execution plan to start building v3.0!`);
    console.log();

    // Cleanup - stop timers and exit
    log.system('Shutting down Minions...');

    if (minions.healthMonitor) {
      minions.healthMonitor.stop();
    }
    if (minions.metricsCollector) {
      minions.metricsCollector.stop();
    }
    if (minions.visionAgent) {
      await minions.visionAgent.shutdown();
    }
    if (minions.architectAgent) {
      await minions.architectAgent.shutdown();
    }
    if (minions.plannerAgent) {
      await minions.plannerAgent.shutdown();
    }

    log.success('Evolution Phase 1 complete. Minions signing off! 🍌');
    process.exit(0);

  } catch (error) {
    log.error(`Evolution failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
