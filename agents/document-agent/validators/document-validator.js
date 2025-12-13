import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('DocumentValidator');

/**
 * DocumentValidator - Validates documentation quality and completeness
 *
 * Features:
 * - Structure validation (headings, sections, format)
 * - API documentation completeness
 * - Code example validation
 * - Link validation
 * - Consistency checking
 * - OpenAPI schema validation
 * - Quality scoring (0-100)
 *
 * Quality Criteria:
 * - Required sections present
 * - Code examples valid
 * - Links working
 * - Proper formatting
 * - Consistent terminology
 */
class DocumentValidator {
  constructor() {
    this.logger = createLogger('DocumentValidator');
    this.requiredSections = {
      api: ['Overview', 'Authentication', 'Endpoints', 'Error Handling'],
      feature: ['Description', 'Requirements', 'API', 'Testing'],
      architecture: ['Overview', 'Components', 'Data Flow', 'Technology Stack']
    };
  }

  /**
   * Validate a document
   *
   * @param {Object} document - Document to validate
   * @param {string} document.type - Document type (api, feature, architecture, etc.)
   * @param {string} document.content - Document content (markdown)
   * @param {Object} document.metadata - Document metadata
   * @returns {Object} Validation result
   */
  validate(document) {
    this.logger.info(`Validating document: ${document.metadata?.title || 'Untitled'}`);

    const result = {
      valid: true,
      score: 100,
      errors: [],
      warnings: [],
      suggestions: [],
      metrics: {
        completeness: 0,
        quality: 0,
        consistency: 0,
        readability: 0
      }
    };

    // Run all validation checks
    this.validateStructure(document, result);
    this.validateContent(document, result);
    this.validateCodeExamples(document, result);
    this.validateLinks(document, result);
    this.validateConsistency(document, result);

    // Calculate overall metrics
    this.calculateMetrics(result);

    // Calculate final score
    result.score = this.calculateScore(result);
    result.valid = result.errors.length === 0 && result.score >= 60;

    this.logger.info(
      `Validation complete: ${result.valid ? 'PASS' : 'FAIL'} ` +
      `(Score: ${result.score}/100, Errors: ${result.errors.length}, ` +
      `Warnings: ${result.warnings.length})`
    );

    return result;
  }

  /**
   * Validate document structure
   */
  validateStructure(document, result) {
    const { type, content } = document;

    // Check required sections
    const requiredSections = this.requiredSections[type] || [];
    const missingSections = [];

    for (const section of requiredSections) {
      const hasSection = this.hasSectionHeading(content, section);
      if (!hasSection) {
        missingSections.push(section);
      }
    }

    if (missingSections.length > 0) {
      result.errors.push({
        type: 'structure',
        message: `Missing required sections: ${missingSections.join(', ')}`,
        severity: 'error',
        sections: missingSections
      });
    }

    // Check heading hierarchy
    const headings = this.extractHeadings(content);
    const hierarchyIssues = this.validateHeadingHierarchy(headings);

    if (hierarchyIssues.length > 0) {
      result.warnings.push({
        type: 'structure',
        message: 'Heading hierarchy issues detected',
        severity: 'warning',
        issues: hierarchyIssues
      });
    }

    // Check for title
    if (!document.metadata?.title && !this.hasH1(content)) {
      result.errors.push({
        type: 'structure',
        message: 'Document must have a title (H1 heading)',
        severity: 'error'
      });
    }
  }

  /**
   * Validate document content
   */
  validateContent(document, result) {
    const { content } = document;

    // Check minimum content length
    const wordCount = this.countWords(content);
    if (wordCount < 50) {
      result.warnings.push({
        type: 'content',
        message: `Document is very short (${wordCount} words). Consider adding more detail.`,
        severity: 'warning',
        wordCount
      });
    }

    // Check for empty sections
    const emptySections = this.findEmptySections(content);
    if (emptySections.length > 0) {
      result.warnings.push({
        type: 'content',
        message: `Found ${emptySections.length} empty section(s)`,
        severity: 'warning',
        sections: emptySections
      });
    }

    // Check for TODO/FIXME markers
    const todos = this.findTODOs(content);
    if (todos.length > 0) {
      result.suggestions.push({
        type: 'content',
        message: `Found ${todos.length} TODO/FIXME marker(s)`,
        severity: 'info',
        todos
      });
    }
  }

  /**
   * Validate code examples
   */
  validateCodeExamples(document, result) {
    const { content } = document;

    const codeBlocks = this.extractCodeBlocks(content);

    if (codeBlocks.length === 0) {
      if (document.type === 'api' || document.type === 'feature') {
        result.warnings.push({
          type: 'code',
          message: 'No code examples found. Consider adding examples.',
          severity: 'warning'
        });
      }
      return;
    }

    // Validate each code block
    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];

      // Check for language specification
      if (!block.language) {
        result.warnings.push({
          type: 'code',
          message: `Code block ${i + 1} missing language specification`,
          severity: 'warning',
          line: block.line
        });
      }

