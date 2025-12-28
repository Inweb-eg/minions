/**
 * CodeEvolutionAgent - Self-improving code through genetic algorithms
 *
 * Revolutionary Enhancement: Code that evolves and improves itself
 *
 * Features:
 * - Generates multiple code variants
 * - Tests all variants automatically
 * - Genetic algorithm merging of best features
 * - Mutation for innovation
 * - Fitness scoring
 * - Cross-breeding of solutions
 */

import { createLogger } from '../../foundation/common/logger.js';
import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { getKnowledgeBrain } from '../../foundation/knowledge-brain/KnowledgeBrain.js';

const logger = createLogger('CodeEvolutionAgent');

// Evolution strategies
const EVOLUTION_STRATEGIES = {
  SPEED: 'speed',
  MEMORY: 'memory',
  READABILITY: 'readability',
  SECURITY: 'security',
  TESTABILITY: 'testability'
};

// Mutation types
const MUTATION_TYPES = {
  VARIABLE_RENAME: 'variable_rename',
  EXTRACT_FUNCTION: 'extract_function',
  INLINE_FUNCTION: 'inline_function',
  LOOP_OPTIMIZATION: 'loop_optimization',
  CACHING_ADD: 'caching_add',
  ERROR_HANDLING: 'error_handling',
  TYPE_ANNOTATION: 'type_annotation',
  ASYNC_CONVERSION: 'async_conversion'
};

// Fitness metrics
const FITNESS_METRICS = {
  performance: {
    weight: 0.25,
    evaluate: (code) => evaluatePerformance(code)
  },
  readability: {
    weight: 0.20,
    evaluate: (code) => evaluateReadability(code)
  },
  maintainability: {
    weight: 0.20,
    evaluate: (code) => evaluateMaintainability(code)
  },
  security: {
    weight: 0.20,
    evaluate: (code) => evaluateSecurity(code)
  },
  testability: {
    weight: 0.15,
    evaluate: (code) => evaluateTestability(code)
  }
};

/**
 * Evaluate code performance characteristics
 */
