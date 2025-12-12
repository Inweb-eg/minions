/**
 * FileSecurityScanner - File-based Security vulnerability detection skill
 *
 * Distinguished from foundation/SecurityScanner which does AST-based analysis.
 * This skill focuses on file system scanning:
 * - OWASP Top 10 vulnerabilities
 * - Hardcoded secrets and credentials
 * - Insecure dependencies
 * - Configuration issues
 * - Code injection risks
 *
 * Extends BaseSkill for consistency with other skills.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BaseSkill, SEVERITY, CATEGORY, createSkillGetter } from '../BaseSkill.js';
import { EventTypes } from '../../../../agents/foundation/event-bus/eventTypes.js';

/**
 * FileSecurityScanner
 * File-based security vulnerability scanner extending BaseSkill
 */
export class FileSecurityScanner extends BaseSkill {
  constructor(options = {}) {
    super('FileSecurityScanner', options);

    this.scanOptions = {
      scanSecrets: true,
      scanDependencies: true,
      scanCode: true,
      scanConfig: true,
      secretPatterns: 'default',
      severityThreshold: 'low', // low, medium, high, critical
      excludePatterns: ['node_modules', '.git', 'dist', 'build'],
      ...options
    };

    // Secret patterns for detection
    this.secretPatterns = [
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: SEVERITY.CRITICAL },
      { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g, context: /aws|secret/i, severity: SEVERITY.CRITICAL },
      { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/g, severity: SEVERITY.CRITICAL },
      { name: 'GitHub OAuth', pattern: /gho_[0-9a-zA-Z]{36}/g, severity: SEVERITY.CRITICAL },
      { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g, severity: SEVERITY.CRITICAL },
      { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g, severity: SEVERITY.CRITICAL },
      { name: 'Twilio Key', pattern: /SK[0-9a-fA-F]{32}/g, severity: SEVERITY.HIGH },
      { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, severity: SEVERITY.CRITICAL },
      { name: 'Password in URL', pattern: /[a-zA-Z]+:\/\/[^:]+:[^@]+@/g, severity: SEVERITY.HIGH },
      { name: 'Generic API Key', pattern: /api[_-]?key['":\s]*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, severity: SEVERITY.HIGH },
      { name: 'Generic Secret', pattern: /secret['":\s]*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, severity: SEVERITY.HIGH },
      { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, severity: SEVERITY.MEDIUM },
      { name: 'Base64 Encoded', pattern: /['"]\s*[A-Za-z0-9+/]{40,}={0,2}\s*['"]/g, context: /key|secret|password|token/i, severity: SEVERITY.MEDIUM }
    ];

    // Vulnerability patterns (OWASP-inspired)
    this.vulnerabilityPatterns = {
      injection: [
        { name: 'SQL Injection', pattern: /(?:query|execute|raw)\s*\(\s*[`'"]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP).*\$\{/gi, severity: SEVERITY.CRITICAL },
        { name: 'SQL Injection (concat)', pattern: /(?:query|execute)\s*\(\s*['"]\s*(?:SELECT|INSERT|UPDATE|DELETE).*['"]?\s*\+/gi, severity: SEVERITY.CRITICAL },
        { name: 'Command Injection', pattern: /(?:exec|spawn|execSync)\s*\(\s*(?:[`'"].*\$\{|[^)]*\+)/gi, severity: SEVERITY.CRITICAL },
        { name: 'NoSQL Injection', pattern: /\.\s*(?:find|findOne|update|delete)\s*\(\s*\{[^}]*\$(?:where|regex|expr)/gi, severity: SEVERITY.HIGH },
        { name: 'LDAP Injection', pattern: /ldap.*\(\s*[`'"].*\$\{/gi, severity: SEVERITY.HIGH },
        { name: 'XPath Injection', pattern: /xpath.*\(\s*[`'"].*\$\{/gi, severity: SEVERITY.HIGH }
      ],
      xss: [
        { name: 'innerHTML Assignment', pattern: /\.innerHTML\s*=\s*[^'"]/g, severity: SEVERITY.HIGH },
        { name: 'React dangerouslySetInnerHTML', pattern: /dangerouslySetInnerHTML\s*=\s*\{/g, severity: SEVERITY.HIGH },
        { name: 'document.write', pattern: /document\.write\s*\(/g, severity: SEVERITY.HIGH },
        { name: 'jQuery html()', pattern: /\$\([^)]+\)\.html\s*\(\s*[^'"]/g, severity: SEVERITY.MEDIUM },
        { name: 'Unsanitized URL', pattern: /(?:href|src)\s*=\s*[`'"]?\s*\$\{/gi, severity: SEVERITY.MEDIUM }
      ],
      authentication: [
        { name: 'Hardcoded Password', pattern: /password\s*[:=]\s*['"][^'"]{3,}['"]/gi, severity: SEVERITY.CRITICAL },
        { name: 'Weak Password Check', pattern: /password\.length\s*[<>=]+\s*[0-7]\b/gi, severity: SEVERITY.MEDIUM },
        { name: 'Missing Auth Check', pattern: /app\.(get|post|put|delete)\s*\([^,]+,\s*(?:async\s*)?\([^)]*\)\s*=>/g, context: /auth|protect|verify/i, negate: true, severity: SEVERITY.MEDIUM }
      ],
      cryptography: [
        { name: 'Weak Hash (MD5)', pattern: /crypto\.createHash\s*\(\s*['"]md5['"]\s*\)/gi, severity: SEVERITY.HIGH },
        { name: 'Weak Hash (SHA1)', pattern: /crypto\.createHash\s*\(\s*['"]sha1['"]\s*\)/gi, severity: SEVERITY.MEDIUM },
        { name: 'Weak Cipher (DES)', pattern: /crypto\.createCipher(?:iv)?\s*\(\s*['"]des/gi, severity: SEVERITY.HIGH },
        { name: 'Hardcoded IV', pattern: /createCipheriv\s*\([^,]+,\s*[^,]+,\s*['"][^'"]+['"]\s*\)/g, severity: SEVERITY.HIGH },
        { name: 'Math.random for Security', pattern: /Math\.random\s*\(\s*\).*(?:token|key|secret|salt|iv)/gi, severity: SEVERITY.HIGH }
      ],
      exposure: [
        { name: 'Stack Trace Exposure', pattern: /res\.(?:send|json)\s*\(\s*(?:err|error)\.stack/gi, severity: SEVERITY.MEDIUM },
        { name: 'Debug Mode', pattern: /DEBUG\s*[:=]\s*(?:true|1|['"]true['"])/gi, severity: SEVERITY.LOW },
        { name: 'Verbose Logging', pattern: /console\.log\s*\(\s*(?:password|secret|token|key)/gi, severity: SEVERITY.HIGH },
        { name: 'Error Message Exposure', pattern: /catch\s*\([^)]+\)\s*\{[^}]*res\.(?:send|json)\s*\(\s*\{[^}]*message:\s*(?:e|err|error)\.message/gi, severity: SEVERITY.LOW }
      ],
      configuration: [
        { name: 'CORS Allow All', pattern: /cors\s*\(\s*\{[^}]*origin:\s*['"]\*['"]/gi, severity: SEVERITY.MEDIUM },
        { name: 'Missing Helmet', pattern: /app\s*=\s*express\s*\(\s*\)/g, context: /helmet/i, negate: true, severity: SEVERITY.LOW },
        { name: 'Disabled HTTPS', pattern: /rejectUnauthorized\s*:\s*false/gi, severity: SEVERITY.HIGH },
        { name: 'Insecure Cookie', pattern: /cookie\s*\([^)]*secure\s*:\s*false/gi, severity: SEVERITY.MEDIUM },
        { name: 'Missing HttpOnly', pattern: /cookie\s*\([^)]*(?!httpOnly)/gi, context: /session|auth/i, severity: SEVERITY.LOW }
      ],
      unsafe: [
        { name: 'eval Usage', pattern: /\beval\s*\(/g, severity: SEVERITY.CRITICAL },
        { name: 'Function Constructor', pattern: /new\s+Function\s*\(/g, severity: SEVERITY.CRITICAL },
        { name: 'setTimeout with String', pattern: /setTimeout\s*\(\s*['"`]/g, severity: SEVERITY.HIGH },
        { name: 'setInterval with String', pattern: /setInterval\s*\(\s*['"`]/g, severity: SEVERITY.HIGH },
        { name: 'Prototype Pollution', pattern: /\[['"](?:__proto__|constructor|prototype)['"]\]/g, severity: SEVERITY.HIGH },
        { name: 'Unsafe Deserialization', pattern: /(?:serialize|pickle|marshal)\.(?:loads?|parse)\s*\(\s*(?!['"])/g, severity: SEVERITY.CRITICAL }
      ],
      fileSystem: [
        { name: 'Path Traversal', pattern: /(?:readFile|writeFile|unlink|rmdir)\s*\([^)]*\+\s*(?:req\.|params\.|query\.)/gi, severity: SEVERITY.CRITICAL },
        { name: 'Arbitrary File Read', pattern: /fs\.(?:readFile|createReadStream)\s*\(\s*(?:req\.|params\.|query\.)/gi, severity: SEVERITY.CRITICAL },
        { name: 'Arbitrary File Write', pattern: /fs\.(?:writeFile|createWriteStream)\s*\(\s*(?:req\.|params\.|query\.)/gi, severity: SEVERITY.CRITICAL },
        { name: 'Unrestricted Upload', pattern: /multer\s*\(\s*\{[^}]*(?!fileFilter)/g, severity: SEVERITY.MEDIUM }
      ]
    };

    // Dangerous packages
    this.dangerousPackages = [
      { name: 'event-stream', reason: 'Known malicious version (flatmap-stream)', severity: SEVERITY.CRITICAL },
      { name: 'flatmap-stream', reason: 'Malicious package', severity: SEVERITY.CRITICAL },
      { name: 'ua-parser-js', versions: ['<0.7.30'], reason: 'Cryptocurrency miner in versions <0.7.30', severity: SEVERITY.CRITICAL },
      { name: 'coa', versions: ['<2.0.3'], reason: 'Malicious version', severity: SEVERITY.CRITICAL },
      { name: 'rc', versions: ['<1.2.9'], reason: 'Malicious version', severity: SEVERITY.CRITICAL }
    ];
  }

  /**
   * Override: Custom event subscriptions
   */
  subscribeToEvents() {
    this.subscribe(EventTypes.SECURITY_SCAN_REQUESTED, async (data) => {
      try {
        const result = await this.scan(data);
        this.publish(EventTypes.SECURITY_SCAN_COMPLETED, result);
      } catch (error) {
        this.logger.error('Error handling SECURITY_SCAN_REQUESTED event:', error);
        this.publish(EventTypes.SECURITY_SCAN_COMPLETED, {
          success: false,
          error: error.message
        });
      }
    });

    this.subscribe(EventTypes.CODE_GENERATED, async (data) => {
      try {
        if (data.files) {
          const result = await this.scanFiles(data.files);
          if (result.findings.length > 0) {
            this.publish(EventTypes.ISSUE_DETECTED, {
              type: 'security',
              findings: result.findings
            });
          }
        }
      } catch (error) {
        this.logger.error('Error handling CODE_GENERATED event:', error);
      }
    });
  }

  /**
   * Run a full security scan
   */
  async scan(options = {}) {
    this.startRun();

    const targetPath = options.path || options.target || process.cwd();

    this.logger.info(`Starting security scan of ${targetPath}`);

    try {
      // Scan for secrets
      if (this.scanOptions.scanSecrets) {
        const secretFindings = await this.scanForSecrets(targetPath);
        secretFindings.forEach(f => this.addIssue(this.createIssue({
          type: f.type,
          severity: f.severity,
          category: CATEGORY.SECURITY,
          message: f.message,
          file: f.file,
          line: f.line,
          suggestion: f.recommendation
        })));
      }

      // Scan code for vulnerabilities
      if (this.scanOptions.scanCode) {
        const codeFindings = await this.scanCodeVulnerabilities(targetPath);
        codeFindings.forEach(f => this.addIssue(this.createIssue({
          type: f.type,
          severity: f.severity,
          category: CATEGORY.SECURITY,
          message: f.message,
          file: f.file,
          line: f.line,
          suggestion: f.recommendation
        })));
      }

      // Scan dependencies
      if (this.scanOptions.scanDependencies) {
        const depFindings = await this.scanDependencies(targetPath);
        depFindings.forEach(f => this.addIssue(this.createIssue({
          type: 'dependency',
          severity: f.severity,
          category: CATEGORY.DEPENDENCY,
          message: f.message,
          file: f.file,
          suggestion: f.recommendation
        })));
      }

      // Scan configuration files
      if (this.scanOptions.scanConfig) {
        const configFindings = await this.scanConfiguration(targetPath);
        configFindings.forEach(f => this.addIssue(this.createIssue({
          type: 'configuration',
          severity: f.severity,
          category: CATEGORY.SECURITY,
          message: f.message,
          file: f.file,
          suggestion: f.recommendation
        })));
      }

      this.completeRun();

      // Publish alert if critical findings
      const criticalCount = this.getIssuesBySeverity(SEVERITY.CRITICAL).length;
      if (criticalCount > 0) {
        this.publish(EventTypes.ALERT_TRIGGERED, {
          type: 'security',
          severity: 'critical',
          message: `Found ${criticalCount} critical security vulnerabilities`,
          findings: this.getIssuesBySeverity(SEVERITY.CRITICAL)
        });
      }

      return {
        success: true,
        target: targetPath,
        findings: this.getIssues(),
        summary: this.generateSummary(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.failRun(error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Scan a single file
   */
  async scanFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const findings = [];

    // Scan for secrets
    const secretFindings = this.findSecrets(content, filePath);
    findings.push(...secretFindings);

    // Scan for vulnerabilities
    const vulnFindings = this.findVulnerabilities(content, filePath);
    findings.push(...vulnFindings);

    return {
      success: true,
      file: filePath,
      findings
    };
  }

  /**
   * Scan multiple files
   */
  async scanFiles(files) {
    const allFindings = [];

    for (const file of files) {
      const result = await this.scanFile(file);
      if (result.success) {
        allFindings.push(...result.findings);
      }
    }

    return {
      success: true,
      filesScanned: files.length,
      findings: allFindings
    };
  }

  /**
   * Scan directory for secrets
   */
  async scanForSecrets(targetPath) {
    const findings = [];
    const files = this.getFilesToScan(targetPath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileFindings = this.findSecrets(content, file);
        findings.push(...fileFindings);
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  }

  /**
   * Find secrets in content
   */
  findSecrets(content, filePath) {
    const findings = [];

    for (const pattern of this.secretPatterns) {
      const matches = content.matchAll(pattern.pattern);

      for (const match of matches) {
        // Check context if required
        if (pattern.context) {
          const lineStart = content.lastIndexOf('\n', match.index) + 1;
          const lineEnd = content.indexOf('\n', match.index);
          const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

          if (!pattern.context.test(line)) continue;
        }

        const lineNumber = content.substring(0, match.index).split('\n').length;

        findings.push({
          type: 'secret',
          name: pattern.name,
          severity: pattern.severity,
          file: filePath,
          line: lineNumber,
          match: this.maskSecret(match[0]),
          message: `Potential ${pattern.name} detected`,
          recommendation: 'Remove from code and use environment variables or a secrets manager'
        });
      }
    }

    return findings;
  }

  /**
   * Scan for code vulnerabilities
   */
  async scanCodeVulnerabilities(targetPath) {
    const findings = [];
    const files = this.getFilesToScan(targetPath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileFindings = this.findVulnerabilities(content, file);
        findings.push(...fileFindings);
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  }

  /**
   * Find vulnerabilities in content
   */
  findVulnerabilities(content, filePath) {
    const findings = [];

    for (const [category, patterns] of Object.entries(this.vulnerabilityPatterns)) {
      for (const vuln of patterns) {
        const matches = content.matchAll(vuln.pattern);

        for (const match of matches) {
          // Check context
          if (vuln.context) {
            const contextMatch = vuln.context.test(content);
            if (vuln.negate ? contextMatch : !contextMatch) continue;
          }

          const lineNumber = content.substring(0, match.index).split('\n').length;

          findings.push({
            type: 'vulnerability',
            category,
            name: vuln.name,
            severity: vuln.severity,
            file: filePath,
            line: lineNumber,
            match: match[0].substring(0, 100),
            message: `${vuln.name} vulnerability detected`,
            recommendation: this.getRecommendation(category, vuln.name)
          });
        }
      }
    }

    return findings;
  }

  /**
   * Scan dependencies for known vulnerabilities
   */
  async scanDependencies(targetPath) {
    const findings = [];

    // Check package.json
    const packageJsonPath = path.join(targetPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        for (const pkg of this.dangerousPackages) {
          if (pkg.name in allDeps) {
            const version = allDeps[pkg.name];

            // Check version if specified
            if (pkg.versions) {
              const isVulnerable = this.isVersionVulnerable(version, pkg.versions);
              if (!isVulnerable) continue;
            }

            findings.push({
              type: 'dependency',
              name: pkg.name,
              severity: pkg.severity,
              file: packageJsonPath,
              version,
              message: `Potentially dangerous package: ${pkg.name}`,
              reason: pkg.reason,
              recommendation: `Update or remove ${pkg.name}`
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Could not parse package.json: ${error.message}`);
      }
    }

    // Try running npm audit
    try {
      const auditResult = await this.runNpmAudit(targetPath);
      findings.push(...auditResult);
    } catch (error) {
      this.logger.debug('npm audit not available or failed');
    }

    return findings;
  }

  /**
   * Run npm audit
   */
  async runNpmAudit(targetPath) {
    return new Promise((resolve) => {
      const proc = spawn('npm', ['audit', '--json'], {
        cwd: targetPath,
        shell: true,
        timeout: 60000
      });

      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        try {
          const audit = JSON.parse(output);
          const findings = [];

          if (audit.vulnerabilities) {
            for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
              findings.push({
                type: 'dependency',
                name,
                severity: vuln.severity,
                file: 'package.json',
                version: vuln.range,
                message: `Vulnerability in ${name}: ${vuln.title || 'Unknown'}`,
                recommendation: vuln.fixAvailable ? `Update to fix available` : 'Check for updates'
              });
            }
          }

          resolve(findings);
        } catch {
          resolve([]);
        }
      });

      proc.on('error', () => resolve([]));
    });
  }

  /**
   * Scan configuration files
   */
  async scanConfiguration(targetPath) {
    const findings = [];
    const configFiles = [
      '.env', '.env.local', '.env.production',
      'config.json', 'config.js',
      'docker-compose.yml', 'docker-compose.yaml',
      '.npmrc', '.yarnrc'
    ];

    for (const configFile of configFiles) {
      const filePath = path.join(targetPath, configFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for secrets in config
        const secretFindings = this.findSecrets(content, filePath);
        findings.push(...secretFindings);

        // Additional config-specific checks
        if (configFile.includes('.env')) {
          // Check for debug mode
          if (/DEBUG\s*=\s*(?:true|1)/i.test(content)) {
            findings.push({
              type: 'configuration',
              name: 'Debug Mode Enabled',
              severity: SEVERITY.MEDIUM,
              file: filePath,
              message: 'Debug mode is enabled in environment',
              recommendation: 'Disable debug mode in production'
            });
          }

          // Check for weak secrets
          const envLines = content.split('\n');
          for (const line of envLines) {
            const match = line.match(/^(\w+)=(.*)$/);
            if (match && /secret|password|key/i.test(match[1])) {
              const value = match[2].replace(/['"]/g, '');
              if (value.length < 16) {
                findings.push({
                  type: 'configuration',
                  name: 'Weak Secret',
                  severity: SEVERITY.MEDIUM,
                  file: filePath,
                  message: `${match[1]} appears to have a weak value`,
                  recommendation: 'Use strong, random values for secrets (32+ characters)'
                });
              }
            }
          }
        }
      }
    }

    return findings;
  }

  // ==================== Utilities ====================

  getFilesToScan(targetPath) {
    const files = [];
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.dart', '.java', '.go', '.rb'];

    const scanDir = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Check exclusions
          if (this.scanOptions.excludePatterns.some(p => fullPath.includes(p))) {
            continue;
          }

          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    if (fs.statSync(targetPath).isDirectory()) {
      scanDir(targetPath);
    } else {
      files.push(targetPath);
    }

    return files;
  }

  maskSecret(secret) {
    if (secret.length <= 8) return '****';
    return secret.substring(0, 4) + '*'.repeat(Math.min(secret.length - 8, 20)) + secret.substring(secret.length - 4);
  }

  isVersionVulnerable(version, vulnerableVersions) {
    // Simplified version check
    const cleanVersion = version.replace(/[\^~>=<]/g, '');
    for (const vulnVersion of vulnerableVersions) {
      if (vulnVersion.startsWith('<')) {
        const threshold = vulnVersion.substring(1);
        if (this.compareVersions(cleanVersion, threshold) < 0) {
          return true;
        }
      }
    }
    return false;
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }

  getRecommendation(category, name) {
    const recommendations = {
      injection: 'Use parameterized queries, prepared statements, or ORM methods',
      xss: 'Sanitize user input, use Content Security Policy, escape output',
      authentication: 'Use secure authentication libraries, implement proper session management',
      cryptography: 'Use modern algorithms (AES-256, SHA-256+), secure random generation',
      exposure: 'Use proper logging levels, sanitize error messages in production',
      configuration: 'Review security headers, use secure defaults',
      unsafe: 'Avoid eval() and dynamic code execution, validate all input',
      fileSystem: 'Validate and sanitize file paths, use allowlists for file operations'
    };

    return recommendations[category] || 'Review and fix the security issue';
  }

  calculateSecurityScore() {
    const counts = {
      [SEVERITY.CRITICAL]: this.getIssuesBySeverity(SEVERITY.CRITICAL).length,
      [SEVERITY.HIGH]: this.getIssuesBySeverity(SEVERITY.HIGH).length,
      [SEVERITY.MEDIUM]: this.getIssuesBySeverity(SEVERITY.MEDIUM).length,
      [SEVERITY.LOW]: this.getIssuesBySeverity(SEVERITY.LOW).length,
      [SEVERITY.INFO]: this.getIssuesBySeverity(SEVERITY.INFO).length
    };

    // Score out of 100
    let score = 100;
    score -= counts[SEVERITY.CRITICAL] * 25;
    score -= counts[SEVERITY.HIGH] * 15;
    score -= counts[SEVERITY.MEDIUM] * 10;
    score -= counts[SEVERITY.LOW] * 5;
    score -= counts[SEVERITY.INFO] * 2;
    return Math.max(0, score);
  }

  /**
   * Override getStatus to include security-specific info
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      patternCount: this.secretPatterns.length + Object.values(this.vulnerabilityPatterns).flat().length,
      scanOptions: {
        scanSecrets: this.scanOptions.scanSecrets,
        scanDependencies: this.scanOptions.scanDependencies,
        scanCode: this.scanOptions.scanCode,
        scanConfig: this.scanOptions.scanConfig
      },
      securityScore: this.calculateSecurityScore()
    };
  }
}

// Singleton getter
export const getFileSecurityScanner = createSkillGetter(FileSecurityScanner);

// Legacy export for backward compatibility
export { FileSecurityScanner as SecurityScanner };
export const getSecurityScanner = getFileSecurityScanner;

export default FileSecurityScanner;
