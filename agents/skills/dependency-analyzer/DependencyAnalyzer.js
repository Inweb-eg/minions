/**
 * DependencyAnalyzer - Dependency management and analysis skill
 *
 * Analyzes:
 * - Outdated dependencies
 * - Security vulnerabilities
 * - License compliance
 * - Unused dependencies
 * - Circular dependencies
 * - Bundle size impact
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getEventBus } from '../../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';
import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('DependencyAnalyzer');

export class DependencyAnalyzer {
  constructor(options = {}) {
    this.options = {
      checkOutdated: true,
      checkSecurity: true,
      checkLicense: true,
      checkUnused: true,
      checkCircular: false,
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', '0BSD'],
      ignoredPackages: [],
      ...options
    };

    this.eventBus = null;
    this.initialized = false;
    this.cache = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    logger.info('Initializing DependencyAnalyzer skill...');
    this.eventBus = getEventBus();

    if (this.eventBus) {
      this.eventBus.subscribe(EventTypes.ANALYZE_DEPENDENCIES, 'dependency-analyzer', async (data) => {
        try {
          const result = await this.analyze(data);
          this.eventBus.publish(EventTypes.DEPENDENCIES_ANALYZED, result);
        } catch (error) {
          logger.error('Error handling ANALYZE_DEPENDENCIES event:', error);
          this.eventBus.publish(EventTypes.DEPENDENCIES_ANALYZED, {
            success: false,
            error: error.message
          });
        }
      });

      this.eventBus.subscribe(EventTypes.UPDATE_DEPENDENCIES, 'dependency-analyzer', async (data) => {
        try {
          const result = await this.updateDependencies(data);
          this.eventBus.publish(EventTypes.DEPENDENCIES_UPDATED, result);
        } catch (error) {
          logger.error('Error handling UPDATE_DEPENDENCIES event:', error);
          this.eventBus.publish(EventTypes.DEPENDENCIES_UPDATED, {
            success: false,
            error: error.message
          });
        }
      });

      // Publish skill ready event
      this.eventBus.publish(EventTypes.SKILL_READY, {
        skill: 'dependency-analyzer',
        timestamp: new Date().toISOString()
      });
    }

    this.initialized = true;
    logger.info('DependencyAnalyzer initialized');
  }

  /**
   * Full dependency analysis
   */
  async analyze(options = {}) {
    const startTime = Date.now();
    const targetPath = options.path || options.target || process.cwd();

    logger.info(`Analyzing dependencies in ${targetPath}`);

    const result = {
      success: true,
      path: targetPath,
      packageManager: await this.detectPackageManager(targetPath),
      dependencies: {},
      devDependencies: {},
      issues: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };

    // Read package.json
    const packageJson = await this.readPackageJson(targetPath);
    if (!packageJson) {
      return { success: false, error: 'No package.json found' };
    }

    result.dependencies = packageJson.dependencies || {};
    result.devDependencies = packageJson.devDependencies || {};
    result.totalDependencies = Object.keys(result.dependencies).length;
    result.totalDevDependencies = Object.keys(result.devDependencies).length;

    // Check for outdated packages
    if (this.options.checkOutdated) {
      const outdated = await this.checkOutdated(targetPath);
      result.outdated = outdated;
      result.issues.push(...outdated.map(p => ({
        type: 'outdated',
        severity: this.getOutdatedSeverity(p),
        package: p.name,
        current: p.current,
        wanted: p.wanted,
        latest: p.latest,
        message: `${p.name} is outdated (${p.current} → ${p.latest})`
      })));
    }

    // Check for security vulnerabilities
    if (this.options.checkSecurity) {
      const security = await this.checkSecurity(targetPath);
      result.security = security;
      result.issues.push(...security.vulnerabilities.map(v => ({
        type: 'security',
        severity: v.severity,
        package: v.name,
        message: v.title || `Security vulnerability in ${v.name}`,
        recommendation: v.recommendation
      })));
    }

    // Check licenses
    if (this.options.checkLicense) {
      const licenses = await this.checkLicenses(targetPath);
      result.licenses = licenses;
      result.issues.push(...licenses.issues.map(l => ({
        type: 'license',
        severity: 'medium',
        package: l.package,
        license: l.license,
        message: `${l.package} has non-standard license: ${l.license}`
      })));
    }

    // Check for unused dependencies
    if (this.options.checkUnused) {
      const unused = await this.checkUnused(targetPath);
      result.unused = unused;
      result.issues.push(...unused.map(p => ({
        type: 'unused',
        severity: 'low',
        package: p,
        message: `${p} appears to be unused`
      })));
    }

    // Check for circular dependencies
    if (this.options.checkCircular) {
      const circular = await this.checkCircular(targetPath);
      result.circular = circular;
      result.issues.push(...circular.map(c => ({
        type: 'circular',
        severity: 'medium',
        packages: c,
        message: `Circular dependency detected: ${c.join(' → ')}`
      })));
    }

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    // Calculate health score
    result.healthScore = this.calculateHealthScore(result);
    result.duration = Date.now() - startTime;

    // Publish if critical issues
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0 && this.eventBus) {
      this.eventBus.publish(EventTypes.ALERT_TRIGGERED, {
        type: 'dependencies',
        severity: 'critical',
        message: `${criticalIssues.length} critical dependency issues found`,
        issues: criticalIssues
      });
    }

    return result;
  }

  /**
   * Check for outdated packages
   */
  async checkOutdated(targetPath) {
    return new Promise((resolve) => {
      const proc = spawn('npm', ['outdated', '--json'], {
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
          const outdated = JSON.parse(output || '{}');
          const packages = Object.entries(outdated).map(([name, info]) => ({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            type: info.type
          }));
          resolve(packages);
        } catch {
          resolve([]);
        }
      });

      proc.on('error', () => resolve([]));
    });
  }

  /**
   * Check for security vulnerabilities
   */
  async checkSecurity(targetPath) {
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
          const audit = JSON.parse(output || '{}');
          const vulnerabilities = [];

          if (audit.vulnerabilities) {
            for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
              vulnerabilities.push({
                name,
                severity: vuln.severity,
                title: vuln.via?.[0]?.title,
                range: vuln.range,
                fixAvailable: vuln.fixAvailable,
                recommendation: vuln.fixAvailable
                  ? `Run 'npm audit fix' or update to ${vuln.fixAvailable.version || 'latest'}`
                  : 'Check for updates or find alternative'
              });
            }
          }

          resolve({
            vulnerabilities,
            summary: audit.metadata || {}
          });
        } catch {
          resolve({ vulnerabilities: [], summary: {} });
        }
      });

      proc.on('error', () => resolve({ vulnerabilities: [], summary: {} }));
    });
  }

  /**
   * Check licenses
   */
  async checkLicenses(targetPath) {
    const licenses = [];
    const issues = [];
    const nodeModulesPath = path.join(targetPath, 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) {
      return { licenses, issues };
    }

    try {
      const packages = fs.readdirSync(nodeModulesPath);

      for (const pkg of packages) {
        if (pkg.startsWith('.') || pkg.startsWith('@')) continue;

        const pkgJsonPath = path.join(nodeModulesPath, pkg, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            const license = pkgJson.license || 'Unknown';

            licenses.push({
              package: pkg,
              license,
              version: pkgJson.version
            });

            // Check against allowed licenses
            if (!this.options.allowedLicenses.includes(license) &&
              !this.options.ignoredPackages.includes(pkg)) {
              issues.push({
                package: pkg,
                license,
                reason: `License '${license}' is not in allowed list`
              });
            }
          } catch {
            // Skip packages with invalid package.json
          }
        }
      }

      // Handle scoped packages
      const scopedDirs = packages.filter(p => p.startsWith('@'));
      for (const scopedDir of scopedDirs) {
        const scopedPath = path.join(nodeModulesPath, scopedDir);
        if (fs.statSync(scopedPath).isDirectory()) {
          const scopedPackages = fs.readdirSync(scopedPath);
          for (const pkg of scopedPackages) {
            const pkgJsonPath = path.join(scopedPath, pkg, 'package.json');
            if (fs.existsSync(pkgJsonPath)) {
              try {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                const license = pkgJson.license || 'Unknown';
                const fullName = `${scopedDir}/${pkg}`;

                licenses.push({
                  package: fullName,
                  license,
                  version: pkgJson.version
                });

                if (!this.options.allowedLicenses.includes(license) &&
                  !this.options.ignoredPackages.includes(fullName)) {
                  issues.push({
                    package: fullName,
                    license,
                    reason: `License '${license}' is not in allowed list`
                  });
                }
              } catch {
                // Skip
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn(`Could not read node_modules: ${error.message}`);
    }

    return { licenses, issues };
  }

  /**
   * Check for unused dependencies
   */
  async checkUnused(targetPath) {
    const packageJson = await this.readPackageJson(targetPath);
    if (!packageJson) return [];

    const allDeps = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    });

    const usedDeps = new Set();
    const srcFiles = this.getSourceFiles(targetPath);

    // Scan source files for imports
    for (const file of srcFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');

        // Match import statements
        const importPatterns = [
          /import\s+.*\s+from\s+['"]([^'"./][^'"]*)['"]/g,
          /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g
        ];

        for (const pattern of importPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            // Extract package name (handle scoped packages)
            let pkgName = match[1];
            if (pkgName.startsWith('@')) {
              const parts = pkgName.split('/');
              pkgName = `${parts[0]}/${parts[1]}`;
            } else {
              pkgName = pkgName.split('/')[0];
            }
            usedDeps.add(pkgName);
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Find unused
    const unused = allDeps.filter(dep => {
      // Skip type definitions
      if (dep.startsWith('@types/')) return false;
      // Skip known dev tools that aren't imported
      const devTools = ['eslint', 'prettier', 'jest', 'typescript', 'nodemon', 'ts-node'];
      if (devTools.some(t => dep.includes(t))) return false;

      return !usedDeps.has(dep);
    });

    return unused;
  }

  /**
   * Check for circular dependencies
   */
  async checkCircular(targetPath) {
    // This is a simplified check - in production, use madge or similar
    const circular = [];
    const srcFiles = this.getSourceFiles(targetPath);
    const graph = new Map();

    // Build dependency graph
    for (const file of srcFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const imports = [];

        const importPattern = /import\s+.*\s+from\s+['"](\.[^'"]+)['"]/g;
        let match;
        while ((match = importPattern.exec(content)) !== null) {
          const importPath = path.resolve(path.dirname(file), match[1]);
          imports.push(importPath);
        }

        graph.set(file, imports);
      } catch {
        // Skip
      }
    }

    // Find cycles (simple DFS)
    const visited = new Set();
    const stack = new Set();

    const dfs = (node, path = []) => {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        circular.push(path.slice(cycleStart).map(p =>
          p.replace(targetPath, '').replace(/^\//, '')
        ));
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      const deps = graph.get(node) || [];
      for (const dep of deps) {
        // Resolve extensions
        const resolved = [dep, `${dep}.js`, `${dep}.ts`, `${dep}/index.js`, `${dep}/index.ts`]
          .find(p => graph.has(p));
        if (resolved) {
          dfs(resolved, [...path, node]);
        }
      }

      stack.delete(node);
    };

    for (const file of graph.keys()) {
      dfs(file);
    }

    return circular.slice(0, 10); // Limit results
  }

  /**
   * Update dependencies
   */
  async updateDependencies(options = {}) {
    const targetPath = options.path || process.cwd();
    const packages = options.packages || [];
    const updateType = options.type || 'patch'; // patch, minor, major, latest

    logger.info(`Updating dependencies in ${targetPath}`);

    const results = [];

    if (packages.length === 0) {
      // Update all
      const result = await this.runUpdate(targetPath, updateType);
      results.push(result);
    } else {
      // Update specific packages
      for (const pkg of packages) {
        const result = await this.runUpdate(targetPath, updateType, pkg);
        results.push(result);
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run npm update
   */
  async runUpdate(targetPath, type, pkg = null) {
    return new Promise((resolve) => {
      let args = ['update'];
      if (pkg) args.push(pkg);
      if (type === 'latest') args = ['install', pkg ? `${pkg}@latest` : ''];

      const proc = spawn('npm', args.filter(Boolean), {
        cwd: targetPath,
        shell: true,
        timeout: 120000
      });

      let output = '';
      let error = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          package: pkg || 'all',
          output: output.trim(),
          error: error.trim()
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          package: pkg || 'all',
          error: err.message
        });
      });
    });
  }

  /**
   * Get dependency tree
   */
  async getDependencyTree(targetPath, depth = 2) {
    return new Promise((resolve) => {
      const proc = spawn('npm', ['ls', '--json', `--depth=${depth}`], {
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
          const tree = JSON.parse(output || '{}');
          resolve(tree);
        } catch {
          resolve({});
        }
      });

      proc.on('error', () => resolve({}));
    });
  }

  /**
   * Get duplicate dependencies
   */
  async getDuplicates(targetPath) {
    return new Promise((resolve) => {
      const proc = spawn('npm', ['ls', '--json', '--all'], {
        cwd: targetPath,
        shell: true,
        timeout: 120000
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        try {
          const tree = JSON.parse(output || '{}');
          const versions = new Map();

          const traverse = (deps) => {
            if (!deps) return;
            for (const [name, info] of Object.entries(deps)) {
              if (!versions.has(name)) {
                versions.set(name, new Set());
              }
              versions.get(name).add(info.version);
              traverse(info.dependencies);
            }
          };

          traverse(tree.dependencies);

          // Find duplicates
          const duplicates = [];
          for (const [name, versionSet] of versions) {
            if (versionSet.size > 1) {
              duplicates.push({
                name,
                versions: Array.from(versionSet)
              });
            }
          }

          resolve(duplicates);
        } catch {
          resolve([]);
        }
      });

      proc.on('error', () => resolve([]));
    });
  }

  // ==================== Utilities ====================

  async detectPackageManager(targetPath) {
    if (fs.existsSync(path.join(targetPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(targetPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(targetPath, 'bun.lockb'))) return 'bun';
    return 'npm';
  }

  async readPackageJson(targetPath) {
    const packageJsonPath = path.join(targetPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return null;

    try {
      return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  getSourceFiles(targetPath, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
    const files = [];
    const exclude = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    const scan = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (exclude.some(e => fullPath.includes(e))) continue;

          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (extensions.includes(path.extname(entry.name))) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    scan(targetPath);
    return files;
  }

  getOutdatedSeverity(pkg) {
    // Major version difference = high
    const currentMajor = parseInt(pkg.current?.split('.')[0] || '0');
    const latestMajor = parseInt(pkg.latest?.split('.')[0] || '0');

    if (latestMajor - currentMajor >= 2) return 'high';
    if (latestMajor - currentMajor === 1) return 'medium';
    return 'low';
  }

  generateRecommendations(result) {
    const recommendations = [];

    // Security recommendations
    const criticalVulns = result.security?.vulnerabilities?.filter(v => v.severity === 'critical') || [];
    if (criticalVulns.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'fix-security',
        message: `Fix ${criticalVulns.length} critical security vulnerabilities immediately`,
        command: 'npm audit fix --force'
      });
    }

    // Outdated recommendations
    const majorOutdated = result.outdated?.filter(p =>
      parseInt(p.current?.split('.')[0]) < parseInt(p.latest?.split('.')[0])
    ) || [];
    if (majorOutdated.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'update-major',
        message: `${majorOutdated.length} packages have major updates available`,
        packages: majorOutdated.map(p => p.name)
      });
    }

    // Unused dependencies
    if (result.unused?.length > 0) {
      recommendations.push({
        priority: 'low',
        action: 'remove-unused',
        message: `Remove ${result.unused.length} unused dependencies`,
        packages: result.unused,
        command: `npm uninstall ${result.unused.join(' ')}`
      });
    }

    // License issues
    if (result.licenses?.issues?.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'review-licenses',
        message: `Review ${result.licenses.issues.length} packages with non-standard licenses`,
        packages: result.licenses.issues.map(l => l.package)
      });
    }

    return recommendations;
  }

  calculateHealthScore(result) {
    let score = 100;

    // Deduct for security issues
    const vulns = result.security?.vulnerabilities || [];
    score -= vulns.filter(v => v.severity === 'critical').length * 20;
    score -= vulns.filter(v => v.severity === 'high').length * 10;
    score -= vulns.filter(v => v.severity === 'medium').length * 5;

    // Deduct for outdated packages
    const outdated = result.outdated || [];
    score -= Math.min(outdated.length * 2, 20);

    // Deduct for license issues
    score -= Math.min((result.licenses?.issues?.length || 0) * 3, 15);

    // Deduct for unused deps
    score -= Math.min((result.unused?.length || 0), 10);

    return Math.max(0, Math.min(100, score));
  }

  getStatus() {
    return {
      initialized: this.initialized,
      options: {
        checkOutdated: this.options.checkOutdated,
        checkSecurity: this.options.checkSecurity,
        checkLicense: this.options.checkLicense,
        checkUnused: this.options.checkUnused
      }
    };
  }
}

let instance = null;

export function getDependencyAnalyzer(options) {
  if (!instance) {
    instance = new DependencyAnalyzer(options);
  }
  return instance;
}

export default DependencyAnalyzer;
