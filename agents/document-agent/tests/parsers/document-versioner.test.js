import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import DocumentVersioner, { getDocumentVersioner } from '../../parsers/code-parser/document-versioner.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

describe('DocumentVersioner', () => {
  let versioner;
  let cache;

  beforeEach(async () => {
    versioner = new DocumentVersioner();
    await versioner.initialize();

    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(versioner).toBeDefined();
      expect(versioner.logger).toBeDefined();
      expect(versioner.cache).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getDocumentVersioner();
      const instance2 = getDocumentVersioner();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Version Creation', () => {
    test('should create first version as 1.0.0', async () => {
      const content = { api: 'test', version: 1 };
      const version = await versioner.createVersion('doc1', content);

      expect(version.version).toBe('1.0.0');
      expect(version.documentId).toBe('doc1');
      expect(version.content).toEqual(content);
      expect(version.previous).toBeNull();
    });

    test('should include metadata in version', async () => {
      const content = { api: 'test' };
      const metadata = {
        author: 'test-user',
        changeType: 'minor',
        message: 'Added new API endpoint'
      };

      const version = await versioner.createVersion('doc1', content, metadata);

      expect(version.metadata.author).toBe('test-user');
      expect(version.metadata.changeType).toBe('minor');
      expect(version.metadata.message).toBe('Added new API endpoint');
      expect(version.metadata.createdAt).toBeDefined();
    });

    test('should create content hash', async () => {
      const content = { api: 'test', endpoints: ['GET /users', 'POST /users'] };
      const version = await versioner.createVersion('doc1', content);

      expect(version.contentHash).toBeDefined();
      expect(version.contentHash).toHaveLength(64); // SHA-256 hex length
    });

    test('should link to previous version', async () => {
      const content1 = { api: 'v1' };
      const content2 = { api: 'v2' };

      const version1 = await versioner.createVersion('doc1', content1);
      const version2 = await versioner.createVersion('doc1', content2);

      expect(version2.previous).toBe('1.0.0');
    });
  });

  describe('Version Retrieval', () => {
    test('should get current version', async () => {
      const content = { api: 'test' };
      await versioner.createVersion('doc1', content);

      const current = await versioner.getCurrentVersion('doc1');

      expect(current).toBeDefined();
      expect(current.version).toBe('1.0.0');
    });

    test('should get specific version', async () => {
      await versioner.createVersion('doc1', { api: 'v1' });
      await versioner.createVersion('doc1', { api: 'v2' }, { changeType: 'minor' });

      const version = await versioner.getVersion('doc1', '1.0.0');

      expect(version).toBeDefined();
      expect(version.content).toEqual({ api: 'v1' });
    });

    test('should return null for non-existent version', async () => {
      const version = await versioner.getVersion('doc1', '9.9.9');

      expect(version).toBeNull();
    });

    test('should return null for non-existent document', async () => {
      const current = await versioner.getCurrentVersion('nonexistent');

      expect(current).toBeNull();
    });
  });

  describe('Version History', () => {
    test('should get version history in descending order', async () => {
      await versioner.createVersion('doc1', { v: 1 });
      await versioner.createVersion('doc1', { v: 2 }, { changeType: 'minor' });
      await versioner.createVersion('doc1', { v: 3 }, { changeType: 'major' });

      const history = await versioner.getHistory('doc1');

      expect(history.length).toBe(3);
      expect(history[0].version).toBe('2.0.0'); // Most recent first
      expect(history[1].version).toBe('1.1.0');
      expect(history[2].version).toBe('1.0.0');
    });

    test('should get version history in ascending order', async () => {
      await versioner.createVersion('doc1', { v: 1 });
      await versioner.createVersion('doc1', { v: 2 }, { changeType: 'minor' });

      const history = await versioner.getHistory('doc1', { order: 'asc' });

      expect(history[0].version).toBe('1.0.0');
      expect(history[1].version).toBe('1.1.0');
    });

    test('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await versioner.createVersion('doc1', { v: i });
      }

      const page1 = await versioner.getHistory('doc1', { limit: 2, offset: 0 });
      const page2 = await versioner.getHistory('doc1', { limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0].version).not.toBe(page2[0].version);
    });

    test('should return empty array for non-existent document', async () => {
      const history = await versioner.getHistory('nonexistent');

      expect(history).toEqual([]);
    });
  });

  describe('Version Calculation', () => {
    test('should bump patch version', async () => {
      const v1 = await versioner.createVersion('doc1', { v: 1 });
      const v2 = await versioner.createVersion('doc1', { v: 2 }, { changeType: 'patch' });

      expect(v2.version).toBe('1.0.1');
    });

    test('should bump minor version', async () => {
      const v1 = await versioner.createVersion('doc1', { v: 1 });
      const v2 = await versioner.createVersion('doc1', { v: 2 }, { changeType: 'minor' });

      expect(v2.version).toBe('1.1.0');
    });

    test('should bump major version', async () => {
      const v1 = await versioner.createVersion('doc1', { v: 1 });
      const v2 = await versioner.createVersion('doc1', { v: 2 }, { changeType: 'major' });

      expect(v2.version).toBe('2.0.0');
    });

    test('should reset minor and patch on major bump', async () => {
      await versioner.createVersion('doc1', { v: 1 }); // 1.0.0
      await versioner.createVersion('doc1', { v: 2 }, { changeType: 'minor' }); // 1.1.0
      await versioner.createVersion('doc1', { v: 3 }, { changeType: 'patch' }); // 1.1.1
      const v4 = await versioner.createVersion('doc1', { v: 4 }, { changeType: 'major' }); // 2.0.0

      expect(v4.version).toBe('2.0.0');
    });

    test('should reset patch on minor bump', async () => {
      await versioner.createVersion('doc1', { v: 1 }); // 1.0.0
      await versioner.createVersion('doc1', { v: 2 }, { changeType: 'patch' }); // 1.0.1
      const v3 = await versioner.createVersion('doc1', { v: 3 }, { changeType: 'minor' }); // 1.1.0

      expect(v3.version).toBe('1.1.0');
    });

    test('should default to patch when no changeType specified', async () => {
      const v1 = await versioner.createVersion('doc1', { v: 1 });
      const v2 = await versioner.createVersion('doc1', { v: 2 });

      expect(v2.version).toBe('1.0.1');
    });
  });

  describe('Change Type Determination', () => {
    test('should determine major for breaking changes', () => {
      const changes = {
        breaking: [{ type: 'route_removed' }],
        nonBreaking: [],
        additions: []
      };

      const changeType = versioner.determineChangeType(changes);

      expect(changeType).toBe('major');
    });

    test('should determine minor for additions', () => {
      const changes = {
        breaking: [],
        nonBreaking: [],
        additions: [{ type: 'route_added' }]
      };

      const changeType = versioner.determineChangeType(changes);

      expect(changeType).toBe('minor');
    });

    test('should determine patch for non-breaking changes', () => {
      const changes = {
        breaking: [],
        nonBreaking: [{ type: 'route_handler_changed' }],
        additions: []
      };

      const changeType = versioner.determineChangeType(changes);

      expect(changeType).toBe('patch');
    });

    test('should prioritize breaking over additions', () => {
      const changes = {
        breaking: [{ type: 'field_removed' }],
        nonBreaking: [],
        additions: [{ type: 'route_added' }]
      };

      const changeType = versioner.determineChangeType(changes);

      expect(changeType).toBe('major');
    });
  });

  describe('Version Parsing and Comparison', () => {
    test('should parse version string', () => {
      const parsed = versioner.parseVersion('1.2.3');

      expect(parsed.major).toBe(1);
      expect(parsed.minor).toBe(2);
      expect(parsed.patch).toBe(3);
    });

    test('should throw error for invalid version format', () => {
      expect(() => versioner.parseVersion('invalid')).toThrow();
      expect(() => versioner.parseVersion('1.2')).toThrow();
      expect(() => versioner.parseVersion('1.2.3.4')).toThrow();
    });

    test('should compare versions correctly', () => {
      expect(versioner.compareVersionNumbers('1.0.0', '1.0.0')).toBe(0);
      expect(versioner.compareVersionNumbers('1.0.0', '1.0.1')).toBeLessThan(0);
      expect(versioner.compareVersionNumbers('1.1.0', '1.0.0')).toBeGreaterThan(0);
      expect(versioner.compareVersionNumbers('2.0.0', '1.9.9')).toBeGreaterThan(0);
    });
  });

  describe('Content Hashing', () => {
    test('should create consistent hash for same content', () => {
      const content = { api: 'test', endpoints: [1, 2, 3] };

      const hash1 = versioner.hashContent(content);
      const hash2 = versioner.hashContent(content);

      expect(hash1).toBe(hash2);
    });

    test('should create different hash for different content', () => {
      const content1 = { api: 'test' };
      const content2 = { api: 'different' };

      const hash1 = versioner.hashContent(content1);
      const hash2 = versioner.hashContent(content2);

      expect(hash1).not.toBe(hash2);
    });

    test('should create same hash regardless of property order', () => {
      const content1 = { b: 2, a: 1 };
      const content2 = { a: 1, b: 2 };

      const hash1 = versioner.hashContent(content1);
      const hash2 = versioner.hashContent(content2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Version Comparison', () => {
    test('should compare two versions', async () => {
      await versioner.createVersion('doc1', { api: 'v1' });
      await versioner.createVersion('doc1', { api: 'v2' }, { changeType: 'minor' });

      const comparison = await versioner.compareDocumentVersions('doc1', '1.0.0', '1.1.0');

      expect(comparison.documentId).toBe('doc1');
      expect(comparison.fromVersion).toBe('1.0.0');
      expect(comparison.toVersion).toBe('1.1.0');
      expect(comparison.contentChanged).toBe(true);
      expect(comparison.versionDiff).toBeLessThan(0); // 1.0.0 < 1.1.0
    });

    test('should detect no content change for same content', async () => {
      const content = { api: 'test' };
      await versioner.createVersion('doc1', content);
      await versioner.createVersion('doc1', content); // Same content

      const comparison = await versioner.compareDocumentVersions('doc1', '1.0.0', '1.0.1');

      expect(comparison.contentChanged).toBe(false);
    });

    test('should throw error for non-existent version', async () => {
      await versioner.createVersion('doc1', { api: 'test' });

      await expect(async () => {
        await versioner.compareDocumentVersions('doc1', '1.0.0', '9.9.9');
      }).rejects.toThrow('Version not found');
    });
  });

  describe('Version Rollback', () => {
    test('should rollback to previous version', async () => {
      await versioner.createVersion('doc1', { api: 'v1' });
      await versioner.createVersion('doc1', { api: 'v2' }, { changeType: 'minor' });
      await versioner.createVersion('doc1', { api: 'v3' }, { changeType: 'patch' });

      const rollback = await versioner.rollback('doc1', '1.0.0');

      expect(rollback.version).toBe('1.1.2'); // Creates new version
      expect(rollback.content).toEqual({ api: 'v1' });
      expect(rollback.metadata.rollbackFrom).toBe('1.0.0');
    });

    test('should throw error for invalid rollback version', async () => {
      await versioner.createVersion('doc1', { api: 'test' });

      await expect(async () => {
        await versioner.rollback('doc1', '9.9.9');
      }).rejects.toThrow('Target version not found');
    });
  });

  describe('Version Tagging', () => {
    test('should tag a version', async () => {
      await versioner.createVersion('doc1', { api: 'test' });

      const tagged = await versioner.tagVersion('doc1', '1.0.0', 'stable');

      expect(tagged.metadata.tags).toContain('stable');
    });

    test('should not duplicate tags', async () => {
      await versioner.createVersion('doc1', { api: 'test' });

      await versioner.tagVersion('doc1', '1.0.0', 'stable');
      await versioner.tagVersion('doc1', '1.0.0', 'stable');

      const version = await versioner.getVersion('doc1', '1.0.0');
      expect(version.metadata.tags.filter(t => t === 'stable').length).toBe(1);
    });

    test('should get versions by tag', async () => {
      await versioner.createVersion('doc1', { v: 1 });
      await versioner.createVersion('doc1', { v: 2 }, { changeType: 'minor' });

      await versioner.tagVersion('doc1', '1.0.0', 'stable');
      await versioner.tagVersion('doc1', '1.1.0', 'beta');

      const stableVersions = await versioner.getVersionsByTag('doc1', 'stable');

      expect(stableVersions.length).toBe(1);
      expect(stableVersions[0].version).toBe('1.0.0');
    });
  });

  describe('Uncommitted Changes', () => {
    test('should detect uncommitted changes', async () => {
      const originalContent = { api: 'v1' };
      const modifiedContent = { api: 'v2' };

      await versioner.createVersion('doc1', originalContent);

      const hasChanges = await versioner.hasUncommittedChanges('doc1', modifiedContent);

      expect(hasChanges).toBe(true);
    });

    test('should detect no uncommitted changes', async () => {
      const content = { api: 'v1' };

      await versioner.createVersion('doc1', content);

      const hasChanges = await versioner.hasUncommittedChanges('doc1', content);

      expect(hasChanges).toBe(false);
    });

    test('should return true for documents without versions', async () => {
      const hasChanges = await versioner.hasUncommittedChanges('newdoc', { api: 'test' });

      expect(hasChanges).toBe(true);
    });
  });

  describe('Version Statistics', () => {
    test('should calculate version statistics', async () => {
      await versioner.createVersion('doc1', { v: 1 }, { author: 'user1' });
      await versioner.createVersion('doc1', { v: 2 }, { changeType: 'minor', author: 'user2' });
      await versioner.createVersion('doc1', { v: 3 }, { changeType: 'major', author: 'user1' });

      await versioner.tagVersion('doc1', '2.0.0', 'stable');

      const stats = await versioner.getVersionStats('doc1');

      expect(stats.totalVersions).toBe(3);
      expect(stats.currentVersion).toBe('2.0.0');
      expect(stats.changeTypes.major).toBe(1);
      expect(stats.changeTypes.minor).toBe(1);
      expect(stats.changeTypes.patch).toBe(1);
      expect(stats.authors).toContain('user1');
      expect(stats.authors).toContain('user2');
      expect(stats.tags).toContain('stable');
    });

    test('should handle documents without versions', async () => {
      const stats = await versioner.getVersionStats('nonexistent');

      expect(stats.totalVersions).toBe(0);
      expect(stats.currentVersion).toBeNull();
    });
  });
});
