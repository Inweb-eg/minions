/**
 * Minions - Technology Stack Selector
 * ====================================
 * Chooses appropriate technologies based on project requirements.
 * Defines package versions and compatibility matrices.
 */

import EventEmitter from 'events';

// Technology Categories
const TechCategories = {
  BACKEND_FRAMEWORK: 'backend-framework',
  DATABASE: 'database',
  CACHE: 'cache',
  FRONTEND_WEB: 'frontend-web',
  FRONTEND_MOBILE: 'frontend-mobile',
  STATE_MANAGEMENT: 'state-management',
  TESTING: 'testing',
  CI_CD: 'ci-cd',
  MONITORING: 'monitoring',
  MESSAGING: 'messaging'
};

// Technology Options with metadata
const TechnologyOptions = {
  // Backend Frameworks
  'express': {
    category: TechCategories.BACKEND_FRAMEWORK,
    name: 'Express.js',
    version: '^4.18.2',
    language: 'javascript',
    pros: ['Mature ecosystem', 'Large community', 'Flexible'],
    cons: ['Callback-heavy', 'Minimal structure'],
    bestFor: ['REST APIs', 'Simple applications', 'Prototypes'],
    dependencies: ['cors', 'helmet', 'morgan', 'compression']
  },
  'fastify': {
    category: TechCategories.BACKEND_FRAMEWORK,
    name: 'Fastify',
    version: '^4.24.0',
    language: 'javascript',
    pros: ['High performance', 'Schema validation', 'TypeScript support'],
    cons: ['Smaller ecosystem', 'Steeper learning curve'],
    bestFor: ['High-performance APIs', 'Microservices'],
    dependencies: ['@fastify/cors', '@fastify/helmet', '@fastify/swagger']
  },
  'nestjs': {
    category: TechCategories.BACKEND_FRAMEWORK,
    name: 'NestJS',
    version: '^10.2.0',
    language: 'typescript',
    pros: ['Enterprise-ready', 'Strong typing', 'Modular architecture'],
    cons: ['Verbose', 'Heavier'],
    bestFor: ['Enterprise applications', 'Complex domains'],
    dependencies: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express']
  },
  
  // Databases
  'mongodb': {
    category: TechCategories.DATABASE,
    name: 'MongoDB',
    version: 'latest',
    type: 'nosql',
    orm: 'mongoose',
    ormVersion: '^8.0.0',
    pros: ['Flexible schema', 'Scalable', 'JSON-native'],
    cons: ['No transactions (older)', 'Denormalization needed'],
    bestFor: ['Rapid development', 'Document storage', 'Scalability']
  },
  'postgresql': {
    category: TechCategories.DATABASE,
    name: 'PostgreSQL',
    version: '15',
    type: 'sql',
    orm: 'prisma',
    ormVersion: '^5.5.0',
    pros: ['ACID compliant', 'Rich features', 'Strong integrity'],
    cons: ['Rigid schema', 'Scaling complexity'],
    bestFor: ['Complex queries', 'Financial data', 'Relationships']
  },
  'mysql': {
    category: TechCategories.DATABASE,
    name: 'MySQL',
    version: '8.0',
    type: 'sql',
    orm: 'sequelize',
    ormVersion: '^6.35.0',
    pros: ['Well understood', 'Good performance', 'Wide support'],
    cons: ['Less features than PostgreSQL'],
    bestFor: ['Traditional applications', 'Read-heavy workloads']
  },
  
  // Cache
  'redis': {
    category: TechCategories.CACHE,
    name: 'Redis',
    version: '7',
    clientVersion: '^4.6.0',
    pros: ['Fast', 'Data structures', 'Pub/Sub'],
    cons: ['Memory-bound', 'Persistence complexity'],
    bestFor: ['Caching', 'Sessions', 'Real-time features']
  },
  
  // Frontend Web
  'react': {
    category: TechCategories.FRONTEND_WEB,
    name: 'React',
    version: '^18.2.0',
    pros: ['Large ecosystem', 'Component model', 'Virtual DOM'],
    cons: ['JSX learning curve', 'Boilerplate'],
    bestFor: ['Complex UIs', 'SPAs', 'Interactive apps'],
    dependencies: ['react-dom', 'react-router-dom']
  },
  'vue': {
    category: TechCategories.FRONTEND_WEB,
    name: 'Vue.js',
    version: '^3.3.0',
    pros: ['Easy to learn', 'Good documentation', 'Flexible'],
    cons: ['Smaller ecosystem than React'],
    bestFor: ['Progressive adoption', 'Smaller teams'],
    dependencies: ['vue-router', 'pinia']
  },
  
  // Frontend Mobile
  'flutter': {
    category: TechCategories.FRONTEND_MOBILE,
    name: 'Flutter',
    version: '^3.16.0',
    language: 'dart',
    pros: ['Single codebase', 'Fast development', 'Beautiful UI'],
    cons: ['Dart learning curve', 'Larger app size'],
    bestFor: ['Cross-platform apps', 'Custom UI', 'MVP development'],
    dependencies: ['provider', 'dio', 'shared_preferences', 'flutter_secure_storage']
  },
  'react-native': {
    category: TechCategories.FRONTEND_MOBILE,
    name: 'React Native',
    version: '^0.72.0',
    language: 'javascript',
    pros: ['JavaScript skills reuse', 'Large community', 'Native modules'],
    cons: ['Bridge overhead', 'Platform-specific code'],
    bestFor: ['JavaScript teams', 'Native integrations'],
    dependencies: ['react-navigation', 'axios', 'async-storage']
  },
  
  // State Management
  'redux-toolkit': {
    category: TechCategories.STATE_MANAGEMENT,
    name: 'Redux Toolkit',
    version: '^2.0.0',
    platform: 'web',
    pros: ['Predictable', 'DevTools', 'Middleware'],
    cons: ['Boilerplate', 'Learning curve'],
    bestFor: ['Complex state', 'Large applications'],
    dependencies: ['react-redux']
  },
  'provider': {
    category: TechCategories.STATE_MANAGEMENT,
    name: 'Provider',
    version: '^6.1.0',
    platform: 'mobile',
    pros: ['Simple', 'Flutter-native', 'InheritedWidget-based'],
    cons: ['Not for complex state'],
    bestFor: ['Simple to medium apps', 'Flutter projects']
  },
  'riverpod': {
    category: TechCategories.STATE_MANAGEMENT,
    name: 'Riverpod',
    version: '^2.4.0',
    platform: 'mobile',
    pros: ['Compile-safe', 'Testable', 'No context needed'],
    cons: ['Steeper learning curve'],
    bestFor: ['Complex Flutter apps', 'Testability focus']
  },
  
  // Testing
  'jest': {
    category: TechCategories.TESTING,
    name: 'Jest',
    version: '^29.7.0',
    platform: 'javascript',
    pros: ['Zero config', 'Snapshot testing', 'Coverage'],
    cons: ['Slower than Vitest'],
    bestFor: ['React apps', 'Node.js testing']
  },
  'vitest': {
    category: TechCategories.TESTING,
    name: 'Vitest',
    version: '^1.0.0',
    platform: 'javascript',
    pros: ['Fast', 'Vite integration', 'Jest compatible'],
    cons: ['Newer, less resources'],
    bestFor: ['Vite projects', 'Modern JS']
  },
  
  // CI/CD
  'github-actions': {
    category: TechCategories.CI_CD,
    name: 'GitHub Actions',
    pros: ['GitHub integration', 'Free tier', 'Matrix builds'],
    cons: ['GitHub lock-in'],
    bestFor: ['GitHub repos', 'Open source']
  },
  
  // Monitoring
  'winston': {
    category: TechCategories.MONITORING,
    name: 'Winston',
    version: '^3.11.0',
    type: 'logging',
    pros: ['Flexible', 'Multiple transports', 'Formatting'],
    cons: ['Configuration complexity'],
    bestFor: ['Node.js applications']
  },
  'prom-client': {
    category: TechCategories.MONITORING,
    name: 'Prometheus Client',
    version: '^15.0.0',
    type: 'metrics',
    pros: ['Industry standard', 'Grafana integration'],
    cons: ['Pull-based model'],
    bestFor: ['Kubernetes', 'Microservices']
  }
};

