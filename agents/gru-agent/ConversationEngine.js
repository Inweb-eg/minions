/**
 * ConversationEngine
 * ------------------
 * Manages AI-powered conversations with clients.
 * Supports both project discussions and general chat.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';
import OllamaAdapter from './OllamaAdapter.js';

// System prompt for flexible conversations
const SYSTEM_PROMPT = `You are Gru, a helpful AI assistant from the Minions framework. You can help with:

1. **Software Projects**: Planning, architecture, features, requirements, technology choices
2. **General Questions**: Programming, technology, problem-solving, explanations
3. **Casual Chat**: Friendly conversation, jokes, interesting discussions

GUIDELINES:
- Be friendly, helpful, and concise
- Use markdown formatting when helpful
- For project planning, ask clarifying questions
- For technical questions, provide clear explanations
- For casual chat, be engaging and natural
- If asked to do something harmful, politely decline

When helping with projects:
- Help prioritize features (must-have vs nice-to-have)
- Suggest best practices
- Consider scalability and maintainability
- Ask about target users and use cases`;

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

    // Add user message to history
    this.history.push({ role: 'user', content: message });

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
        provider: response.provider
      };
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`);
      throw error;
    }
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
    return `Hello! I'm Gru, your AI assistant from the Minions framework.

I can help you with:
- **Project Planning**: Design and plan software projects
- **Technical Questions**: Programming, architecture, best practices
- **General Chat**: Just want to talk? I'm here!

What would you like to discuss today?`;
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
