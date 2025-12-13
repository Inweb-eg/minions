/**
 * Dependency Mapper - Cross-Platform Dependency Analysis
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Maps dependencies across all 4 codebases and detects issues
 *
 * Plan Reference: Phase 6.5.1 - Cross-Platform Analyzers
 * - Dependency graph generation
 * - Cross-platform dependency validation
 * - Circular dependency detection
 * - Unused dependency identification
 * - Version mismatch detection
 */

import { BaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from './base-analyzer.js';
import * as path from 'path';

/**
 * DependencyMapper
 * Analyzes and maps dependencies across all codebases
 */
export class DependencyMapper extends BaseAnalyzer {
  constructor() {
    super('DependencyMapper');
    this.dependencyGraph = {
      [CODEBASE.BACKEND]: {},
      [CODEBASE.USERS_APP]: {},
      [CODEBASE.DRIVERS_APP]: {},
      [CODEBASE.ADMIN_DASHBOARD]: {}
    };
  }

  /**
   * Analyze dependencies across all codebases
   * @param {Object} codebasePaths - Paths to all codebases
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyze(codebasePaths, options = {}) {
    this.logger.info('Starting cross-platform dependency analysis');
    this.clearIssues();

    // Extract dependencies from each codebase
    await this.extractBackendDependencies(codebasePaths.backend);
    await this.extractFlutterDependencies(codebasePaths.usersApp, CODEBASE.USERS_APP);
    await this.extractFlutterDependencies(codebasePaths.driversApp, CODEBASE.DRIVERS_APP);
    await this.extractReactDependencies(codebasePaths.adminDashboard);

    // Analyze for issues
    this.detectVersionMismatches();
    this.detectUnusedDependencies(codebasePaths);
    this.detectOutdatedDependencies();
    this.detectCircularDependencies();
    this.detectDuplicateDependencies();

    // Generate metrics
    this.generateMetrics();

    this.logger.info(`Dependency analysis complete: ${this.issues.length} issues found`);
    return this.formatResults({
      dependencyGraph: this.dependencyGraph
    });
  }

  /**
   * Extract dependencies from Backend (package.json)
   * @param {string} backendPath - Path to backend codebase
   */
  async extractBackendDependencies(backendPath) {
    this.logger.debug('Extracting backend dependencies');

    const packageJsonPath = path.join(backendPath, 'package.json');
    const content = this.readFile(packageJsonPath);

    if (!content) {
      this.addIssue(this.createIssue({
        type: 'missing_package_json',
        severity: SEVERITY.HIGH,
        message: 'Backend package.json not found',
        codebase: CODEBASE.BACKEND,
        file: 'package.json',
        code: null,
        suggestion: 'Ensure package.json exists in backend directory'
      }));
      return;
    }

    try {
      const packageJson = JSON.parse(content);

      this.dependencyGraph[CODEBASE.BACKEND] = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        engines: packageJson.engines || {}
      };

      this.addMetric('backend_dependencies', Object.keys(packageJson.dependencies || {}).length);
      this.addMetric('backend_devDependencies', Object.keys(packageJson.devDependencies || {}).length);

    } catch (error) {
      this.addIssue(this.createIssue({
        type: 'invalid_package_json',
        severity: SEVERITY.HIGH,
        message: `Failed to parse backend package.json: ${error.message}`,
        codebase: CODEBASE.BACKEND,
        file: 'package.json',
        code: null,
        suggestion: 'Fix JSON syntax errors in package.json'
      }));
    }
  }

  /**
   * Extract dependencies from Flutter app (pubspec.yaml)
   * @param {string} appPath - Path to Flutter app
   * @param {string} codebase - Codebase identifier
   */
  async extractFlutterDependencies(appPath, codebase) {
    this.logger.debug(`Extracting Flutter dependencies for ${codebase}`);

    const pubspecPath = path.join(appPath, 'pubspec.yaml');
    const content = this.readFile(pubspecPath);

    if (!content) {
      this.addIssue(this.createIssue({
        type: 'missing_pubspec',
        severity: SEVERITY.HIGH,
        message: `${codebase} pubspec.yaml not found`,
        codebase,
        file: 'pubspec.yaml',
        code: null,
        suggestion: 'Ensure pubspec.yaml exists in Flutter app directory'
      }));
      return;
    }

    try {
      // Simple YAML parsing for dependencies
      const dependencies = this.parseYAMLDependencies(content, 'dependencies:');
      const devDependencies = this.parseYAMLDependencies(content, 'dev_dependencies:');

      this.dependencyGraph[codebase] = {
        dependencies,
        devDependencies
      };

      this.addMetric(`${codebase}_dependencies`, Object.keys(dependencies).length);
      this.addMetric(`${codebase}_devDependencies`, Object.keys(devDependencies).length);

    } catch (error) {
      this.addIssue(this.createIssue({
        type: 'invalid_pubspec',
        severity: SEVERITY.HIGH,
        message: `Failed to parse ${codebase} pubspec.yaml: ${error.message}`,
        codebase,
        file: 'pubspec.yaml',
        code: null,
        suggestion: 'Fix YAML syntax errors in pubspec.yaml'
      }));
    }
  }

  /**
   * Extract dependencies from React app (package.json)
   * @param {string} adminPath - Path to admin dashboard
   */
  async extractReactDependencies(adminPath) {
    this.logger.debug('Extracting React dependencies');

    const packageJsonPath = path.join(adminPath, 'package.json');
    const content = this.readFile(packageJsonPath);

    if (!content) {
      this.addIssue(this.createIssue({
        type: 'missing_package_json',
        severity: SEVERITY.HIGH,
        message: 'Admin dashboard package.json not found',
        codebase: CODEBASE.ADMIN_DASHBOARD,
        file: 'package.json',
        code: null,
        suggestion: 'Ensure package.json exists in admin dashboard directory'
      }));
      return;
    }

    try {
      const packageJson = JSON.parse(content);

      this.dependencyGraph[CODEBASE.ADMIN_DASHBOARD] = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {}
      };

      this.addMetric('admin_dependencies', Object.keys(packageJson.dependencies || {}).length);
      this.addMetric('admin_devDependencies', Object.keys(packageJson.devDependencies || {}).length);

    } catch (error) {
      this.addIssue(this.createIssue({
        type: 'invalid_package_json',
        severity: SEVERITY.HIGH,
        message: `Failed to parse admin package.json: ${error.message}`,
        codebase: CODEBASE.ADMIN_DASHBOARD,
        file: 'package.json',
        code: null,
        suggestion: 'Fix JSON syntax errors in package.json'
      }));
    }
  }

  /**
   * Parse YAML dependencies section
   * @param {string} content - YAML content
   * @param {string} section - Section name
   * @returns {Object} Dependencies object
   */
  parseYAMLDependencies(content, section) {
    const dependencies = {};
    const lines = content.split('\n');

    let inSection = false;
    let sectionIndent = 0;

    for (const line of lines) {
      // Check if we're entering the dependencies section
      if (line.trim().startsWith(section)) {
        inSection = true;
        sectionIndent = line.search(/\S/);
        continue;
      }

      if (inSection) {
        const currentIndent = line.search(/\S/);

        // End of section if indent is same or less
        if (currentIndent >= 0 && currentIndent <= sectionIndent) {
          break;
        }

        // Parse dependency line
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^:]+):\s*(.+)$/);
          if (match) {
            const [, name, version] = match;
            dependencies[name.trim()] = version.trim();
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Detect version mismatches across codebases
   */
  detectVersionMismatches() {
    this.logger.debug('Detecting version mismatches');

    // Common packages that should have matching versions
    const commonPackages = new Set();

    // Collect all package names from JS codebases
    [CODEBASE.BACKEND, CODEBASE.ADMIN_DASHBOARD].forEach(codebase => {
      const deps = this.dependencyGraph[codebase];
      if (deps && deps.dependencies) {
        Object.keys(deps.dependencies).forEach(pkg => commonPackages.add(pkg));
      }
    });

    // Check for version mismatches
    commonPackages.forEach(packageName => {
      const versions = {};

      [CODEBASE.BACKEND, CODEBASE.ADMIN_DASHBOARD].forEach(codebase => {
        const deps = this.dependencyGraph[codebase];
        if (deps && deps.dependencies && deps.dependencies[packageName]) {
          versions[codebase] = deps.dependencies[packageName];
        }
      });

      // If package exists in multiple codebases with different versions
      const uniqueVersions = [...new Set(Object.values(versions))];
      if (Object.keys(versions).length > 1 && uniqueVersions.length > 1) {
        const versionList = Object.entries(versions)
          .map(([cb, ver]) => `${cb}: ${ver}`)
          .join(', ');

        this.addIssue(this.createIssue({
          type: 'version_mismatch',
          severity: SEVERITY.MEDIUM,
          message: `Package "${packageName}" has different versions across codebases`,
          codebase: 'cross-platform',
          file: 'package.json',
          code: versionList,
          suggestion: `Align versions: ${versionList}`,
          impact: 'May cause compatibility issues'
        }));
      }
    });
  }

  /**
   * Detect unused dependencies
   * @param {Object} codebasePaths - Paths to codebases
   */
  detectUnusedDependencies(codebasePaths) {
    this.logger.debug('Detecting unused dependencies');

    // Check backend
    this.checkUnusedInCodebase(
      codebasePaths.backend,
      CODEBASE.BACKEND,
      this.dependencyGraph[CODEBASE.BACKEND].dependencies || {},
      /\.js$/
    );

    // Check admin dashboard
    this.checkUnusedInCodebase(
      codebasePaths.adminDashboard,
      CODEBASE.ADMIN_DASHBOARD,
      this.dependencyGraph[CODEBASE.ADMIN_DASHBOARD].dependencies || {},
      /\.(js|jsx|ts|tsx)$/
    );
  }

  /**
   * Check for unused dependencies in a codebase
   * @param {string} codebasePath - Path to codebase
   * @param {string} codebase - Codebase identifier
   * @param {Object} dependencies - Dependencies to check
   * @param {RegExp} filePattern - File pattern to search
   */
  checkUnusedInCodebase(codebasePath, codebase, dependencies, filePattern) {
    const files = this.findFiles(codebasePath, filePattern);
    const usedDependencies = new Set();

    // Read all files and check for imports
    files.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      // Check for each dependency
      Object.keys(dependencies).forEach(dep => {
        // Check for require() or import statements
        if (content.includes(`require('${dep}')`) ||
            content.includes(`require("${dep}")`) ||
            content.includes(`from '${dep}'`) ||
            content.includes(`from "${dep}"`)) {
          usedDependencies.add(dep);
        }
      });
    });

    // Report unused dependencies
    Object.keys(dependencies).forEach(dep => {
      if (!usedDependencies.has(dep)) {
        this.addIssue(this.createIssue({
          type: 'unused_dependency',
          severity: SEVERITY.LOW,
          message: `Dependency "${dep}" is declared but never imported`,
          codebase,
          file: 'package.json',
          code: dep,
          suggestion: `Remove unused dependency: npm uninstall ${dep}`,
          fixable: true
        }));
      }
    });
  }

  /**
   * Detect outdated dependencies
   */
  detectOutdatedDependencies() {
    this.logger.debug('Detecting outdated dependencies');

    // Known outdated packages (simplified - in production would check npm registry)
    const outdatedPatterns = [
      { name: 'request', reason: 'Deprecated, use axios or node-fetch' },
      { name: 'moment', reason: 'Large bundle size, use date-fns or dayjs' }
    ];

    Object.entries(this.dependencyGraph).forEach(([codebase, deps]) => {
      if (!deps.dependencies) return;

      Object.keys(deps.dependencies).forEach(dep => {
        const outdated = outdatedPatterns.find(p => p.name === dep);
        if (outdated) {
          this.addIssue(this.createIssue({
            type: 'outdated_dependency',
            severity: SEVERITY.MEDIUM,
            message: `Package "${dep}" is outdated or deprecated`,
            codebase,
            file: 'package.json',
            code: dep,
            suggestion: outdated.reason,
            impact: 'Security risks or performance issues'
          }));
        }
      });
    });
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies() {
    this.logger.debug('Detecting circular dependencies');

    // This would require deep analysis of import chains
    // Simplified implementation for now
    // In production, would build full import graph and detect cycles
  }

  /**
   * Detect duplicate dependencies
   */
  detectDuplicateDependencies() {
    this.logger.debug('Detecting duplicate dependencies');

    // Check for packages that exist in both dependencies and devDependencies
    Object.entries(this.dependencyGraph).forEach(([codebase, deps]) => {
      if (!deps.dependencies || !deps.devDependencies) return;

      const depsSet = new Set(Object.keys(deps.dependencies));
      const devDepsSet = new Set(Object.keys(deps.devDependencies));

      depsSet.forEach(dep => {
        if (devDepsSet.has(dep)) {
          this.addIssue(this.createIssue({
            type: 'duplicate_dependency',
            severity: SEVERITY.LOW,
            message: `Package "${dep}" exists in both dependencies and devDependencies`,
            codebase,
            file: 'package.json',
            code: dep,
            suggestion: 'Remove from devDependencies if used in production',
            fixable: true
          }));
        }
      });
    });
  }

  /**
   * Generate dependency metrics
   */
  generateMetrics() {
    let totalDeps = 0;
    let totalDevDeps = 0;

    Object.entries(this.dependencyGraph).forEach(([codebase, deps]) => {
      if (deps.dependencies) {
        totalDeps += Object.keys(deps.dependencies).length;
      }
      if (deps.devDependencies) {
        totalDevDeps += Object.keys(deps.devDependencies).length;
      }
    });

    this.addMetric('total_dependencies', totalDeps);
    this.addMetric('total_devDependencies', totalDevDeps);
    this.addMetric('total_packages', totalDeps + totalDevDeps);
  }

  /**
   * Get category for issue type
   * @param {string} type - Issue type
   * @returns {string} Category
   */
  getCategory(type) {
    return CATEGORY.DEPENDENCY;
  }
}

/**
 * Get singleton instance
 */
let mapperInstance = null;

export function getDependencyMapper() {
  if (!mapperInstance) {
    mapperInstance = new DependencyMapper();
  }
  return mapperInstance;
}
