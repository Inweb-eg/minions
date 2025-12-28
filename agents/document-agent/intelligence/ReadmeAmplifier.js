/**
 * ReadmeAmplifier - Transforms minimal README into enterprise-grade specification
 *
 * Revolutionary Enhancement: 10-line README → 1000-line specification
 *
 * Features:
 * - Infers optimal tech stack based on requirements
 * - Detects implied features user forgot to mention
 * - Adds industry best practices automatically
 * - Predicts future scaling needs
 * - Generates security requirements
 * - Adds compliance requirements based on domain
 */

import { createLogger } from '../../../foundation/common/logger.js';
import { getEventBus } from '../../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

const logger = createLogger('ReadmeAmplifier');

// Domain patterns for detecting project type
const DOMAIN_PATTERNS = {
  ecommerce: /shop|store|cart|checkout|payment|order|product|inventory|catalog/i,
  social: /social|friend|follow|like|share|post|feed|profile|message|chat/i,
  fintech: /bank|payment|transaction|wallet|transfer|finance|money|invoice/i,
  healthcare: /health|patient|doctor|medical|appointment|prescription|clinic/i,
  education: /course|student|teacher|lesson|quiz|grade|school|learn/i,
  logistics: /delivery|shipping|track|driver|route|fleet|warehouse|logistics/i,
  saas: /subscription|tenant|dashboard|admin|user|analytics|report|api/i,
  marketplace: /marketplace|seller|buyer|listing|bid|auction|vendor/i,
  streaming: /video|stream|content|media|playlist|channel|watch/i,
  iot: /device|sensor|telemetry|mqtt|gateway|firmware|hardware/i
};

// Tech stack recommendations by domain
const TECH_STACK_RECOMMENDATIONS = {
  ecommerce: {
    backend: ['Node.js/Express', 'PostgreSQL', 'Redis', 'Stripe/PayPal'],
    frontend: ['React/Next.js', 'TailwindCSS'],
    infrastructure: ['Docker', 'Kubernetes', 'AWS/GCP'],
    features: ['Search (Elasticsearch)', 'CDN', 'Queue (RabbitMQ)']
  },
  social: {
    backend: ['Node.js/Express', 'PostgreSQL', 'Redis', 'WebSocket'],
    frontend: ['React/Next.js', 'TailwindCSS'],
    infrastructure: ['Docker', 'Kubernetes', 'AWS S3'],
    features: ['Real-time notifications', 'Media storage', 'Feed algorithm']
  },
  fintech: {
    backend: ['Node.js/Express', 'PostgreSQL', 'Redis'],
    frontend: ['React/Next.js', 'TailwindCSS'],
    infrastructure: ['Docker', 'Kubernetes', 'AWS/GCP'],
    features: ['Encryption', 'Audit logging', '2FA', 'PCI compliance']
  },
  healthcare: {
    backend: ['Node.js/Express', 'PostgreSQL', 'Redis'],
    frontend: ['React/Next.js', 'TailwindCSS'],
    infrastructure: ['Docker', 'Kubernetes', 'HIPAA-compliant hosting'],
    features: ['Encryption', 'Audit logging', 'HIPAA compliance', 'HL7/FHIR']
  },
  default: {
    backend: ['Node.js/Express', 'PostgreSQL', 'Redis'],
    frontend: ['React/Next.js', 'TailwindCSS'],
    infrastructure: ['Docker', 'Kubernetes'],
    features: ['Authentication', 'Authorization', 'Logging', 'Monitoring']
  }
};

