import { createLogger } from '../../../../foundation/common/logger.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

const logger = createLogger('ChangelogUpdater');

/**
 * ChangelogUpdater - Automatically generates and updates CHANGELOG.md
 *
 * Features:
 * - Auto-generate CHANGELOG from code changes
 * - Follow Keep a Changelog format
 * - Semantic versioning integration
 * - Categorize changes (Added, Changed, Deprecated, Removed, Fixed, Security)
 * - Generate release notes
 * - Track breaking changes
 * - Link to issues and PRs
 *
 * Format: Keep a Changelog (https://keepachangelog.com/)
 */
class ChangelogUpdater {
  constructor() {
    this.logger = createLogger('ChangelogUpdater');
    this.cache = getDocumentCache();
  }

  /**
   * Initialize the updater
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.logger.info('ChangelogUpdater initialized');
  }

  /**
   * Generate CHANGELOG entry from changes
   *
   * @param {Object} changes - Changes from BreakingChangeDetector
   * @param {Object} options - Generation options
   * @returns {Object} CHANGELOG entry
   */
  generateEntry(changes, options = {}) {
    this.logger.info('Generating CHANGELOG entry...');

    const entry = {
      version: options.version || '1.0.0',
      date: options.date || new Date().toISOString().split('T')[0],
      sections: {
        added: [],
        changed: [],
        deprecated: [],
        removed: [],
        fixed: [],
        security: []
      },
      breakingChanges: [],
      summary: ''
    };

    // Categorize changes
    this.categorizeChanges(changes, entry);

    // Generate summary
    entry.summary = this.generateSummary(entry);

    this.logger.info(
      `Generated CHANGELOG entry for v${entry.version} with ` +
      `${this.countTotalChanges(entry)} changes`
    );

    return entry;
  }

  /**
   * Update existing CHANGELOG with new entry
   *
   * @param {string} existingChangelog - Current CHANGELOG content
   * @param {Object} entry - New CHANGELOG entry
   * @param {Object} options - Update options
   * @returns {string} Updated CHANGELOG content
   */
  update(existingChangelog, entry, options = {}) {
    this.logger.info(`Updating CHANGELOG for v${entry.version}...`);

    const formattedEntry = this.formatEntry(entry);

    // Insert new entry at the top (after header)
    const lines = existingChangelog.split('\n');
    const headerEndIndex = this.findHeaderEnd(lines);

    lines.splice(headerEndIndex + 1, 0, '', formattedEntry);

    const updatedChangelog = lines.join('\n');

    this.logger.info('CHANGELOG updated successfully');

    return updatedChangelog;
  }

  /**
   * Generate complete CHANGELOG from scratch
   *
   * @param {Object[]} entries - Array of CHANGELOG entries
   * @param {Object} options - Generation options
   * @returns {string} Complete CHANGELOG content
   */
  generate(entries, options = {}) {
    this.logger.info('Generating complete CHANGELOG...');

    const changelog = [];

    // Header
    changelog.push('# Changelog');
    changelog.push('');
    changelog.push('All notable changes to this project will be documented in this file.');
    changelog.push('');
    changelog.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),');
    changelog.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
    changelog.push('');

    // Add entries
    for (const entry of entries) {
      changelog.push(this.formatEntry(entry));
      changelog.push('');
    }

    this.logger.info(`Generated CHANGELOG with ${entries.length} versions`);

