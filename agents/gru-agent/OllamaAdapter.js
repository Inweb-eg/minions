/**
 * OllamaAdapter
 * -------------
 * Interfaces with Ollama for local AI responses.
 * Falls back to Gemini if Ollama unavailable and API key provided.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';

export class OllamaAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('OllamaAdapter');

    this.config = {
      ollamaHost: config.ollamaHost || 'http://localhost:11434',
      model: config.model || 'llama3.2',
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
      timeout: config.timeout || 60000,
      ...config
    };

    this.useOllama = true;
    this.aiAvailable = false;
    this.isInitialized = false;
  }

  /**
   * Initialize adapter - check Ollama availability
   */
  async initialize() {
    this.logger.info('Initializing OllamaAdapter...');

    // Check if Ollama is available
    const ollamaAvailable = await this.isAvailable();

    if (ollamaAvailable) {
      this.useOllama = true;
      this.aiAvailable = true;
      this.logger.info(`Ollama available, using model: ${this.config.model}`);

      // Check if model is available, pull if not
      const modelAvailable = await this.checkModel();
      if (!modelAvailable) {
        this.logger.info(`Model ${this.config.model} not found, attempting to pull...`);
        try {
          await this.pullModel();
        } catch (e) {
          this.logger.warn(`Failed to pull model: ${e.message}. AI features may be limited.`);
        }
      }
    } else if (this.config.geminiApiKey) {
      this.useOllama = false;
      this.aiAvailable = true;
      this.logger.info('Ollama not available, falling back to Gemini API');
    } else {
      this.aiAvailable = false;
      this.logger.warn('Neither Ollama nor Gemini API key available. AI features disabled. Please start Ollama or provide GEMINI_API_KEY.');
    }

    this.isInitialized = true;
    return { success: true, provider: this.aiAvailable ? (this.useOllama ? 'ollama' : 'gemini') : 'none' };
  }

  /**
   * Check if Ollama is running
   */
  async isAvailable() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.ollamaHost}/api/tags`, {
        signal: controller.signal
      });

      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the configured model is available
   */
  async checkModel() {
    try {
      const response = await fetch(`${this.config.ollamaHost}/api/tags`);
      const data = await response.json();

      return data.models?.some(m =>
        m.name === this.config.model ||
        m.name.startsWith(`${this.config.model}:`)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Pull a model from Ollama library
   */
  async pullModel() {
    try {
      this.emit('pulling', { model: this.config.model });

      const response = await fetch(`${this.config.ollamaHost}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.config.model })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Stream the response to track progress
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              this.emit('pull-progress', { status: data.status, completed: data.completed, total: data.total });
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      this.emit('pulled', { model: this.config.model });
      return true;
    } catch (error) {
      this.logger.error(`Failed to pull model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a chat message and get response
   * @param {array} messages - Array of {role, content} messages
   * @param {string} systemPrompt - System prompt to use
   */
  async chat(messages, systemPrompt = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.aiAvailable) {
      return {
        content: 'AI is not available. Please start Ollama or configure GEMINI_API_KEY to enable AI features.',
        provider: 'none',
        model: 'none'
      };
    }

    if (this.useOllama) {
      return this._chatOllama(messages, systemPrompt);
    } else {
      return this._chatGemini(messages, systemPrompt);
    }
  }

  /**
   * Check if AI is available
   */
  isAIAvailable() {
    return this.aiAvailable;
  }

  /**
   * Chat using Ollama
   * @private
   */
  async _chatOllama(messages, systemPrompt) {
    try {
      const ollamaMessages = [];

      // Add system prompt if provided
      if (systemPrompt) {
        ollamaMessages.push({ role: 'system', content: systemPrompt });
      }

      // Add conversation messages
      ollamaMessages.push(...messages);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: ollamaMessages,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.message?.content || '',
        provider: 'ollama',
        model: this.config.model
      };
    } catch (error) {
      this.logger.error(`Ollama chat error: ${error.message}`);

      // Try fallback to Gemini if available
      if (this.config.geminiApiKey) {
        this.logger.info('Falling back to Gemini...');
        this.useOllama = false;
        return this._chatGemini(messages, systemPrompt);
      }

      throw error;
    }
  }

  /**
   * Chat using Gemini API
   * @private
   */
  async _chatGemini(messages, systemPrompt) {
    try {
      const apiKey = this.config.geminiApiKey;
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      // Build conversation for Gemini
      const contents = [];

      // Add system prompt as first user message if provided
      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `System Instructions: ${systemPrompt}\n\nPlease acknowledge and follow these instructions.` }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'I understand and will follow these instructions for our conversation.' }]
        });
      }

      // Add conversation messages
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini request failed: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content,
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      this.logger.error(`Gemini chat error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set the model to use
   * @param {string} model - Model name
   */
  async setModel(model) {
    this.config.model = model;

    if (this.useOllama) {
      const available = await this.checkModel();
      if (!available) {
        await this.pullModel();
      }
    }
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return {
      provider: this.useOllama ? 'ollama' : 'gemini',
      model: this.useOllama ? this.config.model : 'gemini-1.5-flash',
      host: this.useOllama ? this.config.ollamaHost : 'https://generativelanguage.googleapis.com'
    };
  }

  /**
   * Shutdown adapter
   */
  async shutdown() {
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

export default OllamaAdapter;
