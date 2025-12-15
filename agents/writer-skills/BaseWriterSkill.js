/**
 * BaseWriterSkill - Base Class for Code Generation Skills
 *
 * Extends BaseSkill with code generation capabilities:
 * - Template management
 * - File operations
 * - Code formatting
 * - Spec validation
 *
 * All code writer skills should extend this class.
 */

import { BaseSkill, SKILL_STATUS, SEVERITY, CATEGORY, createSkillGetter } from '../skills/BaseSkill.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Code generation result types
 */
export const GENERATION_RESULT = {
  CREATED: 'created',
  UPDATED: 'updated',
  SKIPPED: 'skipped',
  FAILED: 'failed'
};

/**
 * Supported languages for code generation
 */
export const LANGUAGE = {
  DART: 'dart',
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  JSON: 'json',
  YAML: 'yaml',
  HTML: 'html',
  CSS: 'css'
};

/**
 * BaseWriterSkill - Abstract base class for code generation skills
 */
export class BaseWriterSkill extends BaseSkill {
  /**
   * @param {string} name - Skill name
   * @param {Object} options - Skill options
   * @param {string} options.language - Target language (dart, javascript, typescript)
   * @param {string} options.outputPath - Default output path
   */
  constructor(name, options = {}) {
    super(name, options);

    // Template management
    this.templates = new Map();

    // Configuration
    this.language = options.language || LANGUAGE.JAVASCRIPT;
    this.outputPath = options.outputPath || null;
    this.dryRun = options.dryRun || false;

    // Generated files tracking
    this.generatedFiles = [];
  }

  /**
   * Register a template
   * @param {string} name - Template name
   * @param {string|Function} template - Template string or function
   */
  registerTemplate(name, template) {
    this.templates.set(name, template);
    this.logger.debug(`Registered template: ${name}`);
  }

