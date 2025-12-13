/**
 * API Contract Validator - Cross-Platform API Consistency
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Validates API contracts between backend and all frontend applications
 *
 * Plan Reference: Phase 6.5.1 - Cross-Platform Analyzers
 * - Backend API endpoint extraction
 * - Frontend API call extraction
 * - Contract mismatch detection
 * - Missing endpoint detection
 * - Response schema validation
 */

import { BaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from './base-analyzer.js';
import * as path from 'path';

/**
 * APIContractValidator
 * Validates API contracts across all codebases
 */
export class APIContractValidator extends BaseAnalyzer {
  constructor() {
    super('APIContractValidator');
    this.backendEndpoints = new Map();
    this.frontendCalls = {
      [CODEBASE.USERS_APP]: new Map(),
      [CODEBASE.DRIVERS_APP]: new Map(),
      [CODEBASE.ADMIN_DASHBOARD]: new Map()
    };
  }

  /**
   * Analyze API contracts across all codebases
   * @param {Object} codebasePaths - Paths to all codebases
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyze(codebasePaths, options = {}) {
    this.logger.info('Starting API contract validation');
    this.clearIssues();

    // Extract API endpoints from backend
    await this.extractBackendEndpoints(codebasePaths.backend);

    // Extract API calls from frontends
    await this.extractFlutterAPICalls(codebasePaths.usersApp, CODEBASE.USERS_APP);
    await this.extractFlutterAPICalls(codebasePaths.driversApp, CODEBASE.DRIVERS_APP);
    await this.extractReactAPICalls(codebasePaths.adminDashboard);

    // Validate contracts
    this.detectMissingEndpoints();
    this.detectUnusedEndpoints();
    this.detectMethodMismatches();
    this.detectAuthenticationIssues();

    // Generate metrics
    this.generateMetrics();

    this.logger.info(`API contract validation complete: ${this.issues.length} issues found`);
    return this.formatResults({
      backendEndpoints: Array.from(this.backendEndpoints.values()),
      frontendCalls: this.frontendCalls
    });
  }

  /**
   * Extract API endpoints from backend Express routes
   * @param {string} backendPath - Path to backend
   */
  async extractBackendEndpoints(backendPath) {
    this.logger.debug('Extracting backend API endpoints');

    const routeFiles = this.findFiles(backendPath, /\.route\.js$/);

    routeFiles.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      const ast = this.parseCode(content, file);
      if (!ast) return;

      this.traverse(ast, {
        CallExpression: (path) => {
          // Look for router.get, router.post, etc.
          if (path.node.callee.type === 'MemberExpression' &&
              path.node.callee.object.name === 'router' &&
              ['get', 'post', 'put', 'delete', 'patch'].includes(path.node.callee.property.name)) {

            const method = path.node.callee.property.name.toUpperCase();
            const routeArg = path.node.arguments[0];

            if (routeArg && routeArg.type === 'Literal') {
              const route = routeArg.value;
              const fullPath = this.normalizeRoute(route);

              this.backendEndpoints.set(`${method}:${fullPath}`, {
                method,
                path: fullPath,
                file: path.relative(backendPath, file),
                line: path.node.loc?.start.line || 0,
                requiresAuth: this.checkRequiresAuth(path.node),
                parameters: this.extractRouteParameters(route)
              });
            }
          }
        }
      });
    });

    this.addMetric('backend_endpoints', this.backendEndpoints.size);
    this.logger.debug(`Found ${this.backendEndpoints.size} backend endpoints`);
  }

  /**
   * Extract API calls from Flutter app
   * @param {string} appPath - Path to Flutter app
   * @param {string} codebase - Codebase identifier
   */
  async extractFlutterAPICalls(appPath, codebase) {
    this.logger.debug(`Extracting API calls from ${codebase}`);

    const dartFiles = this.findFiles(appPath, /\.dart$/);

    dartFiles.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      // Pattern-based extraction for Dart (no AST parser available)
      // Look for http.get, http.post, etc.
      const patterns = [
        /http\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/g,
        /dio\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/g,
        /await\s+(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/g
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const method = match[1].toUpperCase();
          const apiPath = this.normalizeRoute(match[2]);

          this.frontendCalls[codebase].set(`${method}:${apiPath}`, {
            method,
            path: apiPath,
            file: path.relative(appPath, file),
            line: this.getLineNumber(content, match.index)
          });
        }
      });
    });

    this.addMetric(`${codebase}_api_calls`, this.frontendCalls[codebase].size);
    this.logger.debug(`Found ${this.frontendCalls[codebase].size} API calls in ${codebase}`);
  }

  /**
   * Extract API calls from React app
   * @param {string} adminPath - Path to admin dashboard
   */
  async extractReactAPICalls(adminPath) {
    this.logger.debug('Extracting API calls from admin dashboard');

    const jsFiles = this.findFiles(adminPath, /\.(js|jsx|ts|tsx)$/);

    jsFiles.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      const ast = this.parseCode(content, file);
      if (!ast) return;

      this.traverse(ast, {
        CallExpression: (callPath) => {
          // Look for fetch, axios.get, api.get, etc.
          const callee = callPath.node.callee;

          let method = null;
          let pathArg = null;

          if (callee.name === 'fetch') {
            // fetch('/api/users')
            pathArg = callPath.node.arguments[0];
            method = 'GET'; // default, could be overridden in options

            // Check for method in options
            const options = callPath.node.arguments[1];
            if (options && options.type === 'ObjectExpression') {
              const methodProp = options.properties.find(p => p.key?.name === 'method');
              if (methodProp && methodProp.value.type === 'Literal') {
                method = methodProp.value.value.toUpperCase();
              }
            }
          } else if (callee.type === 'MemberExpression' &&
                     (callee.object.name === 'axios' || callee.object.name === 'api') &&
                     ['get', 'post', 'put', 'delete', 'patch'].includes(callee.property.name)) {
            // axios.get('/api/users')
            method = callee.property.name.toUpperCase();
            pathArg = callPath.node.arguments[0];
          }

          if (method && pathArg) {
            let apiPath = null;

            if (pathArg.type === 'Literal') {
              apiPath = pathArg.value;
            } else if (pathArg.type === 'TemplateLiteral') {
              // Extract base path from template literal
              apiPath = this.extractTemplateBasePath(pathArg);
            }

            if (apiPath) {
              apiPath = this.normalizeRoute(apiPath);

              this.frontendCalls[CODEBASE.ADMIN_DASHBOARD].set(`${method}:${apiPath}`, {
                method,
                path: apiPath,
                file: path.relative(adminPath, file),
                line: callPath.node.loc?.start.line || 0
              });
            }
          }
        }
      });
    });

    this.addMetric('admin_api_calls', this.frontendCalls[CODEBASE.ADMIN_DASHBOARD].size);
    this.logger.debug(`Found ${this.frontendCalls[CODEBASE.ADMIN_DASHBOARD].size} API calls in admin`);
  }

  /**
   * Detect API calls to non-existent endpoints
   */
  detectMissingEndpoints() {
    this.logger.debug('Detecting missing endpoints');

    Object.entries(this.frontendCalls).forEach(([codebase, calls]) => {
      calls.forEach((call, key) => {
        // Check if this endpoint exists in backend
        if (!this.backendEndpoints.has(key) && !this.isParameterizedMatch(key)) {
          this.addIssue(this.createIssue({
            type: 'missing_backend_endpoint',
            severity: SEVERITY.HIGH,
            message: `${codebase} calls non-existent endpoint: ${call.method} ${call.path}`,
            codebase,
            file: call.file,
            code: `${call.method} ${call.path}`,
            location: { line: call.line, column: 0 },
            suggestion: `Add endpoint in backend or fix API call path`,
            impact: 'API calls will fail at runtime'
          }));
        }
      });
    });
  }

  /**
   * Detect unused backend endpoints
   */
  detectUnusedEndpoints() {
    this.logger.debug('Detecting unused endpoints');

    this.backendEndpoints.forEach((endpoint, key) => {
      let isUsed = false;

      // Check if any frontend calls this endpoint
      Object.values(this.frontendCalls).forEach(calls => {
        if (calls.has(key) || this.hasParameterizedMatch(key, calls)) {
          isUsed = true;
        }
      });

      if (!isUsed) {
        this.addIssue(this.createIssue({
          type: 'unused_backend_endpoint',
          severity: SEVERITY.LOW,
          message: `Backend endpoint not called by any frontend: ${endpoint.method} ${endpoint.path}`,
          codebase: CODEBASE.BACKEND,
          file: endpoint.file,
          code: `${endpoint.method} ${endpoint.path}`,
          location: { line: endpoint.line, column: 0 },
          suggestion: 'Remove unused endpoint or add frontend integration',
          fixable: true
        }));
      }
    });
  }

  /**
   * Detect HTTP method mismatches
   */
  detectMethodMismatches() {
    this.logger.debug('Detecting method mismatches');

    Object.entries(this.frontendCalls).forEach(([codebase, calls]) => {
      calls.forEach((call, key) => {
        const [method, path] = key.split(':');

        // Find matching backend endpoint (could have different method)
        const matchingEndpoints = Array.from(this.backendEndpoints.entries())
          .filter(([k, v]) => {
            const [, backendPath] = k.split(':');
            return this.pathsMatch(path, backendPath);
          });

        matchingEndpoints.forEach(([backendKey, endpoint]) => {
          const [backendMethod] = backendKey.split(':');

          if (method !== backendMethod) {
            this.addIssue(this.createIssue({
              type: 'method_mismatch',
              severity: SEVERITY.HIGH,
              message: `Method mismatch: ${codebase} calls ${method} but backend expects ${backendMethod}`,
              codebase,
              file: call.file,
              code: `${method} ${path} (backend: ${backendMethod})`,
              location: { line: call.line, column: 0 },
              suggestion: `Change to ${backendMethod} or update backend route`,
              impact: 'API call will fail with 404 or 405'
            }));
          }
        });
      });
    });
  }

  /**
   * Detect authentication issues
   */
  detectAuthenticationIssues() {
    this.logger.debug('Detecting authentication issues');

    // Check if protected endpoints are called without auth checks
    // This would require more context about frontend auth implementation
    // Simplified version for now
  }

  /**
   * Normalize API route path
   * @param {string} route - Route path
   * @returns {string} Normalized path
   */
  normalizeRoute(route) {
    // Remove base URL if present
    route = route.replace(/^https?:\/\/[^\/]+/, '');

    // Remove trailing slash
    route = route.replace(/\/$/, '');

    // Ensure leading slash
    if (!route.startsWith('/')) {
      route = '/' + route;
    }

    return route;
  }

  /**
   * Check if route requires authentication
   * @param {Object} node - AST node
   * @returns {boolean} True if requires auth
   */
  checkRequiresAuth(node) {
    // Check if middleware includes 'auth' or 'authenticate'
    const args = node.arguments;
    if (args.length > 1) {
      for (let i = 1; i < args.length - 1; i++) {
        const arg = args[i];
        if (arg.type === 'Identifier' &&
            (arg.name.includes('auth') || arg.name.includes('Auth'))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Extract route parameters
   * @param {string} route - Route path
   * @returns {Array} Parameter names
   */
  extractRouteParameters(route) {
    const params = [];
    const matches = route.matchAll(/:(\w+)/g);
    for (const match of matches) {
      params.push(match[1]);
    }
    return params;
  }

  /**
   * Check if key matches a parameterized endpoint
   * @param {string} key - Endpoint key (METHOD:path)
   * @returns {boolean} True if matches
   */
  isParameterizedMatch(key) {
    const [method, path] = key.split(':');

    // Check if any backend endpoint with same method matches
    for (const [backendKey, endpoint] of this.backendEndpoints.entries()) {
      const [backendMethod, backendPath] = backendKey.split(':');

      if (method === backendMethod && this.pathsMatch(path, backendPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if frontend call matches parameterized endpoint
   * @param {string} backendKey - Backend endpoint key
   * @param {Map} frontendCalls - Frontend calls map
   * @returns {boolean} True if matches
   */
  hasParameterizedMatch(backendKey, frontendCalls) {
    const [method, backendPath] = backendKey.split(':');

    for (const [frontendKey] of frontendCalls.entries()) {
      const [frontendMethod, frontendPath] = frontendKey.split(':');

      if (method === frontendMethod && this.pathsMatch(frontendPath, backendPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two paths match (accounting for parameters)
   * @param {string} path1 - First path
   * @param {string} path2 - Second path
   * @returns {boolean} True if match
   */
  pathsMatch(path1, path2) {
    // Split paths into segments
    const segments1 = path1.split('/').filter(Boolean);
    const segments2 = path2.split('/').filter(Boolean);

    if (segments1.length !== segments2.length) {
      return false;
    }

    for (let i = 0; i < segments1.length; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];

      // If either segment is a parameter, it matches
      if (seg1.startsWith(':') || seg2.startsWith(':')) {
        continue;
      }

      // Exact match required
      if (seg1 !== seg2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract base path from template literal
   * @param {Object} node - Template literal node
   * @returns {string|null} Base path
   */
  extractTemplateBasePath(node) {
    if (node.quasis && node.quasis.length > 0) {
      return node.quasis[0].value.raw;
    }
    return null;
  }

  /**
   * Get line number from string index
   * @param {string} content - File content
   * @param {number} index - String index
   * @returns {number} Line number
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Generate API contract metrics
   */
  generateMetrics() {
    let totalCalls = 0;
    Object.values(this.frontendCalls).forEach(calls => {
      totalCalls += calls.size;
    });

    this.addMetric('total_api_calls', totalCalls);
    this.addMetric('api_coverage',
      this.backendEndpoints.size > 0
        ? ((totalCalls / this.backendEndpoints.size) * 100).toFixed(2) + '%'
        : '0%'
    );
  }

  /**
   * Get category for issue type
   * @param {string} type - Issue type
   * @returns {string} Category
   */
  getCategory(type) {
    return CATEGORY.API_CONTRACT;
  }
}

/**
 * Get singleton instance
 */
let validatorInstance = null;

export function getAPIContractValidator() {
  if (!validatorInstance) {
    validatorInstance = new APIContractValidator();
  }
  return validatorInstance;
}