// Implied features by domain
const IMPLIED_FEATURES = {
  ecommerce: [
    'User authentication and authorization',
    'Product catalog with search and filtering',
    'Shopping cart with persistence',
    'Checkout flow with multiple payment options',
    'Order management and tracking',
    'Inventory management',
    'Email notifications',
    'Admin dashboard',
    'Analytics and reporting',
    'SEO optimization',
    'Mobile responsive design',
    'Wishlist functionality',
    'Product reviews and ratings',
    'Discount codes and promotions'
  ],
  social: [
    'User registration and profiles',
    'Follow/friend system',
    'News feed with algorithm',
    'Post creation (text, images, video)',
    'Like, comment, share functionality',
    'Real-time notifications',
    'Direct messaging',
    'Search functionality',
    'Privacy settings',
    'Content moderation',
    'Report/block functionality',
    'Mobile responsive design'
  ],
  fintech: [
    'Secure user authentication (2FA)',
    'Account management',
    'Transaction processing',
    'Balance tracking',
    'Transaction history',
    'Audit logging',
    'Encryption at rest and in transit',
    'PCI DSS compliance',
    'Fraud detection',
    'KYC verification',
    'Real-time notifications',
    'Admin dashboard'
  ],
  default: [
    'User authentication and authorization',
    'User profile management',
    'Admin dashboard',
    'Email notifications',
    'Logging and monitoring',
    'API documentation',
    'Error handling',
    'Rate limiting',
    'Input validation',
    'Mobile responsive design'
  ]
};

// Security requirements by domain
const SECURITY_REQUIREMENTS = {
  fintech: [
    'PCI DSS Level 1 compliance',
    'End-to-end encryption (AES-256)',
    'Multi-factor authentication',
    'Session management with secure tokens',
    'Rate limiting and DDoS protection',
    'SQL injection prevention',
    'XSS protection',
    'CSRF protection',
    'Audit logging with tamper-proof storage',
    'Penetration testing requirements',
    'Data retention policies',
    'Secure key management (HSM)'
  ],
  healthcare: [
    'HIPAA compliance',
    'PHI encryption at rest and in transit',
    'Access control with audit trails',
    'Business Associate Agreements',
    'Data backup and disaster recovery',
    'Minimum necessary access principle',
    'Patient consent management',
    'Secure messaging',
    'Session timeout policies'
  ],
  default: [
    'HTTPS enforcement',
    'Password hashing (bcrypt/argon2)',
    'JWT with secure configuration',
    'CORS configuration',
    'Rate limiting',
    'Input validation and sanitization',
    'SQL injection prevention',
    'XSS protection',
    'CSRF protection',
    'Security headers (Helmet.js)',
    'Dependency vulnerability scanning'
  ]
};

// Compliance requirements by domain
const COMPLIANCE_REQUIREMENTS = {
  fintech: ['PCI DSS', 'SOC 2', 'GDPR', 'AML/KYC'],
  healthcare: ['HIPAA', 'HITECH', 'FDA (if applicable)', 'GDPR'],
  ecommerce: ['PCI DSS', 'GDPR', 'CCPA', 'ADA compliance'],
  education: ['FERPA', 'COPPA (if minors)', 'GDPR'],
  default: ['GDPR', 'CCPA']
};

// Scale predictions based on domain
const SCALE_PREDICTIONS = {
  social: {
    users: '10K → 1M → 100M',
    requests: '100/s → 10K/s → 1M/s',
    storage: '100GB → 10TB → 1PB',
    considerations: [
      'Horizontal scaling strategy',
      'Database sharding',
      'CDN for media',
      'Caching layer (Redis cluster)',
      'Message queues for async processing',
      'Read replicas for database',
      'Microservices architecture'
    ]
  },
  ecommerce: {
    users: '1K → 100K → 10M',
    requests: '50/s → 5K/s → 100K/s',
    storage: '10GB → 1TB → 100TB',
    considerations: [
      'Auto-scaling for traffic spikes',
      'Database read replicas',
      'CDN for product images',
      'Search engine (Elasticsearch)',
      'Inventory caching',
      'Order processing queue'
    ]
  },
  default: {
    users: '1K → 100K → 1M',
    requests: '10/s → 1K/s → 10K/s',
    storage: '1GB → 100GB → 10TB',
    considerations: [
      'Horizontal scaling strategy',
      'Database optimization',
      'Caching strategy',
      'Load balancing'
    ]
  }
};

class ReadmeAmplifier {
  constructor() {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;
  }

  /**
   * Initialize the amplifier
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.initialized = true;
      this.logger.info('ReadmeAmplifier initialized');
    } catch (error) {
      this.logger.warn('EventBus not available, running in standalone mode');
      this.initialized = true;
    }
  }

  /**
   * Amplify a simple README into a complete specification
   * @param {string} simpleReadme - The minimal README content
   * @returns {Promise<Object>} Complete amplified specification
   */
  async amplifyReadme(simpleReadme) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Starting README amplification');
    const startTime = Date.now();

