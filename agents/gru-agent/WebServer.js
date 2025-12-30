/**
 * WebServer
 * ---------
 * Serves the HTML dashboard and handles WebSocket connections
 * for real-time communication with clients.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../../foundation/common/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('WebServer');

    this.config = {
      port: config.port || 2505,
      fallbackPort: config.fallbackPort || 8005,
      host: config.host || '0.0.0.0',  // Bind to all interfaces (required for Docker)
      publicDir: config.publicDir || path.join(__dirname, 'public'),
      ...config
    };

    this.app = null;
    this.server = null;
    this.wss = null;
    this.clients = new Map();
    this.isRunning = false;
  }

  /**
   * Start the web server
   */
  async start() {
    if (this.isRunning) {
      return { success: true, port: this.config.port };
    }

    return new Promise((resolve, reject) => {
      this.app = express();

      // Middleware
      this.app.use(express.json());
      this.app.use(express.static(this.config.publicDir));

      // Setup routes
      this._setupRoutes();

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket
      this._setupWebSocket();

      // Try primary port, then fallback
      this._tryListen(this.config.port)
        .then((port) => {
          this.config.port = port;
          this.isRunning = true;
          this.logger.info(`Web server running at http://${this.config.host}:${port}`);
          this.emit('started', { port, host: this.config.host });
          resolve({ success: true, port, host: this.config.host });
        })
        .catch((err) => {
          this.logger.error(`Failed to start server: ${err.message}`);
          reject(err);
        });
    });
  }

  /**
   * Try to listen on a port, fallback if busy
   * @private
   */
  _tryListen(port) {
    return new Promise((resolve, reject) => {
      this.server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          this.logger.warn(`Port ${port} in use, trying ${this.config.fallbackPort}`);
          this.server.listen(this.config.fallbackPort, this.config.host, () => {
            resolve(this.config.fallbackPort);
          });
        } else {
          reject(err);
        }
      });

      this.server.listen(port, this.config.host, () => {
        resolve(port);
      });
    });
  }

  /**
   * Setup HTTP routes
   * @private
   */
  _setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get server info
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'Gru Agent',
        version: '1.0.0',
        clients: this.clients.size
      });
    });

    // Chat endpoint (REST fallback if WebSocket fails)
    this.app.post('/api/chat', (req, res) => {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      this.emit('chat:message', { message, source: 'rest' });

      // Response will be sent via event listener in GruAgent
      res.json({ received: true, message: 'Processing...' });
    });

    // ============ Conversation CRUD API ============

    // List all conversations
    this.app.get('/api/conversations', (req, res) => {
      this.emit('api:conversations:list', { callback: (data) => res.json(data) });
    });

    // Get conversations grouped by project
    this.app.get('/api/conversations/grouped', (req, res) => {
      this.emit('api:conversations:grouped', { callback: (data) => res.json(data) });
    });

    // Create new conversation
    this.app.post('/api/conversations', (req, res) => {
      const { projectName, title } = req.body;
      this.emit('api:conversations:create', {
        projectName,
        title,
        callback: (data) => res.json(data)
      });
    });

    // Get single conversation
    this.app.get('/api/conversations/:id', (req, res) => {
      this.emit('api:conversations:get', {
        id: req.params.id,
        callback: (data) => data ? res.json(data) : res.status(404).json({ error: 'Not found' })
      });
    });

    // Update conversation
    this.app.put('/api/conversations/:id', (req, res) => {
      this.emit('api:conversations:update', {
        id: req.params.id,
        updates: req.body,
        callback: (data) => data ? res.json(data) : res.status(404).json({ error: 'Not found' })
      });
    });

    // Delete conversation
    this.app.delete('/api/conversations/:id', (req, res) => {
      this.emit('api:conversations:delete', {
        id: req.params.id,
        callback: (success) => res.json({ success })
      });
    });

    // ============ Project Discovery API ============

    this.app.get('/api/projects/discover', (req, res) => {
      this.emit('api:projects:discover', { callback: (data) => res.json(data) });
    });

    // ============ Learning System API ============

    this.app.get('/api/learning/stats', (req, res) => {
      this.emit('api:learning:stats', { callback: (data) => res.json(data) });
    });

    this.app.get('/api/learning/skills', (req, res) => {
      this.emit('api:learning:skills', { callback: (data) => res.json(data) });
    });

    this.app.get('/api/learning/policy', (req, res) => {
      this.emit('api:learning:policy', { callback: (data) => res.json(data) });
    });

    this.app.get('/api/learning/patterns', (req, res) => {
      this.emit('api:learning:patterns', { callback: (data) => res.json(data) });
    });

    this.app.get('/api/learning/teaching', (req, res) => {
      this.emit('api:learning:teaching', { callback: (data) => res.json(data) });
    });

    this.app.get('/api/learning/tests', (req, res) => {
      this.emit('api:learning:tests', { callback: (data) => res.json(data) });
    });

    this.app.get('/api/learning/events', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      this.emit('api:learning:events', { limit, callback: (data) => res.json(data) });
    });

    // ============ Learning Control API ============

    // RL Policy Controls
    this.app.post('/api/learning/rl/exploration', (req, res) => {
      const { rate } = req.body;
      if (rate === undefined || rate < 0 || rate > 1) {
        return res.status(400).json({ error: 'Rate must be between 0 and 1' });
      }
      this.emit('api:learning:rl:setExploration', {
        rate,
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/rl/reset', (req, res) => {
      const { keepConfig } = req.body;
      this.emit('api:learning:rl:reset', {
        keepConfig: keepConfig !== false,
        callback: (data) => res.json(data)
      });
    });

    // Skills Controls
    this.app.post('/api/learning/skills/generate', (req, res) => {
      const { patternType } = req.body;
      if (!patternType) {
        return res.status(400).json({ error: 'patternType is required' });
      }
      this.emit('api:learning:skills:generate', {
        patternType,
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/skills/:id/approve', (req, res) => {
      this.emit('api:learning:skills:approve', {
        skillId: req.params.id,
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/skills/:id/reject', (req, res) => {
      const { reason } = req.body;
      this.emit('api:learning:skills:reject', {
        skillId: req.params.id,
        reason: reason || 'Manually rejected',
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/skills/:id/toggle', (req, res) => {
      const { enabled } = req.body;
      this.emit('api:learning:skills:toggle', {
        skillId: req.params.id,
        enabled,
        callback: (data) => res.json(data)
      });
    });

    // A/B Test Controls
    this.app.post('/api/learning/tests/start', (req, res) => {
      const { controlSkill, treatmentSkill, options } = req.body;
      if (!controlSkill || !treatmentSkill) {
        return res.status(400).json({ error: 'controlSkill and treatmentSkill are required' });
      }
      this.emit('api:learning:tests:start', {
        controlSkill,
        treatmentSkill,
        options: options || {},
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/tests/:id/cancel', (req, res) => {
      const { reason } = req.body;
      this.emit('api:learning:tests:cancel', {
        testId: req.params.id,
        reason: reason || 'Manually cancelled',
        callback: (data) => res.json(data)
      });
    });

    // Teaching Controls
    this.app.post('/api/learning/teaching/start', (req, res) => {
      const { skillId, teacherAgent, studentAgent } = req.body;
      if (!skillId || !studentAgent) {
        return res.status(400).json({ error: 'skillId and studentAgent are required' });
      }
      this.emit('api:learning:teaching:start', {
        skillId,
        teacherAgent,
        studentAgent,
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/teaching/:id/validate', (req, res) => {
      this.emit('api:learning:teaching:validate', {
        sessionId: req.params.id,
        callback: (data) => res.json(data)
      });
    });

    // Mastery Controls
    this.app.post('/api/learning/mastery', (req, res) => {
      const { agentId, skillId, success } = req.body;
      if (!agentId || !skillId || success === undefined) {
        return res.status(400).json({ error: 'agentId, skillId, and success are required' });
      }
      this.emit('api:learning:mastery:update', {
        agentId,
        skillId,
        success,
        callback: (data) => res.json(data)
      });
    });

    // Learning Plans
    this.app.get('/api/learning/plans', (req, res) => {
      this.emit('api:learning:plans:list', { callback: (data) => res.json(data) });
    });

    this.app.post('/api/learning/plans', (req, res) => {
      const { name, description, targetSkills, priority } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      this.emit('api:learning:plans:create', {
        name,
        description,
        targetSkills: targetSkills || [],
        priority: priority || 'medium',
        callback: (data) => res.json(data)
      });
    });

    this.app.put('/api/learning/plans/:id', (req, res) => {
      this.emit('api:learning:plans:update', {
        planId: req.params.id,
        updates: req.body,
        callback: (data) => res.json(data)
      });
    });

    this.app.delete('/api/learning/plans/:id', (req, res) => {
      this.emit('api:learning:plans:delete', {
        planId: req.params.id,
        callback: (data) => res.json(data)
      });
    });

    this.app.post('/api/learning/plans/:id/execute', (req, res) => {
      this.emit('api:learning:plans:execute', {
        planId: req.params.id,
        callback: (data) => res.json(data)
      });
    });

    // Serve evolve.html for learning dashboard
    this.app.get('/evolve', (req, res) => {
      res.sendFile(path.join(this.config.publicDir, 'evolve.html'));
    });

    // Serve index.html for all other routes (SPA support)
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(this.config.publicDir, 'index.html'));
    });
  }

  /**
   * Setup WebSocket server
   * @private
   */
  _setupWebSocket() {
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      const clientId = this._generateClientId();
      this.clients.set(clientId, ws);

      this.logger.info(`Client connected: ${clientId}`);
      this.emit('client:connected', { clientId });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        message: 'Connected to Gru Agent'
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this._handleWebSocketMessage(clientId, message);
        } catch (error) {
          this.logger.error(`Invalid message from ${clientId}: ${error.message}`);
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Invalid message format'
          });
        }
      });

      // Handle close
      ws.on('close', () => {
        this.clients.delete(clientId);
        this.logger.info(`Client disconnected: ${clientId}`);
        this.emit('client:disconnected', { clientId });
      });

      // Handle errors
      ws.on('error', (error) => {
        this.logger.error(`WebSocket error for ${clientId}: ${error.message}`);
      });
    });
  }

  /**
   * Handle incoming WebSocket message
   * @private
   */
  _handleWebSocketMessage(clientId, message) {
    const { type, payload } = message;

    switch (type) {
      case 'chat':
        this.emit('chat:message', {
          clientId,
          message: payload.message,
          source: 'websocket'
        });
        break;

      case 'project:new':
        this.emit('project:new', { clientId, ...payload });
        break;

      case 'project:existing':
        this.emit('project:existing', { clientId, ...payload });
        break;

      case 'project:confirm':
        this.emit('project:confirm', { clientId, ...payload });
        break;

      case 'plan:approve':
        this.emit('plan:approve', { clientId, ...payload });
        break;

      case 'plan:edit':
        this.emit('plan:edit', { clientId, ...payload });
        break;

      case 'execution:pause':
        this.emit('execution:pause', { clientId });
        break;

      case 'execution:resume':
        this.emit('execution:resume', { clientId });
        break;

      case 'execution:stop':
        this.emit('execution:stop', { clientId });
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong' });
        break;

      // Conversation management via WebSocket
      case 'conversations:list':
        this.emit('api:conversations:list', {
          callback: (data) => this.sendToClient(clientId, { type: 'conversations:list', data })
        });
        break;

      case 'conversations:create':
        this.emit('api:conversations:create', {
          ...payload,
          callback: (data) => this.sendToClient(clientId, { type: 'conversations:created', data })
        });
        break;

      case 'conversations:get':
        this.emit('api:conversations:get', {
          id: payload.id,
          callback: (data) => this.sendToClient(clientId, { type: 'conversations:data', data })
        });
        break;

      case 'conversations:update':
        this.emit('api:conversations:update', {
          id: payload.id,
          updates: payload,
          callback: (data) => this.sendToClient(clientId, { type: 'conversations:updated', data })
        });
        break;

      case 'conversations:delete':
        this.emit('api:conversations:delete', {
          id: payload.id,
          callback: (success) => this.sendToClient(clientId, { type: 'conversations:deleted', id: payload.id, success })
        });
        break;

      case 'projects:discover':
        this.emit('api:projects:discover', {
          callback: (data) => this.sendToClient(clientId, { type: 'projects:discovered', data })
        });
        break;

      case 'chat:general':
        this.emit('chat:message', {
          clientId,
          message: payload.message,
          conversationId: payload.conversationId,
          source: 'websocket'
        });
        break;

      default:
        this.logger.warn(`Unknown message type: ${type}`);
        this.emit('message:unknown', { clientId, type, payload });
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {object} message - Message to broadcast
   */
  broadcast(message) {
    const data = JSON.stringify(message);

    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(data);
      }
    });
  }

  /**
   * Send message to specific client
   * @param {string} clientId - Client ID
   * @param {object} message - Message to send
   */
  sendToClient(clientId, message) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Generate unique client ID
   * @private
   */
  _generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Stop the server
   */
  async stop() {
    if (!this.isRunning) {
      return { success: true };
    }

    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.clients.forEach((ws, clientId) => {
        ws.close(1000, 'Server shutting down');
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          this.logger.info('Web server stopped');
          this.emit('stopped');
          resolve({ success: true });
        });
      } else {
        this.isRunning = false;
        resolve({ success: true });
      }
    });
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      clients: this.clients.size
    };
  }

  /**
   * Shutdown
   */
  async shutdown() {
    await this.stop();
    this.removeAllListeners();
  }
}

export default WebServer;
