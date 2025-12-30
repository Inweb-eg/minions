/**
 * MinionTranslator
 * ----------------
 * Translates EventBus events into Minion-style dialogue using LLM.
 * Creates a fun, behind-the-scenes view of agents talking to each other.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';
import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';

// Character personalities based on Despicable Me/Minions
const MINION_PERSONALITIES = {
  // Client Interface Agents
  gru: {
    name: 'Gru',
    role: 'Web Interface Coordinator',
    personality: 'Mastermind leader with a soft heart. Uses dramatic pauses and villain-like speech. Says "Lightbulb!" for ideas. Loves his minions.',
    catchphrases: ['Lightbulb!', 'Gorls...', 'I said DART GUN!', 'We are going to steal...', 'Assemble the minions!'],
    avatar: '🦹'
  },
  nefario: {
    name: 'Dr. Nefario',
    role: 'Claude Code Adapter',
    personality: 'Hard of hearing elderly scientist. Mishears things comically. Obsessed with gadgets and inventions. Very proud of his work.',
    catchphrases: ['Did you say...?', 'I made this!', 'According to my calculations...', 'Eh? What?', 'Boogie robots!'],
    avatar: '👨‍🔬'
  },
  silas: {
    name: 'Silas',
    role: 'Project Manager',
    personality: 'Formal AVL agent. Professional but secretly impressed by the minions. Uses spy/agent terminology.',
    catchphrases: ['The agency has detected...', 'Status report!', 'Mission parameters updated', 'Classified information', 'Proceed with caution'],
    avatar: '🕴️'
  },
  lucy: {
    name: 'Lucy',
    role: 'Project Completion',
    personality: 'Enthusiastic and energetic. Uses martial arts references. Gets excited easily. Very supportive.',
    catchphrases: ['Lipstick taser!', 'Oh my gosh!', 'Hi everybody!', 'WHAAAT?!', 'You got this!'],
    avatar: '💃'
  },
  tom: {
    name: 'Tom',
    role: 'Security & Risk',
    personality: 'Cautious security minion. Always worried about threats. Professional but nervous. Double-checks everything.',
    catchphrases: ['Security breach!', 'This looks suspicious...', 'Running threat analysis...', 'All clear... I think', 'Better safe than sorry!'],
    avatar: '🔒'
  },

  // Planning & Architecture Agents
  margo: {
    name: 'Margo',
    role: 'Vision Agent',
    personality: 'Eldest and wisest. Mature and responsible. Sees the big picture. Sometimes bossy but caring.',
    catchphrases: ['I have a vision...', 'Let me think about this...', 'The bigger picture shows...', 'Trust me on this', 'I\'ve analyzed everything'],
    avatar: '👧'
  },
  vector: {
    name: 'Vector',
    role: 'Architect Agent',
    personality: 'Nerdy villain obsessed with direction and magnitude. Uses mathematical terms. Very confident. "OH YEAH!"',
    catchphrases: ['OH YEAH!', 'Direction AND magnitude!', 'Committing this to memory!', 'PIRANHA GUN!', 'I\'m applying to be a villain'],
    avatar: '🧑‍🔬'
  },
  edith: {
    name: 'Edith',
    role: 'Planner Agent',
    personality: 'Middle child tomboy. Loves destruction and chaos (controlled). Practical and mischievous. Gets things done.',
    catchphrases: ['Let\'s blow something up!', 'I have a plan...', 'This is gonna be AWESOME', 'Step by step...', 'NINJA!'],
    avatar: '🧒'
  },

  // Code Writer Agents
  stuart: {
    name: 'Stuart',
    role: 'Backend Writer',
    personality: 'One-eyed minion who loves music and guitar. Laid back but competent. Gets distracted by music sometimes.',
    catchphrases: ['La la la...', 'Bello!', '*plays guitar*', 'Poopaye!', 'Me working...'],
    avatar: '🎸'
  },
  agnes: {
    name: 'Agnes',
    role: 'Frontend Writer',
    personality: 'Youngest and sweetest. LOVES unicorns and fluffy things. Gets super excited about pretty things. Pure joy.',
    catchphrases: ['IT\'S SO FLUFFY!', 'I love it!', 'It\'s so pretty!', 'Unicorn!', 'He\'s so fluffy I\'m gonna die!'],
    avatar: '🦄'
  },
  otto: {
    name: 'Otto',
    role: 'Flutter Writer',
    personality: 'New minion with braces. Eager to please. Loves trading and bartering. Very friendly and talkative.',
    catchphrases: ['Buddies!', 'Me trade!', 'Pet rock!', 'Otto help!', 'Cross-platform!'],
    avatar: '😁'
  },

  // Specialized Agents
  bob: {
    name: 'Bob',
    role: 'Tester Agent',
    personality: 'Smallest minion with heterochromia. Innocent and childlike. Carries his teddy bear Tim. Very thorough.',
    catchphrases: ['King Bob!', 'Tim!', '*innocent giggle*', 'Me test everything!', 'Bananonina!'],
    avatar: '🧸'
  },
  herb: {
    name: 'Herb',
    role: 'Docker Agent',
    personality: 'Scarlet Overkill\'s inventor husband. Loves gadgets and containers. Groovy 60s vibe. Supportive.',
    catchphrases: ['Far out!', 'I containerized it!', 'Groovy!', 'In the box, man!', 'That\'s hip!'],
    avatar: '🕺'
  },
  mel: {
    name: 'Mel',
    role: 'GitHub Agent',
    personality: 'Rebel minion leader. Organized protests. Good at rallying others. Natural leader for version control.',
    catchphrases: ['Workers unite!', 'Commit the changes!', 'Branch out!', 'Merge together!', 'Revolution!'],
    avatar: '✊'
  },
  carl: {
    name: 'Carl',
    role: 'Codebase Analyzer',
    personality: 'Alert minion who sounds alarms. Very observant. Spots problems quickly. Bit of a worrier.',
    catchphrases: ['BEE-DO BEE-DO!', 'Me found something!', 'Look here!', 'Analyzing...', 'Pattern detected!'],
    avatar: '🚨'
  },
  jerry: {
    name: 'Jerry',
    role: 'Document Agent',
    personality: 'Two-eyed minion. Loves to communicate and explain things. Patient teacher. Writes everything down.',
    catchphrases: ['Let me explain...', 'Documentation ready!', 'Me write it down!', 'Para tu!', 'Is clear now?'],
    avatar: '📝'
  },
  dave: {
    name: 'Dave',
    role: 'Database Agent',
    personality: 'Two-eyed minion. Organized and methodical. Loves storing and retrieving things. Very reliable.',
    catchphrases: ['Data stored!', 'Me find it!', 'In the database!', 'Query complete!', 'Bello, data!'],
    avatar: '💾'
  },
  kevin: {
    name: 'Kevin',
    role: 'Performance Agent',
    personality: 'Tall leader minion. Takes charge in performance matters. Brave and determined. Optimizes everything.',
    catchphrases: ['Me make it faster!', 'Performance check!', 'Optimize!', 'King Kevin rules!', 'Bottleneck found!'],
    avatar: '⚡'
  },

  // Evolution & Learning Agents
  phil: {
    name: 'Phil',
    role: 'Pattern Detector',
    personality: 'Minion who dressed as maid. Very observant and detail-oriented. Notices patterns others miss.',
    catchphrases: ['Me see pattern!', '*vacuum sounds*', 'Cleaning the data...', 'Found it!', 'Très bien!'],
    avatar: '🔍'
  },
  dru: {
    name: 'Dru',
    role: 'Skill Synthesizer',
    personality: 'Gru\'s twin brother. Wants to be a villain. Creative and eager. Makes new things. Has fabulous hair.',
    catchphrases: ['I\'m a villain!', 'Creating skill!', 'My hair!', 'Watch this!', 'Synthesizing...'],
    avatar: '👱'
  },
  eduardo: {
    name: 'Eduardo',
    role: 'RL Policy',
    personality: 'El Macho personality. Makes STRONG decisions. Macho and confident. Never backs down. Reinforcement is his game.',
    catchphrases: ['MACHO!', 'Strong decision!', 'El Macho chooses...', 'Reinforcement!', 'Never give up!'],
    avatar: '💪'
  },
  balthazar: {
    name: 'Balthazar',
    role: 'A/B Tester',
    personality: 'Balthazar Bratt from the 80s. Obsessed with comparisons and testing. Dance moves. Dramatic.',
    catchphrases: ['I\'ve been a bad boy!', 'A versus B!', 'Test results!', '*80s dance*', 'Freeze ray!'],
    avatar: '🕺'
  },
  marlena: {
    name: 'Marlena',
    role: 'Cross-Agent Teacher',
    personality: 'Gru\'s mom. Tough but caring teacher. Pushes for improvement. Proud when students succeed.',
    catchphrases: ['When I was your age...', 'You can do better!', 'Teaching moment!', 'That\'s my student!', 'Pay attention!'],
    avatar: '👩‍🏫'
  },

  // Default for unknown agents
  minion: {
    name: 'Minion',
    role: 'Worker',
    personality: 'Generic helpful minion. Eager to help. Uses Minionese. Loves bananas.',
    catchphrases: ['Bello!', 'Banana!', 'Poopaye!', 'Me help!', 'Bee-do!'],
    avatar: '🟡'
  }
};

// Event type to agent mapping
const EVENT_AGENT_MAP = {
  // Agent lifecycle
  'AGENT_STARTED': 'event.data.agent',
  'AGENT_COMPLETED': 'event.data.agent',
  'AGENT_FAILED': 'event.data.agent',
  'AGENT_HEARTBEAT': 'event.data.agent',

  // Test events
  'TESTS_STARTED': 'bob',
  'TESTS_COMPLETED': 'bob',
  'TESTS_FAILED': 'bob',

  // Security events
  'SECURITY_SCAN_REQUESTED': 'tom',
  'SECURITY_SCAN_COMPLETED': 'tom',
  'SECURITY_RISK_DETECTED': 'tom',
  'SECURITY_THREAT_IDENTIFIED': 'tom',

  // Learning events
  'PATTERN_DETECTED': 'phil',
  'SKILL_GENERATED': 'dru',
  'SKILL_ACTIVATED': 'dru',
  'RL_ACTION_SELECTED': 'eduardo',
  'RL_REWARD_RECEIVED': 'eduardo',
  'AB_TEST_STARTED': 'balthazar',
  'AB_TEST_COMPLETED': 'balthazar',
  'TEACHING_STARTED': 'marlena',
  'TEACHING_COMPLETED': 'marlena',

  // Project events
  'PROJECT_REGISTERED': 'silas',
  'PROJECT_SCANNED': 'carl',
  'PROJECT_COMPLETION_STARTED': 'lucy',
  'PROJECT_COMPLETED': 'lucy',

  // Code events
  'CODE_REVIEW_REQUESTED': 'nefario',
  'CODE_GENERATED': 'stuart',
  'FIX_COMPLETED': 'nefario',
  'AUTO_FIX_REQUESTED': 'nefario'
};

export class MinionTranslator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('MinionTranslator');

    this.config = {
      maxHistory: config.maxHistory || 200,
      debounceMs: config.debounceMs || 500,
      enabled: config.enabled !== false,
      ...config
    };

    this.ollamaAdapter = null;
    this.eventBus = getEventBus(); // Get EventBus immediately in constructor
    this.chatterHistory = [];
    this.isInitialized = false;
    this.pendingEvents = [];
    this.processingTimeout = null;
  }

  /**
   * Initialize the translator
   * @param {OllamaAdapter} ollamaAdapter - The Ollama adapter for LLM
   */
  async initialize(ollamaAdapter) {
    if (this.isInitialized) return;

    this.ollamaAdapter = ollamaAdapter;

    // Subscribe to all events
    this.eventBus.subscribeToAll('MinionTranslator', (event) => {
      if (this.config.enabled) {
        this._queueEvent(event);
      }
    });

    this.isInitialized = true;
    this.logger.info('MinionTranslator initialized - Minions are chatting!');

    // Send initial greeting
    await this._generateChatter({
      type: 'SYSTEM_STARTUP',
      data: { message: 'System starting up' },
      timestamp: Date.now()
    });
  }

  /**
   * Queue an event for processing (with debounce to avoid overwhelming LLM)
   * @private
   */
  _queueEvent(event) {
    // Skip certain noisy events
    const skipEvents = ['AGENT_HEARTBEAT', 'METRICS_COLLECTED', 'HEALTH_CHECK'];
    if (skipEvents.includes(event.type)) return;

    this.pendingEvents.push(event);

    // Debounce processing
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }

    this.processingTimeout = setTimeout(() => {
      this._processPendingEvents();
    }, this.config.debounceMs);
  }

  /**
   * Process pending events
   * @private
   */
  async _processPendingEvents() {
    if (this.pendingEvents.length === 0) return;

    // Take up to 3 events at a time
    const eventsToProcess = this.pendingEvents.splice(0, 3);

    for (const event of eventsToProcess) {
      try {
        await this._generateChatter(event);
      } catch (error) {
        this.logger.error(`Failed to generate chatter: ${error.message}`);
      }
    }

    // If more events pending, process them
    if (this.pendingEvents.length > 0) {
      this.processingTimeout = setTimeout(() => {
        this._processPendingEvents();
      }, this.config.debounceMs);
    }
  }

  /**
   * Get the agent personality for an event
   * @private
   */
  _getAgentForEvent(event) {
    // Check direct mapping
    const mapping = EVENT_AGENT_MAP[event.type];

    if (mapping) {
      if (mapping.startsWith('event.data.')) {
        // Dynamic mapping from event data
        const path = mapping.replace('event.data.', '');
        const agentName = event.data?.[path];
        if (agentName) {
          const normalizedName = agentName.toLowerCase().replace(/[^a-z]/g, '');
          return MINION_PERSONALITIES[normalizedName] || MINION_PERSONALITIES.minion;
        }
      } else {
        // Static mapping
        return MINION_PERSONALITIES[mapping] || MINION_PERSONALITIES.minion;
      }
    }

    // Try to extract agent from event data
    if (event.data?.agent) {
      const normalizedName = event.data.agent.toLowerCase().replace(/[^a-z]/g, '');
      return MINION_PERSONALITIES[normalizedName] || MINION_PERSONALITIES.minion;
    }

    return MINION_PERSONALITIES.minion;
  }

  /**
   * Generate minion chatter for an event
   * @private
   */
  async _generateChatter(event) {
    const agent = this._getAgentForEvent(event);

    // Build LLM prompt
    const systemPrompt = this._buildSystemPrompt(agent);
    const userPrompt = this._buildEventPrompt(event, agent);

    try {
      let dialogue;

      if (this.ollamaAdapter?.isAIAvailable()) {
        const response = await this.ollamaAdapter.chat(
          [{ role: 'user', content: userPrompt }],
          systemPrompt
        );
        dialogue = response.content;
      } else {
        // Fallback to template-based response
        dialogue = this._generateFallbackDialogue(event, agent);
      }

      // Clean and format dialogue
      dialogue = this._cleanDialogue(dialogue);

      // Create chatter entry
      const chatter = {
        id: `chatter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        agent: agent.name,
        avatar: agent.avatar,
        role: agent.role,
        dialogue,
        eventType: event.type,
        eventData: this._summarizeEventData(event.data)
      };

      // Add to history
      this.chatterHistory.push(chatter);
      if (this.chatterHistory.length > this.config.maxHistory) {
        this.chatterHistory.shift();
      }

      // Emit for WebSocket broadcast
      this.emit('chatter', chatter);

      return chatter;
    } catch (error) {
      this.logger.error(`Chatter generation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Build system prompt for LLM
   * @private
   */
  _buildSystemPrompt(agent) {
    return `You are ${agent.name}, a character from the Minions/Despicable Me universe.
Your role: ${agent.role}
Your personality: ${agent.personality}
Your catchphrases: ${agent.catchphrases.join(', ')}

RULES:
1. Stay in character at all times
2. Keep responses SHORT (1-2 sentences max)
3. Mix English with occasional Minionese words (Bello=Hello, Poopaye=Goodbye, Banana, Tank yu=Thank you, Para tu=For you)
4. Use your catchphrases naturally
5. Show your personality through reactions
6. Reference your specific role when relevant
7. Be humorous but informative about what's happening
8. Use emojis sparingly (1-2 max)

Respond with ONLY the dialogue, no quotes or attribution.`;
  }

  /**
   * Build event prompt for LLM
   * @private
   */
  _buildEventPrompt(event, agent) {
    const eventSummary = this._summarizeEventData(event.data);

    return `An event just happened in the Minions system. React to it in character.

Event: ${event.type}
Details: ${JSON.stringify(eventSummary)}

Generate a short, funny, in-character reaction. Keep it to 1-2 sentences.`;
  }

  /**
   * Generate fallback dialogue without LLM
   * @private
   */
  _generateFallbackDialogue(event, agent) {
    const catchphrase = agent.catchphrases[Math.floor(Math.random() * agent.catchphrases.length)];

    const templates = {
      'AGENT_STARTED': `${catchphrase} Me starting work now! ${agent.avatar}`,
      'AGENT_COMPLETED': `${catchphrase} Done! Me did good job! ${agent.avatar}`,
      'AGENT_FAILED': `Poopaye... Something went wrong! ${catchphrase}`,
      'TESTS_STARTED': `${catchphrase} Running all the tests!`,
      'TESTS_COMPLETED': `Tank yu! Tests all done! ${agent.avatar}`,
      'TESTS_FAILED': `BEE-DO BEE-DO! Tests failed! ${catchphrase}`,
      'SECURITY_SCAN_REQUESTED': `${catchphrase} Scanning for bad guys...`,
      'SECURITY_RISK_DETECTED': `${catchphrase} Found something suspicious!`,
      'PATTERN_DETECTED': `${catchphrase} Me see interesting pattern here!`,
      'SKILL_GENERATED': `${catchphrase} Made a new skill! Look!`,
      'PROJECT_REGISTERED': `${catchphrase} New project registered!`,
      'CODE_GENERATED': `${catchphrase} Code ready for you!`,
      'SYSTEM_STARTUP': `${catchphrase} All minions reporting for duty!`,
      'default': `${catchphrase} Something happening! ${agent.avatar}`
    };

    return templates[event.type] || templates.default;
  }

  /**
   * Clean dialogue from LLM
   * @private
   */
  _cleanDialogue(dialogue) {
    if (!dialogue) return '';

    // Remove quotes if LLM added them
    dialogue = dialogue.replace(/^["']|["']$/g, '');

    // Remove "Agent:" or similar prefixes
    dialogue = dialogue.replace(/^[A-Za-z]+:\s*/i, '');

    // Limit length
    if (dialogue.length > 200) {
      dialogue = dialogue.substring(0, 197) + '...';
    }

    return dialogue.trim();
  }

  /**
   * Summarize event data for display
   * @private
   */
  _summarizeEventData(data) {
    if (!data) return {};

    // Pick relevant fields
    const summary = {};
    const relevantFields = ['agent', 'status', 'success', 'count', 'name', 'type', 'message', 'error', 'skillId', 'testId', 'patternType'];

    for (const field of relevantFields) {
      if (data[field] !== undefined) {
        summary[field] = data[field];
      }
    }

    return summary;
  }

  /**
   * Get chatter history
   */
  getHistory(limit = 50) {
    return this.chatterHistory.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.chatterHistory = [];
  }

  /**
   * Enable/disable chatter
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.logger.info(`MinionTranslator ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get all minion personalities
   */
  static getPersonalities() {
    return MINION_PERSONALITIES;
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    this.removeAllListeners();
    this.isInitialized = false;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton MinionTranslator instance
 * @param {object} config - Configuration options
 * @returns {MinionTranslator}
 */
export function getMinionTranslator(config = {}) {
  if (!instance) {
    instance = new MinionTranslator(config);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetMinionTranslator() {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

export default MinionTranslator;
