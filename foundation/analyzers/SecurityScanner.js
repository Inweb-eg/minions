/**
 * SecurityScanner - Security Vulnerability Detection
 *
 * Shared foundation module for security scanning across all agents.
 * Detects OWASP Top 10 and common security vulnerabilities.
 *
 * Capabilities:
 * - Secrets in code detection
 * - Weak password validation
 * - Missing rate limiting
 * - Missing input sanitization
 * - SQL injection vulnerabilities
 * - XSS vulnerabilities
 * - CORS misconfiguration
 * - Insecure authentication patterns
 */

import { BaseAnalyzer, SEVERITY, CATEGORY } from './BaseAnalyzer.js';

/**
 * SecurityScanner
 * Detects security vulnerabilities in code
 */
export class SecurityScanner extends BaseAnalyzer {
  constructor() {
    super('SecurityScanner');
  }

  /**
   * Analyze code for security vulnerabilities
   * @param {Object} ast - Abstract Syntax Tree
   * @param {string} code - Source code
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyze(ast, code, options = {}) {
    this.logger.info('Starting security vulnerability scan');
    this.clearIssues();

    // Run all security checks
    this.detectSecretsInCode(ast, code);
    this.detectWeakPasswordValidation(ast, code);
    this.detectMissingRateLimiting(ast, code);
    this.detectMissingInputSanitization(ast, code);
    this.detectSQLInjection(ast, code);
    this.detectXSSVulnerabilities(ast, code);
    this.detectCORSMisconfiguration(ast, code);
    this.detectInsecureAuthentication(ast, code);

    this.logger.info(`Security scan complete: ${this.issues.length} vulnerabilities found`);
    return this.formatResults();
  }

  /**
   * Detect secrets in code (API keys, passwords, tokens)
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectSecretsInCode(ast, code) {
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, name: 'API Key' },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Password' },
      { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Secret' },
      { pattern: /token\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Token' },
      { pattern: /aws[_-]?secret/gi, name: 'AWS Secret' },
      { pattern: /sk_live_[a-zA-Z0-9]+/g, name: 'Stripe Secret Key' },
      { pattern: /AIza[0-9A-Za-z_-]{35}/g, name: 'Google API Key' },
      { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub Token' },
      { pattern: /mongodb\+srv:\/\/[^'"]+/gi, name: 'MongoDB Connection String' }
    ];

    const lines = code.split('\n');
    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        return;
      }

      secretPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(line)) {
          this.addIssue(this.createIssue({
            type: 'hardcoded_secret',
            severity: SEVERITY.ERROR,
            message: `Hardcoded ${name} detected in code`,
            location: { line: index + 1, column: 0 },
            code: line.trim(),
            category: CATEGORY.SECURITY,
            suggestion: 'Move secrets to environment variables or secure vault'
          }));
        }
      });
    });
  }

  /**
   * Detect weak password validation
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectWeakPasswordValidation(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name || '';

        // Check password validation functions
        if (name.toLowerCase().includes('password') || name.toLowerCase().includes('validate')) {
          const functionCode = code.substring(path.node.start, path.node.end);

          // Check for minimum length requirement
          const hasMinLength = /length\s*[><=]+\s*\d+/.test(functionCode);

          if (!hasMinLength) {
            this.addIssue(this.createIssue({
              type: 'weak_password_validation',
              severity: SEVERITY.WARNING,
              message: `${name}: Missing password length validation`,
              location: { line: path.node.loc?.start.line || 0, column: 0 },
              code: name,
              category: CATEGORY.SECURITY,
              suggestion: 'Add minimum password length requirement (8+ characters)'
            }));
          }
        }
      }
    });
  }

  /**
   * Detect missing rate limiting
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectMissingRateLimiting(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      CallExpression: (path) => {
        // Detect Express route definitions
        if (path.node.callee.property &&
            ['post', 'put', 'delete'].includes(path.node.callee.property.name)) {

          const routePath = path.node.arguments[0]?.value || '';
          const functionCode = code.substring(path.node.start, path.node.end);

          // Check for rate limiter middleware
          const hasRateLimiter = /rateLimit|limiter/i.test(functionCode);

          if (!hasRateLimiter && (
            routePath.includes('login') ||
            routePath.includes('register') ||
            routePath.includes('password') ||
            routePath.includes('api')
          )) {
            this.addIssue(this.createIssue({
              type: 'missing_rate_limiting',
              severity: SEVERITY.WARNING,
              message: `Route ${routePath}: Missing rate limiting`,
              location: { line: path.node.loc?.start.line || 0, column: 0 },
              code: routePath,
              category: CATEGORY.SECURITY,
              suggestion: 'Add express-rate-limit middleware to prevent abuse'
            }));
          }
        }
      }
    });
  }

  /**
   * Detect missing input sanitization
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectMissingInputSanitization(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      MemberExpression: (path) => {
        // Check for req.body, req.query, req.params usage
        if (path.node.object?.name === 'req' &&
            ['body', 'query', 'params'].includes(path.node.property?.name)) {

          // Check if sanitization is applied
          const parent = path.parent;
          if (parent) {
            const hasSanitization = code.substring(parent.start, parent.end).match(
              /sanitize|escape|trim|validator|xss|DOMPurify/i
            );

            if (!hasSanitization) {
              this.addIssue(this.createIssue({
                type: 'missing_input_sanitization',
                severity: SEVERITY.WARNING,
                message: `User input from req.${path.node.property.name} not sanitized`,
                location: { line: path.node.loc?.start.line || 0, column: 0 },
                code: `req.${path.node.property.name}`,
                category: CATEGORY.SECURITY,
                suggestion: 'Sanitize user input using express-validator or similar'
              }));
            }
          }
        }
      }
    });
  }

  /**
   * Detect SQL injection vulnerabilities
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectSQLInjection(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      TemplateLiteral: (path) => {
        const templateCode = code.substring(path.node.start, path.node.end);

        // Check if template contains SQL keywords
        if (/SELECT|INSERT|UPDATE|DELETE|WHERE|FROM/i.test(templateCode)) {
          // Check if expressions use user input
          path.node.expressions.forEach((expr) => {
            const exprCode = code.substring(expr.start, expr.end);

            if (exprCode.includes('req.') || exprCode.includes('params') || exprCode.includes('query')) {
              this.addIssue(this.createIssue({
                type: 'sql_injection',
                severity: SEVERITY.ERROR,
                message: 'Potential SQL injection: User input in SQL query',
                location: { line: path.node.loc?.start.line || 0, column: 0 },
                code: templateCode.substring(0, 50) + '...',
                category: CATEGORY.SECURITY,
                suggestion: 'Use parameterized queries or ORM (Sequelize, TypeORM)'
              }));
            }
          });
        }
      }
    });
  }

  /**
   * Detect XSS vulnerabilities
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectXSSVulnerabilities(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      CallExpression: (path) => {
        // Check for res.send/res.write with user input
        if (path.node.callee.property &&
            ['send', 'write', 'end'].includes(path.node.callee.property.name) &&
            path.node.callee.object?.name === 'res') {

          path.node.arguments.forEach((arg) => {
            const argCode = code.substring(arg.start, arg.end);

            // Check if argument contains user input
            if (argCode.includes('req.') || argCode.includes('params') || argCode.includes('query')) {
              const hasEscaping = argCode.match(/escape|sanitize|DOMPurify|xss/i);

              if (!hasEscaping) {
                this.addIssue(this.createIssue({
                  type: 'xss_vulnerability',
                  severity: SEVERITY.ERROR,
                  message: 'Potential XSS: Unescaped user input in response',
                  location: { line: path.node.loc?.start.line || 0, column: 0 },
                  code: argCode.substring(0, 50) + '...',
                  category: CATEGORY.SECURITY,
                  suggestion: 'Escape user input using xss library or Content Security Policy'
                }));
              }
            }
          });
        }
      }
    });
  }

  /**
   * Detect CORS misconfiguration
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectCORSMisconfiguration(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      CallExpression: (path) => {
        // Check for cors() usage
        if (path.node.callee.name === 'cors') {
          const corsConfig = path.node.arguments[0];

          if (!corsConfig) {
            this.addIssue(this.createIssue({
              type: 'cors_misconfiguration',
              severity: SEVERITY.WARNING,
              message: 'CORS enabled without configuration (allows all origins)',
              location: { line: path.node.loc?.start.line || 0, column: 0 },
              code: 'cors()',
              category: CATEGORY.SECURITY,
              suggestion: 'Configure CORS with specific allowed origins'
            }));
          } else if (corsConfig.type === 'ObjectExpression') {
            const originProp = corsConfig.properties.find(p => p.key?.name === 'origin');

            if (originProp && originProp.value?.value === '*') {
              this.addIssue(this.createIssue({
                type: 'cors_misconfiguration',
                severity: SEVERITY.WARNING,
                message: 'CORS allows all origins (origin: "*")',
                location: { line: path.node.loc?.start.line || 0, column: 0 },
                code: 'origin: "*"',
                category: CATEGORY.SECURITY,
                suggestion: 'Restrict CORS to specific trusted origins'
              }));
            }
          }
        }
      }
    });
  }

  /**
   * Detect insecure authentication
   * @param {Object} ast - AST
   * @param {string} code - Source code
   */
  detectInsecureAuthentication(ast, code) {
    if (!ast) return;

    this.traverse(ast, {
      CallExpression: (path) => {
        const calleeCode = code.substring(path.node.callee.start, path.node.callee.end);

        // Check for weak hashing algorithms
        if (calleeCode.includes('createHash') || calleeCode.includes('hash')) {
          const args = path.node.arguments;
          if (args.length > 0 && args[0].value) {
            const algorithm = args[0].value.toLowerCase();

            if (['md5', 'sha1'].includes(algorithm)) {
              this.addIssue(this.createIssue({
                type: 'weak_hashing_algorithm',
                severity: SEVERITY.ERROR,
                message: `Weak hashing algorithm: ${algorithm}`,
                location: { line: path.node.loc?.start.line || 0, column: 0 },
                code: algorithm,
                category: CATEGORY.SECURITY,
                suggestion: 'Use bcrypt, scrypt, or argon2 for password hashing'
              }));
            }
          }
        }

        // Check for JWT without expiration
        if (calleeCode.includes('jwt.sign')) {
          const args = path.node.arguments;
          if (args.length >= 2) {
            const options = args[2];
            if (!options || options.type !== 'ObjectExpression') {
              this.addIssue(this.createIssue({
                type: 'jwt_without_expiration',
                severity: SEVERITY.WARNING,
                message: 'JWT signed without expiration time',
                location: { line: path.node.loc?.start.line || 0, column: 0 },
                code: 'jwt.sign()',
                category: CATEGORY.SECURITY,
                suggestion: 'Add expiresIn option to JWT.sign()'
              }));
            }
          }
        }
      }
    });
  }
}

/**
 * Get singleton instance
 */
let scannerInstance = null;

export function getSecurityScanner() {
  if (!scannerInstance) {
    scannerInstance = new SecurityScanner();
  }
  return scannerInstance;
}

export default SecurityScanner;
