/**
 * DockerfileValidator - Validates Dockerfile Syntax and Best Practices
 *
 * Phase 8.3: Validators
 * Validates Dockerfile files for syntax errors and best practices
 */

import { BaseValidator, VALIDATION_SEVERITY } from './base-validator.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dockerfile instructions
 */
export const DOCKERFILE_INSTRUCTIONS = [
  'FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV',
  'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER',
  'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'
];

/**
 * DockerfileValidator
 * Validates Dockerfile files
 */
export class DockerfileValidator extends BaseValidator {
  constructor() {
    super('DockerfileValidator', 'dockerfile');
    this.rules = this.initializeRules();
  }

  /**
   * Initialize validation rules
   * @returns {Array} Validation rules
   */
  initializeRules() {
    return [
      { id: 'DL3000', check: this.checkFromInstruction.bind(this), name: 'FROM instruction' },
      { id: 'DL3001', check: this.checkPinVersion.bind(this), name: 'Pin versions' },
      { id: 'DL3002', check: this.checkUser.bind(this), name: 'User instruction' },
      { id: 'DL3003', check: this.checkWorkdir.bind(this), name: 'WORKDIR usage' },
      { id: 'DL3004', check: this.checkAptGet.bind(this), name: 'apt-get best practices' },
      { id: 'DL3005', check: this.checkCopyChown.bind(this), name: 'COPY with chown' },
      { id: 'DL3006', check: this.checkLayerOptimization.bind(this), name: 'Layer optimization' },
      { id: 'DL3007', check: this.checkHealthcheck.bind(this), name: 'Healthcheck' },
      { id: 'DL3008', check: this.checkSecretsExposure.bind(this), name: 'Secrets exposure' }
    ];
  }

