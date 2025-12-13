/**
 * README Parser & Analyzer
 * ========================
 * Parses README.md files to extract project requirements, features,
 * and detect implicit requirements.
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

// Feature types detected in README
export const FeatureType = {
  CORE: 'CORE',           // Essential features
  ENHANCEMENT: 'ENHANCEMENT', // Nice-to-have features
  INTEGRATION: 'INTEGRATION', // Third-party integrations
  INFRASTRUCTURE: 'INFRASTRUCTURE', // DevOps/infrastructure
  DOCUMENTATION: 'DOCUMENTATION' // Documentation requirements
};

// Section types in README
export const SectionType = {
  OVERVIEW: 'overview',
  FEATURES: 'features',
  INSTALLATION: 'installation',
  USAGE: 'usage',
  API: 'api',
  CONFIGURATION: 'configuration',
  CONTRIBUTING: 'contributing',
  LICENSE: 'license',
  ROADMAP: 'roadmap',
  TODO: 'todo',
  UNKNOWN: 'unknown'
};

export class ReadmeParser extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      ...config
    };

    // Patterns for detecting sections
    this.sectionPatterns = {
      [SectionType.OVERVIEW]: /^#+\s*(overview|about|introduction|summary)/i,
      [SectionType.FEATURES]: /^#+\s*(features|capabilities|what it does|highlights)/i,
      [SectionType.INSTALLATION]: /^#+\s*(install|getting started|setup|quick start)/i,
      [SectionType.USAGE]: /^#+\s*(usage|how to use|examples?|basic usage)/i,
      [SectionType.API]: /^#+\s*(api|reference|methods|endpoints)/i,
      [SectionType.CONFIGURATION]: /^#+\s*(config|configuration|options|settings)/i,
      [SectionType.CONTRIBUTING]: /^#+\s*(contribut|development|dev setup)/i,
      [SectionType.LICENSE]: /^#+\s*license/i,
      [SectionType.ROADMAP]: /^#+\s*(roadmap|planned|upcoming|future)/i,
      [SectionType.TODO]: /^#+\s*(todo|tasks|checklist)/i
    };

    // Patterns for detecting features
    this.featurePatterns = [
      /[-*]\s*\[[ x]\]\s*(.+)/gi,  // Checkbox items
      /[-*]\s*\*\*(.+?)\*\*/gi,    // Bold items in lists
      /[-*]\s*`(.+?)`\s*[-:]/gi,   // Code items with description
      /^#{2,3}\s*(.+)/gim          // Subheadings as features
    ];

    // Implicit requirement indicators
    this.implicitIndicators = {
      authentication: [
        /login/i, /auth/i, /user\s*account/i, /sign\s*(up|in)/i,
        /password/i, /oauth/i, /jwt/i, /session/i
      ],
      database: [
        /store/i, /persist/i, /save/i, /database/i, /db/i,
        /mongo/i, /postgres/i, /mysql/i, /redis/i, /cache/i
      ],
      api: [
        /api/i, /endpoint/i, /rest/i, /graphql/i, /webhook/i,
        /request/i, /response/i
      ],
      realtime: [
        /real-?time/i, /websocket/i, /socket\.io/i, /live/i,
        /streaming/i, /push\s*notification/i
      ],
      security: [
        /security/i, /encrypt/i, /secure/i, /ssl/i, /https/i,
        /sanitize/i, /validate/i, /xss/i, /csrf/i
      ],
      testing: [
        /test/i, /spec/i, /coverage/i, /unit\s*test/i,
        /integration\s*test/i, /e2e/i
      ],
      deployment: [
        /deploy/i, /docker/i, /kubernetes/i, /ci\s*\/?\s*cd/i,
        /pipeline/i, /production/i
      ],
      monitoring: [
        /monitor/i, /log/i, /metric/i, /alert/i, /trace/i,
        /observab/i, /health\s*check/i
      ]
    };
  }

  /**
   * Parse a README file
   */
  async parse(readmePath) {
    try {
      const content = await fs.readFile(readmePath, 'utf-8');
      return this.parseContent(content, readmePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.emit('warning', { message: `README not found: ${readmePath}` });
        return this._createEmptyResult(readmePath);
      }
      throw error;
    }
  }

  /**
   * Parse README content string
   */
  parseContent(content, sourcePath = 'README.md') {
    const lines = content.split('\n');
    const result = {
      source: sourcePath,
      title: this._extractTitle(lines),
      description: this._extractDescription(lines),
      sections: this._extractSections(lines),
      features: [],
      technologies: this._extractTechnologies(content),
      badges: this._extractBadges(content),
      links: this._extractLinks(content),
      codeBlocks: this._extractCodeBlocks(content),
      parsedAt: new Date().toISOString()
    };

    // Extract features from relevant sections
    const featureSections = result.sections.filter(s =>
      s.type === SectionType.FEATURES ||
      s.type === SectionType.ROADMAP ||
      s.type === SectionType.TODO
    );

    for (const section of featureSections) {
      const sectionFeatures = this._extractFeatures(section);
      result.features.push(...sectionFeatures);
    }

    // Also check overview for high-level features
    const overviewSection = result.sections.find(s => s.type === SectionType.OVERVIEW);
    if (overviewSection) {
      const overviewFeatures = this._extractFeatures(overviewSection, true);
      result.features.push(...overviewFeatures);
    }

    // Deduplicate features
    result.features = this._deduplicateFeatures(result.features);

    return result;
  }

  /**
   * Detect implicit requirements from parsed README
   */
  async detectImplicitRequirements(parseResult) {
    const implicit = [];
    const content = this._getSectionContent(parseResult);

    for (const [category, patterns] of Object.entries(this.implicitIndicators)) {
      const matches = [];

      for (const pattern of patterns) {
        const found = content.match(pattern);
        if (found) {
          matches.push(...found);
        }
      }

      if (matches.length > 0) {
        // Check if requirement is explicitly stated
        const isExplicit = parseResult.features.some(f =>
          f.name.toLowerCase().includes(category) ||
          f.description?.toLowerCase().includes(category)
        );

        if (!isExplicit) {
          implicit.push({
            id: `implicit-${category}-${Date.now()}`,
            category,
            type: this._categorizeImplicit(category),
            confidence: Math.min(matches.length * 0.2 + 0.3, 0.95),
            indicators: [...new Set(matches)].slice(0, 5),
            recommendation: this._getImplicitRecommendation(category),
            detectedAt: new Date().toISOString()
          });
        }
      }
    }

    return implicit;
  }

  /**
   * Extract title from README
   */
  _extractTitle(lines) {
    // Look for H1 heading
    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.replace(/^#\s*/, '').trim();
      }
    }
    return 'Untitled Project';
  }

  /**
   * Extract description (first paragraph after title)
   */
  _extractDescription(lines) {
    let foundTitle = false;
    let description = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        foundTitle = true;
        continue;
      }

      if (foundTitle) {
        const trimmed = line.trim();

        // Skip badges line
        if (trimmed.startsWith('[![') || trimmed.startsWith('![')) {
          continue;
        }

        // Skip empty lines at the start
        if (!trimmed && description.length === 0) {
          continue;
        }

        // Stop at next heading or empty line after content
        if (trimmed.startsWith('#') || (!trimmed && description.length > 0)) {
          break;
        }

        if (trimmed) {
          description.push(trimmed);
        }
      }
    }

    return description.join(' ').trim();
  }

  /**
   * Extract sections from README
   */
  _extractSections(lines) {
    const sections = [];
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      const isHeading = /^#{1,6}\s+/.test(line);

      if (isHeading) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Determine section type
        const level = (line.match(/^#+/) || [''])[0].length;
        const title = line.replace(/^#+\s*/, '').trim();
        const type = this._determineSectionType(line);

        currentSection = {
          id: `section-${sections.length + 1}`,
          level,
          title,
          type,
          startLine: lines.indexOf(line)
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Don't forget the last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Determine section type from heading
   */
  _determineSectionType(line) {
    for (const [type, pattern] of Object.entries(this.sectionPatterns)) {
      if (pattern.test(line)) {
        return type;
      }
    }
    return SectionType.UNKNOWN;
  }

  /**
   * Extract features from a section
   */
  _extractFeatures(section, isOverview = false) {
    const features = [];
    const content = section.content || '';
    const lines = content.split('\n');

    let featureIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Checkbox items: - [ ] Feature name or - [x] Feature name
      const checkboxMatch = trimmed.match(/^[-*]\s*\[([ x])\]\s*(.+)/i);
      if (checkboxMatch) {
        features.push({
          id: `feature-${section.id}-${featureIndex++}`,
          name: checkboxMatch[2].trim(),
          type: this._determineFeatureType(checkboxMatch[2]),
          status: checkboxMatch[1].toLowerCase() === 'x' ? 'implemented' : 'planned',
          source: section.title,
          isFromOverview: isOverview
        });
        continue;
      }

      // Bold items in lists: - **Feature name** - Description
      const boldMatch = trimmed.match(/^[-*]\s*\*\*(.+?)\*\*\s*[-:]?\s*(.*)$/);
      if (boldMatch) {
        features.push({
          id: `feature-${section.id}-${featureIndex++}`,
          name: boldMatch[1].trim(),
          description: boldMatch[2].trim() || undefined,
          type: this._determineFeatureType(boldMatch[1]),
          status: 'planned',
          source: section.title,
          isFromOverview: isOverview
        });
        continue;
      }

      // Simple list items (if not in overview to avoid noise)
      if (!isOverview && /^[-*]\s+[A-Z]/.test(trimmed)) {
        const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
        if (listMatch && listMatch[1].length > 5 && listMatch[1].length < 100) {
          features.push({
            id: `feature-${section.id}-${featureIndex++}`,
            name: listMatch[1].trim(),
            type: this._determineFeatureType(listMatch[1]),
            status: 'planned',
            source: section.title,
            isFromOverview: isOverview
          });
        }
      }
    }

    return features;
  }

  /**
   * Determine feature type from name
   */
  _determineFeatureType(name) {
    const lower = name.toLowerCase();

    if (/integrat|connect|sync|import|export/.test(lower)) {
      return FeatureType.INTEGRATION;
    }

    if (/deploy|docker|ci|cd|pipeline|kubernetes|infra/.test(lower)) {
      return FeatureType.INFRASTRUCTURE;
    }

    if (/doc|readme|guide|tutorial/.test(lower)) {
      return FeatureType.DOCUMENTATION;
    }

    if (/improve|enhance|optim|better|upgrade/.test(lower)) {
      return FeatureType.ENHANCEMENT;
    }

    return FeatureType.CORE;
  }

  /**
   * Deduplicate features by similarity
   */
  _deduplicateFeatures(features) {
    const seen = new Map();

    for (const feature of features) {
      const normalized = feature.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (!seen.has(normalized)) {
        seen.set(normalized, feature);
      } else {
        // Keep the one with more information
        const existing = seen.get(normalized);
        if ((feature.description && !existing.description) ||
            (feature.status === 'implemented' && existing.status !== 'implemented')) {
          seen.set(normalized, { ...existing, ...feature });
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Extract technologies mentioned in README
   */
  _extractTechnologies(content) {
    const technologies = new Set();

    // Common technology patterns
    const techPatterns = [
      /node\.?js/gi, /react/gi, /vue/gi, /angular/gi, /express/gi,
      /typescript/gi, /javascript/gi, /python/gi, /java\b/gi, /go\b/gi,
      /rust/gi, /dart/gi, /flutter/gi, /swift/gi, /kotlin/gi,
      /mongodb/gi, /postgres/gi, /mysql/gi, /redis/gi, /elasticsearch/gi,
      /docker/gi, /kubernetes/gi, /aws/gi, /gcp/gi, /azure/gi,
      /graphql/gi, /rest\s*api/gi, /websocket/gi,
      /jest/gi, /mocha/gi, /cypress/gi, /playwright/gi
    ];

    for (const pattern of techPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(m => technologies.add(m.toLowerCase()));
      }
    }

    return Array.from(technologies);
  }

  /**
   * Extract badges from README
   */
  _extractBadges(content) {
    const badges = [];
    const badgePattern = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;

    let match;
    while ((match = badgePattern.exec(content)) !== null) {
      badges.push({
        alt: match[1],
        imageUrl: match[2],
        linkUrl: match[3]
      });
    }

    return badges;
  }

  /**
   * Extract links from README
   */
  _extractLinks(content) {
    const links = [];
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      // Skip badge images
      if (!match[1].startsWith('!')) {
        links.push({
          text: match[1],
          url: match[2]
        });
      }
    }

    return links;
  }

  /**
   * Extract code blocks from README
   */
  _extractCodeBlocks(content) {
    const codeBlocks = [];
    const codePattern = /```(\w*)\n([\s\S]*?)```/g;

    let match;
    while ((match = codePattern.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return codeBlocks;
  }

  /**
   * Get combined section content for analysis
   */
  _getSectionContent(parseResult) {
    const parts = [parseResult.title, parseResult.description];

    for (const section of parseResult.sections) {
      parts.push(section.title);
      parts.push(section.content);
    }

    return parts.join(' ');
  }

  /**
   * Categorize implicit requirement
   */
  _categorizeImplicit(category) {
    const categoryMap = {
      authentication: FeatureType.CORE,
      database: FeatureType.INFRASTRUCTURE,
      api: FeatureType.CORE,
      realtime: FeatureType.ENHANCEMENT,
      security: FeatureType.CORE,
      testing: FeatureType.INFRASTRUCTURE,
      deployment: FeatureType.INFRASTRUCTURE,
      monitoring: FeatureType.INFRASTRUCTURE
    };

    return categoryMap[category] || FeatureType.CORE;
  }

  /**
   * Get recommendation for implicit requirement
   */
  _getImplicitRecommendation(category) {
    const recommendations = {
      authentication: 'Consider adding explicit authentication requirements and user management features.',
      database: 'Define data persistence strategy and database requirements explicitly.',
      api: 'Document API endpoints and data contracts clearly.',
      realtime: 'Specify real-time requirements including expected latency and protocols.',
      security: 'Add security requirements section covering encryption, validation, and compliance.',
      testing: 'Define testing strategy including coverage targets and test types.',
      deployment: 'Document deployment requirements and infrastructure needs.',
      monitoring: 'Specify observability requirements including logging, metrics, and alerting.'
    };

    return recommendations[category] || 'Consider documenting this requirement explicitly.';
  }

  /**
   * Create empty result for missing README
   */
  _createEmptyResult(sourcePath) {
    return {
      source: sourcePath,
      title: 'Unknown Project',
      description: '',
      sections: [],
      features: [],
      technologies: [],
      badges: [],
      links: [],
      codeBlocks: [],
      parsedAt: new Date().toISOString(),
      warning: 'README file not found'
    };
  }
}

export default ReadmeParser;