      // Check for empty code blocks
      if (block.code.trim().length === 0) {
        result.warnings.push({
          type: 'code',
          message: `Code block ${i + 1} is empty`,
          severity: 'warning',
          line: block.line
        });
      }

      // Basic syntax validation for common languages
      const syntaxErrors = this.validateCodeSyntax(block);
      if (syntaxErrors.length > 0) {
        result.warnings.push({
          type: 'code',
          message: `Potential syntax issues in code block ${i + 1}`,
          severity: 'warning',
          line: block.line,
          errors: syntaxErrors
        });
      }
    }
  }

  /**
   * Validate links
   */
  validateLinks(document, result) {
    const { content } = document;

    const links = this.extractLinks(content);

    for (const link of links) {
      // Check for broken internal links
      if (link.url.startsWith('#')) {
        const anchor = link.url.substring(1);
        if (!this.hasAnchor(content, anchor)) {
          result.warnings.push({
            type: 'link',
            message: `Broken internal link: ${link.url}`,
            severity: 'warning',
            text: link.text,
            url: link.url
          });
        }
      }

      // Check for empty links
      if (!link.url || link.url === '#') {
        result.errors.push({
          type: 'link',
          message: 'Empty link found',
          severity: 'error',
          text: link.text
        });
      }
    }
  }

  /**
   * Validate consistency
   */
  validateConsistency(document, result) {
    const { content } = document;

    // Check for consistent terminology
    const terminology = this.extractTerminology(content);
    const inconsistencies = this.findTerminologyInconsistencies(terminology);

    if (inconsistencies.length > 0) {
      result.suggestions.push({
        type: 'consistency',
        message: 'Inconsistent terminology detected',
        severity: 'info',
        inconsistencies
      });
    }

    // Check for consistent formatting
    const formattingIssues = this.validateFormatting(content);
    if (formattingIssues.length > 0) {
      result.suggestions.push({
        type: 'consistency',
        message: 'Formatting inconsistencies detected',
        severity: 'info',
        issues: formattingIssues
      });
    }
  }

  /**
   * Calculate metrics
   */
  calculateMetrics(result) {
    // Completeness: Based on required sections and content length
    const structureErrors = result.errors.filter(e => e.type === 'structure');
    result.metrics.completeness = Math.max(0, 100 - (structureErrors.length * 20));

    // Quality: Based on code examples and detail
    const codeWarnings = result.warnings.filter(w => w.type === 'code');
    result.metrics.quality = Math.max(0, 100 - (codeWarnings.length * 10));

    // Consistency: Based on terminology and formatting
    const consistencyIssues = result.suggestions.filter(
      s => s.type === 'consistency'
    );
    result.metrics.consistency = Math.max(0, 100 - (consistencyIssues.length * 5));

    // Readability: Based on structure and content warnings
    const contentWarnings = result.warnings.filter(w => w.type === 'content');
    result.metrics.readability = Math.max(0, 100 - (contentWarnings.length * 10));
  }

  /**
   * Calculate overall score
   */
  calculateScore(result) {
    const { metrics } = result;

    // Weighted average
    const weights = {
      completeness: 0.4,
      quality: 0.3,
      consistency: 0.15,
      readability: 0.15
    };

    let score = 0;
    score += metrics.completeness * weights.completeness;
    score += metrics.quality * weights.quality;
    score += metrics.consistency * weights.consistency;
    score += metrics.readability * weights.readability;

    // Penalties for errors and warnings
    score -= result.errors.length * 10;
    score -= result.warnings.length * 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Validate OpenAPI specification
   */
  validateOpenAPI(spec) {
    this.logger.info('Validating OpenAPI specification...');

    const result = {
      valid: true,
      score: 100,
      errors: [],
      warnings: [],
      suggestions: [],
      metrics: {
        completeness: 0,
        quality: 0,
        consistency: 0,
        readability: 0
      }
    };

    // Required fields
    if (!spec.openapi) {
      result.errors.push({
        type: 'openapi',
        message: 'Missing openapi version',
        severity: 'error'
      });
    }

    if (!spec.info || !spec.info.title || !spec.info.version) {
      result.errors.push({
        type: 'openapi',
        message: 'Missing required info fields (title, version)',
        severity: 'error'
      });
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      result.errors.push({
        type: 'openapi',
        message: 'No paths defined',
        severity: 'error'
      });
    }

    // Validate paths
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.responses) {
          result.warnings.push({
            type: 'openapi',
            message: `No responses defined for ${method.toUpperCase()} ${path}`,
            severity: 'warning',
            path,
            method
          });
        }

        if (!operation.summary && !operation.description) {
          result.suggestions.push({
            type: 'openapi',
            message: `No summary or description for ${method.toUpperCase()} ${path}`,
            severity: 'info',
            path,
            method
          });
        }
      }
    }

    result.valid = result.errors.length === 0;
    result.score = this.calculateScore(result);

    this.logger.info(
      `OpenAPI validation complete: ${result.valid ? 'PASS' : 'FAIL'} ` +
      `(Score: ${result.score}/100)`
    );

    return result;
  }

  // Helper methods

  hasSectionHeading(content, section) {
    const regex = new RegExp(`^#{1,6}\\s+${section}\\s*$`, 'im');
    return regex.test(content);
  }

  hasH1(content) {
    return /^#\s+.+$/m.test(content);
  }

  hasAnchor(content, anchor) {
    const headingAnchor = this.slugify(anchor);
    const headings = this.extractHeadings(content);
    return headings.some(h => this.slugify(h.text) === headingAnchor);
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  extractHeadings(content) {
    const headings = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: content.substring(0, match.index).split('\n').length
      });
    }

    return headings;
  }

  validateHeadingHierarchy(headings) {
    const issues = [];
    let previousLevel = 0;

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];

      // Check for skipped levels (e.g., H1 -> H3)
      if (previousLevel > 0 && heading.level > previousLevel + 1) {
        issues.push({
          line: heading.line,
          message: `Heading level skips from H${previousLevel} to H${heading.level}`,
          heading: heading.text
        });
      }

      previousLevel = heading.level;
    }

    return issues;
  }

  countWords(content) {
    // Remove code blocks first
    const withoutCode = content.replace(/```[\s\S]*?```/g, '');
    // Remove markdown formatting
    const plain = withoutCode.replace(/[#*_`\[\]]/g, '');
    // Count words
    return plain.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  findEmptySections(content) {
    const emptySections = [];
    const sections = content.split(/^#{1,6}\s+.+$/gm);

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i].trim();
      if (section.length === 0 || section.replace(/\s/g, '').length === 0) {
        emptySections.push(i);
      }
    }

    return emptySections;
  }

  findTODOs(content) {
    const todos = [];
    const regex = /(TODO|FIXME|XXX|HACK):\s*(.+)/gi;
    let match;

    while ((match = regex.exec(content)) !== null) {
      todos.push({
        type: match[1],
        message: match[2],
        line: content.substring(0, match.index).split('\n').length
      });
    }

    return todos;
  }

  extractCodeBlocks(content) {
    const blocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || null,
        code: match[2],
        line: content.substring(0, match.index).split('\n').length
      });
    }

    return blocks;
  }

  validateCodeSyntax(block) {
    const errors = [];
    const { language, code } = block;

    // Basic validation for common languages
    if (language === 'javascript' || language === 'js') {
      // Check for unmatched brackets
      const openBrackets = (code.match(/[\{\[\(]/g) || []).length;
      const closeBrackets = (code.match(/[\}\]\)]/g) || []).length;

      if (openBrackets !== closeBrackets) {
        errors.push('Unmatched brackets detected');
      }
    }

    if (language === 'json') {
      try {
        JSON.parse(code);
      } catch (e) {
        errors.push(`Invalid JSON: ${e.message}`);
      }
    }

    return errors;
  }

  extractLinks(content) {
    const links = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        line: content.substring(0, match.index).split('\n').length
      });
    }

    return links;
  }

  extractTerminology(content) {
    // Extract commonly used terms (capitalized words, acronyms, technical terms)
    const terms = {};
    // Match: Capitalized words, ALL CAPS (2+ letters), or common tech terms
    const regex = /\b([A-Z][a-z]{2,}|[A-Z]{2,}|[a-z]{3,})\b/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const term = match[1];
      // Only track terms that appear more than once in different cases
      terms[term] = (terms[term] || 0) + 1;
    }

    return terms;
  }

  findTerminologyInconsistencies(terminology) {
    const inconsistencies = [];

    // Check for similar terms with different cases
    const termsList = Object.keys(terminology);
    for (let i = 0; i < termsList.length; i++) {
      for (let j = i + 1; j < termsList.length; j++) {
        const term1 = termsList[i];
        const term2 = termsList[j];

        if (term1.toLowerCase() === term2.toLowerCase()) {
          inconsistencies.push({
            terms: [term1, term2],
            message: `Inconsistent capitalization: "${term1}" vs "${term2}"`
          });
        }
      }
    }

    return inconsistencies;
  }

  validateFormatting(content) {
    const issues = [];

    // Check for multiple blank lines
    if (/\n{3,}/.test(content)) {
      issues.push('Multiple consecutive blank lines found');
    }

    // Check for trailing whitespace
    if (/\s+$/m.test(content)) {
      issues.push('Trailing whitespace found');
    }

    // Check for tabs vs spaces
    const hasTabs = /\t/.test(content);
    const hasSpaces = /^ +/m.test(content);

    if (hasTabs && hasSpaces) {
      issues.push('Mixed tabs and spaces for indentation');
    }

    return issues;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of DocumentValidator
 * @returns {DocumentValidator}
 */
export function getDocumentValidator() {
  if (!instance) {
    instance = new DocumentValidator();
  }
  return instance;
}

export { DocumentValidator };
export default DocumentValidator;
