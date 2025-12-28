#!/usr/bin/env node
/**
 * Minions Self-Evolution - Phase 2: Feature Decomposition
 *
 * This phase takes the features extracted in Phase 1 and:
 * 1. Decomposes them into Epics → Stories → Tasks
 * 2. Generates acceptance criteria
 * 3. Prepares work items for code generation
 *
 * Usage: node evolve-phase2.js
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
  gruJr: (msg) => console.log(`${colors.blue}📝 Gru Jr:${colors.reset} ${msg}`),
  phil: (msg) => console.log(`${colors.cyan}🔍 Phil:${colors.reset} ${msg}`),
  system: (msg) => console.log(`${colors.bright}⚙️ System:${colors.reset} ${msg}`),
  event: (msg) => console.log(`${colors.magenta}🔔 Event:${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌ Error:${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅ Success:${colors.reset} ${msg}`),
  task: (msg) => console.log(`${colors.cyan}  📋${colors.reset} ${msg}`),
  story: (msg) => console.log(`${colors.green}  📖${colors.reset} ${msg}`),
  epic: (msg) => console.log(`${colors.yellow}  🎯${colors.reset} ${msg}`)
};

// Banner
console.log(`
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.cyan}    ____  _   _    _    ____  _____   ____  ${colors.reset}
${colors.cyan}   |  _ \\| | | |  / \\  / ___|| ____| |___ \\ ${colors.reset}
${colors.cyan}   | |_) | |_| | / _ \\ \\___ \\|  _|     __) |${colors.reset}
${colors.cyan}   |  __/|  _  |/ ___ \\ ___) | |___   / __/ ${colors.reset}
${colors.cyan}   |_|   |_| |_/_/   \\_\\____/|_____| |_____|${colors.reset}
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.bright}           Feature Decomposition & Acceptance Criteria${colors.reset}
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);

async function main() {
  try {
    // Step 1: Initialize Minions
    log.kevin('Phase 2 starting! Time to break down those features! 🍌');
    console.log();

    log.system('Initializing Minions Framework...');
    const eventBus = getEventBus();

    // Monitor events
    eventBus.subscribe('*', 'Phase2Monitor', (data, event) => {
      if (event.type.includes('vision:') || event.type.includes('planner:')) {
        log.event(`[${event.type}] ${data?.agent || ''}`);
      }
    });

    const minions = await initializeMinions({
      enableVisionAgent: true,
      enableArchitectAgent: true,
      enablePlannerAgent: true,
      enableMemoryStore: true,
      enableDecisionLogger: true,
      enableEnhancedEventBus: true,
      enableMetrics: true,
      enableHealth: true,
      projectRoot: process.cwd(),
      maxConcurrency: 5
    });

    log.success('All agents initialized!');
    console.log();

    // Step 2: Load Phase 1 data from memory or re-parse
    log.kevin('Loading Phase 1 results...');

    let features = minions.visionAgent.getFeatures();

    if (features.length === 0) {
      log.system('No cached features found, re-parsing self-evolution plan...');
      const planPath = path.join(process.cwd(), 'minions-self-evolution-plan.md');
      await minions.visionAgent.parseReadme(planPath);
      features = minions.visionAgent.getFeatures();
    }

    log.success(`Loaded ${features.length} features from Phase 1`);
    console.log();

    // Step 3: Decompose Features into Epics → Stories → Tasks
    log.kevin('Gru Jr! Start decomposing these features into work items!');
    console.log();
    log.gruJr('Breaking down features into Epics, Stories, and Tasks...');
    console.log();

    const decompositionResults = {
      epics: [],
      stories: [],
      tasks: [],
      acceptanceCriteria: []
    };

    let processedCount = 0;
    const totalFeatures = Math.min(features.length, 15); // Process top 15 for demo

    for (const feature of features.slice(0, totalFeatures)) {
      processedCount++;
      const progress = `[${processedCount}/${totalFeatures}]`;

      try {
        // Register feature with product state manager if not already
        if (!minions.visionAgent.getFeature(feature.id)) {
          minions.visionAgent.features.set(feature.id, feature);
        }

        // Decompose feature
        log.epic(`${progress} Decomposing: ${feature.name}`);

        const result = await minions.visionAgent.decomposeFeature(feature.id, {
          generateTasks: true,
          maxStoriesPerEpic: 3,
          maxTasksPerStory: 3
        });

        if (result.success) {
          decompositionResults.epics.push(result.epic);
          decompositionResults.stories.push(...result.stories);
          decompositionResults.tasks.push(...result.tasks);

          // Show decomposition
          log.story(`Epic: ${result.epic.name} (complexity: ${result.epic.complexity})`);
          result.stories.forEach(story => {
            log.task(`Story: ${story.name}`);
          });

          // Generate acceptance criteria for the feature
          try {
            const acResult = await minions.visionAgent.generateAcceptanceCriteria(feature.id, 'feature');
            if (acResult.success && acResult.acceptanceCriteria) {
              decompositionResults.acceptanceCriteria.push({
                featureId: feature.id,
                criteria: acResult.acceptanceCriteria
              });
            }
          } catch (acError) {
            // Acceptance criteria generation is optional
          }
        }
      } catch (error) {
        log.error(`Failed to decompose ${feature.name}: ${error.message}`);
      }

      console.log();
    }

    // Step 4: Summary
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log.gruJr('Feature decomposition complete!');
    console.log();

    console.log(`${colors.bright}Decomposition Summary:${colors.reset}`);
    console.log(`  - Features Processed: ${processedCount}`);
    console.log(`  - Epics Created: ${decompositionResults.epics.length}`);
    console.log(`  - Stories Created: ${decompositionResults.stories.length}`);
    console.log(`  - Tasks Created: ${decompositionResults.tasks.length}`);
    console.log(`  - Acceptance Criteria Sets: ${decompositionResults.acceptanceCriteria.length}`);
    console.log();

    // Calculate total complexity
    const totalComplexity = decompositionResults.epics.reduce((sum, e) => sum + (e.complexity || 0), 0);
    console.log(`${colors.bright}Complexity Analysis:${colors.reset}`);
    console.log(`  - Total Story Points: ${totalComplexity}`);
    console.log(`  - Average per Epic: ${(totalComplexity / decompositionResults.epics.length || 0).toFixed(1)}`);
    console.log();

    // Step 5: Store results in memory
    if (minions.memoryStore) {
      await minions.memoryStore.set('evolution', 'phase2-decomposition', decompositionResults);
      log.system('Decomposition results stored in memory');
    }

    // Step 6: Show sample work items
    console.log(`${colors.bright}Sample Work Items:${colors.reset}`);
    console.log();

    decompositionResults.epics.slice(0, 3).forEach((epic, i) => {
      console.log(`  ${colors.yellow}Epic ${i + 1}:${colors.reset} ${epic.name}`);
      console.log(`    Complexity: ${epic.complexity} | Status: ${epic.status || 'planned'}`);

      const epicStories = decompositionResults.stories.filter(s => s.epicId === epic.id);
      epicStories.slice(0, 2).forEach(story => {
        console.log(`    ${colors.green}└─ Story:${colors.reset} ${story.name}`);

        const storyTasks = decompositionResults.tasks.filter(t => t.storyId === story.id);
        storyTasks.slice(0, 2).forEach(task => {
          console.log(`       ${colors.cyan}└─ Task:${colors.reset} ${task.name}`);
        });
      });
      console.log();
    });

    // Step 7: Get product state
    const productState = minions.visionAgent.getProductState();
    console.log(`${colors.bright}Product State:${colors.reset}`);
    console.log(`  - Total Features: ${productState.features?.length || features.length}`);
    console.log(`  - Planned: ${productState.planned || 'N/A'}`);
    console.log(`  - In Progress: ${productState.inProgress || 0}`);
    console.log(`  - Completed: ${productState.completed || 0}`);
    console.log();

    // Step 8: Get agent metrics
    const visionMetrics = minions.visionAgent.getMetrics();
    console.log(`${colors.bright}Vision Agent Metrics:${colors.reset}`);
    console.log(`  - Epics Created: ${visionMetrics.epicsCreated}`);
    console.log(`  - Stories Created: ${visionMetrics.storiesCreated}`);
    console.log(`  - Tasks Created: ${visionMetrics.tasksCreated}`);
    console.log(`  - Acceptance Criteria: ${visionMetrics.acceptanceCriteriaGenerated}`);
    console.log();

    // Celebration
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log.kevin('Phase 2 Complete! We have a detailed work breakdown! 🍌');
    log.bob('*counts all the tasks* So many bananas to earn!');
    log.stuart('*starts planning guitar breaks between tasks* 🎸');
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log();

    console.log(`${colors.bright}Next Steps (Phase 3):${colors.reset}`);
    console.log(`  1. Assign tasks to specialized agents (Carl, Otto, Larry, etc.)`);
    console.log(`  2. Begin code generation for each component`);
    console.log(`  3. Run Build → Test → Fix cycles`);
    console.log();

    // Cleanup
    log.system('Shutting down Minions...');
    if (minions.healthMonitor) minions.healthMonitor.stop();
    if (minions.metricsCollector) minions.metricsCollector.stop();
    if (minions.visionAgent) await minions.visionAgent.shutdown();
    if (minions.architectAgent) await minions.architectAgent.shutdown();
    if (minions.plannerAgent) await minions.plannerAgent.shutdown();

    log.success('Phase 2 complete. Minions signing off! 🍌');
    process.exit(0);

  } catch (error) {
    log.error(`Phase 2 failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