    return changelog.join('\n');
  }

  /**
   * Categorize changes into CHANGELOG sections
   */
  categorizeChanges(changes, entry) {
    // Process additions
    for (const change of changes.additions || []) {
      if (change.category === 'routes') {
        entry.sections.added.push({
          type: 'endpoint',
          description: `New endpoint: \`${change.newValue?.method} ${change.newValue?.path}\``,
          details: change.message
        });
      } else if (change.category === 'models') {
        entry.sections.added.push({
          type: 'model',
          description: `New model: \`${change.newValue?.name}\``,
          details: change.message
        });
      }
    }

    // Process non-breaking changes
    for (const change of changes.nonBreaking || []) {
      if (change.type === 'route_handler_changed') {
        entry.sections.changed.push({
          type: 'implementation',
          description: `Updated handler for \`${change.newValue?.method} ${change.newValue?.path}\``,
          details: change.message
        });
      } else if (change.type === 'field_made_optional') {
        entry.sections.changed.push({
          type: 'validation',
          description: `Field \`${change.model}.${change.field}\` is now optional`,
          details: change.message
        });
      }
    }

    // Process breaking changes
    for (const change of changes.breaking || []) {
      const breakingChange = {
        type: change.type,
        description: change.message,
        category: change.category,
        impact: change.impact
      };

      entry.breakingChanges.push(breakingChange);

      if (change.type === 'route_removed') {
        entry.sections.removed.push({
          type: 'endpoint',
          description: `**BREAKING**: Removed endpoint \`${change.oldValue?.method} ${change.oldValue?.path}\``,
          details: change.message,
          breaking: true
        });
      } else if (change.type === 'field_removed') {
        entry.sections.removed.push({
          type: 'field',
          description: `**BREAKING**: Removed field \`${change.model}.${change.field}\``,
          details: change.message,
          breaking: true
        });
      } else if (change.type === 'field_type_changed') {
        entry.sections.changed.push({
          type: 'schema',
          description: `**BREAKING**: Changed type of \`${change.model}.${change.field}\` from ${change.oldValue?.type} to ${change.newValue?.type}`,
          details: change.message,
          breaking: true
        });
      } else if (change.type === 'model_removed') {
        entry.sections.removed.push({
          type: 'model',
          description: `**BREAKING**: Removed model \`${change.oldValue?.name}\``,
          details: change.message,
          breaking: true
        });
      } else if (change.type === 'route_middleware_removed') {
        const removedAuth = change.removed?.some(m => m.includes('auth'));
        if (removedAuth) {
          entry.sections.security.push({
            type: 'authentication',
            description: `**BREAKING**: Removed authentication from endpoint`,
            details: change.message,
            breaking: true
          });
        } else {
          entry.sections.changed.push({
            type: 'middleware',
            description: `**BREAKING**: Changed middleware configuration`,
            details: change.message,
            breaking: true
          });
        }
      } else if (change.type === 'required_field_added' || change.type === 'field_made_required') {
        entry.sections.changed.push({
          type: 'validation',
          description: `**BREAKING**: Field \`${change.model}.${change.field}\` is now required`,
          details: change.message,
          breaking: true
        });
      }
    }
  }

  /**
   * Format CHANGELOG entry
   */
  formatEntry(entry) {
    const lines = [];

    // Version header
    lines.push(`## [${entry.version}] - ${entry.date}`);
    lines.push('');

    // Summary
    if (entry.summary) {
      lines.push(entry.summary);
      lines.push('');
    }

    // Breaking changes warning
    if (entry.breakingChanges.length > 0) {
      lines.push('### ⚠️ BREAKING CHANGES');
      lines.push('');
      for (const change of entry.breakingChanges) {
        lines.push(`- ${change.description}`);
      }
      lines.push('');
    }

    // Added section
    if (entry.sections.added.length > 0) {
      lines.push('### Added');
      lines.push('');
      for (const item of entry.sections.added) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    // Changed section
    if (entry.sections.changed.length > 0) {
      lines.push('### Changed');
      lines.push('');
      for (const item of entry.sections.changed) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    // Deprecated section
    if (entry.sections.deprecated.length > 0) {
      lines.push('### Deprecated');
      lines.push('');
      for (const item of entry.sections.deprecated) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    // Removed section
    if (entry.sections.removed.length > 0) {
      lines.push('### Removed');
      lines.push('');
      for (const item of entry.sections.removed) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    // Fixed section
    if (entry.sections.fixed.length > 0) {
      lines.push('### Fixed');
      lines.push('');
      for (const item of entry.sections.fixed) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    // Security section
    if (entry.sections.security.length > 0) {
      lines.push('### Security');
      lines.push('');
      for (const item of entry.sections.security) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * Generate summary for entry
   */
  generateSummary(entry) {
    const parts = [];

    const totalChanges = this.countTotalChanges(entry);
    const hasBreaking = entry.breakingChanges.length > 0;

    if (hasBreaking) {
      parts.push('**This release contains breaking changes.**');
    }

    if (entry.sections.added.length > 0) {
      parts.push(`Added ${entry.sections.added.length} new feature${entry.sections.added.length > 1 ? 's' : ''}.`);
    }

    if (entry.sections.changed.length > 0) {
      parts.push(`Updated ${entry.sections.changed.length} existing feature${entry.sections.changed.length > 1 ? 's' : ''}.`);
    }

    if (entry.sections.removed.length > 0) {
      parts.push(`Removed ${entry.sections.removed.length} deprecated feature${entry.sections.removed.length > 1 ? 's' : ''}.`);
    }

    if (entry.sections.security.length > 0) {
      parts.push(`**${entry.sections.security.length} security update${entry.sections.security.length > 1 ? 's' : ''}.**`);
    }

    return parts.join(' ');
  }

  /**
   * Count total changes in entry
   */
  countTotalChanges(entry) {
    return (
      entry.sections.added.length +
      entry.sections.changed.length +
      entry.sections.deprecated.length +
      entry.sections.removed.length +
      entry.sections.fixed.length +
      entry.sections.security.length
    );
  }

  /**
   * Find header end in CHANGELOG
   */
  findHeaderEnd(lines) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        return i - 1;
      }
    }
    // If no version found, insert after header
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Semantic Versioning')) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Parse existing CHANGELOG
   *
   * @param {string} changelog - CHANGELOG content
   * @returns {Object[]} Parsed entries
   */
  parse(changelog) {
    const entries = [];
    const lines = changelog.split('\n');

    let currentEntry = null;
    let currentSection = null;

    for (const line of lines) {
      // Version header
      const versionMatch = line.match(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/);
      if (versionMatch) {
        if (currentEntry) {
          entries.push(currentEntry);
        }
        currentEntry = {
          version: versionMatch[1],
          date: versionMatch[2],
          sections: {
            added: [],
            changed: [],
            deprecated: [],
            removed: [],
            fixed: [],
            security: []
          },
          breakingChanges: []
        };
        currentSection = null;
        continue;
      }

      // Section headers
      if (line.startsWith('### ')) {
        const section = line.substring(4).toLowerCase().replace(/[^a-z]/g, '');
        if (section === 'breakingchanges') {
          currentSection = 'breakingChanges';
        } else if (currentEntry?.sections[section]) {
          currentSection = section;
        }
        continue;
      }

      // List items
      if (line.startsWith('- ') && currentEntry && currentSection) {
        const description = line.substring(2);
        if (currentSection === 'breakingChanges') {
          currentEntry.breakingChanges.push({ description });
        } else {
          currentEntry.sections[currentSection].push({ description });
        }
      }
    }

    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  /**
   * Get version from CHANGELOG
   *
   * @param {string} changelog - CHANGELOG content
   * @returns {string|null} Latest version
   */
  getLatestVersion(changelog) {
    const match = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m);
    return match ? match[1] : null;
  }

  /**
   * Validate CHANGELOG format
   *
   * @param {string} changelog - CHANGELOG content
   * @returns {Object} Validation result
   */
  validate(changelog) {
    const errors = [];
    const warnings = [];

    // Check header
    if (!changelog.includes('# Changelog')) {
      errors.push('Missing Changelog header');
    }

    // Check format reference
    if (!changelog.includes('Keep a Changelog')) {
      warnings.push('Missing Keep a Changelog reference');
    }

    // Check for versions
    const versions = changelog.match(/^## \[\d+\.\d+\.\d+\]/gm);
    if (!versions || versions.length === 0) {
      errors.push('No version entries found');
    }

    // Check version format
    const invalidVersions = changelog.match(/^## \[.*?\]/gm)?.filter(v => !v.match(/^## \[\d+\.\d+\.\d+\]/));
    if (invalidVersions && invalidVersions.length > 0) {
      errors.push(`Invalid version format: ${invalidVersions.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate release notes from entry
   *
   * @param {Object} entry - CHANGELOG entry
   * @returns {string} Release notes
   */
  generateReleaseNotes(entry) {
    const lines = [];

    lines.push(`# Release ${entry.version}`);
    lines.push('');
    lines.push(`Released on ${entry.date}`);
    lines.push('');

    if (entry.summary) {
      lines.push(entry.summary);
      lines.push('');
    }

    if (entry.breakingChanges.length > 0) {
      lines.push('## ⚠️ Breaking Changes');
      lines.push('');
      for (const change of entry.breakingChanges) {
        lines.push(`- ${change.description}`);
      }
      lines.push('');
    }

    if (entry.sections.added.length > 0) {
      lines.push('## New Features');
      lines.push('');
      for (const item of entry.sections.added) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    if (entry.sections.changed.length > 0 || entry.sections.fixed.length > 0) {
      lines.push('## Improvements & Fixes');
      lines.push('');
      for (const item of [...entry.sections.changed, ...entry.sections.fixed]) {
        lines.push(`- ${item.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ChangelogUpdater
 * @returns {ChangelogUpdater}
 */
export function getChangelogUpdater() {
  if (!instance) {
    instance = new ChangelogUpdater();
  }
  return instance;
}

export { ChangelogUpdater };
export default ChangelogUpdater;
