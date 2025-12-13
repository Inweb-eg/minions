/**
 * ReleaseManager - Manages GitHub Releases
 *
 * Phase 9.4: Release & Analytics
 * Creates releases with changelog generation
 */

import { BaseManager, OPERATION_STATUS } from '../branches/base-manager.js';

/**
 * Release type
 */
export const RELEASE_TYPE = {
  MAJOR: 'major',      // 1.0.0 -> 2.0.0
  MINOR: 'minor',      // 1.0.0 -> 1.1.0
  PATCH: 'patch'       // 1.0.0 -> 1.0.1
};

/**
 * ReleaseManager
 * Manages GitHub releases
 */
export class ReleaseManager extends BaseManager {
  constructor() {
    super('ReleaseManager', 'release');
  }

  /**
   * Create release
   * @param {Object} options - Release options
   * @returns {Promise<Object>} Result
   */
  async createRelease(options = {}) {
    this.ensureInitialized();

    const {
      tagName,
      targetCommitish = null,
      name = null,
      body = null,
      draft = false,
      prerelease = false,
      generateChangelog = true,
      previousTag = null
    } = options;

    this.logger.info(`Creating release: ${tagName}`);

    try {
      // Generate changelog if requested
      let releaseBody = body;
      if (generateChangelog && !body) {
        releaseBody = await this.generateChangelog(previousTag, tagName);
      }

      const { data: release } = await this.octokit.rest.repos.createRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: tagName,
        target_commitish: targetCommitish,
        name: name || tagName,
        body: releaseBody,
        draft,
        prerelease
      });

      const result = this.createResult({
        success: true,
        data: {
          id: release.id,
          tagName: release.tag_name,
          name: release.name,
          url: release.html_url,
          draft: release.draft,
          prerelease: release.prerelease
        }
      });

      this.recordOperation(result);
      this.logger.info(`Release created successfully: ${tagName}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to create release: ${error.message}`);

      const result = this.createResult({
        success: false,
        error: error.message
      });