  /**
   * Validate Dockerfile
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(options = {}) {
    const {
      filePath,
      content = null,
      strict = false,
      enabledRules = this.rules.map(r => r.id)
    } = options;

    this.logger.info(`Validating Dockerfile: ${filePath || 'from content'}`);

    const issues = [];
    let dockerfileContent;

    // Read Dockerfile
    if (content) {
      dockerfileContent = content;
    } else if (filePath) {
      if (!fs.existsSync(filePath)) {
        return this.createResult({
          valid: false,
          issues: [
            this.createIssue({
              severity: VALIDATION_SEVERITY.ERROR,
              message: `Dockerfile not found: ${filePath}`
            })
          ]
        });
      }
      dockerfileContent = fs.readFileSync(filePath, 'utf-8');
    } else {
      return this.createResult({
        valid: false,
        issues: [
          this.createIssue({
            severity: VALIDATION_SEVERITY.ERROR,
            message: 'Either filePath or content must be provided'
          })
        ]
      });
    }

    // Parse Dockerfile
    const instructions = this.parseDockerfile(dockerfileContent);

    // Run syntax validation
    const syntaxIssues = this.validateSyntax(instructions);
    issues.push(...syntaxIssues);

    // Run best practice checks
    for (const rule of this.rules) {
      if (enabledRules.includes(rule.id)) {
        try {
          const ruleIssues = await rule.check(instructions, dockerfileContent);
          issues.push(...ruleIssues);
        } catch (error) {
          this.logger.error(`Rule ${rule.id} failed: ${error.message}`);
        }
      }
    }

    // Determine if valid
    const errors = issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR);
    const valid = errors.length === 0;

    const result = this.createResult({
      valid,
      issues,
      metadata: {
        filePath,
        instructionCount: instructions.length,
        rulesChecked: enabledRules.length
      }
    });

    this.recordValidation(result);
    this.logger.info(`Validation completed: ${result.status} (${errors.length} errors, ${result.warnings.length} warnings)`);

    return result;
  }

  /**
   * Parse Dockerfile into instructions
   * @param {string} content - Dockerfile content
   * @returns {Array} Instructions
   */
  parseDockerfile(content) {
    const instructions = [];
    const lines = content.split('\n');
    let currentInstruction = null;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      // Check for line continuation
      if (currentInstruction && line.startsWith(' ')) {
        currentInstruction.args += ' ' + trimmedLine;
        currentInstruction.endLine = lineNum;
        return;
      }

      // Check if line ends with continuation
      if (trimmedLine.endsWith('\\')) {
        if (currentInstruction) {
          currentInstruction.args += ' ' + trimmedLine.slice(0, -1).trim();
          currentInstruction.endLine = lineNum;
        } else {
          const match = trimmedLine.match(/^([A-Z]+)\s+(.+)\\$/);
          if (match) {
            currentInstruction = {
              instruction: match[1],
              args: match[2].trim(),
              line: lineNum,
              endLine: lineNum
            };
          }
        }
        return;
      }

      // Finalize previous instruction
      if (currentInstruction) {
        instructions.push(currentInstruction);
        currentInstruction = null;
      }

      // Parse new instruction
      const match = trimmedLine.match(/^([A-Z]+)\s+(.+)$/);
      if (match) {
        instructions.push({
          instruction: match[1],
          args: match[2].trim(),
          line: lineNum,
          endLine: lineNum
        });
      }
    });

    // Don't forget last instruction if it was continued
    if (currentInstruction) {
      instructions.push(currentInstruction);
    }

    return instructions;
  }

  /**
   * Validate syntax
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  validateSyntax(instructions) {
    const issues = [];

    // Check if Dockerfile starts with FROM
    if (instructions.length === 0) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: 'Dockerfile is empty',
        code: 'DL3000'
      }));
      return issues;
    }

    // Check for unknown instructions
    instructions.forEach(inst => {
      if (!DOCKERFILE_INSTRUCTIONS.includes(inst.instruction)) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.ERROR,
          message: `Unknown instruction: ${inst.instruction}`,
          line: inst.line,
          code: 'DL3099'
        }));
      }
    });

    return issues;
  }

  /**
   * Check FROM instruction
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkFromInstruction(instructions) {
    const issues = [];
    const fromInstructions = instructions.filter(i => i.instruction === 'FROM');

    if (fromInstructions.length === 0) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: 'Dockerfile must start with FROM instruction',
        code: 'DL3000'
      }));
    } else {
      // Check if first instruction is FROM
      if (instructions[0].instruction !== 'FROM' && instructions[0].instruction !== 'ARG') {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.ERROR,
          message: 'FROM must be the first instruction (or preceded only by ARG)',
          line: instructions[0].line,
          code: 'DL3000'
        }));
      }
    }

    return issues;
  }

  /**
   * Check version pinning
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkPinVersion(instructions) {
    const issues = [];

    instructions.forEach(inst => {
      if (inst.instruction === 'FROM') {
        // Check if base image has version tag
        if (inst.args.includes(':latest') || !inst.args.includes(':')) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.WARNING,
            message: 'Base image should use specific version tag instead of \'latest\'',
            line: inst.line,
            code: 'DL3001',
            suggestion: 'Use a specific version tag (e.g., node:18.17.0 instead of node:latest)'
          }));
        }
      }
    });

    return issues;
  }

  /**
   * Check USER instruction
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkUser(instructions) {
    const issues = [];
    const hasUser = instructions.some(i => i.instruction === 'USER');

    if (!hasUser) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: 'No USER instruction found - container will run as root',
        code: 'DL3002',
        suggestion: 'Add USER instruction to run container as non-root user',
        documentation: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user'
      }));
    }

    return issues;
  }

  /**
   * Check WORKDIR usage
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkWorkdir(instructions) {
    const issues = [];

    instructions.forEach(inst => {
      if (inst.instruction === 'RUN' && inst.args.includes('cd ')) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: 'Use WORKDIR instead of \'cd\' in RUN commands',
          line: inst.line,
          code: 'DL3003',
          suggestion: 'Replace \'cd\' with WORKDIR instruction'
        }));
      }
    });

    return issues;
  }

  /**
   * Check apt-get best practices
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkAptGet(instructions) {
    const issues = [];

    instructions.forEach(inst => {
      if (inst.instruction === 'RUN' && inst.args.includes('apt-get')) {
        // Check for update && install pattern
        if (inst.args.includes('apt-get install') && !inst.args.includes('apt-get update')) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.WARNING,
            message: 'apt-get install should be combined with apt-get update in the same RUN',
            line: inst.line,
            code: 'DL3004',
            suggestion: 'RUN apt-get update && apt-get install -y <packages>'
          }));
        }

        // Check for -y flag
        if (inst.args.includes('apt-get install') && !inst.args.includes('-y')) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.WARNING,
            message: 'apt-get install should use -y flag for non-interactive installation',
            line: inst.line,
            code: 'DL3004'
          }));
        }

        // Check for cleanup
        if (inst.args.includes('apt-get') && !inst.args.includes('rm -rf /var/lib/apt/lists/*')) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.SUGGESTION,
            message: 'Clean up apt cache to reduce image size',
            line: inst.line,
            code: 'DL3004',
            suggestion: 'Add && rm -rf /var/lib/apt/lists/* at the end of apt-get commands'
          }));
        }
      }
    });

    return issues;
  }

  /**
   * Check COPY with chown
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkCopyChown(instructions) {
    const issues = [];
    const hasUser = instructions.some(i => i.instruction === 'USER');

    if (hasUser) {
      instructions.forEach(inst => {
        if ((inst.instruction === 'COPY' || inst.instruction === 'ADD') && !inst.args.includes('--chown=')) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.SUGGESTION,
            message: 'Consider using --chown flag with COPY/ADD to set ownership',
            line: inst.line,
            code: 'DL3005',
            suggestion: 'COPY --chown=user:group <src> <dest>'
          }));
        }
      });
    }

    return issues;
  }

  /**
   * Check layer optimization
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkLayerOptimization(instructions) {
    const issues = [];
    const runInstructions = instructions.filter(i => i.instruction === 'RUN');

    if (runInstructions.length > 10) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.INFO,
        message: `High number of RUN instructions (${runInstructions.length}) may increase image layers`,
        code: 'DL3006',
        suggestion: 'Consider combining related RUN commands using && to reduce layers'
      }));
    }

    return issues;
  }

  /**
   * Check healthcheck
   * @param {Array} instructions - Parsed instructions
   * @returns {Array} Issues
   */
  checkHealthcheck(instructions) {
    const issues = [];
    const hasHealthcheck = instructions.some(i => i.instruction === 'HEALTHCHECK');

    if (!hasHealthcheck) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.SUGGESTION,
        message: 'No HEALTHCHECK instruction found',
        code: 'DL3007',
        suggestion: 'Add HEALTHCHECK to monitor container health',
        documentation: 'https://docs.docker.com/engine/reference/builder/#healthcheck'
      }));
    }

    return issues;
  }

  /**
   * Check for secrets exposure
   * @param {Array} instructions - Parsed instructions
   * @param {string} content - Full content
   * @returns {Array} Issues
   */
  checkSecretsExposure(instructions, content) {
    const issues = [];
    const secretPatterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i
    ];

    instructions.forEach(inst => {
      if (inst.instruction === 'ENV' || inst.instruction === 'ARG') {
        secretPatterns.forEach(pattern => {
          if (pattern.test(inst.args)) {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.ERROR,
              message: 'Potential secret or credential found in Dockerfile',
              line: inst.line,
              code: 'DL3008',
              suggestion: 'Use build-time secrets or environment variables instead of hardcoding credentials'
            }));
          }
        });
      }
    });

    return issues;
  }

  /**
   * Validate multiple Dockerfiles
   * @param {Array} filePaths - Paths to Dockerfile files
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Aggregated result
   */
  async validateMultipleFiles(filePaths, options = {}) {
    this.logger.info(`Validating ${filePaths.length} Dockerfiles`);

    const results = [];
    for (const filePath of filePaths) {
      const result = await this.validate({ ...options, filePath });
      results.push(result);
    }

    return this.aggregateResults(results);
  }
}

/**
 * Get singleton instance
 */
let validatorInstance = null;

export function getDockerfileValidator() {
  if (!validatorInstance) {
    validatorInstance = new DockerfileValidator();
  }
  return validatorInstance;
}
