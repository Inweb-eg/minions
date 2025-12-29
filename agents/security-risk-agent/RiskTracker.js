/**
 * RiskTracker
 * -----------
 * Tracks and manages project risks.
 * Maintains risks.json in the project folder.
 *
 * Risk Categories:
 * - Technical: Architecture, dependencies, scalability
 * - Security: Vulnerabilities, data protection
 * - Operational: Deployment, monitoring, maintenance
 * - Business: Timeline, resources, requirements
 * - External: Third-party dependencies, regulations
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

// Risk status
export const RiskStatus = {
  IDENTIFIED: 'identified',
  ANALYZING: 'analyzing',
  MITIGATING: 'mitigating',
  MITIGATED: 'mitigated',
  MONITORING: 'monitoring',
  CLOSED: 'closed',
  ACCEPTED: 'accepted'
};

// Risk severity (matches main agent)
export const RiskSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

// Risk categories
export const RiskCategory = {
  TECHNICAL: 'technical',
  SECURITY: 'security',
  OPERATIONAL: 'operational',
  BUSINESS: 'business',
  EXTERNAL: 'external'
};

export class RiskTracker extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.projectPath = null;
    this.risks = {
      version: '1.0.0',
      lastUpdated: null,
      items: [],
      history: []
    };
    this.riskId = 0;
  }

  async initialize() {
    // Nothing to initialize until project path is set
  }

  /**
   * Set project path and load existing risks
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;
    await this._loadRisks();
  }

  /**
   * Add a new risk
   */
  async add(risk) {
    const newRisk = {
      id: `risk-${++this.riskId}-${Date.now()}`,
      title: risk.title,
      description: risk.description || '',
      category: risk.category || RiskCategory.TECHNICAL,
      severity: risk.severity || RiskSeverity.MEDIUM,
      likelihood: risk.likelihood || 'medium',  // low, medium, high
      impact: risk.impact || 'medium',          // low, medium, high
      status: RiskStatus.IDENTIFIED,
      owner: risk.owner || '',
      affectedAreas: risk.affectedAreas || [],
      triggers: risk.triggers || [],            // What would trigger this risk
      mitigationPlan: risk.mitigationPlan || '',
      contingencyPlan: risk.contingencyPlan || '',
      mitigations: [],
      identifiedBy: risk.identifiedBy,
      identifiedAt: risk.identifiedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: risk.dueDate || null,
      reviewDate: risk.reviewDate || null
    };

    // Calculate risk score
    newRisk.score = this._calculateRiskScore(newRisk);

    this.risks.items.push(newRisk);
    this.risks.lastUpdated = new Date().toISOString();

    // Add to history
    this._addHistoryEntry('RISK_ADDED', newRisk);

    await this.save();
    this.emit('risk:added', newRisk);

    // Auto-escalate critical risks
    if (newRisk.severity === RiskSeverity.CRITICAL) {
      this.emit('risk:escalated', newRisk);
    }

    return newRisk;
  }

  /**
   * Update existing risk
   */
  async update(riskId, updates) {
    const index = this.risks.items.findIndex(r => r.id === riskId);
    if (index === -1) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    const oldRisk = { ...this.risks.items[index] };

    this.risks.items[index] = {
      ...this.risks.items[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Recalculate score if relevant fields changed
    if (updates.severity || updates.likelihood || updates.impact) {
      this.risks.items[index].score = this._calculateRiskScore(this.risks.items[index]);
    }

    this.risks.lastUpdated = new Date().toISOString();

    // Track what changed
    this._addHistoryEntry('RISK_UPDATED', {
      riskId,
      changes: Object.keys(updates),
      oldValues: Object.keys(updates).reduce((acc, key) => {
        acc[key] = oldRisk[key];
        return acc;
      }, {})
    });

    await this.save();
    return this.risks.items[index];
  }

  /**
   * Mark risk as mitigated
   */
  async mitigate(riskId, mitigation) {
    const risk = this.risks.items.find(r => r.id === riskId);
    if (!risk) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    const mitigationEntry = {
      id: `mitigation-${Date.now()}`,
      description: mitigation.description,
      type: mitigation.type || 'reduce',  // avoid, reduce, transfer, accept
      effectiveness: mitigation.effectiveness || 100,  // percentage
      implementedBy: mitigation.mitigatedBy,
      implementedAt: mitigation.mitigatedAt || new Date().toISOString(),
      evidence: mitigation.evidence || ''
    };

    risk.mitigations.push(mitigationEntry);
    risk.status = RiskStatus.MITIGATED;
    risk.updatedAt = new Date().toISOString();

    // Recalculate score based on mitigation
    const effectiveReduction = mitigationEntry.effectiveness / 100;
    risk.residualScore = risk.score * (1 - effectiveReduction);

    this.risks.lastUpdated = new Date().toISOString();

    this._addHistoryEntry('RISK_MITIGATED', { riskId, mitigation: mitigationEntry });

    await this.save();
    return risk;
  }

  /**
   * Accept a risk (conscious decision not to mitigate)
   */
  async accept(riskId, acceptance) {
    const risk = this.risks.items.find(r => r.id === riskId);
    if (!risk) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    risk.status = RiskStatus.ACCEPTED;
    risk.acceptedBy = acceptance.acceptedBy;
    risk.acceptedAt = new Date().toISOString();
    risk.acceptanceReason = acceptance.reason;
    risk.reviewDate = acceptance.reviewDate || null;
    risk.updatedAt = new Date().toISOString();

    this._addHistoryEntry('RISK_ACCEPTED', {
      riskId,
      reason: acceptance.reason,
      acceptedBy: acceptance.acceptedBy
    });

    await this.save();
    return risk;
  }

  /**
   * Analyze all risks and return summary
   */
  async analyze() {
    const active = this.risks.items.filter(
      r => r.status !== RiskStatus.CLOSED && r.status !== RiskStatus.MITIGATED
    );

    // Sort by score descending
    active.sort((a, b) => (b.score || 0) - (a.score || 0));

    return active;
  }

  /**
   * Get all active (non-closed) risks
   */
  async getActive() {
    return this.risks.items.filter(
      r => r.status !== RiskStatus.CLOSED
    );
  }

  /**
   * Get critical unmitigated risks
   */
  async getCriticalUnmitigated() {
    return this.risks.items.filter(
      r => r.severity === RiskSeverity.CRITICAL &&
           r.status !== RiskStatus.MITIGATED &&
           r.status !== RiskStatus.CLOSED
    );
  }

  /**
   * Get risk summary statistics
   */
  async getSummary() {
    const items = this.risks.items;
    const bySeverity = {};
    const byStatus = {};
    const byCategory = {};

    for (const risk of items) {
      bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;
      byStatus[risk.status] = (byStatus[risk.status] || 0) + 1;
      byCategory[risk.category] = (byCategory[risk.category] || 0) + 1;
    }

    const active = items.filter(r =>
      r.status !== RiskStatus.CLOSED && r.status !== RiskStatus.MITIGATED
    );

    const totalScore = active.reduce((sum, r) => sum + (r.score || 0), 0);
    const avgScore = active.length > 0 ? totalScore / active.length : 0;

    return {
      totalRisks: items.length,
      activeRisks: active.length,
      bySeverity,
      byStatus,
      byCategory,
      averageScore: Math.round(avgScore * 100) / 100,
      criticalCount: bySeverity[RiskSeverity.CRITICAL] || 0,
      highCount: bySeverity[RiskSeverity.HIGH] || 0,
      lastUpdated: this.risks.lastUpdated
    };
  }

  /**
   * Get risks by category
   */
  async getByCategory(category) {
    return this.risks.items.filter(r => r.category === category);
  }

  /**
   * Get risks due for review
   */
  async getDueForReview() {
    const now = new Date();
    return this.risks.items.filter(r => {
      if (!r.reviewDate) return false;
      return new Date(r.reviewDate) <= now;
    });
  }

  /**
   * Validate risks.json file
   */
  async validateFile() {
    const result = { valid: true, severity: 'info', issues: [] };

    if (!this.projectPath) {
      result.issues.push({ type: 'warning', message: 'Project path not set' });
      return result;
    }

    const risksPath = path.join(this.projectPath, 'risks.json');

    try {
      await fs.access(risksPath);

      // Validate content
      const content = await fs.readFile(risksPath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.items || !Array.isArray(data.items)) {
        result.valid = false;
        result.severity = 'error';
        result.issues.push({ type: 'error', message: 'Invalid risks.json structure' });
      }

      // Check for risks without required fields
      for (const risk of (data.items || [])) {
        if (!risk.title) {
          result.issues.push({
            type: 'warning',
            message: `Risk ${risk.id} missing title`
          });
        }
        if (!risk.severity) {
          result.issues.push({
            type: 'warning',
            message: `Risk ${risk.id} missing severity`
          });
        }
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        result.issues.push({
          type: 'warning',
          message: 'risks.json not found (will be created)'
        });
      } else if (error instanceof SyntaxError) {
        result.valid = false;
        result.severity = 'error';
        result.issues.push({ type: 'error', message: 'Invalid JSON in risks.json' });
      } else {
        result.issues.push({ type: 'error', message: error.message });
      }
    }

    return result;
  }

  /**
   * Get risk history
   */
  async getHistory(filter = {}) {
    let history = [...this.risks.history];

    if (filter.riskId) {
      history = history.filter(h => h.riskId === filter.riskId);
    }

    if (filter.action) {
      history = history.filter(h => h.action === filter.action);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(h => new Date(h.timestamp) >= since);
    }

    // Sort by timestamp descending
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (filter.limit) {
      history = history.slice(0, filter.limit);
    }

    return history;
  }

  /**
   * Save risks to disk
   */
  async save() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'risks.json');
    await fs.writeFile(filePath, JSON.stringify(this.risks, null, 2));
  }

  // Private methods

  async _loadRisks() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'risks.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.risks = JSON.parse(content);

      // Update risk ID counter
      const maxId = this.risks.items.reduce((max, r) => {
        const num = parseInt(r.id.split('-')[1]) || 0;
        return Math.max(max, num);
      }, 0);
      this.riskId = maxId;
    } catch (error) {
      // File doesn't exist, use default
    }
  }

  _calculateRiskScore(risk) {
    // Risk score = Likelihood × Impact × Severity Weight
    const likelihoodValues = { low: 1, medium: 2, high: 3 };
    const impactValues = { low: 1, medium: 2, high: 3 };
    const severityWeights = {
      [RiskSeverity.CRITICAL]: 5,
      [RiskSeverity.HIGH]: 4,
      [RiskSeverity.MEDIUM]: 3,
      [RiskSeverity.LOW]: 2,
      [RiskSeverity.INFO]: 1
    };

    const likelihood = likelihoodValues[risk.likelihood] || 2;
    const impact = impactValues[risk.impact] || 2;
    const weight = severityWeights[risk.severity] || 3;

    return likelihood * impact * weight;
  }

  _addHistoryEntry(action, data) {
    this.risks.history.push({
      id: `history-${Date.now()}`,
      action,
      data,
      timestamp: new Date().toISOString()
    });

    // Keep only last 1000 history entries
    if (this.risks.history.length > 1000) {
      this.risks.history = this.risks.history.slice(-1000);
    }
  }
}

export default RiskTracker;
