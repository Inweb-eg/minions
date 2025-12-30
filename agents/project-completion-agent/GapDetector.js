/**
 * GapDetector
 * -----------
 * Analyzes projects to find missing features, endpoints, pages, tests, and documentation.
 * Enhanced with code-level analysis and test coverage detection.
 *
 * Part of Lucy (ProjectCompletionAgent)
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../foundation/common/logger.js';

// Gap types
export const GapType = {
  BACKEND_ENDPOINT: 'backend:endpoint',
  BACKEND_MODEL: 'backend:model',
  BACKEND_SERVICE: 'backend:service',
  FRONTEND_PAGE: 'frontend:page',
  FRONTEND_COMPONENT: 'frontend:component',
  TEST_UNIT: 'test:unit',
  TEST_INTEGRATION: 'test:integration',
  DOCUMENTATION: 'documentation',
  CONFIGURATION: 'configuration'
};

// Gap priority levels
export const Priority = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4
};

export class GapDetector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.gaps = [];
    this.gapId = 0;
    this.logger = createLogger('GapDetector');

    // Analysis patterns
    this.patterns = {
      // Common patterns that indicate missing error handling
      missingErrorHandling: /catch\s*\(\s*\w*\s*\)\s*{\s*}/g,
      // TODO/FIXME comments
      todoComments: /(TODO|FIXME|XXX|HACK|BUG):/gi,
      // Console.log statements (shouldn't be in production)
      consoleLogs: /console\.(log|debug|info)\(/g,
      // Hard-coded credentials or secrets
      hardcodedSecrets: /(password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]+['"]/gi,
      // Missing return types (TypeScript)
      missingReturnType: /function\s+\w+\([^)]*\)\s*{/g,
      // Empty catch blocks
      emptyCatch: /catch\s*\([^)]*\)\s*{\s*}/g
    };
  }

  /**
   * Full gap detection for a project
   * @param {object} project - Project to analyze
   * @param {object} options - Detection options
   */
  async detect(project, options = {}) {
    try {
      this.gaps = [];
      const sourcePath = project.sourcePath || project.path || process.cwd();

      this.logger.info(`Starting gap detection for: ${project.name || sourcePath}`);

      // Detect different types of gaps
      const backendGaps = await this.detectBackendGaps(sourcePath, project);
      const frontendGaps = await this.detectFrontendGaps(sourcePath, project);
      const testGaps = await this.detectTestGaps(sourcePath, project);
      const docGaps = await this.detectDocumentationGaps(sourcePath, project);

      // Enhanced analysis (can be disabled for speed)
      let codeQualityGaps = [];
      let testCoverageGaps = [];
      let securityGaps = [];

      if (options.deepAnalysis !== false) {
        codeQualityGaps = await this.detectCodeQualityGaps(sourcePath, project);
        testCoverageGaps = await this.detectTestCoverageGaps(sourcePath, project);
        securityGaps = await this.detectSecurityGaps(sourcePath, project);
      }

      this.gaps = [
        ...backendGaps,
        ...frontendGaps,
        ...testGaps,
        ...docGaps,
        ...codeQualityGaps,
        ...testCoverageGaps,
        ...securityGaps
      ];

      this.logger.info(`Gap detection complete: ${this.gaps.length} gaps found`);

      return this.gaps;
    } catch (error) {
      this.emit('error', { method: 'detect', error: error.message });
      throw error;
    }
  }

  /**
   * Detect missing backend endpoints and models
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectBackendGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Check for routes directory
      const routesPath = path.join(sourcePath, 'src', 'routes');
      try {
        const routes = await fs.readdir(routesPath);

        // Check for common missing endpoints
        const expectedRoutes = ['users', 'auth', 'health'];
        for (const expected of expectedRoutes) {
          const exists = routes.some(r => r.toLowerCase().includes(expected));
          if (!exists) {
            gaps.push(this._createGap({
              type: GapType.BACKEND_ENDPOINT,
              description: `Missing ${expected} routes`,
              location: routesPath,
              priority: expected === 'auth' ? Priority.CRITICAL : Priority.HIGH
            }));
          }
        }
      } catch (e) {
        // No routes directory
      }

      // Check for models directory
      const modelsPath = path.join(sourcePath, 'src', 'models');
      try {
        await fs.access(modelsPath);
      } catch (e) {
        gaps.push(this._createGap({
          type: GapType.BACKEND_MODEL,
          description: 'No models directory found',
          location: path.join(sourcePath, 'src'),
          priority: Priority.MEDIUM
        }));
      }

      // Check for services directory
      const servicesPath = path.join(sourcePath, 'src', 'services');
      try {
        await fs.access(servicesPath);
      } catch (e) {
        gaps.push(this._createGap({
          type: GapType.BACKEND_SERVICE,
          description: 'No services directory found',
          location: path.join(sourcePath, 'src'),
          priority: Priority.MEDIUM
        }));
      }

    } catch (error) {
      // Continue with other checks
    }

    return gaps;
  }

  /**
   * Detect missing frontend pages and components
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectFrontendGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Check for pages directory (Next.js pattern)
      const pagesPath = path.join(sourcePath, 'pages');
      const appPath = path.join(sourcePath, 'app');
      const srcPagesPath = path.join(sourcePath, 'src', 'pages');

      let hasPages = false;
      for (const p of [pagesPath, appPath, srcPagesPath]) {
        try {
          await fs.access(p);
          hasPages = true;
          break;
        } catch (e) {
          // Continue checking
        }
      }

      if (!hasPages && project.framework?.includes('Next.js')) {
        gaps.push(this._createGap({
          type: GapType.FRONTEND_PAGE,
          description: 'No pages directory found',
          location: sourcePath,
          priority: Priority.HIGH
        }));
      }

      // Check for components directory
      const componentsPath = path.join(sourcePath, 'src', 'components');
      const componentsPath2 = path.join(sourcePath, 'components');

      let hasComponents = false;
      for (const p of [componentsPath, componentsPath2]) {
        try {
          await fs.access(p);
          hasComponents = true;
          break;
        } catch (e) {
          // Continue checking
        }
      }

      if (!hasComponents) {
        gaps.push(this._createGap({
          type: GapType.FRONTEND_COMPONENT,
          description: 'No components directory found',
          location: sourcePath,
          priority: Priority.MEDIUM
        }));
      }

    } catch (error) {
      // Continue with other checks
    }

    return gaps;
  }

  /**
   * Detect missing tests
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectTestGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Check for test directories
      const testPaths = [
        path.join(sourcePath, 'tests'),
        path.join(sourcePath, 'test'),
        path.join(sourcePath, '__tests__'),
        path.join(sourcePath, 'src', '__tests__')
      ];

      let hasTests = false;
      for (const p of testPaths) {
        try {
          await fs.access(p);
          hasTests = true;
          break;
        } catch (e) {
          // Continue checking
        }
      }

      if (!hasTests) {
        gaps.push(this._createGap({
          type: GapType.TEST_UNIT,
          description: 'No tests directory found',
          location: sourcePath,
          priority: Priority.HIGH
        }));
      }

      // Check for test configuration
      const jestConfigPaths = ['jest.config.js', 'jest.config.ts', 'jest.config.json'];
      let hasTestConfig = false;

      for (const configFile of jestConfigPaths) {
        try {
          await fs.access(path.join(sourcePath, configFile));
          hasTestConfig = true;
          break;
        } catch (e) {
          // Continue checking
        }
      }

      if (!hasTestConfig && hasTests) {
        gaps.push(this._createGap({
          type: GapType.CONFIGURATION,
          description: 'No Jest configuration found',
          location: sourcePath,
          priority: Priority.LOW
        }));
      }

    } catch (error) {
      // Continue with other checks
    }

    return gaps;
  }

  /**
   * Detect missing documentation
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectDocumentationGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Check for README
      try {
        await fs.access(path.join(sourcePath, 'README.md'));
      } catch (e) {
        gaps.push(this._createGap({
          type: GapType.DOCUMENTATION,
          description: 'No README.md found',
          location: sourcePath,
          priority: Priority.MEDIUM
        }));
      }

      // Check for docs directory
      try {
        await fs.access(path.join(sourcePath, 'docs'));
      } catch (e) {
        gaps.push(this._createGap({
          type: GapType.DOCUMENTATION,
          description: 'No docs directory found',
          location: sourcePath,
          priority: Priority.LOW
        }));
      }

    } catch (error) {
      // Continue with other checks
    }

    return gaps;
  }

  /**
   * Detect code quality gaps
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectCodeQualityGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Find all JS/TS files
      const files = await this._findSourceFiles(sourcePath);
      this.logger.info(`Analyzing ${files.length} source files for code quality...`);

      for (const file of files.slice(0, 50)) { // Limit to first 50 files
        try {
          const content = await fs.readFile(file, 'utf-8');
          const relativePath = path.relative(sourcePath, file);

          // Check for TODO/FIXME comments
          const todos = content.match(this.patterns.todoComments) || [];
          if (todos.length > 3) {
            gaps.push(this._createGap({
              type: GapType.CONFIGURATION,
              description: `${todos.length} TODO/FIXME comments in ${relativePath}`,
              location: file,
              priority: Priority.LOW,
              details: { count: todos.length, type: 'todos' }
            }));
          }

          // Check for empty catch blocks
          const emptyCatches = content.match(this.patterns.emptyCatch) || [];
          if (emptyCatches.length > 0) {
            gaps.push(this._createGap({
              type: GapType.BACKEND_SERVICE,
              description: `Empty catch block(s) in ${relativePath}`,
              location: file,
              priority: Priority.HIGH,
              details: { count: emptyCatches.length, type: 'empty_catch' }
            }));
          }

          // Check for hardcoded secrets
          const secrets = content.match(this.patterns.hardcodedSecrets) || [];
          if (secrets.length > 0) {
            gaps.push(this._createGap({
              type: GapType.CONFIGURATION,
              description: `Potential hardcoded secret in ${relativePath}`,
              location: file,
              priority: Priority.CRITICAL,
              details: { count: secrets.length, type: 'hardcoded_secret' }
            }));
          }

        } catch (error) {
          // Skip files that can't be read
        }
      }

    } catch (error) {
      this.logger.warn(`Code quality analysis error: ${error.message}`);
    }

    return gaps;
  }

  /**
   * Detect test coverage gaps
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectTestCoverageGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Find source files and test files
      const sourceFiles = await this._findSourceFiles(sourcePath);
      const testFiles = await this._findTestFiles(sourcePath);

      // Build map of tested files
      const testedFiles = new Set();
      for (const testFile of testFiles) {
        const testContent = await fs.readFile(testFile, 'utf-8').catch(() => '');

        // Extract imported files from test
        const imports = testContent.match(/from\s+['"]([^'"]+)['"]/g) || [];
        imports.forEach(imp => {
          const match = imp.match(/from\s+['"]([^'"]+)['"]/);
          if (match) {
            testedFiles.add(match[1]);
          }
        });
      }

      // Check for major files without tests
      const majorFiles = sourceFiles.filter(f => {
        const relativePath = path.relative(sourcePath, f);
        // Focus on main source files
        return (relativePath.includes('/src/') || relativePath.startsWith('src/')) &&
               !relativePath.includes('__tests__') &&
               !relativePath.includes('.test.') &&
               !relativePath.includes('.spec.');
      });

      const untestedFiles = majorFiles.filter(f => {
        const basename = path.basename(f, path.extname(f));
        return !testFiles.some(tf => tf.includes(basename));
      });

      // Report gaps for important untested files
      const importantPatterns = ['controller', 'service', 'model', 'util', 'helper', 'api'];

      for (const file of untestedFiles.slice(0, 20)) { // Limit reports
        const basename = path.basename(file).toLowerCase();
        const isImportant = importantPatterns.some(p => basename.includes(p));

        if (isImportant) {
          gaps.push(this._createGap({
            type: GapType.TEST_UNIT,
            description: `No test file for ${path.relative(sourcePath, file)}`,
            location: file,
            priority: Priority.HIGH,
            details: { suggestedTestFile: file.replace(/\.(js|ts)$/, '.test.$1') }
          }));
        }
      }

      // Check test coverage percentage
      const coverageRatio = testFiles.length / Math.max(majorFiles.length, 1);
      if (coverageRatio < 0.3 && majorFiles.length > 5) {
        gaps.push(this._createGap({
          type: GapType.TEST_UNIT,
          description: `Low test coverage: ${Math.round(coverageRatio * 100)}% of files have tests`,
          location: sourcePath,
          priority: Priority.HIGH,
          details: {
            testedFiles: testFiles.length,
            totalFiles: majorFiles.length,
            coveragePercent: Math.round(coverageRatio * 100)
          }
        }));
      }

    } catch (error) {
      this.logger.warn(`Test coverage analysis error: ${error.message}`);
    }

    return gaps;
  }

  /**
   * Detect security gaps
   * @param {string} sourcePath - Path to project source
   * @param {object} project - Project info
   */
  async detectSecurityGaps(sourcePath, project) {
    const gaps = [];

    try {
      // Check for .env.example (should exist if using env vars)
      const envPath = path.join(sourcePath, '.env');
      const envExamplePath = path.join(sourcePath, '.env.example');

      let hasEnv = false;
      let hasEnvExample = false;

      try {
        await fs.access(envPath);
        hasEnv = true;
      } catch (e) {}

      try {
        await fs.access(envExamplePath);
        hasEnvExample = true;
      } catch (e) {}

      if (hasEnv && !hasEnvExample) {
        gaps.push(this._createGap({
          type: GapType.CONFIGURATION,
          description: '.env exists but .env.example missing (for team setup)',
          location: sourcePath,
          priority: Priority.MEDIUM,
          details: { type: 'env_example' }
        }));
      }

      // Check .gitignore
      try {
        const gitignorePath = path.join(sourcePath, '.gitignore');
        const gitignore = await fs.readFile(gitignorePath, 'utf-8');

        const shouldIgnore = ['.env', 'node_modules', '*.log', '.DS_Store'];
        const missing = shouldIgnore.filter(item => !gitignore.includes(item));

        if (missing.length > 0) {
          gaps.push(this._createGap({
            type: GapType.CONFIGURATION,
            description: `.gitignore missing entries: ${missing.join(', ')}`,
            location: gitignorePath,
            priority: Priority.HIGH,
            details: { missing }
          }));
        }
      } catch (e) {
        gaps.push(this._createGap({
          type: GapType.CONFIGURATION,
          description: 'No .gitignore file found',
          location: sourcePath,
          priority: Priority.HIGH,
          details: { type: 'gitignore' }
        }));
      }

      // Check package.json for security scripts
      try {
        const pkgPath = path.join(sourcePath, 'package.json');
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

        if (!pkg.scripts?.['audit'] && !pkg.scripts?.['security']) {
          gaps.push(this._createGap({
            type: GapType.CONFIGURATION,
            description: 'No security/audit script in package.json',
            location: pkgPath,
            priority: Priority.LOW,
            details: { type: 'security_script' }
          }));
        }
      } catch (e) {}

    } catch (error) {
      this.logger.warn(`Security analysis error: ${error.message}`);
    }

    return gaps;
  }

  /**
   * Find source files recursively
   * @private
   */
  async _findSourceFiles(dir, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules, .git, etc
        if (entry.name.startsWith('.') || entry.name === 'node_modules' ||
            entry.name === 'dist' || entry.name === 'build' || entry.name === 'coverage') {
          continue;
        }

        if (entry.isDirectory()) {
          await this._findSourceFiles(fullPath, files);
        } else if (/\.(js|ts|jsx|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files;
  }

  /**
   * Find test files recursively
   * @private
   */
  async _findTestFiles(dir, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules, .git, etc
        if (entry.name.startsWith('.') || entry.name === 'node_modules' ||
            entry.name === 'dist' || entry.name === 'build') {
          continue;
        }

        if (entry.isDirectory()) {
          // Specifically look in test directories
          if (entry.name === '__tests__' || entry.name === 'tests' || entry.name === 'test') {
            await this._findSourceFiles(fullPath, files);
          } else {
            await this._findTestFiles(fullPath, files);
          }
        } else if (/\.(test|spec)\.(js|ts|jsx|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files;
  }

  /**
   * Prioritize gaps by importance
   * @param {array} gaps - List of gaps
   */
  async prioritize(gaps) {
    // Sort by priority (lower number = higher priority)
    // Then by type (security issues first)
    return [...gaps].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Secondary sort: security/config issues first
      const typeOrder = {
        [GapType.CONFIGURATION]: 0,
        [GapType.BACKEND_ENDPOINT]: 1,
        [GapType.TEST_UNIT]: 2,
        [GapType.TEST_INTEGRATION]: 3,
        [GapType.FRONTEND_PAGE]: 4,
        [GapType.FRONTEND_COMPONENT]: 5,
        [GapType.DOCUMENTATION]: 6
      };
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
  }

  /**
   * Save gaps to a file
   * @param {string} outputPath - Path to save gaps
   */
  async save(outputPath) {
    try {
      await fs.writeFile(outputPath, JSON.stringify(this.gaps, null, 2));
      return { success: true, path: outputPath };
    } catch (error) {
      this.emit('error', { method: 'save', error: error.message });
      throw error;
    }
  }

  /**
   * Create a gap object
   * @private
   */
  _createGap({ type, description, location, priority, details = {} }) {
    return {
      id: `gap-${++this.gapId}`,
      type,
      description,
      location,
      priority,
      status: 'pending',
      detectedAt: new Date().toISOString(),
      details
    };
  }

  async shutdown() {
    this.gaps = [];
    this.removeAllListeners();
  }
}

export default GapDetector;