  /**
   * Get a template by name
   * @param {string} name - Template name
   * @returns {string|Function} Template
   */
  getTemplate(name) {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }
    return template;
  }

  /**
   * Render a template with data
   * @param {string} name - Template name
   * @param {Object} data - Data to interpolate
   * @returns {string} Rendered code
   */
  renderTemplate(name, data) {
    const template = this.getTemplate(name);

    if (typeof template === 'function') {
      return template(data);
    }

    // Simple string interpolation with {{key}} syntax
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Check if template exists
   * @param {string} name - Template name
   * @returns {boolean} True if template exists
   */
  hasTemplate(name) {
    return this.templates.has(name);
  }

  // ==================== File Operations ====================

  /**
   * Write generated code to a file
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @param {Object} options - Write options
   * @returns {Promise<Object>} Write result
   */
  async writeFile(filePath, content, options = {}) {
    const { overwrite = false, createDirs = true } = options;

    try {
      const fullPath = this.resolvePath(filePath);

      // Check if file exists
      let exists = false;
      try {
        await fs.access(fullPath);
        exists = true;
      } catch {
        exists = false;
      }

      if (exists && !overwrite) {
        this.logger.warn(`File already exists (skipping): ${filePath}`);
        return {
          success: false,
          result: GENERATION_RESULT.SKIPPED,
          path: fullPath,
          reason: 'File already exists'
        };
      }

      // Create directories if needed
      if (createDirs) {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
      }

      // Dry run mode - don't actually write
      if (this.dryRun) {
        this.logger.info(`[DRY RUN] Would write to: ${filePath}`);
        return {
          success: true,
          result: exists ? GENERATION_RESULT.UPDATED : GENERATION_RESULT.CREATED,
          path: fullPath,
          dryRun: true
        };
      }

      // Write the file
      await fs.writeFile(fullPath, content, 'utf-8');

      // Track generated file
      this.generatedFiles.push({
        path: fullPath,
        result: exists ? GENERATION_RESULT.UPDATED : GENERATION_RESULT.CREATED,
        timestamp: new Date().toISOString()
      });

      this.logger.info(`${exists ? 'Updated' : 'Created'} file: ${filePath}`);

      return {
        success: true,
        result: exists ? GENERATION_RESULT.UPDATED : GENERATION_RESULT.CREATED,
        path: fullPath
      };
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath}:`, error);
      return {
        success: false,
        result: GENERATION_RESULT.FAILED,
        path: filePath,
        error: error.message
      };
    }
  }

  /**
   * Read a file
   * @param {string} filePath - File path
   * @returns {Promise<string|null>} File content or null
   */
  async readFile(filePath) {
    try {
      const fullPath = this.resolvePath(filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      this.logger.debug(`Failed to read file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve a path relative to output path
   * @param {string} filePath - Relative or absolute path
   * @returns {string} Absolute path
   */
  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    if (this.outputPath) {
      return path.join(this.outputPath, filePath);
    }
    return path.resolve(filePath);
  }

  // ==================== Code Formatting ====================

  /**
   * Format generated code
   * @param {string} code - Code to format
   * @param {string} language - Language (optional, uses default)
   * @returns {string} Formatted code
   */
  formatCode(code, language = null) {
    const lang = language || this.language;

    // Basic formatting - add proper indentation and newlines
    switch (lang) {
      case LANGUAGE.DART:
        return this.formatDart(code);
      case LANGUAGE.JAVASCRIPT:
      case LANGUAGE.TYPESCRIPT:
        return this.formatJS(code);
      case LANGUAGE.JSON:
        return this.formatJSON(code);
      default:
        return code;
    }
  }

  /**
   * Basic Dart formatting
   * @param {string} code - Dart code
   * @returns {string} Formatted code
   */
  formatDart(code) {
    // Ensure consistent line endings
    let formatted = code.replace(/\r\n/g, '\n');

    // Ensure single newline at end
    formatted = formatted.trimEnd() + '\n';

    return formatted;
  }

  /**
   * Basic JavaScript/TypeScript formatting
   * @param {string} code - JS/TS code
   * @returns {string} Formatted code
   */
  formatJS(code) {
    // Ensure consistent line endings
    let formatted = code.replace(/\r\n/g, '\n');

    // Ensure single newline at end
    formatted = formatted.trimEnd() + '\n';

    return formatted;
  }

  /**
   * Format JSON code
   * @param {string} code - JSON code
   * @returns {string} Formatted code
   */
  formatJSON(code) {
    try {
      const parsed = JSON.parse(code);
      return JSON.stringify(parsed, null, 2) + '\n';
    } catch {
      return code;
    }
  }

  // ==================== Spec Validation ====================

  /**
   * Validate a generation spec
   * @param {Object} spec - Spec to validate
   * @param {Object} schema - Validation schema
   * @returns {Object} Validation result
   */
  validateSpec(spec, schema) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (spec[field] === undefined || spec[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check field types
    if (schema.properties) {
      for (const [field, config] of Object.entries(schema.properties)) {
        const value = spec[field];

        if (value !== undefined) {
          // Type checking
          if (config.type && typeof value !== config.type) {
            errors.push(`Field '${field}' should be ${config.type}, got ${typeof value}`);
          }

          // Enum checking
          if (config.enum && !config.enum.includes(value)) {
            errors.push(`Field '${field}' must be one of: ${config.enum.join(', ')}`);
          }

          // Pattern checking
          if (config.pattern && typeof value === 'string' && !new RegExp(config.pattern).test(value)) {
            errors.push(`Field '${field}' does not match pattern: ${config.pattern}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==================== Generation Helpers ====================

  /**
   * Generate and write code from a spec
   * @param {Object} spec - Generation spec
   * @param {string} templateName - Template to use
   * @param {string} outputFile - Output file path
   * @param {Object} options - Options
   * @returns {Promise<Object>} Generation result
   */
  async generateAndWrite(spec, templateName, outputFile, options = {}) {
    try {
      // Render template
      const code = this.renderTemplate(templateName, spec);

      // Format code
      const formatted = this.formatCode(code, options.language);

      // Write file
      const result = await this.writeFile(outputFile, formatted, options);

      if (result.success) {
        // Publish event
        this.publishGenerationEvent(outputFile, spec, result);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate ${outputFile}:`, error);
      return {
        success: false,
        result: GENERATION_RESULT.FAILED,
        path: outputFile,
        error: error.message
      };
    }
  }

  /**
   * Publish a code generation event
   * @param {string} filePath - Generated file path
   * @param {Object} spec - Generation spec
   * @param {Object} result - Generation result
   */
  publishGenerationEvent(filePath, spec, result) {
    if (this.eventBus) {
      this.publish(EventTypes.CODE_GENERATED, {
        file: filePath,
        spec,
        result: result.result,
        language: this.language,
        skill: this.name
      });
    }
  }

  /**
   * Get list of generated files
   * @returns {Array} Generated files
   */
  getGeneratedFiles() {
    return this.generatedFiles;
  }

  /**
   * Clear generated files list
   */
  clearGeneratedFiles() {
    this.generatedFiles = [];
  }

  // ==================== Execution ====================

  /**
   * Reset skill state (overrides BaseSkill)
   */
  reset() {
    super.reset();
    this.clearGeneratedFiles();
  }

  /**
   * Get skill status (overrides BaseSkill)
   */
  getStatus() {
    return {
      ...super.getStatus(),
      language: this.language,
      outputPath: this.outputPath,
      dryRun: this.dryRun,
      generatedFilesCount: this.generatedFiles.length
    };
  }

  /**
   * Set output path
   * @param {string} outputPath - Output path
   */
  setOutputPath(outputPath) {
    this.outputPath = outputPath;
  }

  /**
   * Set dry run mode
   * @param {boolean} dryRun - Dry run mode
   */
  setDryRun(dryRun) {
    this.dryRun = dryRun;
  }
}

// Re-export constants from BaseSkill
export { SKILL_STATUS, SEVERITY, CATEGORY, createSkillGetter };

export default BaseWriterSkill;
