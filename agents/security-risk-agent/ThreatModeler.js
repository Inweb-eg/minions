/**
 * ThreatModeler
 * -------------
 * Manages threat models using STRIDE methodology.
 * Maintains security/threat-model.json and security/permissions.json
 *
 * STRIDE Categories:
 * - Spoofing: Impersonating something or someone
 * - Tampering: Modifying data or code
 * - Repudiation: Claiming to not have performed an action
 * - Information Disclosure: Exposing information to unauthorized parties
 * - Denial of Service: Denying or degrading service
 * - Elevation of Privilege: Gaining capabilities without authorization
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

// Threat status
export const ThreatStatus = {
  IDENTIFIED: 'identified',
  ANALYZING: 'analyzing',
  MITIGATED: 'mitigated',
  ACCEPTED: 'accepted',      // Risk accepted, not mitigating
  TRANSFERRED: 'transferred' // Risk transferred (e.g., insurance)
};

// STRIDE categories
export const StrideCategory = {
  SPOOFING: 'spoofing',
  TAMPERING: 'tampering',
  REPUDIATION: 'repudiation',
  INFO_DISCLOSURE: 'info_disclosure',
  DENIAL_OF_SERVICE: 'dos',
  ELEVATION: 'elevation'
};

export class ThreatModeler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.projectPath = null;
    this.threatModel = {
      version: '1.0.0',
      lastUpdated: null,
      assets: [],
      threats: [],
      mitigations: [],
      dataFlows: []
    };
    this.permissions = {
      roles: [],
      resources: [],
      policies: []
    };
    this.threatId = 0;
  }

  async initialize() {
    // Nothing to initialize until project path is set
  }

  /**
   * Set project path and load existing threat model
   */
  async setProjectPath(securityPath) {
    this.projectPath = securityPath;
    await this._ensureDirectory();
    await this._loadThreatModel();
    await this._loadPermissions();
  }

  /**
   * Add a new threat to the model
   */
  async add(threat) {
    const newThreat = {
      id: `threat-${++this.threatId}-${Date.now()}`,
      title: threat.title,
      description: threat.description || '',
      category: threat.category || StrideCategory.INFO_DISCLOSURE,
      affectedAssets: threat.affectedAssets || [],
      attackVector: threat.attackVector || '',
      likelihood: threat.likelihood || 'medium',  // low, medium, high
      impact: threat.impact || 'medium',          // low, medium, high
      status: ThreatStatus.IDENTIFIED,
      mitigations: [],
      addedBy: threat.addedBy,
      addedAt: threat.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.threatModel.threats.push(newThreat);
    this.threatModel.lastUpdated = new Date().toISOString();

    await this.save();
    this.emit('threat:added', newThreat);

    return newThreat;
  }

  /**
   * Update existing threat
   */
  async update(threatId, updates) {
    const index = this.threatModel.threats.findIndex(t => t.id === threatId);
    if (index === -1) {
      throw new Error(`Threat not found: ${threatId}`);
    }

    this.threatModel.threats[index] = {
      ...this.threatModel.threats[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.threatModel.lastUpdated = new Date().toISOString();
    await this.save();

    return this.threatModel.threats[index];
  }

  /**
   * Mark threat as mitigated
   */
  async mitigate(threatId, mitigation) {
    const threat = this.threatModel.threats.find(t => t.id === threatId);
    if (!threat) {
      throw new Error(`Threat not found: ${threatId}`);
    }

    const mitigationEntry = {
      id: `mitigation-${Date.now()}`,
      description: mitigation.description,
      implementedBy: mitigation.implementedBy,
      implementedAt: new Date().toISOString(),
      effectiveness: mitigation.effectiveness || 'full' // full, partial
    };

    threat.mitigations.push(mitigationEntry);
    threat.status = mitigation.effectiveness === 'full'
      ? ThreatStatus.MITIGATED
      : ThreatStatus.ANALYZING;
    threat.updatedAt = new Date().toISOString();

    // Also add to global mitigations list
    this.threatModel.mitigations.push({
      ...mitigationEntry,
      threatId
    });

    this.threatModel.lastUpdated = new Date().toISOString();
    await this.save();

    this.emit('threat:mitigated', { threat, mitigation: mitigationEntry });
    return threat;
  }

  /**
   * Add an asset to protect
   */
  async addAsset(asset) {
    const newAsset = {
      id: `asset-${Date.now()}`,
      name: asset.name,
      type: asset.type,  // data, service, infrastructure, user
      description: asset.description || '',
      sensitivity: asset.sensitivity || 'medium', // low, medium, high, critical
      owner: asset.owner || '',
      addedAt: new Date().toISOString()
    };

    this.threatModel.assets.push(newAsset);
    this.threatModel.lastUpdated = new Date().toISOString();
    await this.save();

    return newAsset;
  }

  /**
   * Add a data flow
   */
  async addDataFlow(flow) {
    const newFlow = {
      id: `flow-${Date.now()}`,
      name: flow.name,
      source: flow.source,
      destination: flow.destination,
      dataType: flow.dataType,
      protocol: flow.protocol || '',
      encrypted: flow.encrypted !== false,
      authenticated: flow.authenticated !== false,
      trustBoundary: flow.trustBoundary || false,
      addedAt: new Date().toISOString()
    };

    this.threatModel.dataFlows.push(newFlow);
    this.threatModel.lastUpdated = new Date().toISOString();
    await this.save();

    return newFlow;
  }

  /**
   * Update threat model based on architecture changes
   */
  async updateFromArchitecture(changes) {
    const result = {
      newThreats: [],
      updatedThreats: []
    };

    // Analyze new components for potential threats
    if (changes.newComponents) {
      for (const component of changes.newComponents) {
        const threats = this._analyzeComponentThreats(component);
        for (const threat of threats) {
          const added = await this.add(threat);
          result.newThreats.push(added);
        }
      }
    }

    // Analyze new data flows
    if (changes.newDataFlows) {
      for (const flow of changes.newDataFlows) {
        await this.addDataFlow(flow);
        const threats = this._analyzeDataFlowThreats(flow);
        for (const threat of threats) {
          const added = await this.add(threat);
          result.newThreats.push(added);
        }
      }
    }

    // Analyze new external integrations
    if (changes.newIntegrations) {
      for (const integration of changes.newIntegrations) {
        const threats = this._analyzeIntegrationThreats(integration);
        for (const threat of threats) {
          const added = await this.add(threat);
          result.newThreats.push(added);
        }
      }
    }

    return result;
  }

  /**
   * Get the full threat model
   */
  async getModel() {
    return { ...this.threatModel };
  }

  /**
   * Get summary statistics
   */
  async getSummary() {
    const threats = this.threatModel.threats;
    const byStatus = {};
    const byCategory = {};

    for (const threat of threats) {
      byStatus[threat.status] = (byStatus[threat.status] || 0) + 1;
      byCategory[threat.category] = (byCategory[threat.category] || 0) + 1;
    }

    return {
      totalThreats: threats.length,
      byStatus,
      byCategory,
      totalAssets: this.threatModel.assets.length,
      totalMitigations: this.threatModel.mitigations.length,
      lastUpdated: this.threatModel.lastUpdated
    };
  }

  /**
   * Get unmitigated threats
   */
  async getUnmitigated() {
    return this.threatModel.threats.filter(
      t => t.status === ThreatStatus.IDENTIFIED || t.status === ThreatStatus.ANALYZING
    );
  }

  /**
   * Add permission role
   */
  async addRole(role) {
    const newRole = {
      id: `role-${Date.now()}`,
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || [],
      inheritsFrom: role.inheritsFrom || [],
      createdAt: new Date().toISOString()
    };

    this.permissions.roles.push(newRole);
    await this._savePermissions();

    return newRole;
  }

  /**
   * Add permission policy
   */
  async addPolicy(policy) {
    const newPolicy = {
      id: `policy-${Date.now()}`,
      name: policy.name,
      effect: policy.effect || 'allow',  // allow, deny
      actions: policy.actions || [],
      resources: policy.resources || [],
      conditions: policy.conditions || {},
      createdAt: new Date().toISOString()
    };

    this.permissions.policies.push(newPolicy);
    await this._savePermissions();

    return newPolicy;
  }

  /**
   * Validate files exist and are valid
   */
  async validateFiles() {
    const result = { valid: true, severity: 'info', issues: [] };

    if (!this.projectPath) {
      result.issues.push({ type: 'warning', message: 'Security path not set' });
      return result;
    }

    const threatModelPath = path.join(this.projectPath, 'threat-model.json');
    const permissionsPath = path.join(this.projectPath, 'permissions.json');

    try {
      await fs.access(threatModelPath);
    } catch {
      result.issues.push({
        type: 'warning',
        message: 'threat-model.json not found (will be created)'
      });
    }

    try {
      await fs.access(permissionsPath);
    } catch {
      result.issues.push({
        type: 'info',
        message: 'permissions.json not found (optional)'
      });
    }

    // Check for unmitigated high-impact threats
    const unmitigated = await this.getUnmitigated();
    const highImpact = unmitigated.filter(t => t.impact === 'high');
    if (highImpact.length > 0) {
      result.issues.push({
        type: 'warning',
        message: `${highImpact.length} high-impact threats not mitigated`
      });
    }

    return result;
  }

  /**
   * Save threat model to disk
   */
  async save() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'threat-model.json');
    await fs.writeFile(filePath, JSON.stringify(this.threatModel, null, 2));
  }

  // Private methods

  async _ensureDirectory() {
    if (!this.projectPath) return;
    await fs.mkdir(this.projectPath, { recursive: true });
  }

  async _loadThreatModel() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'threat-model.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.threatModel = JSON.parse(content);

      // Update threat ID counter
      const maxId = this.threatModel.threats.reduce((max, t) => {
        const num = parseInt(t.id.split('-')[1]) || 0;
        return Math.max(max, num);
      }, 0);
      this.threatId = maxId;
    } catch (error) {
      // File doesn't exist, use default
    }
  }

  async _loadPermissions() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'permissions.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.permissions = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, use default
    }
  }

  async _savePermissions() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'permissions.json');
    await fs.writeFile(filePath, JSON.stringify(this.permissions, null, 2));
  }

  _analyzeComponentThreats(component) {
    const threats = [];

    // Authentication components
    if (component.type === 'auth' || component.name?.includes('auth')) {
      threats.push({
        title: `Spoofing attack on ${component.name}`,
        category: StrideCategory.SPOOFING,
        affectedAssets: [component.name],
        likelihood: 'high',
        impact: 'high'
      });
    }

    // Database components
    if (component.type === 'database' || component.name?.includes('db')) {
      threats.push({
        title: `Data tampering in ${component.name}`,
        category: StrideCategory.TAMPERING,
        affectedAssets: [component.name],
        likelihood: 'medium',
        impact: 'high'
      });
    }

    // API components
    if (component.type === 'api' || component.name?.includes('api')) {
      threats.push({
        title: `Information disclosure via ${component.name}`,
        category: StrideCategory.INFO_DISCLOSURE,
        affectedAssets: [component.name],
        likelihood: 'medium',
        impact: 'medium'
      });
    }

    return threats;
  }

  _analyzeDataFlowThreats(flow) {
    const threats = [];

    // Unencrypted flows
    if (!flow.encrypted) {
      threats.push({
        title: `Unencrypted data flow: ${flow.name}`,
        category: StrideCategory.INFO_DISCLOSURE,
        description: `Data flowing from ${flow.source} to ${flow.destination} is not encrypted`,
        likelihood: 'high',
        impact: 'high'
      });
    }

    // Trust boundary crossings
    if (flow.trustBoundary) {
      threats.push({
        title: `Trust boundary crossing: ${flow.name}`,
        category: StrideCategory.TAMPERING,
        description: `Data crossing trust boundary from ${flow.source} to ${flow.destination}`,
        likelihood: 'medium',
        impact: 'medium'
      });
    }

    return threats;
  }

  _analyzeIntegrationThreats(integration) {
    const threats = [];

    // External API integrations
    threats.push({
      title: `Third-party dependency: ${integration.name}`,
      category: StrideCategory.DENIAL_OF_SERVICE,
      description: `System depends on external service: ${integration.name}`,
      likelihood: 'medium',
      impact: 'medium'
    });

    // OAuth/API key integrations
    if (integration.authType === 'oauth' || integration.authType === 'apikey') {
      threats.push({
        title: `Credential exposure for ${integration.name}`,
        category: StrideCategory.INFO_DISCLOSURE,
        likelihood: 'medium',
        impact: 'high'
      });
    }

    return threats;
  }
}

export default ThreatModeler;
