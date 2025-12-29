/**
 * AuditLogger
 * -----------
 * Maintains security audit trail for all security-relevant actions.
 * Stores in security/audit-log.json
 *
 * Tracks:
 * - Security scans and results
 * - Risk changes (added, updated, mitigated)
 * - Threat model updates
 * - Access and permission changes
 * - Validation results
 * - Security alerts
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

// Audit entry types
export const AuditType = {
  SCAN: 'scan',
  RISK: 'risk',
  THREAT: 'threat',
  ACCESS: 'access',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  ALERT: 'alert',
  CONFIG: 'config',
  DEPLOYMENT: 'deployment',
  INCIDENT: 'incident'
};

// Audit severity
export const AuditSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

export class AuditLogger extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxEntries: config.maxEntries || 10000,
      flushInterval: config.flushInterval || 30000,  // 30 seconds
      alertThreshold: config.alertThreshold || 10,    // entries before alert check
      ...config
    };
    this.projectPath = null;
    this.auditLog = {
      version: '1.0.0',
      projectName: '',
      entries: [],
      alerts: [],
      statistics: {
        totalEntries: 0,
        byType: {},
        bySeverity: {},
        lastEntry: null
      }
    };
    this.pendingEntries = [];
    this.flushTimer = null;
  }

  async initialize() {
    // Start periodic flush
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this._flushPending();
      }, this.config.flushInterval);
    }
  }

  /**
   * Set project path and load existing audit log
   */
  async setProjectPath(securityPath) {
    this.projectPath = securityPath;
    await this._ensureDirectory();
    await this._loadAuditLog();
  }

  /**
   * Log an audit entry
   */
  async log(entry) {
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: entry.type || AuditType.INFO,
      action: entry.action,
      severity: entry.severity || AuditSeverity.INFO,
      agent: entry.agent || 'Tom',
      project: entry.project || this.auditLog.projectName,
      details: entry.details || {},
      // Additional context
      user: entry.user || 'system',
      source: entry.source || 'agent',
      correlationId: entry.correlationId || null,
      metadata: entry.metadata || {}
    };

    // Add to pending entries (batched write)
    this.pendingEntries.push(auditEntry);

    // Update statistics
    this._updateStatistics(auditEntry);

    // Check for alert conditions
    await this._checkAlerts(auditEntry);

    // Immediate flush for critical entries
    if (auditEntry.severity === AuditSeverity.CRITICAL) {
      await this._flushPending();
    }

    // Flush if threshold reached
    if (this.pendingEntries.length >= this.config.alertThreshold) {
      await this._flushPending();
    }

    return auditEntry;
  }

  /**
   * Log a security alert
   */
  async alert(alert) {
    const auditAlert = {
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: alert.type,
      title: alert.title,
      description: alert.description,
      severity: alert.severity || AuditSeverity.WARNING,
      source: alert.source || 'security-scan',
      affectedResources: alert.affectedResources || [],
      recommendations: alert.recommendations || [],
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null
    };

    this.auditLog.alerts.push(auditAlert);

    // Also log as entry
    await this.log({
      type: AuditType.ALERT,
      action: 'ALERT_RAISED',
      severity: alert.severity,
      details: {
        alertId: auditAlert.id,
        title: auditAlert.title
      }
    });

    // Emit alert event
    this.emit('alert', auditAlert);

    await this._save();
    return auditAlert;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.auditLog.alerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date().toISOString();

    await this.log({
      type: AuditType.ALERT,
      action: 'ALERT_ACKNOWLEDGED',
      details: { alertId, acknowledgedBy }
    });

    await this._save();
    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, resolvedBy, resolution) {
    const alert = this.auditLog.alerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.resolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date().toISOString();
    alert.resolution = resolution;

    await this.log({
      type: AuditType.ALERT,
      action: 'ALERT_RESOLVED',
      details: { alertId, resolvedBy, resolution }
    });

    await this._save();
    return alert;
  }

  /**
   * Query audit log entries
   */
  async query(filter = {}) {
    let entries = [...this.auditLog.entries];

    // Apply filters
    if (filter.type) {
      entries = entries.filter(e => e.type === filter.type);
    }

    if (filter.action) {
      entries = entries.filter(e => e.action === filter.action);
    }

    if (filter.severity) {
      entries = entries.filter(e => e.severity === filter.severity);
    }

    if (filter.agent) {
      entries = entries.filter(e => e.agent === filter.agent);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      entries = entries.filter(e => new Date(e.timestamp) >= since);
    }

    if (filter.until) {
      const until = new Date(filter.until);
      entries = entries.filter(e => new Date(e.timestamp) <= until);
    }

    if (filter.correlationId) {
      entries = entries.filter(e => e.correlationId === filter.correlationId);
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    if (filter.limit) {
      const offset = filter.offset || 0;
      entries = entries.slice(offset, offset + filter.limit);
    }

    return entries;
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit = 20) {
    const entries = [...this.auditLog.entries];
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return entries.slice(0, limit);
  }

  /**
   * Get active (unresolved) alerts
   */
  async getActiveAlerts() {
    return this.auditLog.alerts.filter(a => !a.resolved);
  }

  /**
   * Get audit statistics
   */
  async getStatistics() {
    return { ...this.auditLog.statistics };
  }

  /**
   * Get entries for a specific time range
   */
  async getEntriesForPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.auditLog.entries.filter(e => {
      const timestamp = new Date(e.timestamp);
      return timestamp >= start && timestamp <= end;
    });
  }

  /**
   * Generate audit report
   */
  async generateReport(options = {}) {
    const { startDate, endDate, includeAlerts = true } = options;

    const entries = startDate && endDate
      ? await this.getEntriesForPeriod(startDate, endDate)
      : this.auditLog.entries;

    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate || 'all-time',
        end: endDate || 'now'
      },
      summary: {
        totalEntries: entries.length,
        byType: {},
        bySeverity: {},
        byAgent: {}
      },
      criticalEvents: [],
      alerts: includeAlerts ? this.auditLog.alerts : []
    };

    // Calculate summary
    for (const entry of entries) {
      report.summary.byType[entry.type] = (report.summary.byType[entry.type] || 0) + 1;
      report.summary.bySeverity[entry.severity] = (report.summary.bySeverity[entry.severity] || 0) + 1;
      report.summary.byAgent[entry.agent] = (report.summary.byAgent[entry.agent] || 0) + 1;

      if (entry.severity === AuditSeverity.CRITICAL || entry.severity === AuditSeverity.ERROR) {
        report.criticalEvents.push(entry);
      }
    }

    return report;
  }

  /**
   * Flush pending entries to disk
   */
  async flush() {
    await this._flushPending();
  }

  /**
   * Shutdown - flush and cleanup
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this._flushPending();
  }

  // Private methods

  async _ensureDirectory() {
    if (!this.projectPath) return;
    await fs.mkdir(this.projectPath, { recursive: true });
  }

  async _loadAuditLog() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'audit-log.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.auditLog = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, use default
    }
  }

  async _save() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'audit-log.json');
    await fs.writeFile(filePath, JSON.stringify(this.auditLog, null, 2));
  }

  async _flushPending() {
    if (this.pendingEntries.length === 0) return;

    // Add pending entries to main log
    this.auditLog.entries.push(...this.pendingEntries);
    this.pendingEntries = [];

    // Trim if exceeds max entries
    if (this.auditLog.entries.length > this.config.maxEntries) {
      // Keep newest entries
      this.auditLog.entries = this.auditLog.entries.slice(-this.config.maxEntries);
    }

    await this._save();
  }

  _updateStatistics(entry) {
    const stats = this.auditLog.statistics;

    stats.totalEntries++;
    stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
    stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
    stats.lastEntry = entry.timestamp;
  }

  async _checkAlerts(entry) {
    // Check for patterns that should trigger alerts
    const alertConditions = [
      {
        condition: entry.action === 'SECRET_DETECTED',
        alert: {
          type: 'secret_exposure',
          title: 'Secret Detected in Code',
          description: 'A potential secret or credential was detected',
          severity: AuditSeverity.CRITICAL,
          recommendations: [
            'Remove the secret from code immediately',
            'Rotate the exposed credential',
            'Use environment variables or secret management'
          ]
        }
      },
      {
        condition: entry.action === 'CRITICAL_VULNERABILITY',
        alert: {
          type: 'critical_vulnerability',
          title: 'Critical Vulnerability Found',
          description: 'A critical security vulnerability was detected',
          severity: AuditSeverity.CRITICAL,
          recommendations: [
            'Review and fix the vulnerability immediately',
            'Do not deploy until resolved'
          ]
        }
      },
      {
        condition: entry.action === 'VALIDATION_FAILED' && entry.severity === AuditSeverity.ERROR,
        alert: {
          type: 'validation_failure',
          title: 'Security Validation Failed',
          description: 'Pre-execution security validation failed',
          severity: AuditSeverity.WARNING,
          recommendations: [
            'Review validation errors',
            'Fix issues before proceeding'
          ]
        }
      }
    ];

    for (const { condition, alert } of alertConditions) {
      if (condition) {
        await this.alert({
          ...alert,
          source: entry.action,
          affectedResources: entry.details?.files || []
        });
      }
    }
  }
}

export default AuditLogger;
