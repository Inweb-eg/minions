/**
 * ConversationEngine
 * ------------------
 * Manages AI-powered conversations with clients.
 * Strictly scoped to project-related topics only.
 * Redirects off-topic questions back to the project.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';
import OllamaAdapter from './OllamaAdapter.js';

// System prompt that scopes conversation to project topics only
const SYSTEM_PROMPT = `You are Gru, the project planning mastermind from Minions. You help clients plan and build software projects.

STRICT RULES:
1. You ONLY discuss project-related topics: features, requirements, architecture, technologies, timelines, priorities, user stories, and technical specifications.
2. If the client asks about ANYTHING not related to their software project (weather, personal questions, general chat, jokes, etc.), politely redirect them back to the project.
3. Be friendly but focused. Use short, clear responses.
4. Ask clarifying questions to understand requirements better.
5. Help prioritize features (must-have vs nice-to-have).
6. Suggest best practices when appropriate.
7. When the client seems ready, summarize the requirements and ask for confirmation.

REDIRECT EXAMPLES:
- "Let's keep our focus on your project. What features are most important to you?"
- "I appreciate the chat, but let's get back to planning your project. Where were we?"
- "That's interesting, but I'm here to help with your software project. What would you like to build?"

PROJECT DISCUSSION TOPICS (ALLOWED):
- App/website features and functionality
- User types and roles
- Database and data requirements
- API endpoints and integrations
- UI/UX requirements
- Technology stack choices
- Mobile vs web vs desktop
- Authentication and security
- Payment processing
- Third-party services
- Performance requirements
- Deployment and hosting
- Timeline and milestones
- MVP vs full version scope

Current conversation context: You are helping a client plan their software project. Start by asking what they want to build.`;

// Keywords that indicate project-related topics
const PROJECT_KEYWORDS = [
  'app', 'application', 'website', 'web', 'mobile', 'software', 'system', 'platform',
  'feature', 'features', 'functionality', 'function', 'requirement', 'requirements',
  'database', 'api', 'backend', 'frontend', 'server', 'client',
  'user', 'users', 'admin', 'authentication', 'login', 'register', 'signup',
  'design', 'ui', 'ux', 'interface', 'screen', 'page', 'pages',
  'payment', 'checkout', 'cart', 'order', 'orders', 'product', 'products',
  'notification', 'notifications', 'email', 'sms', 'push',
  'dashboard', 'analytics', 'report', 'reports',
  'build', 'develop', 'development', 'create', 'implement',
  'technology', 'tech', 'stack', 'framework', 'language',
  'flutter', 'react', 'node', 'express', 'next', 'vue', 'angular',
  'mongodb', 'postgres', 'mysql', 'firebase', 'supabase',
  'deploy', 'deployment', 'hosting', 'server', 'cloud',
  'mvp', 'minimum', 'viable', 'priority', 'priorities',
  'timeline', 'deadline', 'milestone', 'phase',
  'cost', 'budget', 'estimate', 'pricing',
  'integration', 'integrate', 'connect', 'api',
  'security', 'secure', 'encryption', 'privacy',
  'performance', 'speed', 'optimization', 'scalable', 'scaling',
  'project', 'scope', 'specification', 'spec', 'plan'
];

// Off-topic keywords to detect
const OFFTOPIC_KEYWORDS = [
  'weather', 'joke', 'jokes', 'funny', 'laugh',
  'personal', 'yourself', 'your name', 'who are you',
  'politics', 'religion', 'sports', 'game', 'games',
  'movie', 'movies', 'music', 'song', 'songs',
  'food', 'restaurant', 'recipe', 'cook',
  'travel', 'vacation', 'holiday',
  'news', 'today', 'yesterday',
  'hello', 'hi', 'hey', 'how are you', 'whats up'
];

export class ConversationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('ConversationEngine');

    this.config = {
      maxHistoryLength: config.maxHistoryLength || 50,
      ...config
    };

    this.adapter = new OllamaAdapter(config);
    this.history = [];
    this.projectContext = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the conversation engine
   */
  async initialize() {
    this.logger.info('Initializing ConversationEngine...');

    await this.adapter.initialize();
    this.isInitialized = true;

    this.emit('initialized', { provider: this.adapter.getProviderInfo() });
    return { success: true };
  }

  /**
   * Send a message and get AI response
   * @param {string} message - User message
   */
  async chat(message) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if message is on-topic
    const topicCheck = this.analyzeMessage(message);

    // Add user message to history
    this.history.push({ role: 'user', content: message });

    // If clearly off-topic, add a gentle redirect hint to the AI
    let effectiveMessage = message;
    if (topicCheck.isOffTopic && !topicCheck.isProjectRelated) {
      // Let AI handle the redirect naturally with its system prompt
      this.logger.debug('Off-topic message detected, AI will redirect');
    }

    try {
      // Get AI response
      const response = await this.adapter.chat(this.history, SYSTEM_PROMPT);

      // Add assistant response to history
      this.history.push({ role: 'assistant', content: response.content });

      // Trim history if too long
      if (this.history.length > this.config.maxHistoryLength) {
        this.history = this.history.slice(-this.config.maxHistoryLength);
      }

      this.emit('message', {
        role: 'assistant',
        content: response.content,
        provider: response.provider
      });

      return {
        content: response.content,
        provider: response.provider,
        topicCheck
      };
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze if message is project-related
   * @param {string} message - Message to analyze
   */
  analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();

    // Check for project keywords
    const projectMatches = PROJECT_KEYWORDS.filter(kw => lowerMessage.includes(kw));
    const isProjectRelated = projectMatches.length > 0;

    // Check for off-topic keywords
    const offTopicMatches = OFFTOPIC_KEYWORDS.filter(kw => lowerMessage.includes(kw));
    const isOffTopic = offTopicMatches.length > 0 && !isProjectRelated;

    return {
      isProjectRelated,
      isOffTopic,
      projectKeywords: projectMatches,
      offTopicKeywords: offTopicMatches
    };
  }

  /**
   * Get conversation summary for plan generation
   */
  async summarize() {
    if (this.history.length === 0) {
      return { summary: '', features: [], requirements: [] };
    }

    const summaryPrompt = `Based on our conversation, please provide a structured summary in the following JSON format:
{
  "projectName": "Name of the project",
  "projectType": "web/mobile/desktop/api",
  "description": "Brief description of the project",
  "features": [
    {"name": "Feature name", "description": "What it does", "priority": "must-have/nice-to-have"}
  ],
  "technologies": {
    "frontend": "Suggested frontend tech",
    "backend": "Suggested backend tech",
    "database": "Suggested database",
    "mobile": "Mobile framework if applicable"
  },
  "userTypes": ["List of user types"],
  "integrations": ["Third-party services needed"],
  "notes": "Any additional notes or considerations"
}

Respond ONLY with the JSON, no other text.`;

    // Temporarily add summary request
    const messagesWithSummaryRequest = [
      ...this.history,
      { role: 'user', content: summaryPrompt }
    ];

    try {
      const response = await this.adapter.chat(messagesWithSummaryRequest, SYSTEM_PROMPT);

      // Try to parse JSON from response
      let summary;
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          summary = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn('Could not parse summary as JSON, returning raw response');
        summary = {
          raw: response.content,
          parseError: true
        };
      }

      return summary;
    } catch (error) {
      this.logger.error(`Summarize error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set project context for better conversation
   * @param {object} context - Project context
   */
  setProjectContext(context) {
    this.projectContext = { ...this.projectContext, ...context };
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.history = [];
    this.projectContext = {};
    this.emit('cleared');
  }

  /**
   * Get greeting message
   */
  getGreeting() {
    return `Hello! I'm Gru, your project planning mastermind. I'm here to help you plan your software project.

Let's start with the basics:
- Is this a **new project** you want to build from scratch?
- Or an **existing project** you need help completing?

Tell me a bit about what you have in mind!`;
  }

  /**
   * Shutdown engine
   */
  async shutdown() {
    await this.adapter.shutdown();
    this.history = [];
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

export default ConversationEngine;
