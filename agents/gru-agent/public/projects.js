/**
 * Projects Dashboard
 * ------------------
 * Frontend controller for the Projects page.
 * Handles project listing, connection, and execution control.
 */

class ProjectsDashboard {
  constructor() {
    this.projects = [];
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;

    // DOM elements
    this.projectsList = document.getElementById('projectsList');
    this.emptyState = document.getElementById('emptyState');
    this.connectModal = document.getElementById('connectModal');
    this.projectPathInput = document.getElementById('projectPath');
    this.connectBtn = document.getElementById('connectBtn');
    this.toastContainer = document.getElementById('toastContainer');

    // Stats elements
    this.statTotal = document.getElementById('statTotal');
    this.statRunning = document.getElementById('statRunning');
    this.statCompleted = document.getElementById('statCompleted');
    this.statErrors = document.getElementById('statErrors');

    this.init();
  }

  async init() {
    await this.loadProjects();
    this.connectWebSocket();
    this.setupPathInput();
  }

  // ==================== Data Loading ====================

  async loadProjects() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();

      if (data.success) {
        this.projects = data.projects || [];
        this.render();
      } else {
        this.showToast('Failed to load projects: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      this.showToast('Failed to load projects', 'error');
    }
  }

  // ==================== WebSocket ====================

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('WebSocket connected');
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.connectWebSocket(), delay);
    }
  }

  handleWebSocketMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'projects:list':
        this.projects = data.projects || [];
        this.render();
        break;

      case 'projects:connected':
        this.projects.push(data);
        this.render();
        this.showToast(`Project "${data.name}" connected successfully`, 'success');
        break;

      case 'projects:disconnected':
        this.projects = this.projects.filter(p => p.name !== data.name);
        this.render();
        this.showToast(`Project "${data.name}" disconnected`, 'success');
        break;

      case 'projects:scanned':
        this.updateProject(data.name, { lastScannedAt: new Date().toISOString() });
        this.showToast(`Project "${data.name}" rescanned`, 'success');
        break;

      case 'projects:execution:started':
        this.updateProject(data.project, { status: 'executing', percentage: 0 });
        break;

      case 'projects:execution:progress':
        this.updateProject(data.project, {
          status: 'executing',
          percentage: data.percentage,
          phase: data.phase || data.iteration
        });
        break;

      case 'projects:execution:paused':
        this.updateProject(data.project, { status: 'paused' });
        break;

      case 'projects:execution:resumed':
        this.updateProject(data.project, { status: 'executing' });
        break;

      case 'projects:execution:completed':
        this.updateProject(data.project, {
          status: 'completed',
          percentage: data.percentage || 100
        });
        this.showToast(`Project "${data.project}" execution completed!`, 'success');
        break;

      case 'projects:execution:stopped':
        this.updateProject(data.project, { status: 'connected', percentage: 0 });
        break;

      case 'projects:execution:error':
        this.updateProject(data.project, { status: 'error', error: data.error });
        this.showToast(`Error in "${data.project}": ${data.error}`, 'error');
        break;
    }
  }

  updateProject(name, updates) {
    const project = this.projects.find(p => p.name === name);
    if (project) {
      Object.assign(project, updates);
      this.render();
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  // ==================== Rendering ====================

  render() {
    this.updateStats();

    if (this.projects.length === 0) {
      this.projectsList.innerHTML = '';
      this.emptyState.style.display = 'block';
      return;
    }

    this.emptyState.style.display = 'none';
    this.projectsList.innerHTML = this.projects.map(p => this.renderProjectCard(p)).join('');
  }

  updateStats() {
    const total = this.projects.length;
    const running = this.projects.filter(p => p.status === 'executing').length;
    const completed = this.projects.filter(p => p.status === 'completed').length;
    const errors = this.projects.filter(p => p.status === 'error').length;

    this.statTotal.textContent = total;
    this.statRunning.textContent = running;
    this.statCompleted.textContent = completed;
    this.statErrors.textContent = errors;
  }

  renderProjectCard(project) {
    const status = project.status || 'connected';
    const percentage = project.percentage || 0;
    const phase = project.phase || '';

    // Format frameworks and languages as tags
    const frameworks = (project.framework || []).map(f => `<span class="tag">${f}</span>`).join('');
    const languages = (project.language || []).map(l => `<span class="tag">${l}</span>`).join('');

    // Format dates
    const connectedAt = project.connectedAt ? this.formatDate(project.connectedAt) : 'N/A';
    const lastScanned = project.lastScannedAt ? this.formatDate(project.lastScannedAt) : 'N/A';

    // Determine which action buttons to show
    const isExecuting = status === 'executing';
    const isPaused = status === 'paused';
    const canStart = status === 'connected' || status === 'completed';

    return `
      <article class="project-card" data-project="${project.name}">
        <div class="project-card-header">
          <div>
            <div class="project-name">
              <span>📦</span> ${this.escapeHtml(project.name)}
            </div>
            <div class="project-path">${this.escapeHtml(project.sourcePath || project.path || '')}</div>
          </div>
          <span class="project-status-badge ${status}">${status}</span>
        </div>

        <div class="project-info-grid">
          <div class="project-info-item">
            <span class="label">Frameworks</span>
            <span class="value">${frameworks || '<span style="color: var(--text-secondary)">Not detected</span>'}</span>
          </div>
          <div class="project-info-item">
            <span class="label">Languages</span>
            <span class="value">${languages || '<span style="color: var(--text-secondary)">Not detected</span>'}</span>
          </div>
          <div class="project-info-item">
            <span class="label">Connected</span>
            <span class="value">${connectedAt}</span>
          </div>
          <div class="project-info-item">
            <span class="label">Last Scanned</span>
            <span class="value">${lastScanned}</span>
          </div>
        </div>

        ${isExecuting || isPaused ? `
          <div class="project-progress">
            <div class="progress-header">
              <span class="progress-phase">${phase || 'Processing...'}</span>
              <span class="progress-percent">${percentage}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        ` : ''}

        <div class="project-actions">
          <button class="btn-action" onclick="dashboard.rescanProject('${project.name}')">
            🔄 Rescan
          </button>

          ${canStart ? `
            <button class="btn-start" onclick="dashboard.startProject('${project.name}')">
              ▶️ Start
            </button>
          ` : ''}

          ${isExecuting ? `
            <button class="btn-pause" onclick="dashboard.pauseProject('${project.name}')">
              ⏸️ Pause
            </button>
            <button class="btn-stop" onclick="dashboard.stopProject('${project.name}')">
              ⏹️ Stop
            </button>
          ` : ''}

          ${isPaused ? `
            <button class="btn-start" onclick="dashboard.resumeProject('${project.name}')">
              ▶️ Resume
            </button>
            <button class="btn-stop" onclick="dashboard.stopProject('${project.name}')">
              ⏹️ Stop
            </button>
          ` : ''}

          <button class="btn-disconnect" onclick="dashboard.disconnectProject('${project.name}')">
            🔌 Disconnect
          </button>
        </div>
      </article>
    `;
  }

  formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Actions ====================

  async connectProject() {
    const path = this.projectPathInput.value.trim();
    if (!path) return;

    this.connectBtn.disabled = true;
    this.connectBtn.innerHTML = '<span class="loading-spinner"></span> Connecting...';

    try {
      const res = await fetch('/api/projects/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });

      const data = await res.json();

      if (data.success) {
        this.hideConnectModal();
        // Project will be added via WebSocket broadcast
        if (data.project) {
          this.projects.push(data.project);
          this.render();
          this.showToast(`Project "${data.project.name}" connected successfully`, 'success');
        }
      } else {
        this.showToast('Failed to connect: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to connect project:', error);
      this.showToast('Failed to connect project', 'error');
    } finally {
      this.connectBtn.disabled = false;
      this.connectBtn.textContent = 'Connect';
    }
  }

  async disconnectProject(name) {
    if (!confirm(`Are you sure you want to disconnect "${name}"?`)) return;

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/disconnect`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        this.projects = this.projects.filter(p => p.name !== name);
        this.render();
        this.showToast(`Project "${name}" disconnected`, 'success');
      } else {
        this.showToast('Failed to disconnect: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to disconnect project:', error);
      this.showToast('Failed to disconnect project', 'error');
    }
  }

  async rescanProject(name) {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/rescan`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(`Project "${name}" rescanned`, 'success');
        await this.loadProjects(); // Reload to get updated info
      } else {
        this.showToast('Failed to rescan: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to rescan project:', error);
      this.showToast('Failed to rescan project', 'error');
    }
  }

  async startProject(name) {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/start`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        this.updateProject(name, { status: 'executing', percentage: 0 });
        this.showToast(`Started execution for "${name}"`, 'success');
      } else {
        this.showToast('Failed to start: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to start project:', error);
      this.showToast('Failed to start project', 'error');
    }
  }

  async pauseProject(name) {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/pause`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        this.updateProject(name, { status: 'paused' });
        this.showToast(`Paused execution for "${name}"`, 'success');
      } else {
        this.showToast('Failed to pause: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to pause project:', error);
      this.showToast('Failed to pause project', 'error');
    }
  }

  async resumeProject(name) {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/resume`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        this.updateProject(name, { status: 'executing' });
        this.showToast(`Resumed execution for "${name}"`, 'success');
      } else {
        this.showToast('Failed to resume: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to resume project:', error);
      this.showToast('Failed to resume project', 'error');
    }
  }

  async stopProject(name) {
    if (!confirm(`Are you sure you want to stop execution for "${name}"?`)) return;

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/stop`, {
        method: 'POST'
      });

      const data = await res.json();

      if (data.success) {
        this.updateProject(name, { status: 'connected', percentage: 0 });
        this.showToast(`Stopped execution for "${name}"`, 'success');
      } else {
        this.showToast('Failed to stop: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to stop project:', error);
      this.showToast('Failed to stop project', 'error');
    }
  }

  // ==================== Modal ====================

  showConnectModal() {
    this.connectModal.classList.add('visible');
    this.projectPathInput.value = '';
    this.connectBtn.disabled = true;
    this.projectPathInput.focus();
  }

  hideConnectModal() {
    this.connectModal.classList.remove('visible');
    this.projectPathInput.value = '';
  }

  setupPathInput() {
    this.projectPathInput.addEventListener('input', () => {
      this.connectBtn.disabled = !this.projectPathInput.value.trim();
    });

    // Close modal on overlay click
    this.connectModal.addEventListener('click', (e) => {
      if (e.target === this.connectModal) {
        this.hideConnectModal();
      }
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.connectModal.classList.contains('visible')) {
        this.hideConnectModal();
      }
    });
  }

  // ==================== Toast ====================

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Global functions for inline onclick handlers
let dashboard;

function showConnectModal() {
  dashboard.showConnectModal();
}

function hideConnectModal() {
  dashboard.hideConnectModal();
}

function connectProject() {
  dashboard.connectProject();
}

function handlePathKeyup(event) {
  if (event.key === 'Enter') {
    dashboard.connectProject();
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new ProjectsDashboard();
});
