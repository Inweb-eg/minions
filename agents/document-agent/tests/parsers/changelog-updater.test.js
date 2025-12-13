import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ChangelogUpdater, { getChangelogUpdater } from '../../parsers/code-parser/changelog-updater.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

describe('ChangelogUpdater', () => {
  let updater;
  let cache;

  beforeEach(async () => {
    updater = new ChangelogUpdater();
    await updater.initialize();

    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(updater).toBeDefined();
      expect(updater.logger).toBeDefined();
      expect(updater.cache).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getChangelogUpdater();
      const instance2 = getChangelogUpdater();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Entry Generation', () => {
    test('should generate changelog entry from changes', () => {
      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: { method: 'POST', path: '/api/users' },
            message: 'New endpoint added'
          }
        ],
        breaking: [],
        nonBreaking: []
      };

      const entry = updater.generateEntry(changes, { version: '1.1.0', date: '2024-01-01' });

      expect(entry.version).toBe('1.1.0');
      expect(entry.date).toBe('2024-01-01');
      expect(entry.sections.added.length).toBe(1);
      expect(entry.sections.added[0].description).toContain('POST /api/users');
    });

    test('should categorize route additions', () => {
      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.added.length).toBe(1);
      expect(entry.sections.added[0].type).toBe('endpoint');
    });

    test('should categorize model additions', () => {
      const changes = {
        additions: [
          {
            type: 'model_added',
            category: 'models',
            newValue: { name: 'UserSchema' }
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.added.length).toBe(1);
      expect(entry.sections.added[0].type).toBe('model');
    });

    test('should categorize handler changes', () => {
      const changes = {
        nonBreaking: [
          {
            type: 'route_handler_changed',
            category: 'routes',
            newValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.changed.length).toBe(1);
      expect(entry.sections.changed[0].type).toBe('implementation');
    });

    test('should categorize route removals as breaking', () => {
      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'DELETE', path: '/api/users/:id' },
            message: 'Route removed'
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.removed.length).toBe(1);
      expect(entry.sections.removed[0].description).toContain('BREAKING');
      expect(entry.breakingChanges.length).toBe(1);
    });

    test('should categorize field removals as breaking', () => {
      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email',
            message: 'Field removed'
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.removed.length).toBe(1);
      expect(entry.sections.removed[0].description).toContain('UserSchema.email');
      expect(entry.breakingChanges.length).toBe(1);
    });

    test('should categorize field type changes as breaking', () => {
      const changes = {
        breaking: [
          {
            type: 'field_type_changed',
            category: 'models',
            model: 'UserSchema',
            field: 'age',
            oldValue: { type: 'String' },
            newValue: { type: 'Number' },
            message: 'Type changed'
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.changed.length).toBe(1);
      expect(entry.sections.changed[0].description).toContain('BREAKING');
      expect(entry.sections.changed[0].description).toContain('String to Number');
    });

    test('should categorize security changes', () => {
      const changes = {
        breaking: [
          {
            type: 'route_middleware_removed',
            category: 'routes',
            removed: ['authenticate'],
            message: 'Auth removed'
          }
        ]
      };

      const entry = updater.generateEntry(changes);

      expect(entry.sections.security.length).toBe(1);
      expect(entry.sections.security[0].type).toBe('authentication');
      expect(entry.breakingChanges.length).toBe(1);
    });

    test('should default version and date', () => {
      const changes = { additions: [], breaking: [], nonBreaking: [] };
      const entry = updater.generateEntry(changes);

      expect(entry.version).toBeDefined();
      expect(entry.date).toBeDefined();
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Entry Formatting', () => {
    test('should format entry correctly', () => {
      const entry = {
        version: '1.0.0',
        date: '2024-01-01',
        sections: {
          added: [{ description: 'New feature' }],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const formatted = updater.formatEntry(entry);

      expect(formatted).toContain('## [1.0.0] - 2024-01-01');
      expect(formatted).toContain('### Added');
      expect(formatted).toContain('- New feature');
    });

    test('should include breaking changes section', () => {
      const entry = {
        version: '2.0.0',
        date: '2024-01-01',
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: [
          { description: 'Breaking change 1' }
        ]
      };

      const formatted = updater.formatEntry(entry);

      expect(formatted).toContain('### ⚠️ BREAKING CHANGES');
      expect(formatted).toContain('- Breaking change 1');
    });

    test('should include all non-empty sections', () => {
      const entry = {
        version: '1.0.0',
        date: '2024-01-01',
        sections: {
          added: [{ description: 'Added item' }],
          changed: [{ description: 'Changed item' }],
          deprecated: [{ description: 'Deprecated item' }],
          removed: [{ description: 'Removed item' }],
          fixed: [{ description: 'Fixed item' }],
          security: [{ description: 'Security item' }]
        },
        breakingChanges: []
      };

      const formatted = updater.formatEntry(entry);

      expect(formatted).toContain('### Added');
      expect(formatted).toContain('### Changed');
      expect(formatted).toContain('### Deprecated');
      expect(formatted).toContain('### Removed');
      expect(formatted).toContain('### Fixed');
      expect(formatted).toContain('### Security');
    });

    test('should omit empty sections', () => {
      const entry = {
        version: '1.0.0',
        date: '2024-01-01',
        sections: {
          added: [{ description: 'Added item' }],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const formatted = updater.formatEntry(entry);

      expect(formatted).toContain('### Added');
      expect(formatted).not.toContain('### Changed');
      expect(formatted).not.toContain('### Removed');
    });
  });

  describe('CHANGELOG Update', () => {
    test('should update existing changelog', () => {
      const existing = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added

- Initial release`;

      const entry = {
        version: '1.1.0',
        date: '2024-01-15',
        sections: {
          added: [{ description: 'New feature' }],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const updated = updater.update(existing, entry);

      expect(updated).toContain('[1.1.0] - 2024-01-15');
      expect(updated).toContain('[1.0.0] - 2024-01-01');
      expect(updated.indexOf('[1.1.0]')).toBeLessThan(updated.indexOf('[1.0.0]'));
    });

    test('should insert new entry after header', () => {
      const existing = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`;

      const entry = {
        version: '1.0.0',
        date: '2024-01-01',
        sections: {
          added: [{ description: 'Initial release' }],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const updated = updater.update(existing, entry);

      expect(updated).toContain('[1.0.0] - 2024-01-01');
      expect(updated).toContain('### Added');
    });
  });

  describe('CHANGELOG Generation', () => {
    test('should generate complete changelog', () => {
      const entries = [
        {
          version: '1.1.0',
          date: '2024-01-15',
          sections: {
            added: [{ description: 'New feature' }],
            changed: [],
            deprecated: [],
            removed: [],
            fixed: [],
            security: []
          },
          breakingChanges: []
        },
        {
          version: '1.0.0',
          date: '2024-01-01',
          sections: {
            added: [{ description: 'Initial release' }],
            changed: [],
            deprecated: [],
            removed: [],
            fixed: [],
            security: []
          },
          breakingChanges: []
        }
      ];

      const changelog = updater.generate(entries);

      expect(changelog).toContain('# Changelog');
      expect(changelog).toContain('Keep a Changelog');
      expect(changelog).toContain('Semantic Versioning');
      expect(changelog).toContain('[1.1.0] - 2024-01-15');
      expect(changelog).toContain('[1.0.0] - 2024-01-01');
    });

    test('should handle empty entries array', () => {
      const changelog = updater.generate([]);

      expect(changelog).toContain('# Changelog');
      expect(changelog).toContain('Keep a Changelog');
    });
  });

  describe('Summary Generation', () => {
    test('should generate summary for additions', () => {
      const entry = {
        sections: {
          added: [{ description: 'Feature 1' }, { description: 'Feature 2' }],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const summary = updater.generateSummary(entry);

      expect(summary).toContain('Added 2 new features');
    });

    test('should generate summary for changes', () => {
      const entry = {
        sections: {
          added: [],
          changed: [{ description: 'Change 1' }],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const summary = updater.generateSummary(entry);

      expect(summary).toContain('Updated 1 existing feature');
    });

    test('should include breaking changes warning', () => {
      const entry = {
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: [{ description: 'Breaking change' }]
      };

      const summary = updater.generateSummary(entry);

      expect(summary).toContain('breaking changes');
    });

    test('should highlight security updates', () => {
      const entry = {
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: [{ description: 'Security fix' }]
        },
        breakingChanges: []
      };

      const summary = updater.generateSummary(entry);

      expect(summary).toContain('security update');
    });
  });

  describe('CHANGELOG Parsing', () => {
    test('should parse changelog entries', () => {
      const changelog = `# Changelog

## [1.1.0] - 2024-01-15

### Added

- New feature

### Changed

- Updated feature

## [1.0.0] - 2024-01-01

### Added

- Initial release`;

      const entries = updater.parse(changelog);

      expect(entries.length).toBe(2);
      expect(entries[0].version).toBe('1.1.0');
      expect(entries[0].date).toBe('2024-01-15');
      expect(entries[0].sections.added.length).toBe(1);
      expect(entries[0].sections.changed.length).toBe(1);
      expect(entries[1].version).toBe('1.0.0');
    });

    test('should parse breaking changes section', () => {
      const changelog = `# Changelog

## [2.0.0] - 2024-01-01

### ⚠️ BREAKING CHANGES

- Breaking change 1

### Added

- New feature`;

      const entries = updater.parse(changelog);

      expect(entries[0].breakingChanges.length).toBe(1);
      expect(entries[0].breakingChanges[0].description).toContain('Breaking change 1');
    });

    test('should handle empty changelog', () => {
      const changelog = '# Changelog\n\nNo releases yet.';
      const entries = updater.parse(changelog);

      expect(entries.length).toBe(0);
    });
  });

  describe('Version Extraction', () => {
    test('should get latest version from changelog', () => {
      const changelog = `# Changelog

## [1.2.0] - 2024-01-15

### Added

- Feature

## [1.1.0] - 2024-01-10

### Added

- Feature`;

      const version = updater.getLatestVersion(changelog);

      expect(version).toBe('1.2.0');
    });

    test('should return null for empty changelog', () => {
      const changelog = '# Changelog\n\nNo releases.';
      const version = updater.getLatestVersion(changelog);

      expect(version).toBeNull();
    });
  });

  describe('Validation', () => {
    test('should validate correct changelog', () => {
      const changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added

- Initial release`;

      const validation = updater.validate(changelog);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect missing header', () => {
      const changelog = `## [1.0.0] - 2024-01-01

### Added

- Feature`;

      const validation = updater.validate(changelog);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing Changelog header');
    });

    test('should detect missing versions', () => {
      const changelog = `# Changelog

All notable changes to this project will be documented in this file.`;

      const validation = updater.validate(changelog);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No version entries found');
    });

    test('should warn about missing Keep a Changelog reference', () => {
      const changelog = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- Feature`;

      const validation = updater.validate(changelog);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('Keep a Changelog');
    });
  });

  describe('Release Notes Generation', () => {
    test('should generate release notes from entry', () => {
      const entry = {
        version: '1.0.0',
        date: '2024-01-01',
        summary: 'Initial release with core features',
        sections: {
          added: [{ description: 'User authentication' }],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: []
      };

      const notes = updater.generateReleaseNotes(entry);

      expect(notes).toContain('# Release 1.0.0');
      expect(notes).toContain('Released on 2024-01-01');
      expect(notes).toContain('Initial release');
      expect(notes).toContain('## New Features');
      expect(notes).toContain('User authentication');
    });

    test('should include breaking changes in release notes', () => {
      const entry = {
        version: '2.0.0',
        date: '2024-01-01',
        summary: '',
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        },
        breakingChanges: [
          { description: 'API endpoint removed' }
        ]
      };

      const notes = updater.generateReleaseNotes(entry);

      expect(notes).toContain('## ⚠️ Breaking Changes');
      expect(notes).toContain('API endpoint removed');
    });
  });

  describe('Helper Methods', () => {
    test('should count total changes', () => {
      const entry = {
        sections: {
          added: [{ description: 'A' }, { description: 'B' }],
          changed: [{ description: 'C' }],
          deprecated: [],
          removed: [{ description: 'D' }],
          fixed: [],
          security: []
        }
      };

      const count = updater.countTotalChanges(entry);

      expect(count).toBe(4);
    });

    test('should count zero for empty entry', () => {
      const entry = {
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: []
        }
      };

      const count = updater.countTotalChanges(entry);

      expect(count).toBe(0);
    });
  });
});
