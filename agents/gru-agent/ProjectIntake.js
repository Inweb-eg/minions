/**
 * ProjectIntake
 * -------------
 * Handles the two project intake flows - new projects and existing projects.
 * For existing projects, uses auto-detection with confirmation.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../foundation/common/logger.js';
import ProjectScanner from '../project-manager-agent/ProjectScanner.js';

export class ProjectIntake extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('ProjectIntake');

    this.config = {
      projectsDir: config.projectsDir || 'projects',
      projectRoot: config.projectRoot || process.cwd(),
      ...config
    };

    this.scanner = new ProjectScanner(this.config);
    this.currentProject = null;
    this.intakeState = 'idle'; // idle, new, existing, confirming, complete
  }

  /**
   * Start new project intake
   * @param {object} projectInfo - Initial project info
   */
  async startNewProject(projectInfo = {}) {
    this.intakeState = 'new';
    this.currentProject = {
      type: 'new',
      name: projectInfo.name || null,
      description: projectInfo.description || null,
      features: [],
      technologies: {},
      createdAt: new Date().toISOString()
    };

    this.emit('started', { type: 'new' });

    return {
      type: 'new',
      questions: this._getNewProjectQuestions()
    };
  }

  /**
   * Start existing project intake
   * @param {object} projectInfo - Project info including path
   */
  async startExistingProject(projectInfo = {}) {
    this.intakeState = 'existing';
    this.currentProject = {
      type: 'existing',
      name: projectInfo.name || null,
      path: projectInfo.path || null,
      components: [],
      detectedStructure: null,
      createdAt: new Date().toISOString()
    };

    this.emit('started', { type: 'existing' });

    return {
      type: 'existing',
      needsPath: !projectInfo.path,
      message: projectInfo.path
        ? 'Scanning project structure...'
        : 'Please provide the path to your project folder.'
    };
  }

  /**
   * Collect project information
   * @param {object} info - Project information to collect
   */
  async collectProjectInfo(info) {
    if (!this.currentProject) {
      throw new Error('No project intake in progress');
    }

    // Merge info into current project
    Object.assign(this.currentProject, info);

    if (this.currentProject.type === 'new') {
      return this._handleNewProjectInfo(info);
    } else {
      return this._handleExistingProjectInfo(info);
    }
  }

  /**
   * Handle new project info collection
   * @private
   */
  _handleNewProjectInfo(info) {
    const missing = [];

    if (!this.currentProject.name) missing.push('name');
    if (!this.currentProject.description) missing.push('description');

    if (missing.length > 0) {
      return {
        complete: false,
        missing,
        message: `Please provide: ${missing.join(', ')}`
      };
    }

    return {
      complete: true,
      project: this.currentProject,
      message: 'Project info collected. Ready to discuss features.'
    };
  }

  /**
   * Handle existing project info collection
   * @private
   */
  async _handleExistingProjectInfo(info) {
    if (info.path) {
      this.currentProject.path = info.path;

      // Validate path exists
      try {
        const stats = await fs.stat(info.path);
        if (!stats.isDirectory()) {
          return {
            complete: false,
            error: 'Path is not a directory',
            message: 'The provided path is not a directory. Please provide a valid project folder path.'
          };
        }
      } catch (error) {
        return {
          complete: false,
          error: 'Path not found',
          message: 'The provided path does not exist. Please check the path and try again.'
        };
      }

      // Auto-detect structure
      const detected = await this.detectProjectStructure(info.path);
      return detected;
    }

    return {
      complete: false,
      needsPath: true,
      message: 'Please provide the path to your project folder.'
    };
  }

  /**
   * Auto-detect project structure using Silas's scanner
   * @param {string} projectPath - Path to project
   */
  async detectProjectStructure(projectPath) {
    this.logger.info(`Scanning project at: ${projectPath}`);
    this.emit('scanning', { path: projectPath });

    try {
      const scanResult = await this.scanner.scan(projectPath);

      this.currentProject.name = this.currentProject.name || path.basename(projectPath);
      this.currentProject.detectedStructure = scanResult;

      // Build friendly summary
      const summary = this._buildDetectedSummary(scanResult);

      this.intakeState = 'confirming';
      this.emit('scanned', { result: scanResult, summary });

      return {
        complete: false,
        needsConfirmation: true,
        detected: scanResult,
        summary,
        message: `I scanned your project and found:\n\n${summary}\n\nIs this correct? Anything missing or incorrect?`
      };
    } catch (error) {
      this.logger.error(`Scan failed: ${error.message}`);
      return {
        complete: false,
        error: error.message,
        message: `Failed to scan project: ${error.message}`
      };
    }
  }

  /**
   * Build friendly summary of detected structure
   * @private
   */
  _buildDetectedSummary(scanResult) {
    const lines = [];

    // Frameworks
    if (scanResult.framework && scanResult.framework.length > 0) {
      const frameworks = scanResult.framework.filter(f => f !== 'Unknown');
      if (frameworks.length > 0) {
        lines.push(`**Frameworks:** ${frameworks.join(', ')}`);
      }
    }

    // Languages
    if (scanResult.language && scanResult.language.length > 0) {
      const languages = scanResult.language.filter(l => l !== 'Unknown');
      if (languages.length > 0) {
        lines.push(`**Languages:** ${languages.join(', ')}`);
      }
    }

    // Components
    if (scanResult.components && scanResult.components.length > 0) {
      lines.push('\n**Components Found:**');
      for (const comp of scanResult.components) {
        const icon = this._getComponentIcon(comp.type);
        lines.push(`  ${icon} ${comp.name} (${comp.type})`);
      }
    }

    return lines.length > 0 ? lines.join('\n') : 'Could not detect project structure.';
  }

  /**
   * Get icon for component type
   * @private
   */
  _getComponentIcon(type) {
    const icons = {
      'source': '📁',
      'backend': '⚙️',
      'frontend': '🖥️',
      'api': '🔌',
      'web': '🌐',
      'mobile': '📱',
      'admin': '👤',
      'app': '📦',
      'tests': '🧪',
      'documentation': '📚',
      'monorepo-apps': '📂',
      'monorepo-packages': '📦'
    };
    return icons[type] || '📄';
  }

  /**
   * Confirm detected structure
   * @param {object} confirmation - Confirmation data
   */
  async confirmStructure(confirmation = {}) {
    if (this.intakeState !== 'confirming') {
      throw new Error('No structure to confirm');
    }

    const { confirmed, corrections, additionalPaths } = confirmation;

    if (confirmed) {
      // Apply any corrections
      if (corrections) {
        this.currentProject.detectedStructure = {
          ...this.currentProject.detectedStructure,
          ...corrections
        };
      }

      // Add additional paths if provided
      if (additionalPaths && additionalPaths.length > 0) {
        for (const addPath of additionalPaths) {
          this.currentProject.detectedStructure.components.push({
            name: path.basename(addPath.path),
            type: addPath.type,
            path: addPath.path
          });
        }
      }

      this.intakeState = 'complete';
      this.emit('confirmed', { project: this.currentProject });

      return {
        complete: true,
        project: this.currentProject,
        message: 'Project structure confirmed. Ready to create a plan.'
      };
    } else {
      // Need more information
      return {
        complete: false,
        needsCorrection: true,
        message: 'Please tell me what needs to be corrected or what paths are missing.'
      };
    }
  }

  /**
   * Collect missing paths for existing project
   * @param {array} paths - Array of {type, path} objects
   */
  async collectMissingPaths(paths) {
    if (!this.currentProject || !this.currentProject.detectedStructure) {
      throw new Error('No project structure to update');
    }

    for (const p of paths) {
      // Validate path exists
      try {
        await fs.access(p.path);
        this.currentProject.detectedStructure.components.push({
          name: path.basename(p.path),
          type: p.type,
          path: p.path,
          addedManually: true
        });
      } catch (error) {
        this.logger.warn(`Path not found: ${p.path}`);
      }
    }

    return {
      added: paths.length,
      components: this.currentProject.detectedStructure.components
    };
  }

  /**
   * Generate project configuration
   */
  generateProjectConfig() {
    if (!this.currentProject) {
      throw new Error('No project in progress');
    }

    const config = {
      name: this.currentProject.name,
      type: this.currentProject.type,
      version: '1.0.0',
      description: this.currentProject.description || '',
      createdAt: this.currentProject.createdAt,
      ...(this.currentProject.type === 'existing' ? {
        sourcePath: this.currentProject.path,
        framework: this.currentProject.detectedStructure?.framework || [],
        language: this.currentProject.detectedStructure?.language || [],
        components: this.currentProject.detectedStructure?.components || []
      } : {
        features: this.currentProject.features || [],
        technologies: this.currentProject.technologies || {}
      })
    };

    return config;
  }

  /**
   * Get questions for new project
   * @private
   */
  _getNewProjectQuestions() {
    return [
      {
        id: 'name',
        question: 'What would you like to name your project?',
        type: 'text',
        required: true
      },
      {
        id: 'description',
        question: 'Briefly describe what your project will do:',
        type: 'text',
        required: true
      },
      {
        id: 'type',
        question: 'What type of application is this?',
        type: 'choice',
        options: ['Web Application', 'Mobile App', 'API/Backend', 'Full Stack', 'Desktop App'],
        required: true
      }
    ];
  }

  /**
   * Get current project
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * Get intake state
   */
  getState() {
    return this.intakeState;
  }

  /**
   * Reset intake
   */
  reset() {
    this.currentProject = null;
    this.intakeState = 'idle';
    this.emit('reset');
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.reset();
    this.removeAllListeners();
  }
}

export default ProjectIntake;