      this.recordOperation(result);
      throw error;
    }
  }

  /**
   * Generate changelog
   * @param {string} fromTag - Starting tag
   * @param {string} toTag - Ending tag
   * @returns {Promise<string>} Changelog
   */
  async generateChangelog(fromTag, toTag) {
    this.logger.info(`Generating changelog: ${fromTag} -> ${toTag}`);

    try {
      // Get commits between tags
      const commits = await this.getCommitsBetweenTags(fromTag, toTag);

      // Categorize commits
      const categorized = this.categorizeCommits(commits);

      // Format changelog
      const changelog = this.formatChangelog(categorized, fromTag, toTag);

      return changelog;
    } catch (error) {
      this.logger.error(`Failed to generate changelog: ${error.message}`);
      return `## Release ${toTag}\n\nChangelog generation failed: ${error.message}`;
    }
  }

  /**
   * Get commits between tags
   * @param {string} fromTag - Starting tag
   * @param {string} toTag - Ending tag
   * @returns {Promise<Array>} Commits
   */
  async getCommitsBetweenTags(fromTag, toTag) {
    if (!fromTag) {
      // Get all commits up to toTag
      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        sha: toTag,
        per_page: 100
      });

      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date
      }));
    }

    const { data: comparison } = await this.octokit.rest.repos.compareCommits({
      owner: this.owner,
      repo: this.repo,
      base: fromTag,
      head: toTag
    });

    return comparison.commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date
    }));
  }

  /**
   * Categorize commits
   * @param {Array} commits - Commits
   * @returns {Object} Categorized commits
   */
  categorizeCommits(commits) {
    const categories = {
      breaking: [],
      features: [],
      fixes: [],
      improvements: [],
      chores: [],
      other: []
    };

    commits.forEach(commit => {
      const message = commit.message.toLowerCase();
      const firstLine = commit.message.split('\n')[0];

      if (message.includes('breaking') || message.includes('!:')) {
        categories.breaking.push({ ...commit, firstLine });
      } else if (message.startsWith('feat') || message.includes('feature')) {
        categories.features.push({ ...commit, firstLine });
      } else if (message.startsWith('fix') || message.includes('bug')) {
        categories.fixes.push({ ...commit, firstLine });
      } else if (message.startsWith('improve') || message.startsWith('enhance') || message.startsWith('update')) {
        categories.improvements.push({ ...commit, firstLine });
      } else if (message.startsWith('chore') || message.startsWith('docs') || message.startsWith('test')) {
        categories.chores.push({ ...commit, firstLine });
      } else {
        categories.other.push({ ...commit, firstLine });
      }
    });

    return categories;
  }

  /**
   * Format changelog
   * @param {Object} categorized - Categorized commits
   * @param {string} fromTag - Starting tag
   * @param {string} toTag - Ending tag
   * @returns {string} Formatted changelog
   */
  formatChangelog(categorized, fromTag, toTag) {
    const sections = [];

    sections.push(`## Release ${toTag}`);
    sections.push('');

    if (fromTag) {
      sections.push(`**Full Changelog**: ${fromTag}...${toTag}`);
      sections.push('');
    }

    // Breaking changes
    if (categorized.breaking.length > 0) {
      sections.push('### ⚠️ BREAKING CHANGES');
      sections.push('');
      categorized.breaking.forEach(commit => {
        sections.push(`- ${commit.firstLine} (${commit.sha.substring(0, 7)})`);
      });
      sections.push('');
    }

    // Features
    if (categorized.features.length > 0) {
      sections.push('### ✨ Features');
      sections.push('');
      categorized.features.forEach(commit => {
        sections.push(`- ${commit.firstLine} (${commit.sha.substring(0, 7)})`);
      });
      sections.push('');
    }

    // Bug fixes
    if (categorized.fixes.length > 0) {
      sections.push('### 🐛 Bug Fixes');
      sections.push('');
      categorized.fixes.forEach(commit => {
        sections.push(`- ${commit.firstLine} (${commit.sha.substring(0, 7)})`);
      });
      sections.push('');
    }

    // Improvements
    if (categorized.improvements.length > 0) {
      sections.push('### 🚀 Improvements');
      sections.push('');
      categorized.improvements.forEach(commit => {
        sections.push(`- ${commit.firstLine} (${commit.sha.substring(0, 7)})`);
      });
      sections.push('');
    }

    // Chores (only if there are few other changes)
    const totalSignificant = categorized.breaking.length +
                            categorized.features.length +
                            categorized.fixes.length +
                            categorized.improvements.length;

    if (totalSignificant < 5 && categorized.chores.length > 0) {
      sections.push('### 🔧 Maintenance');
      sections.push('');
      categorized.chores.slice(0, 10).forEach(commit => {
        sections.push(`- ${commit.firstLine} (${commit.sha.substring(0, 7)})`);
      });
      sections.push('');
    }

    sections.push('---');
    sections.push('');
    sections.push('🤖 Auto-generated changelog by [Claude Code](https://claude.com/claude-code)');

    return sections.join('\n');
  }

  /**
   * Get latest release
   * @returns {Promise<Object>} Latest release
   */
  async getLatestRelease() {
    this.ensureInitialized();

    try {
      const { data: release } = await this.octokit.rest.repos.getLatestRelease({
        owner: this.owner,
        repo: this.repo
      });

      return release;
    } catch (error) {
      if (error.status === 404) {
        return null; // No releases yet
      }
      throw error;
    }
  }

  /**
   * List releases
   * @param {Object} options - List options
   * @returns {Promise<Object>} Releases list
   */
  async listReleases(options = {}) {
    this.ensureInitialized();

    const { perPage = 30 } = options;

    try {
      const { data: releases } = await this.octokit.rest.repos.listReleases({
        owner: this.owner,
        repo: this.repo,
        per_page: perPage
      });

      return this.createResult({
        success: true,
        data: {
          releases: releases.map(release => ({
            id: release.id,
            tagName: release.tag_name,
            name: release.name,
            draft: release.draft,
            prerelease: release.prerelease,
            url: release.html_url,
            createdAt: release.created_at,
            publishedAt: release.published_at
          })),
          count: releases.length
        }
      });
    } catch (error) {
      this.logger.error(`Failed to list releases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update release
   * @param {number} releaseId - Release ID
   * @param {Object} updates - Updates
   * @returns {Promise<Object>} Result
   */
  async updateRelease(releaseId, updates = {}) {
    this.ensureInitialized();

    try {
      const { data: release } = await this.octokit.rest.repos.updateRelease({
        owner: this.owner,
        repo: this.repo,
        release_id: releaseId,
        ...updates
      });

      return this.createResult({
        success: true,
        data: {
          id: release.id,
          tagName: release.tag_name,
          name: release.name
        }
      });
    } catch (error) {
      this.logger.error(`Failed to update release: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete release
   * @param {number} releaseId - Release ID
   * @returns {Promise<Object>} Result
   */
  async deleteRelease(releaseId) {
    this.ensureInitialized();

    try {
      await this.octokit.rest.repos.deleteRelease({
        owner: this.owner,
        repo: this.repo,
        release_id: releaseId
      });

      this.logger.info(`Deleted release #${releaseId}`);

      return this.createResult({
        success: true,
        data: { releaseId }
      });
    } catch (error) {
      this.logger.error(`Failed to delete release: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate next version
   * @param {string} currentVersion - Current version
   * @param {string} releaseType - Release type
   * @returns {string} Next version
   */
  calculateNextVersion(currentVersion, releaseType) {
    // Remove 'v' prefix if present
    const version = currentVersion.replace(/^v/, '');
    const parts = version.split('.').map(Number);

    if (parts.length !== 3) {
      throw new Error('Invalid version format. Expected: major.minor.patch');
    }

    let [major, minor, patch] = parts;

    switch (releaseType) {
      case RELEASE_TYPE.MAJOR:
        major++;
        minor = 0;
        patch = 0;
        break;
      case RELEASE_TYPE.MINOR:
        minor++;
        patch = 0;
        break;
      case RELEASE_TYPE.PATCH:
        patch++;
        break;
      default:
        throw new Error(`Invalid release type: ${releaseType}`);
    }

    return `v${major}.${minor}.${patch}`;
  }

  /**
   * Create next release
   * @param {Object} options - Release options
   * @returns {Promise<Object>} Result
   */
  async createNextRelease(options = {}) {
    const {
      releaseType = RELEASE_TYPE.PATCH,
      ...releaseOptions
    } = options;

    // Get latest release
    const latestRelease = await this.getLatestRelease();
    const currentVersion = latestRelease ? latestRelease.tag_name : 'v0.0.0';

    // Calculate next version
    const nextVersion = this.calculateNextVersion(currentVersion, releaseType);

    this.logger.info(`Creating next release: ${currentVersion} -> ${nextVersion} (${releaseType})`);

    return this.createRelease({
      tagName: nextVersion,
      previousTag: latestRelease ? latestRelease.tag_name : null,
      ...releaseOptions
    });
  }
}

/**
 * Get singleton instance
 */
let managerInstance = null;

export function getReleaseManager() {
  if (!managerInstance) {
    managerInstance = new ReleaseManager();
  }
  return managerInstance;
}