    // Parse the basic README
    const original = await this.parseBasicReadme(simpleReadme);

    // Detect domain
    const domain = this.detectDomain(simpleReadme);
    this.logger.info(`Detected domain: ${domain}`);

    // Build enhanced specification
    const enhanced = {
      // Original information
      original: {
        title: original.title,
        description: original.description,
        rawContent: simpleReadme
      },

      // Inferred optimal tech stack
      techStack: await this.inferOptimalStack(original, domain),

      // Implied features user forgot to mention
      impliedFeatures: await this.detectImpliedFeatures(original, domain),

      // Industry best practices
      bestPractices: await this.injectBestPractices(original, domain),

      // Scaling requirements
      scalingRequirements: await this.predictScale(original, domain),

      // Security requirements
      securityRequirements: await this.inferSecurity(original, domain),

      // Compliance requirements
      compliance: await this.detectCompliance(original, domain),

      // API structure
      apiStructure: await this.generateAPIStructure(original, domain),

      // Database schema suggestions
      databaseSchema: await this.generateDatabaseSchema(original, domain),

      // Non-functional requirements
      nonFunctionalRequirements: this.generateNFRs(domain),

      // Metadata
      metadata: {
        domain,
        amplifiedAt: new Date().toISOString(),
        amplificationVersion: '2.0',
        originalLines: simpleReadme.split('\n').length,
        processingTimeMs: 0
      }
    };

    enhanced.metadata.processingTimeMs = Date.now() - startTime;

    // Generate complete specification document
    const completeSpec = await this.generateCompleteSpec(enhanced);

