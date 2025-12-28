/**
 * Intelligence Layer - Minions 2.0 Document Intelligence
 *
 * This module provides revolutionary AI-powered document processing capabilities:
 *
 * - ReadmeAmplifier: 10-line README → Enterprise specification
 * - ZeroShotArchitect: Single sentence → Complete architecture
 * - SpecEvolution: Evolutionary architecture optimization
 * - PredictiveAnalyzer: Predict and prevent bugs before they exist
 * - NaturalLanguageInterface: Casual description → Structured requirements
 */

// Import all intelligence components
import ReadmeAmplifier, { getReadmeAmplifier } from './ReadmeAmplifier.js';
import ZeroShotArchitect, { getZeroShotArchitect } from './ZeroShotArchitect.js';
import SpecEvolution, { getSpecEvolution } from './SpecEvolution.js';
import PredictiveAnalyzer, { getPredictiveAnalyzer } from './PredictiveAnalyzer.js';
import NaturalLanguageInterface, { getNaturalLanguageInterface } from './NaturalLanguageInterface.js';

// Export classes
export {
  ReadmeAmplifier,
  ZeroShotArchitect,
  SpecEvolution,
  PredictiveAnalyzer,
  NaturalLanguageInterface
};

// Export singleton getters
export {
  getReadmeAmplifier,
  getZeroShotArchitect,
  getSpecEvolution,
  getPredictiveAnalyzer,
  getNaturalLanguageInterface
};

/**
 * Initialize all intelligence components
 * @returns {Promise<Object>} Initialized components
 */
export async function initializeIntelligence() {
  const readmeAmplifier = getReadmeAmplifier();
  const zeroShotArchitect = getZeroShotArchitect();
  const specEvolution = getSpecEvolution();
  const predictiveAnalyzer = getPredictiveAnalyzer();
  const naturalLanguageInterface = getNaturalLanguageInterface();

  await Promise.all([
    readmeAmplifier.initialize(),
    zeroShotArchitect.initialize(),
    specEvolution.initialize(),
    predictiveAnalyzer.initialize(),
    naturalLanguageInterface.initialize()
  ]);

  return {
    readmeAmplifier,
    zeroShotArchitect,
    specEvolution,
    predictiveAnalyzer,
    naturalLanguageInterface
  };
}

/**
 * Process a project from natural language to complete specification
 * Full intelligence pipeline
 *
 * @param {string} input - Natural language project description
 * @returns {Promise<Object>} Complete processed result
 */
export async function processProject(input) {
  // Initialize components
  const nlInterface = getNaturalLanguageInterface();
  const amplifier = getReadmeAmplifier();
  const architect = getZeroShotArchitect();
  const evolution = getSpecEvolution();
  const analyzer = getPredictiveAnalyzer();

  await Promise.all([
    nlInterface.initialize(),
    amplifier.initialize(),
    architect.initialize(),
    evolution.initialize(),
    analyzer.initialize()
  ]);

  // Step 1: Understand natural language input
  const understanding = await nlInterface.understandIntent(input);

  // Step 2: Generate basic README from understanding
  const generatedReadme = generateReadmeFromUnderstanding(understanding);

  // Step 3: Amplify the README
  const amplified = await amplifier.amplifyReadme(generatedReadme);

  // Step 4: Generate architecture
  const architecture = await architect.generateFromSentence(input);

  // Step 5: Evolve specifications
  const evolved = await evolution.evolveSpecs(amplified.structured);

  // Step 6: Predict potential problems
  const predictions = await analyzer.analyzeFutureProblems(amplified.structured);

  return {
    understanding,
    amplified,
    architecture,
    evolved,
    predictions,
    summary: {
      input,
      domain: understanding.understanding.domain,
      features: understanding.understanding.features.core.length,
      riskLevel: predictions.riskScores.riskLevel,
      recommendedArchitecture: evolved.top3[0]?.strategy || 'balanced'
    }
  };
}

/**
 * Generate README from NL understanding
 */
function generateReadmeFromUnderstanding(understanding) {
  const { domain, features, references, constraints, users } = understanding.understanding;

  const lines = [
    `# ${domain.description.charAt(0).toUpperCase() + domain.description.slice(1)}`,
    '',
    understanding.summary.detailed,
    '',
    '## Features',
    ''
  ];

  features.core.forEach(f => {
    lines.push(`- ${f.name}: ${f.description}`);
  });

  lines.push('');
  lines.push('## User Types');
  lines.push('');
  users.forEach(u => {
    lines.push(`- ${u.charAt(0).toUpperCase() + u.slice(1)}`);
  });

  if (references.length > 0) {
    lines.push('');
    lines.push('## Reference Applications');
    lines.push('');
    references.forEach(r => {
      lines.push(`- ${r.name} (${r.category})`);
    });
  }

  lines.push('');
  lines.push('## Constraints');
  lines.push('');
  lines.push(`- Scale: ${constraints.scale}`);
  lines.push(`- Security: ${constraints.security}`);
  lines.push(`- Platforms: ${constraints.platform.join(', ')}`);

  return lines.join('\n');
}

// Default export
export default {
  initializeIntelligence,
  processProject,
  getReadmeAmplifier,
  getZeroShotArchitect,
  getSpecEvolution,
  getPredictiveAnalyzer,
  getNaturalLanguageInterface
};