// Compatibility Matrix
const CompatibilityMatrix = {
  'express': {
    compatible: ['mongodb', 'postgresql', 'mysql', 'redis', 'jest', 'winston'],
    recommended: ['mongodb', 'redis', 'jest']
  },
  'fastify': {
    compatible: ['mongodb', 'postgresql', 'redis', 'jest', 'vitest'],
    recommended: ['postgresql', 'redis', 'vitest']
  },
  'react': {
    compatible: ['redux-toolkit', 'jest', 'vitest'],
    recommended: ['redux-toolkit', 'vitest']
  },
  'flutter': {
    compatible: ['provider', 'riverpod'],
    recommended: ['provider']
  }
};

class TechSelector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.selectedStack = null;
  }
  
  /**
   * Select technology stack based on requirements
   */
  async selectStack(requirements) {
    const stack = {
      id: `STACK-${Date.now()}`,
      createdAt: new Date().toISOString(),
      
      // Backend
      backend: this._selectBackend(requirements),
      
      // Database
      database: this._selectDatabase(requirements),
      
      // Cache
      cache: this._selectCache(requirements),
      
      // Admin Dashboard
      admin: this._selectAdminStack(requirements),
      
      // Mobile Apps
      mobile: this._selectMobileStack(requirements),
      
      // Testing
      testing: this._selectTestingStack(requirements),
      
      // CI/CD
      cicd: this._selectCiCd(requirements),
      
      // Monitoring
      monitoring: this._selectMonitoring(requirements),
      
      // Package versions (for consistency)
      versions: {},
      
      // Compatibility verification
      compatibility: { verified: true, issues: [] }
    };
    
    // Compile all versions
    stack.versions = this._compileVersions(stack);
    
    // Verify compatibility
    stack.compatibility = this._verifyCompatibility(stack);
    
    // Store selection
    this.selectedStack = stack;
    
    return stack;
  }
  
  /**
   * Get technology details
   */
  getTechnologyInfo(techKey) {
    return TechnologyOptions[techKey] || null;
  }
  
  /**
   * Get all technologies in a category
   */
  getTechnologiesByCategory(category) {
    return Object.entries(TechnologyOptions)
      .filter(([key, tech]) => tech.category === category)
      .map(([key, tech]) => ({ key, ...tech }));
  }
  
  /**
   * Check if two technologies are compatible
   */
  areCompatible(tech1, tech2) {
    const matrix = CompatibilityMatrix[tech1];
    if (!matrix) return true; // Unknown, assume compatible
    return matrix.compatible.includes(tech2);
  }
  
  /**
   * Get recommended companions for a technology
   */
  getRecommendedCompanions(techKey) {
    const matrix = CompatibilityMatrix[techKey];
    if (!matrix) return [];
    return matrix.recommended.map(key => ({
      key,
      ...TechnologyOptions[key]
    }));
  }
  
  /**
   * Generate package.json dependencies section
   */
  generatePackageJson(stack, type = 'backend') {
    const dependencies = {};
    const devDependencies = {};
    
    if (type === 'backend') {
      const backend = TechnologyOptions[stack.backend?.framework];
      if (backend) {
        dependencies[stack.backend.framework] = backend.version;
        for (const dep of backend.dependencies || []) {
          dependencies[dep] = 'latest';
        }
      }
      
      const db = TechnologyOptions[stack.database?.type];
      if (db && db.orm) {
        dependencies[db.orm] = db.ormVersion;
      }
      
      const cache = TechnologyOptions[stack.cache?.type];
      if (cache) {
        dependencies['redis'] = cache.clientVersion;
      }
      
      // Testing
      const testing = TechnologyOptions[stack.testing?.unit];
      if (testing) {
        devDependencies[stack.testing.unit] = testing.version;
      }
      
      // Monitoring
      const logging = TechnologyOptions[stack.monitoring?.logging];
      if (logging) {
        dependencies[stack.monitoring.logging] = logging.version;
      }
    }
    
    if (type === 'admin') {
      const frontend = TechnologyOptions[stack.admin?.framework];
      if (frontend) {
        dependencies[stack.admin.framework] = frontend.version;
        for (const dep of frontend.dependencies || []) {
          dependencies[dep] = 'latest';
        }
      }
      
      const state = TechnologyOptions[stack.admin?.stateManagement];
      if (state) {
        dependencies[stack.admin.stateManagement] = state.version;
        for (const dep of state.dependencies || []) {
          dependencies[dep] = 'latest';
        }
      }
    }
    
    return { dependencies, devDependencies };
  }
  
  /**
   * Generate pubspec.yaml dependencies for Flutter
   */
  generatePubspec(stack) {
    const dependencies = {
      flutter: { sdk: 'flutter' }
    };
    
    const mobile = TechnologyOptions[stack.mobile?.framework];
    if (mobile) {
      for (const dep of mobile.dependencies || []) {
        dependencies[dep] = 'any';
      }
    }
    
    const state = TechnologyOptions[stack.mobile?.stateManagement];
    if (state) {
      dependencies[stack.mobile.stateManagement] = `^${state.version.replace('^', '')}`;
    }
    
    return { dependencies };
  }
  
  // ==================== Private Methods ====================
  
  _selectBackend(requirements) {
    // Default to Express for simplicity
    let framework = 'express';
    
    // Check for specific needs
    if (requirements.performance === 'high') {
      framework = 'fastify';
    }
    if (requirements.enterprise === true || requirements.typescript === true) {
      framework = 'nestjs';
    }
    
    const tech = TechnologyOptions[framework];
    
    return {
      framework,
      name: tech.name,
      version: tech.version,
      language: tech.language || 'javascript',
      runtime: 'node',
      runtimeVersion: '>=18.0.0',
      packageManager: 'npm',
      dependencies: tech.dependencies,
      rationale: this._generateRationale(framework, requirements)
    };
  }
  
  _selectDatabase(requirements) {
    // Default to MongoDB for rapid development
    let dbType = 'mongodb';
    
    // Check for specific needs
    if (requirements.transactions === true || requirements.relational === true) {
      dbType = 'postgresql';
    }
    if (requirements.legacy === true) {
      dbType = 'mysql';
    }
    
    const tech = TechnologyOptions[dbType];
    
    return {
      type: dbType,
      name: tech.name,
      version: tech.version,
      dbType: tech.type,
      orm: tech.orm,
      ormVersion: tech.ormVersion,
      migrations: true,
      seeding: true,
      rationale: this._generateRationale(dbType, requirements)
    };
  }
  
  _selectCache(requirements) {
    const tech = TechnologyOptions['redis'];
    
    return {
      type: 'redis',
      name: tech.name,
      version: tech.version,
      clientVersion: tech.clientVersion,
      useCases: ['sessions', 'caching', 'rate-limiting', 'pub-sub'],
      rationale: 'Redis is the industry standard for caching and session management'
    };
  }
  
  _selectAdminStack(requirements) {
    // Default to React with Redux
    let framework = 'react';
    let stateManagement = 'redux-toolkit';
    
    if (requirements.adminFramework) {
      framework = requirements.adminFramework;
    }
    
    const tech = TechnologyOptions[framework];
    const stateTech = TechnologyOptions[stateManagement];
    
    return {
      framework,
      name: tech.name,
      version: tech.version,
      stateManagement,
      stateManagementVersion: stateTech.version,
      routing: 'react-router-dom',
      styling: 'tailwindcss',
      ui: 'shadcn-ui',
      dependencies: [...(tech.dependencies || []), ...(stateTech.dependencies || [])],
      buildTool: 'vite',
      rationale: this._generateRationale(framework, requirements)
    };
  }
  
  _selectMobileStack(requirements) {
    // Default to Flutter with Provider
    let framework = 'flutter';
    let stateManagement = 'provider';
    
    if (requirements.mobileFramework) {
      framework = requirements.mobileFramework;
    }
    
    if (requirements.complexState === true) {
      stateManagement = 'riverpod';
    }
    
    const tech = TechnologyOptions[framework];
    const stateTech = TechnologyOptions[stateManagement];
    
    return {
      framework,
      name: tech.name,
      version: tech.version,
      language: tech.language,
      stateManagement,
      stateManagementVersion: stateTech.version,
      dependencies: tech.dependencies,
      rationale: this._generateRationale(framework, requirements)
    };
  }
  
  _selectTestingStack(requirements) {
    // Default testing tools
    return {
      unit: 'jest',
      unitVersion: TechnologyOptions['jest'].version,
      integration: 'supertest',
      e2e: 'playwright',
      mobile: 'flutter_test',
      coverage: {
        tool: 'istanbul',
        threshold: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      rationale: 'Industry-standard testing tools with good coverage reporting'
    };
  }
  
  _selectCiCd(requirements) {
    return {
      platform: 'github-actions',
      name: TechnologyOptions['github-actions'].name,
      pipelines: [
        {
          name: 'test',
          triggers: ['push', 'pull_request'],
          steps: ['lint', 'test', 'coverage']
        },
        {
          name: 'build',
          triggers: ['push:main'],
          steps: ['test', 'build', 'docker-build']
        },
        {
          name: 'deploy',
          triggers: ['release'],
          steps: ['test', 'build', 'deploy-staging', 'deploy-production']
        }
      ],
      rationale: 'Native GitHub integration with generous free tier'
    };
  }
  
  _selectMonitoring(requirements) {
    return {
      logging: 'winston',
      loggingVersion: TechnologyOptions['winston'].version,
      metrics: 'prom-client',
      metricsVersion: TechnologyOptions['prom-client'].version,
      errorTracking: 'sentry',
      apm: 'datadog',
      alerting: {
        provider: 'pagerduty',
        channels: ['email', 'slack']
      },
      dashboards: {
        provider: 'grafana',
        prebuilt: ['nodejs', 'mongodb', 'redis']
      },
      rationale: 'Comprehensive monitoring stack with industry-standard tools'
    };
  }
  
  _compileVersions(stack) {
    const versions = {};
    
    // Backend
    if (stack.backend) {
      versions[stack.backend.framework] = stack.backend.version;
      versions['node'] = stack.backend.runtimeVersion;
    }
    
    // Database
    if (stack.database) {
      versions[stack.database.type] = stack.database.version;
      if (stack.database.orm) {
        versions[stack.database.orm] = stack.database.ormVersion;
      }
    }
    
    // Cache
    if (stack.cache) {
      versions[stack.cache.type] = stack.cache.version;
    }
    
    // Admin
    if (stack.admin) {
      versions[stack.admin.framework] = stack.admin.version;
      versions[stack.admin.stateManagement] = stack.admin.stateManagementVersion;
    }
    
    // Mobile
    if (stack.mobile) {
      versions[stack.mobile.framework] = stack.mobile.version;
      versions[stack.mobile.stateManagement] = stack.mobile.stateManagementVersion;
    }
    
    // Testing
    if (stack.testing) {
      versions[stack.testing.unit] = stack.testing.unitVersion;
    }
    
    // Monitoring
    if (stack.monitoring) {
      versions[stack.monitoring.logging] = stack.monitoring.loggingVersion;
      versions[stack.monitoring.metrics] = stack.monitoring.metricsVersion;
    }
    
    return versions;
  }
  
  _verifyCompatibility(stack) {
    const issues = [];
    
    // Check backend-database compatibility
    if (stack.backend && stack.database) {
      if (!this.areCompatible(stack.backend.framework, stack.database.type)) {
        issues.push({
          severity: 'WARNING',
          message: `${stack.backend.framework} and ${stack.database.type} may have compatibility issues`
        });
      }
    }
    
    // Check frontend-state management compatibility
    if (stack.admin && stack.admin.stateManagement) {
      if (!this.areCompatible(stack.admin.framework, stack.admin.stateManagement)) {
        issues.push({
          severity: 'WARNING',
          message: `${stack.admin.framework} and ${stack.admin.stateManagement} may have compatibility issues`
        });
      }
    }
    
    return {
      verified: issues.filter(i => i.severity === 'ERROR').length === 0,
      issues
    };
  }
  
  _generateRationale(techKey, requirements) {
    const tech = TechnologyOptions[techKey];
    if (!tech) return 'Selected as default option';
    
    const reasons = [];
    
    if (tech.pros) {
      reasons.push(`Strengths: ${tech.pros.slice(0, 2).join(', ')}`);
    }
    
    if (tech.bestFor) {
      const match = tech.bestFor.find(use => 
        requirements.description?.toLowerCase().includes(use.toLowerCase())
      );
      if (match) {
        reasons.push(`Well-suited for: ${match}`);
      }
    }
    
    return reasons.length > 0 ? reasons.join('. ') : `${tech.name} is a solid choice for this project`;
  }
}

export { TechSelector, TechCategories };
export default TechSelector;