    // Publish event if eventBus available
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'readme-amplifier',
        type: 'specification',
        original: simpleReadme.length,
        amplified: completeSpec.length,
        domain
      });
    }

    this.logger.info(`README amplified: ${simpleReadme.split('\n').length} lines → ${completeSpec.split('\n').length} lines`);

    return {
      specification: completeSpec,
      structured: enhanced,
      summary: this.generateSummary(enhanced)
    };
  }

  /**
   * Parse basic README structure
   */
  async parseBasicReadme(content) {
    const lines = content.split('\n').filter(l => l.trim());

    // Extract title (first heading or first line)
    let title = 'Untitled Project';
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else if (lines[0]) {
      title = lines[0].replace(/^#+\s*/, '').trim();
    }

    // Extract description (content after title)
    let description = '';
    const descMatch = content.match(/^#[^#].*\n\n([\s\S]*?)(?=\n#|\n\n#|$)/);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Extract features if listed
    const features = [];
    const featureMatches = content.matchAll(/^[-*]\s+(.+)$/gm);
    for (const match of featureMatches) {
      features.push(match[1].trim());
    }

    // Extract any mentioned technologies
    const technologies = this.extractTechnologies(content);

    // Extract any mentioned user types
    const userTypes = this.extractUserTypes(content);

    return {
      title,
      description,
      features,
      technologies,
      userTypes,
      rawLength: content.length
    };
  }

  /**
   * Detect project domain from content
   */
  detectDomain(content) {
    const contentLower = content.toLowerCase();

    for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
      if (pattern.test(contentLower)) {
        return domain;
      }
    }

    return 'default';
  }

  /**
   * Extract mentioned technologies
   */
  extractTechnologies(content) {
    const techPatterns = [
      /node\.?js/i, /express/i, /react/i, /vue/i, /angular/i,
      /postgresql/i, /postgres/i, /mysql/i, /mongodb/i, /redis/i,
      /docker/i, /kubernetes/i, /k8s/i, /aws/i, /gcp/i, /azure/i,
      /graphql/i, /rest/i, /websocket/i, /grpc/i,
      /flutter/i, /swift/i, /kotlin/i, /react native/i,
      /typescript/i, /javascript/i, /python/i, /go/i, /rust/i
    ];

    const found = [];
    for (const pattern of techPatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        if (match) found.push(match[0]);
      }
    }

    return [...new Set(found)];
  }

  /**
   * Extract user types mentioned
   */
  extractUserTypes(content) {
    const userPatterns = [
      /admin/i, /user/i, /customer/i, /driver/i, /seller/i,
      /buyer/i, /vendor/i, /merchant/i, /patient/i, /doctor/i,
      /student/i, /teacher/i, /manager/i, /employee/i, /guest/i
    ];

    const found = [];
    for (const pattern of userPatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        if (match) found.push(match[0].toLowerCase());
      }
    }

    return [...new Set(found)];
  }

  /**
   * Infer optimal tech stack
   */
  async inferOptimalStack(original, domain) {
    const recommendations = TECH_STACK_RECOMMENDATIONS[domain] || TECH_STACK_RECOMMENDATIONS.default;

    // Merge with any technologies already mentioned
    const stack = {
      ...recommendations,
      userSpecified: original.technologies,
      reasoning: this.generateStackReasoning(domain, original)
    };

    return stack;
  }

  /**
   * Generate reasoning for tech stack choice
   */
  generateStackReasoning(domain, original) {
    const reasons = [];

    switch (domain) {
      case 'ecommerce':
        reasons.push('PostgreSQL for ACID compliance in transactions');
        reasons.push('Redis for cart session management');
        reasons.push('Elasticsearch for product search');
        break;
      case 'social':
        reasons.push('PostgreSQL for relational user data');
        reasons.push('Redis for caching and real-time features');
        reasons.push('WebSocket for real-time notifications');
        break;
      case 'fintech':
        reasons.push('PostgreSQL for transaction integrity');
        reasons.push('Redis for rate limiting and caching');
        reasons.push('Event sourcing for audit trail');
        break;
      default:
        reasons.push('Node.js/Express for rapid development');
        reasons.push('PostgreSQL for reliable data storage');
        reasons.push('Redis for caching and sessions');
    }

    return reasons;
  }

  /**
   * Detect implied features
   */
  async detectImpliedFeatures(original, domain) {
    const baseFeatures = IMPLIED_FEATURES[domain] || IMPLIED_FEATURES.default;

    // Filter out features already mentioned
    const mentionedLower = original.features.map(f => f.toLowerCase()).join(' ');
    const implied = baseFeatures.filter(f =>
      !mentionedLower.includes(f.toLowerCase().split(' ')[0])
    );

    return {
      explicit: original.features,
      implied: implied,
      total: [...original.features, ...implied]
    };
  }

  /**
   * Inject best practices
   */
  async injectBestPractices(original, domain) {
    return {
      architecture: [
        'Clean Architecture / Hexagonal Architecture',
        'Separation of concerns (controllers, services, repositories)',
        'Dependency injection for testability',
        'Event-driven communication between services'
      ],
      coding: [
        'TypeScript for type safety',
        'ESLint + Prettier for code quality',
        'Comprehensive error handling',
        'Structured logging (pino/winston)',
        'Input validation (Joi/Zod)'
      ],
      testing: [
        'Unit tests (Jest) - 80%+ coverage',
        'Integration tests for API endpoints',
        'E2E tests for critical flows',
        'Contract testing for APIs'
      ],
      devops: [
        'CI/CD pipeline (GitHub Actions)',
        'Docker containerization',
        'Infrastructure as Code (Terraform)',
        'Environment-based configuration',
        'Health checks and readiness probes'
      ],
      documentation: [
        'OpenAPI/Swagger for API docs',
        'Architecture Decision Records (ADRs)',
        'README with setup instructions',
        'Contributing guidelines'
      ]
    };
  }

  /**
   * Predict scaling requirements
   */
  async predictScale(original, domain) {
    return SCALE_PREDICTIONS[domain] || SCALE_PREDICTIONS.default;
  }

  /**
   * Infer security requirements
   */
  async inferSecurity(original, domain) {
    const requirements = SECURITY_REQUIREMENTS[domain] || SECURITY_REQUIREMENTS.default;

    return {
      requirements,
      priority: domain === 'fintech' || domain === 'healthcare' ? 'critical' : 'high',
      certifications: domain === 'fintech' ? ['PCI DSS', 'SOC 2'] : []
    };
  }

  /**
   * Detect compliance requirements
   */
  async detectCompliance(original, domain) {
    return {
      required: COMPLIANCE_REQUIREMENTS[domain] || COMPLIANCE_REQUIREMENTS.default,
      recommended: ['ISO 27001', 'SOC 2 Type II'],
      dataProtection: ['GDPR', 'CCPA']
    };
  }

  /**
   * Generate API structure suggestions
   */
  async generateAPIStructure(original, domain) {
    const baseEndpoints = [
      { method: 'POST', path: '/api/auth/register', description: 'User registration' },
      { method: 'POST', path: '/api/auth/login', description: 'User login' },
      { method: 'POST', path: '/api/auth/logout', description: 'User logout' },
      { method: 'GET', path: '/api/users/me', description: 'Get current user' },
      { method: 'PUT', path: '/api/users/me', description: 'Update current user' }
    ];

    const domainEndpoints = this.getDomainEndpoints(domain);

    return {
      version: 'v1',
      baseUrl: '/api',
      authentication: 'JWT Bearer token',
      endpoints: [...baseEndpoints, ...domainEndpoints],
      conventions: {
        naming: 'RESTful resource naming',
        pagination: 'Cursor-based pagination',
        filtering: 'Query parameters',
        sorting: '?sort=field:asc|desc',
        errors: 'RFC 7807 Problem Details'
      }
    };
  }

  /**
   * Get domain-specific endpoints
   */
  getDomainEndpoints(domain) {
    const endpoints = {
      ecommerce: [
        { method: 'GET', path: '/api/products', description: 'List products' },
        { method: 'GET', path: '/api/products/:id', description: 'Get product' },
        { method: 'POST', path: '/api/cart', description: 'Add to cart' },
        { method: 'GET', path: '/api/cart', description: 'Get cart' },
        { method: 'POST', path: '/api/orders', description: 'Create order' },
        { method: 'GET', path: '/api/orders', description: 'List orders' },
        { method: 'POST', path: '/api/payments', description: 'Process payment' }
      ],
      social: [
        { method: 'GET', path: '/api/feed', description: 'Get news feed' },
        { method: 'POST', path: '/api/posts', description: 'Create post' },
        { method: 'POST', path: '/api/posts/:id/like', description: 'Like post' },
        { method: 'POST', path: '/api/posts/:id/comment', description: 'Comment on post' },
        { method: 'POST', path: '/api/users/:id/follow', description: 'Follow user' },
        { method: 'GET', path: '/api/notifications', description: 'Get notifications' }
      ],
      fintech: [
        { method: 'GET', path: '/api/accounts', description: 'List accounts' },
        { method: 'GET', path: '/api/accounts/:id/balance', description: 'Get balance' },
        { method: 'POST', path: '/api/transactions', description: 'Create transaction' },
        { method: 'GET', path: '/api/transactions', description: 'List transactions' },
        { method: 'POST', path: '/api/transfers', description: 'Transfer funds' }
      ]
    };

    return endpoints[domain] || [];
  }

  /**
   * Generate database schema suggestions
   */
  async generateDatabaseSchema(original, domain) {
    const baseModels = [
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'UUID', primary: true },
          { name: 'email', type: 'VARCHAR(255)', unique: true },
          { name: 'password_hash', type: 'VARCHAR(255)' },
          { name: 'created_at', type: 'TIMESTAMP' },
          { name: 'updated_at', type: 'TIMESTAMP' }
        ]
      }
    ];

    const domainModels = this.getDomainModels(domain);

    return {
      type: 'PostgreSQL',
      models: [...baseModels, ...domainModels],
      indexes: this.suggestIndexes(domain),
      relationships: this.suggestRelationships(domain)
    };
  }

  /**
   * Get domain-specific database models
   */
  getDomainModels(domain) {
    const models = {
      ecommerce: [
        {
          name: 'Product',
          fields: [
            { name: 'id', type: 'UUID', primary: true },
            { name: 'name', type: 'VARCHAR(255)' },
            { name: 'description', type: 'TEXT' },
            { name: 'price', type: 'DECIMAL(10,2)' },
            { name: 'stock', type: 'INTEGER' },
            { name: 'category_id', type: 'UUID', foreign: 'Category.id' }
          ]
        },
        {
          name: 'Order',
          fields: [
            { name: 'id', type: 'UUID', primary: true },
            { name: 'user_id', type: 'UUID', foreign: 'User.id' },
            { name: 'status', type: 'VARCHAR(50)' },
            { name: 'total', type: 'DECIMAL(10,2)' },
            { name: 'created_at', type: 'TIMESTAMP' }
          ]
        }
      ],
      social: [
        {
          name: 'Post',
          fields: [
            { name: 'id', type: 'UUID', primary: true },
            { name: 'user_id', type: 'UUID', foreign: 'User.id' },
            { name: 'content', type: 'TEXT' },
            { name: 'created_at', type: 'TIMESTAMP' }
          ]
        },
        {
          name: 'Follow',
          fields: [
            { name: 'follower_id', type: 'UUID', foreign: 'User.id' },
            { name: 'following_id', type: 'UUID', foreign: 'User.id' },
            { name: 'created_at', type: 'TIMESTAMP' }
          ]
        }
      ]
    };

    return models[domain] || [];
  }

  /**
   * Suggest database indexes
   */
  suggestIndexes(domain) {
    return [
      { table: 'users', columns: ['email'], type: 'UNIQUE' },
      { table: 'users', columns: ['created_at'], type: 'BTREE' }
    ];
  }

  /**
   * Suggest relationships
   */
  suggestRelationships(domain) {
    return [];
  }

  /**
   * Generate non-functional requirements
   */
  generateNFRs(domain) {
    return {
      performance: {
        responseTime: 'P95 < 200ms for API calls',
        throughput: '1000 requests/second minimum',
        availability: '99.9% uptime SLA'
      },
      scalability: {
        horizontal: 'Support auto-scaling 1-100 instances',
        database: 'Support read replicas',
        caching: 'Multi-layer caching (CDN, Redis, application)'
      },
      reliability: {
        recovery: 'RPO < 1 hour, RTO < 4 hours',
        backup: 'Daily automated backups with 30-day retention',
        monitoring: 'Real-time alerting on errors and performance'
      },
      maintainability: {
        documentation: 'API docs auto-generated from code',
        logging: 'Structured logging with correlation IDs',
        testing: '80%+ code coverage requirement'
      }
    };
  }

  /**
   * Generate complete specification document
   */
  async generateCompleteSpec(enhanced) {
    const lines = [];

    // Header
    lines.push(`# ${enhanced.original.title} - Technical Specification`);
    lines.push('');
    lines.push(`> Auto-generated specification from ${enhanced.metadata.originalLines}-line README`);
    lines.push(`> Domain: ${enhanced.metadata.domain} | Generated: ${enhanced.metadata.amplifiedAt}`);
    lines.push('');

    // Executive Summary
    lines.push('## 1. Executive Summary');
    lines.push('');
    lines.push(enhanced.original.description || 'No description provided');
    lines.push('');

    // Technology Stack
    lines.push('## 2. Technology Stack');
    lines.push('');
    lines.push('### 2.1 Backend');
    enhanced.techStack.backend.forEach(tech => lines.push(`- ${tech}`));
    lines.push('');
    lines.push('### 2.2 Frontend');
    enhanced.techStack.frontend.forEach(tech => lines.push(`- ${tech}`));
    lines.push('');
    lines.push('### 2.3 Infrastructure');
    enhanced.techStack.infrastructure.forEach(tech => lines.push(`- ${tech}`));
    lines.push('');
    lines.push('### 2.4 Additional Services');
    enhanced.techStack.features.forEach(tech => lines.push(`- ${tech}`));
    lines.push('');
    lines.push('### 2.5 Stack Reasoning');
    enhanced.techStack.reasoning.forEach(reason => lines.push(`- ${reason}`));
    lines.push('');

    // Features
    lines.push('## 3. Features');
    lines.push('');
    lines.push('### 3.1 Explicit Features (from README)');
    if (enhanced.impliedFeatures.explicit.length > 0) {
      enhanced.impliedFeatures.explicit.forEach(f => lines.push(`- ${f}`));
    } else {
      lines.push('- No explicit features listed');
    }
    lines.push('');
    lines.push('### 3.2 Implied Features (auto-detected)');
    enhanced.impliedFeatures.implied.forEach(f => lines.push(`- ${f}`));
    lines.push('');

    // API Structure
    lines.push('## 4. API Design');
    lines.push('');
    lines.push(`Base URL: \`${enhanced.apiStructure.baseUrl}\``);
    lines.push(`Version: ${enhanced.apiStructure.version}`);
    lines.push(`Authentication: ${enhanced.apiStructure.authentication}`);
    lines.push('');
    lines.push('### 4.1 Endpoints');
    lines.push('');
    lines.push('| Method | Path | Description |');
    lines.push('|--------|------|-------------|');
    enhanced.apiStructure.endpoints.forEach(ep => {
      lines.push(`| ${ep.method} | \`${ep.path}\` | ${ep.description} |`);
    });
    lines.push('');
    lines.push('### 4.2 API Conventions');
    Object.entries(enhanced.apiStructure.conventions).forEach(([key, value]) => {
      lines.push(`- **${key}**: ${value}`);
    });
    lines.push('');

    // Database Schema
    lines.push('## 5. Database Schema');
    lines.push('');
    lines.push(`Database: ${enhanced.databaseSchema.type}`);
    lines.push('');
    enhanced.databaseSchema.models.forEach(model => {
      lines.push(`### ${model.name}`);
      lines.push('```sql');
      lines.push(`CREATE TABLE ${model.name.toLowerCase()}s (`);
      model.fields.forEach((field, idx) => {
        let line = `  ${field.name} ${field.type}`;
        if (field.primary) line += ' PRIMARY KEY';
        if (field.unique) line += ' UNIQUE';
        if (field.foreign) line += ` REFERENCES ${field.foreign}`;
        if (idx < model.fields.length - 1) line += ',';
        lines.push(line);
      });
      lines.push(');');
      lines.push('```');
      lines.push('');
    });

    // Security
    lines.push('## 6. Security Requirements');
    lines.push('');
    lines.push(`Priority: **${enhanced.securityRequirements.priority.toUpperCase()}**`);
    lines.push('');
    enhanced.securityRequirements.requirements.forEach(req => lines.push(`- ${req}`));
    lines.push('');

    // Compliance
    lines.push('## 7. Compliance');
    lines.push('');
    lines.push('### Required');
    enhanced.compliance.required.forEach(c => lines.push(`- ${c}`));
    lines.push('');
    lines.push('### Recommended');
    enhanced.compliance.recommended.forEach(c => lines.push(`- ${c}`));
    lines.push('');

    // Scaling
    lines.push('## 8. Scaling Strategy');
    lines.push('');
    lines.push(`- Users: ${enhanced.scalingRequirements.users}`);
    lines.push(`- Requests: ${enhanced.scalingRequirements.requests}`);
    lines.push(`- Storage: ${enhanced.scalingRequirements.storage}`);
    lines.push('');
    lines.push('### Considerations');
    enhanced.scalingRequirements.considerations.forEach(c => lines.push(`- ${c}`));
    lines.push('');

    // Best Practices
    lines.push('## 9. Best Practices');
    lines.push('');
    Object.entries(enhanced.bestPractices).forEach(([category, practices]) => {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      practices.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    });

    // Non-Functional Requirements
    lines.push('## 10. Non-Functional Requirements');
    lines.push('');
    Object.entries(enhanced.nonFunctionalRequirements).forEach(([category, reqs]) => {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      Object.entries(reqs).forEach(([key, value]) => {
        lines.push(`- **${key}**: ${value}`);
      });
      lines.push('');
    });

    // Footer
    lines.push('---');
    lines.push(`*Generated by Minions ReadmeAmplifier v2.0 in ${enhanced.metadata.processingTimeMs}ms*`);

    return lines.join('\n');
  }

  /**
   * Generate summary
   */
  generateSummary(enhanced) {
    return {
      originalLines: enhanced.metadata.originalLines,
      domain: enhanced.metadata.domain,
      explicitFeatures: enhanced.impliedFeatures.explicit.length,
      impliedFeatures: enhanced.impliedFeatures.implied.length,
      apiEndpoints: enhanced.apiStructure.endpoints.length,
      databaseModels: enhanced.databaseSchema.models.length,
      securityRequirements: enhanced.securityRequirements.requirements.length,
      complianceRequirements: enhanced.compliance.required.length,
      processingTimeMs: enhanced.metadata.processingTimeMs
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ReadmeAmplifier
 * @returns {ReadmeAmplifier}
 */
export function getReadmeAmplifier() {
  if (!instance) {
    instance = new ReadmeAmplifier();
  }
  return instance;
}

export { ReadmeAmplifier };
export default ReadmeAmplifier;
