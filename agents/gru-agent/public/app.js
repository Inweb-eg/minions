/**
 * Gru Dashboard - Client Application
 * -----------------------------------
 * Manages UI interactions and WebSocket communication with Gru Agent.
 */

class GruDashboard {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.currentScreen = 'welcome';
    this.projectType = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;

    // Conversation management
    this.conversations = {};
    this.currentConversationId = null;

    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.connect();
  }

  cacheElements() {
    // Screens
    this.screens = {
      welcome: document.getElementById('welcomeScreen'),
      chat: document.getElementById('chatScreen'),
      plan: document.getElementById('planScreen'),
      execution: document.getElementById('executionScreen'),
      completed: document.getElementById('completedScreen'),
      error: document.getElementById('errorScreen')
    };

    // Status
    this.connectionStatus = document.getElementById('connectionStatus');
    this.statusDot = this.connectionStatus.querySelector('.status-dot');
    this.statusText = this.connectionStatus.querySelector('.status-text');
    this.serverInfo = document.getElementById('serverInfo');

    // Welcome
    this.newProjectBtn = document.getElementById('newProjectBtn');
    this.existingProjectBtn = document.getElementById('existingProjectBtn');

    // Chat
    this.chatTitle = document.getElementById('chatTitle');
    this.chatPhase = document.getElementById('chatPhase');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.backToWelcome = document.getElementById('backToWelcome');

    // Plan
    this.planContent = document.getElementById('planContent');
    this.editPlanBtn = document.getElementById('editPlanBtn');
    this.approvePlanBtn = document.getElementById('approvePlanBtn');

    // Execution
    this.executionTitle = document.getElementById('executionTitle');
    this.executionPhase = document.getElementById('executionPhase');
    this.progressFill = document.getElementById('progressFill');
    this.progressPercent = document.getElementById('progressPercent');
    this.elapsedTime = document.getElementById('elapsedTime');
    this.executionLog = document.getElementById('executionLog');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.stopBtn = document.getElementById('stopBtn');

    // Completed
    this.completedSummary = document.getElementById('completedSummary');
    this.startNewBtn = document.getElementById('startNewBtn');

    // Error
    this.errorMessage = document.getElementById('errorMessage');
    this.retryBtn = document.getElementById('retryBtn');
    this.backHomeBtn = document.getElementById('backHomeBtn');

    // Modals
    this.pathModal = document.getElementById('pathModal');
    this.projectPathInput = document.getElementById('projectPathInput');
    this.cancelPathBtn = document.getElementById('cancelPathBtn');
    this.confirmPathBtn = document.getElementById('confirmPathBtn');

    this.confirmModal = document.getElementById('confirmModal');
    this.confirmTitle = document.getElementById('confirmTitle');
    this.confirmBody = document.getElementById('confirmBody');
    this.confirmNoBtn = document.getElementById('confirmNoBtn');
    this.confirmYesBtn = document.getElementById('confirmYesBtn');
  }

  bindEvents() {
    // Welcome screen
    this.newProjectBtn.addEventListener('click', () => this.startNewProject());
    this.existingProjectBtn.addEventListener('click', () => this.startExistingProject());

    // General chat button
    const generalChatBtn = document.getElementById('generalChatBtn');
    if (generalChatBtn) {
      generalChatBtn.addEventListener('click', () => this.startGeneralChat());
    }

    // Chat
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.backToWelcome.addEventListener('click', () => this.showScreen('welcome'));

    // Plan
    this.editPlanBtn.addEventListener('click', () => this.requestPlanChanges());
    this.approvePlanBtn.addEventListener('click', () => this.approvePlan());

    // Execution
    this.pauseBtn.addEventListener('click', () => this.pauseExecution());
    this.resumeBtn.addEventListener('click', () => this.resumeExecution());
    this.stopBtn.addEventListener('click', () => this.stopExecution());

    // Completed
    this.startNewBtn.addEventListener('click', () => this.reset());

    // Error
    this.retryBtn.addEventListener('click', () => this.retry());
    this.backHomeBtn.addEventListener('click', () => this.reset());

    // Path Modal
    this.cancelPathBtn.addEventListener('click', () => this.hideModal('path'));
    this.confirmPathBtn.addEventListener('click', () => this.submitProjectPath());
    this.projectPathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitProjectPath();
    });

    // Confirm Modal
    this.confirmNoBtn.addEventListener('click', () => this.confirmStructure(false));
    this.confirmYesBtn.addEventListener('click', () => this.confirmStructure(true));
  }

  // WebSocket Connection
  connect() {
    const wsUrl = `ws://${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected', 'Connected');
      console.log('Connected to Gru Agent');
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.updateConnectionStatus('disconnected', 'Disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionStatus('error', 'Connection Error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateConnectionStatus('error', 'Failed to connect');
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionStatus('connecting', `Reconnecting (${this.reconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  updateConnectionStatus(status, text) {
    this.statusDot.className = 'status-dot';
    if (status === 'connected') {
      this.statusDot.classList.add('connected');
    } else if (status === 'error') {
      this.statusDot.classList.add('error');
    }
    this.statusText.textContent = text;
  }

  // Message Handling
  handleMessage(message) {
    console.log('Received:', message);

    switch (message.type) {
      case 'welcome':
        this.clientId = message.clientId;
        this.serverInfo.textContent = `Port: ${window.location.port || '80'}`;
        break;

      case 'chat:greeting':
        // Display greeting message when on chat screen
        if (this.currentScreen === 'chat') {
          this.hideTypingIndicator();
          this.addMessage('gru', message.content);
        }
        break;

      case 'chat:response':
        this.addMessage('gru', message.message);
        this.hideTypingIndicator();
        break;

      case 'project:needsPath':
        this.showModal('path');
        break;

      case 'project:scanning':
        this.addMessage('system', 'Scanning project structure...');
        break;

      case 'project:scanned':
        this.hideTypingIndicator();
        this.showConfirmModal(message.summary);
        break;

      case 'project:confirmed':
        this.hideModal('confirm');
        this.addMessage('system', 'Project structure confirmed. Creating plan...');
        this.showTypingIndicator();
        break;

      case 'plan:created':
        this.hideTypingIndicator();
        this.showPlan(message.plan);
        break;

      case 'plan:needsChanges':
        this.showScreen('chat');
        this.addMessage('gru', 'What changes would you like to make to the plan?');
        break;

      case 'execution:started':
        this.showScreen('execution');
        this.addLogEntry('info', 'Execution started');
        break;

      case 'execution:updated':
        this.updateExecution(message);
        break;

      case 'execution:paused':
        this.pauseBtn.classList.add('hidden');
        this.resumeBtn.classList.remove('hidden');
        this.addLogEntry('info', 'Execution paused');
        break;

      case 'execution:resumed':
        this.resumeBtn.classList.add('hidden');
        this.pauseBtn.classList.remove('hidden');
        this.addLogEntry('info', 'Execution resumed');
        break;

      case 'execution:completed':
        this.showCompleted(message.summary);
        break;

      case 'error':
        this.showError(message.message);
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  send(type, payload = {}) {
    if (!this.isConnected) {
      console.warn('Not connected');
      return;
    }

    this.ws.send(JSON.stringify({ type, payload }));
  }

  // Project Flow
  startNewProject() {
    this.projectType = 'new';
    this.chatTitle.textContent = 'New Project';
    this.chatPhase.textContent = 'Discovery';
    this.showScreen('chat');
    this.clearChat();

    this.send('project:new');
    this.showTypingIndicator();

    // Initial Gru message will come from server
    setTimeout(() => {
      if (this.chatMessages.children.length <= 1) {
        // Fallback if server doesn't respond
        this.hideTypingIndicator();
        this.addMessage('gru', "Hello! I'm Gru, your project planning mastermind. Let's build something amazing together!\n\nWhat kind of project would you like to create? Tell me about your idea.");
      }
    }, 3000);
  }

  startExistingProject() {
    this.projectType = 'existing';
    this.chatTitle.textContent = 'Existing Project';
    this.chatPhase.textContent = 'Setup';
    this.showScreen('chat');
    this.clearChat();

    this.send('project:existing');
    this.showTypingIndicator();

    setTimeout(() => {
      if (this.chatMessages.children.length <= 1) {
        this.hideTypingIndicator();
        this.addMessage('gru', "Great! Let's continue work on your existing project.\n\nPlease provide the full path to your project folder so I can analyze its structure.");
        this.showModal('path');
      }
    }, 2000);
  }

  submitProjectPath() {
    const path = this.projectPathInput.value.trim();
    if (!path) {
      this.projectPathInput.focus();
      return;
    }

    this.hideModal('path');
    this.addMessage('user', path);
    this.showTypingIndicator();

    this.send('chat', { message: path, type: 'path' });
    this.projectPathInput.value = '';
  }

  showConfirmModal(summary) {
    this.confirmTitle.textContent = 'Project Structure Detected';
    this.confirmBody.innerHTML = this.formatSummary(summary);
    this.showModal('confirm');
  }

  confirmStructure(confirmed) {
    this.hideModal('confirm');

    if (confirmed) {
      this.send('project:confirm', { confirmed: true });
      this.addMessage('system', 'Structure confirmed. Generating plan...');
      this.showTypingIndicator();
    } else {
      this.send('project:confirm', { confirmed: false });
      this.addMessage('gru', "No problem! Please tell me what's incorrect or what components are missing from the detected structure.");
    }
  }

  sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    this.addMessage('user', message);
    this.chatInput.value = '';
    this.showTypingIndicator();

    this.send('chat', { message });
  }

  // Plan
  showPlan(plan) {
    this.showScreen('plan');
    this.planContent.innerHTML = this.formatPlan(plan);
  }

  requestPlanChanges() {
    this.send('plan:edit');
  }

  approvePlan() {
    this.send('plan:approve');
  }

  formatPlan(plan) {
    if (typeof plan === 'string') {
      return `<pre>${this.escapeHtml(plan)}</pre>`;
    }

    let html = '';

    if (plan.name) {
      html += `<div class="plan-section">
        <h4>Project</h4>
        <p><strong>${this.escapeHtml(plan.name)}</strong></p>
        ${plan.description ? `<p>${this.escapeHtml(plan.description)}</p>` : ''}
      </div>`;
    }

    if (plan.features && plan.features.length > 0) {
      html += `<div class="plan-section">
        <h4>Features</h4>
        <ul>${plan.features.map(f => `<li>${this.escapeHtml(f.name || f)}</li>`).join('')}</ul>
      </div>`;
    }

    if (plan.tasks && plan.tasks.length > 0) {
      html += `<div class="plan-section">
        <h4>Tasks</h4>
        <ul>${plan.tasks.map(t => `<li>${this.escapeHtml(t.title || t)}</li>`).join('')}</ul>
      </div>`;
    }

    if (plan.technologies) {
      const techs = Object.entries(plan.technologies).map(([k, v]) => `${k}: ${v}`);
      if (techs.length > 0) {
        html += `<div class="plan-section">
          <h4>Technologies</h4>
          <ul>${techs.map(t => `<li>${this.escapeHtml(t)}</li>`).join('')}</ul>
        </div>`;
      }
    }

    return html || '<p>Plan details loading...</p>';
  }

  // Execution
  updateExecution(data) {
    if (data.phase) {
      this.executionPhase.textContent = this.formatPhase(data.phase);
    }

    if (data.progress !== undefined) {
      this.progressFill.style.width = `${data.progress}%`;
      this.progressPercent.textContent = `${Math.round(data.progress)}%`;
    }

    if (data.elapsed) {
      this.elapsedTime.textContent = data.elapsedFormatted || `${data.elapsed}s`;
    }

    if (data.message) {
      const logType = data.phase === 'error' ? 'error' :
                      data.phase === 'completed' ? 'success' : 'info';
      this.addLogEntry(logType, data.message);
    }
  }

  addLogEntry(type, message) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-message">${this.escapeHtml(message)}</span>
    `;

    this.executionLog.appendChild(entry);
    this.executionLog.scrollTop = this.executionLog.scrollHeight;
  }

  pauseExecution() {
    this.send('execution:pause');
  }

  resumeExecution() {
    this.send('execution:resume');
  }

  stopExecution() {
    if (confirm('Are you sure you want to stop the execution? Progress will be saved.')) {
      this.send('execution:stop');
    }
  }

  // Completed
  showCompleted(summary) {
    this.showScreen('completed');

    if (summary) {
      this.completedSummary.innerHTML = `
        <p><strong>Project:</strong> ${this.escapeHtml(summary.project || 'Unknown')}</p>
        <p><strong>Progress:</strong> ${summary.percentage || 100}%</p>
        <p><strong>Duration:</strong> ${summary.duration || 'Unknown'}</p>
        ${summary.message ? `<p>${this.escapeHtml(summary.message)}</p>` : ''}
      `;
    }
  }

  // Error
  showError(message) {
    this.showScreen('error');
    this.errorMessage.textContent = message || 'An unexpected error occurred.';
  }

  retry() {
    // Return to previous screen or chat
    this.showScreen('chat');
  }

  reset() {
    this.projectType = null;
    this.clearChat();
    this.planContent.innerHTML = '';
    this.executionLog.innerHTML = '';
    this.progressFill.style.width = '0%';
    this.progressPercent.textContent = '0%';
    this.showScreen('welcome');
  }

  // UI Helpers
  showScreen(name) {
    Object.values(this.screens).forEach(screen => {
      screen.classList.remove('active');
    });

    if (this.screens[name]) {
      this.screens[name].classList.add('active');
      this.currentScreen = name;
    }
  }

  showModal(name) {
    const modal = name === 'path' ? this.pathModal : this.confirmModal;
    modal.classList.remove('hidden');
  }

  hideModal(name) {
    const modal = name === 'path' ? this.pathModal : this.confirmModal;
    modal.classList.add('hidden');
  }

  addMessage(type, content) {
    const message = document.createElement('div');
    message.className = `message ${type}`;

    const formattedContent = this.formatMessage(content);
    message.innerHTML = `
      <div class="message-content">${formattedContent}</div>
      <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;

    // Remove typing indicator if present
    this.hideTypingIndicator();

    this.chatMessages.appendChild(message);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  showTypingIndicator() {
    // Remove existing indicator
    this.hideTypingIndicator();

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';

    this.chatMessages.appendChild(indicator);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  clearChat() {
    this.chatMessages.innerHTML = '';
  }

  formatMessage(content) {
    // Simple markdown-like formatting
    let formatted = this.escapeHtml(content);

    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  formatSummary(summary) {
    if (typeof summary === 'string') {
      // Parse markdown-like formatting
      let formatted = this.escapeHtml(summary);
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\n/g, '<br>');
      return `<div style="text-align: left; line-height: 1.8;">${formatted}</div>`;
    }

    return `<pre>${JSON.stringify(summary, null, 2)}</pre>`;
  }

  formatPhase(phase) {
    const phases = {
      idle: 'Idle',
      planning: 'Planning',
      connecting: 'Connecting',
      scanning: 'Scanning',
      analyzing: 'Analyzing',
      building: 'Building',
      testing: 'Testing',
      fixing: 'Fixing',
      verifying: 'Verifying',
      paused: 'Paused',
      completed: 'Completed',
      error: 'Error'
    };

    return phases[phase] || phase;
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Conversation Management ====================

  /**
   * Load all conversations from server
   */
  async loadConversations() {
    try {
      const res = await fetch('/api/conversations/grouped');
      this.conversations = await res.json();
      this.renderConversationList();
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  /**
   * Render conversation list in sidebar
   */
  renderConversationList() {
    const container = document.getElementById('conversationList');
    if (!container) return;

    if (Object.keys(this.conversations).length === 0) {
      container.innerHTML = '<div class="empty-list">No conversations yet</div>';
      return;
    }

    let html = '';
    for (const [project, convs] of Object.entries(this.conversations)) {
      html += `<div class="conv-group">
        <div class="conv-group-header">${this.escapeHtml(project)}</div>
        ${convs.map(c => `
          <div class="conv-item ${c.id === this.currentConversationId ? 'active' : ''}"
               data-id="${c.id}" onclick="gruDashboard.loadConversation('${c.id}')">
            <span class="conv-title">${this.escapeHtml(c.title)}</span>
            <span class="conv-meta">${c.messageCount || 0} msgs</span>
          </div>
        `).join('')}
      </div>`;
    }

    container.innerHTML = html;
  }

  /**
   * Create a new conversation
   */
  async createNewConversation(projectName = 'General') {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, title: 'New Conversation' })
      });
      const conv = await res.json();
      this.currentConversationId = conv.id;
      await this.loadConversations();
      return conv;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }

  /**
   * Load a specific conversation
   */
  async loadConversation(id) {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const conv = await res.json();

      this.currentConversationId = id;
      this.clearChat();

      // Restore messages
      for (const msg of conv.messages || []) {
        this.addMessage(msg.role === 'user' ? 'user' : 'gru', msg.content);
      }

      this.chatTitle.textContent = conv.title || 'Chat';
      this.showScreen('chat');
      this.renderConversationList();
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }

  /**
   * Save message to current conversation
   */
  async saveMessageToConversation(role, content) {
    if (!this.currentConversationId) return;

    try {
      await fetch(`/api/conversations/${this.currentConversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role, content }]
        })
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id) {
    if (!confirm('Delete this conversation?')) return;

    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (this.currentConversationId === id) {
        this.currentConversationId = null;
        this.showScreen('welcome');
      }
      await this.loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }

  /**
   * Discover available projects
   */
  async discoverProjects() {
    try {
      const res = await fetch('/api/projects/discover');
      return await res.json();
    } catch (error) {
      console.error('Failed to discover projects:', error);
      return [];
    }
  }

  /**
   * Start general chat (not project-specific)
   */
  async startGeneralChat() {
    const conv = await this.createNewConversation('General');
    if (conv) {
      this.projectType = 'general';
      this.chatTitle.textContent = 'General Chat';
      this.chatPhase.textContent = 'Chat';
      this.showScreen('chat');
      this.clearChat();

      // Get greeting
      this.showTypingIndicator();
      this.send('chat:general', { message: '/start', conversationId: conv.id });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.gruDashboard = new GruDashboard();

  // Load conversations after connection
  setTimeout(() => {
    if (window.gruDashboard.isConnected) {
      window.gruDashboard.loadConversations();
    }
  }, 1000);
});

// Heartbeat to keep connection alive
setInterval(() => {
  if (window.gruDashboard && window.gruDashboard.isConnected) {
    window.gruDashboard.send('ping');
  }
}, 30000);