function evaluatePerformance(code) {
  let score = 100;

  // Penalize nested loops
  const nestedLoops = (code.match(/for\s*\([^)]*\)[^{]*{[^}]*for\s*\(/g) || []).length;
  score -= nestedLoops * 15;

  // Reward early returns
  const earlyReturns = (code.match(/if\s*\([^)]*\)\s*return/g) || []).length;
  score += earlyReturns * 5;

  // Penalize synchronous file operations
  if (/readFileSync|writeFileSync/.test(code)) score -= 20;

  // Reward caching patterns
  if (/cache|memoize|memo/.test(code)) score += 10;

  // Penalize regex in loops
  const regexInLoops = (code.match(/for[^{]*{[^}]*\/[^/]+\/[gim]*\.test/g) || []).length;
  score -= regexInLoops * 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Evaluate code readability
 */
function evaluateReadability(code) {
  let score = 100;
  const lines = code.split('\n');

  // Penalize long lines
  const longLines = lines.filter(l => l.length > 100).length;
  score -= longLines * 2;

  // Penalize deep nesting
  const maxIndent = Math.max(...lines.map(l => (l.match(/^\s*/) || [''])[0].length));
  if (maxIndent > 16) score -= (maxIndent - 16) * 2;

  // Reward descriptive names (longer identifiers)
  const identifiers = code.match(/(?:const|let|var|function)\s+(\w+)/g) || [];
  const avgLength = identifiers.reduce((sum, id) => sum + id.split(/\s+/)[1]?.length || 0, 0) / (identifiers.length || 1);
  if (avgLength > 8) score += 10;
  if (avgLength < 3) score -= 15;

  // Reward comments
  const commentLines = (code.match(/\/\/|\/\*|\*\//g) || []).length;
  score += Math.min(15, commentLines * 2);

  // Penalize magic numbers
  const magicNumbers = (code.match(/(?<![.\d])\d{3,}(?![.\d])/g) || []).length;
  score -= magicNumbers * 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Evaluate code maintainability
 */
function evaluateMaintainability(code) {
  let score = 100;

  // Count functions
  const functionCount = (code.match(/(?:function|=>)/g) || []).length;

  // Penalize too few or too many functions
  if (functionCount === 0) score -= 20;
  if (functionCount > 20) score -= (functionCount - 20) * 2;

  // Reward modular code (exports)
  if (/export\s+(?:default|{|const|function|class)/.test(code)) score += 10;

  // Penalize global variables
  const globals = (code.match(/^(?:var|let)\s+\w+/gm) || []).length;
  score -= globals * 5;

  // Reward TypeScript/JSDoc types
  if (/@param|@returns|:\s*\w+(?:\[\])?(?:\s*[=,)])/.test(code)) score += 15;

  // Penalize TODO/FIXME/HACK
  const techDebt = (code.match(/TODO|FIXME|HACK|XXX/g) || []).length;
  score -= techDebt * 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Evaluate code security
 */
function evaluateSecurity(code) {
  let score = 100;

  // Critical: SQL injection
  if (/`SELECT[\s\S]*\$\{/.test(code)) score -= 40;

  // Critical: eval usage
  if (/\beval\s*\(/.test(code)) score -= 30;

  // High: innerHTML
  if (/innerHTML\s*=/.test(code)) score -= 20;

  // High: hardcoded secrets
  if (/(?:password|secret|apikey|api_key)\s*[:=]\s*['"][^'"]{5,}/i.test(code)) score -= 30;

  // Medium: no input validation
  if (/req\.(?:body|query|params)/.test(code) && !/validate|sanitize|escape/.test(code)) score -= 15;

  // Reward: parameterized queries
  if (/\$\d|\?\s*,/.test(code) && /query|execute/.test(code)) score += 10;

  // Reward: helmet/security headers
  if (/helmet|csp|xss|csrf/.test(code)) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Evaluate code testability
 */
function evaluateTestability(code) {
  let score = 100;

  // Reward dependency injection
  if (/constructor\s*\([^)]*(?:Service|Repository|Client)/.test(code)) score += 15;

  // Reward pure functions (no side effects indicators)
  const pureIndicators = (code.match(/(?:const|return)\s+\w+\s*\([^)]*\)\s*=>/g) || []).length;
  score += pureIndicators * 3;

  // Penalize direct I/O in business logic
  if (/fetch\(|axios|fs\.\w+/.test(code) && !/Service|Repository|Client/.test(code)) score -= 15;

  // Penalize singletons (hard to mock)
  if (/getInstance|instance\s*=\s*null/.test(code)) score -= 10;

  // Reward interface/abstract patterns
  if (/interface\s+\w+|abstract\s+class/.test(code)) score += 10;

  // Reward small functions
  const functions = code.match(/(?:function|=>)[^{]*{[^}]*}/g) || [];
  const avgFuncLength = functions.reduce((sum, f) => sum + f.split('\n').length, 0) / (functions.length || 1);
  if (avgFuncLength < 15) score += 10;
  if (avgFuncLength > 30) score -= 15;

  return Math.max(0, Math.min(100, score));
}

class CodeEvolutionAgent {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.initialized = false;

    // Configuration
    this.config = {
      populationSize: options.populationSize || 5,
      generations: options.generations || 5,
      mutationRate: options.mutationRate || 0.1,
      crossoverRate: options.crossoverRate || 0.7,
      elitismCount: options.elitismCount || 1,
      fitnessThreshold: options.fitnessThreshold || 85
    };

    // Evolution state
    this.currentGeneration = 0;
    this.population = [];
    this.bestSolution = null;
    this.evolutionHistory = [];

    // Statistics
    this.stats = {
      evolutions: 0,
      improvements: 0,
      totalGenerations: 0,
      avgImprovement: 0
    };
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.knowledgeBrain = getKnowledgeBrain();
    } catch (error) {
      this.logger.warn('Dependencies not fully available');
    }

    this.initialized = true;
    this.logger.info('CodeEvolutionAgent initialized', this.config);
  }

  /**
   * Evolve code through multiple generations
   * @param {string} originalCode The code to evolve
   * @param {Object} requirements Evolution requirements
   * @returns {Promise<Object>} Evolved code and metrics
   */
  async evolveCode(originalCode, requirements = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Starting code evolution');
    const startTime = Date.now();
    this.stats.evolutions++;

    const {
      strategies = Object.values(EVOLUTION_STRATEGIES),
      maxGenerations = this.config.generations,
      targetFitness = this.config.fitnessThreshold
    } = requirements;

    // Initialize population with original and variants
    this.population = await this.initializePopulation(originalCode, strategies);
    this.currentGeneration = 0;
    this.evolutionHistory = [];

    // Calculate initial fitness
    const initialFitness = this.calculateFitness(originalCode);
    this.logger.info(`Initial fitness: ${initialFitness.total.toFixed(1)}`);

    // Evolve through generations
    let bestFitness = initialFitness.total;
    this.bestSolution = { code: originalCode, fitness: initialFitness };

    for (let gen = 0; gen < maxGenerations; gen++) {
      this.currentGeneration = gen + 1;
      this.stats.totalGenerations++;

      // Evaluate fitness for all individuals
      const evaluated = this.population.map(individual => ({
        ...individual,
        fitness: this.calculateFitness(individual.code)
      }));

      // Sort by fitness
      evaluated.sort((a, b) => b.fitness.total - a.fitness.total);

      // Track best
      if (evaluated[0].fitness.total > bestFitness) {
        bestFitness = evaluated[0].fitness.total;
        this.bestSolution = evaluated[0];
        this.stats.improvements++;
      }

      // Record history
      this.evolutionHistory.push({
        generation: this.currentGeneration,
        bestFitness: evaluated[0].fitness.total,
        avgFitness: evaluated.reduce((sum, i) => sum + i.fitness.total, 0) / evaluated.length,
        worstFitness: evaluated[evaluated.length - 1].fitness.total
      });

      this.logger.debug(`Generation ${this.currentGeneration}: best=${evaluated[0].fitness.total.toFixed(1)}`);

      // Check if target reached
      if (bestFitness >= targetFitness) {
        this.logger.info(`Target fitness reached at generation ${this.currentGeneration}`);
        break;
      }

      // Create next generation
      this.population = await this.createNextGeneration(evaluated);
    }

    // Verify improvement
    const improved = this.bestSolution.fitness.total > initialFitness.total;

    // Calculate improvement percentage
    const improvementPercent = ((this.bestSolution.fitness.total - initialFitness.total) / initialFitness.total * 100);
    this.stats.avgImprovement = (this.stats.avgImprovement * (this.stats.evolutions - 1) + improvementPercent) / this.stats.evolutions;

    const result = {
      success: improved,
      originalCode,
      evolvedCode: improved ? this.bestSolution.code : originalCode,
      originalFitness: initialFitness,
      finalFitness: this.bestSolution.fitness,
      improvement: improvementPercent.toFixed(1) + '%',
      generations: this.currentGeneration,
      history: this.evolutionHistory,
      mutations: this.bestSolution.mutations || [],
      processingTime: Date.now() - startTime
    };

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'code-evolution',
        type: 'evolved-code',
        improved,
        improvement: improvementPercent,
        generations: this.currentGeneration
      });
    }

    // Learn from successful evolutions
    if (improved && this.knowledgeBrain) {
      await this.knowledgeBrain.learn({
        type: 'code_pattern',
        content: {
          original: originalCode.substring(0, 500),
          evolved: this.bestSolution.code.substring(0, 500),
          mutations: this.bestSolution.mutations,
          improvement: improvementPercent
        },
        tags: ['evolution', 'improvement'],
        quality: 'community'
      });
    }

    return result;
  }

  /**
   * Initialize population with variants
   */
  async initializePopulation(originalCode, strategies) {
    const population = [
      { code: originalCode, mutations: [], strategy: 'original' }
    ];

    // Generate variants for each strategy
    for (const strategy of strategies) {
      const variant = await this.generateVariant(originalCode, strategy);
      population.push(variant);
    }

    // Fill remaining population with random mutations
    while (population.length < this.config.populationSize) {
      const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
      const variant = await this.generateVariant(originalCode, randomStrategy);
      population.push(variant);
    }

    return population;
  }

  /**
   * Generate a code variant using a specific strategy
   */
  async generateVariant(code, strategy) {
    const mutations = [];
    let mutatedCode = code;

    switch (strategy) {
      case EVOLUTION_STRATEGIES.SPEED:
        mutatedCode = this.optimizeForSpeed(code, mutations);
        break;
      case EVOLUTION_STRATEGIES.MEMORY:
        mutatedCode = this.optimizeForMemory(code, mutations);
        break;
      case EVOLUTION_STRATEGIES.READABILITY:
        mutatedCode = this.optimizeForReadability(code, mutations);
        break;
      case EVOLUTION_STRATEGIES.SECURITY:
        mutatedCode = this.optimizeForSecurity(code, mutations);
        break;
      case EVOLUTION_STRATEGIES.TESTABILITY:
        mutatedCode = this.optimizeForTestability(code, mutations);
        break;
    }

    return {
      code: mutatedCode,
      mutations,
      strategy
    };
  }

  /**
   * Optimize code for speed
   */
  optimizeForSpeed(code, mutations) {
    let result = code;

    // Convert forEach to for loop
    if (/\.forEach\s*\(/.test(result)) {
      result = result.replace(
        /(\w+)\.forEach\s*\(\s*(?:\(?\s*(\w+)\s*(?:,\s*\w+)?\s*\)?\s*=>|function\s*\(\s*(\w+)\s*(?:,\s*\w+)?\s*\))\s*{/g,
        (match, arr, item1, item2) => {
          const item = item1 || item2;
          mutations.push({ type: MUTATION_TYPES.LOOP_OPTIMIZATION, description: 'forEach to for loop' });
          return `for (let i = 0; i < ${arr}.length; i++) { const ${item} = ${arr}[i];`;
        }
      );
    }

    // Add caching for repeated computations
    if (/(\w+)\([^)]*\).*\1\([^)]*\)/s.test(result) && !/cache|memo/.test(result)) {
      // Simple pattern: add caching hint
      mutations.push({ type: MUTATION_TYPES.CACHING_ADD, description: 'Suggested caching' });
    }

    // Convert string concatenation to template literals
    result = result.replace(
      /(['"])\s*\+\s*(\w+)\s*\+\s*\1/g,
      (match, quote, variable) => {
        mutations.push({ type: 'template_literal', description: 'String concat to template' });
        return '`${' + variable + '}`';
      }
    );

    return result;
  }

  /**
   * Optimize code for memory
   */
  optimizeForMemory(code, mutations) {
    let result = code;

    // Replace array spread with direct methods where possible
    result = result.replace(
      /\[\s*\.\.\.(\w+)\s*\]/g,
      (match, arr) => {
        mutations.push({ type: 'memory_optimization', description: 'Spread to slice' });
        return `${arr}.slice()`;
      }
    );

    // Suggest generators for large iterations
    if (/for\s*\([^)]*\)\s*{[^}]*\.push\s*\(/s.test(result)) {
      mutations.push({ type: 'generator_suggestion', description: 'Consider generator for memory' });
    }

    return result;
  }

  /**
   * Optimize code for readability
   */
  optimizeForReadability(code, mutations) {
    let result = code;

    // Add spacing around operators
    result = result.replace(/([=<>!+\-*/%])([=<>])?(?=\S)/g, '$1$2 ');

    // Convert ternary chains to if/else (if too complex)
    const ternaryChains = result.match(/\?[^:]*:[^?]*\?/g);
    if (ternaryChains && ternaryChains.length > 2) {
      mutations.push({ type: 'ternary_simplification', description: 'Consider if/else for clarity' });
    }

    // Suggest variable extraction for complex expressions
    const complexExpressions = result.match(/\([^()]{50,}\)/g);
    if (complexExpressions) {
      mutations.push({ type: MUTATION_TYPES.EXTRACT_FUNCTION, description: 'Extract complex expressions' });
    }

    return result;
  }

  /**
   * Optimize code for security
   */
  optimizeForSecurity(code, mutations) {
    let result = code;

    // Replace innerHTML with textContent where possible
    result = result.replace(
      /(\w+)\.innerHTML\s*=\s*([^;]+);/g,
      (match, element, content) => {
        if (!/[<>]/.test(content)) {
          mutations.push({ type: 'xss_prevention', description: 'innerHTML to textContent' });
          return `${element}.textContent = ${content};`;
        }
        return match;
      }
    );

    // Add input validation hints
    if (/req\.(body|query|params)\.(\w+)/.test(result) && !/validate|sanitize/.test(result)) {
      mutations.push({ type: MUTATION_TYPES.ERROR_HANDLING, description: 'Add input validation' });
    }

    return result;
  }

  /**
   * Optimize code for testability
   */
  optimizeForTestability(code, mutations) {
    let result = code;

    // Suggest dependency injection
    if (/new\s+\w+Service\s*\(/.test(result) && !/constructor\s*\([^)]*Service/.test(result)) {
      mutations.push({ type: 'dependency_injection', description: 'Use DI for services' });
    }

    // Suggest extracting side effects
    if (/(?:fetch|axios|fs\.)\w+/.test(result) && /(?:if|for|while)/.test(result)) {
      mutations.push({ type: MUTATION_TYPES.EXTRACT_FUNCTION, description: 'Extract I/O from logic' });
    }

    return result;
  }

  /**
   * Calculate fitness score for code
   */
  calculateFitness(code) {
    const scores = {};
    let total = 0;

    for (const [metric, config] of Object.entries(FITNESS_METRICS)) {
      const score = config.evaluate(code);
      scores[metric] = score;
      total += score * config.weight;
    }

    return {
      ...scores,
      total: Math.round(total)
    };
  }

  /**
   * Create next generation through selection, crossover, and mutation
   */
  async createNextGeneration(evaluated) {
    const nextGen = [];

    // Elitism: keep best individuals
    for (let i = 0; i < this.config.elitismCount && i < evaluated.length; i++) {
      nextGen.push(evaluated[i]);
    }

    // Fill rest with crossover and mutation
    while (nextGen.length < this.config.populationSize) {
      // Tournament selection
      const parent1 = this.tournamentSelect(evaluated);
      const parent2 = this.tournamentSelect(evaluated);

      // Crossover
      let child;
      if (Math.random() < this.config.crossoverRate) {
        child = this.crossover(parent1, parent2);
      } else {
        child = { ...parent1 };
      }

      // Mutation
      if (Math.random() < this.config.mutationRate) {
        child = await this.mutate(child);
      }

      nextGen.push(child);
    }

    return nextGen;
  }

  /**
   * Tournament selection
   */
  tournamentSelect(population, tournamentSize = 3) {
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      tournament.push(population[idx]);
    }
    tournament.sort((a, b) => b.fitness.total - a.fitness.total);
    return tournament[0];
  }

  /**
   * Crossover two parents
   */
  crossover(parent1, parent2) {
    // Simple line-based crossover
    const lines1 = parent1.code.split('\n');
    const lines2 = parent2.code.split('\n');

    const crossoverPoint = Math.floor(Math.random() * Math.min(lines1.length, lines2.length));

    const childLines = [
      ...lines1.slice(0, crossoverPoint),
      ...lines2.slice(crossoverPoint)
    ];

    return {
      code: childLines.join('\n'),
      mutations: [...(parent1.mutations || []), ...(parent2.mutations || []), { type: 'crossover' }],
      strategy: 'crossover'
    };
  }

  /**
   * Mutate an individual
   */
  async mutate(individual) {
    const mutationType = Object.values(MUTATION_TYPES)[
      Math.floor(Math.random() * Object.values(MUTATION_TYPES).length)
    ];

    let mutatedCode = individual.code;
    const mutations = [...(individual.mutations || [])];

    switch (mutationType) {
      case MUTATION_TYPES.VARIABLE_RENAME:
        // Add underscore prefix to a random variable
        mutatedCode = mutatedCode.replace(
          /(?:const|let|var)\s+(\w)(\w+)\s*=/,
          (match, first, rest) => match.replace(first + rest, first.toLowerCase() + rest)
        );
        mutations.push({ type: mutationType, description: 'Variable naming adjustment' });
        break;

      case MUTATION_TYPES.ERROR_HANDLING:
        // Wrap function body in try-catch
        if (!/try\s*{/.test(mutatedCode) && /async\s+function/.test(mutatedCode)) {
          mutatedCode = mutatedCode.replace(
            /(async\s+function\s+\w+\s*\([^)]*\)\s*{)/,
            '$1\n  try {'
          );
          mutations.push({ type: mutationType, description: 'Added error handling' });
        }
        break;

      default:
        mutations.push({ type: 'random_mutation', description: 'Minor adjustment' });
    }

    return {
      code: mutatedCode,
      mutations,
      strategy: individual.strategy
    };
  }

  /**
   * Battle test variants
   */
  async battleTest(variants, requirements) {
    const results = [];

    for (const variant of variants) {
      const fitness = this.calculateFitness(variant.code);
      results.push({
        ...variant,
        fitness,
        passed: this.meetsRequirements(variant.code, requirements)
      });
    }

    results.sort((a, b) => b.fitness.total - a.fitness.total);
    return results;
  }

  /**
   * Check if code meets requirements
   */
  meetsRequirements(code, requirements) {
    const fitness = this.calculateFitness(code);

    if (requirements.minPerformance && fitness.performance < requirements.minPerformance) {
      return false;
    }
    if (requirements.minSecurity && fitness.security < requirements.minSecurity) {
      return false;
    }
    if (requirements.minReadability && fitness.readability < requirements.minReadability) {
      return false;
    }

    return true;
  }

  /**
   * Get evolution statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentGeneration: this.currentGeneration,
      populationSize: this.population.length,
      bestFitness: this.bestSolution?.fitness?.total || 0
    };
  }

  /**
   * Get evolution history
   */
  getHistory() {
    return this.evolutionHistory;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of CodeEvolutionAgent
 * @returns {CodeEvolutionAgent}
 */
export function getCodeEvolutionAgent(options = {}) {
  if (!instance) {
    instance = new CodeEvolutionAgent(options);
  }
  return instance;
}

export { CodeEvolutionAgent, EVOLUTION_STRATEGIES, MUTATION_TYPES, FITNESS_METRICS };
export default CodeEvolutionAgent;
