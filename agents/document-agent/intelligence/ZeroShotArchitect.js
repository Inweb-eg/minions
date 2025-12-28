/**
 * ZeroShotArchitect - Generates complete system architecture from a single sentence
 *
 * Revolutionary Enhancement: "Build an Uber clone" → Complete architecture
 *
 * Features:
 * - Zero-shot architecture generation from description
 * - C4 diagram generation
 * - OpenAPI specification generation
 * - Database ERD generation
 * - Kubernetes manifest generation
 * - Infrastructure as Code (Terraform)
 * - CI/CD pipeline generation
 */

import { createLogger } from '../../../foundation/common/logger.js';
import { getEventBus } from '../../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

const logger = createLogger('ZeroShotArchitect');

// Architecture templates by app type
const ARCHITECTURE_TEMPLATES = {
  uber: {
    name: 'Ride-Sharing Platform',
    services: [
      { name: 'api-gateway', type: 'gateway', port: 8080 },
      { name: 'user-service', type: 'service', port: 3001 },
      { name: 'driver-service', type: 'service', port: 3002 },
      { name: 'ride-service', type: 'service', port: 3003 },
      { name: 'payment-service', type: 'service', port: 3004 },
      { name: 'notification-service', type: 'service', port: 3005 },
      { name: 'location-service', type: 'service', port: 3006 },
      { name: 'pricing-service', type: 'service', port: 3007 }
    ],
    databases: [
      { name: 'users-db', type: 'postgresql', service: 'user-service' },
      { name: 'rides-db', type: 'postgresql', service: 'ride-service' },
      { name: 'payments-db', type: 'postgresql', service: 'payment-service' },
      { name: 'locations-cache', type: 'redis', service: 'location-service' }
    ],
    queues: ['ride-events', 'payment-events', 'notifications'],
    apps: ['passenger-app', 'driver-app', 'admin-dashboard']
  },
  airbnb: {
    name: 'Property Rental Platform',
    services: [
      { name: 'api-gateway', type: 'gateway', port: 8080 },
      { name: 'user-service', type: 'service', port: 3001 },
      { name: 'listing-service', type: 'service', port: 3002 },
      { name: 'booking-service', type: 'service', port: 3003 },
      { name: 'payment-service', type: 'service', port: 3004 },
      { name: 'review-service', type: 'service', port: 3005 },
      { name: 'search-service', type: 'service', port: 3006 },
      { name: 'messaging-service', type: 'service', port: 3007 }
    ],
    databases: [
      { name: 'users-db', type: 'postgresql', service: 'user-service' },
      { name: 'listings-db', type: 'postgresql', service: 'listing-service' },
      { name: 'bookings-db', type: 'postgresql', service: 'booking-service' },
      { name: 'search-index', type: 'elasticsearch', service: 'search-service' }
    ],
    queues: ['booking-events', 'payment-events', 'notifications'],
    apps: ['guest-app', 'host-app', 'admin-dashboard']
  },
  instagram: {
    name: 'Social Media Platform',
    services: [
      { name: 'api-gateway', type: 'gateway', port: 8080 },
      { name: 'user-service', type: 'service', port: 3001 },
      { name: 'post-service', type: 'service', port: 3002 },
      { name: 'feed-service', type: 'service', port: 3003 },
      { name: 'notification-service', type: 'service', port: 3004 },
      { name: 'media-service', type: 'service', port: 3005 },
      { name: 'search-service', type: 'service', port: 3006 },
      { name: 'messaging-service', type: 'service', port: 3007 }
    ],
    databases: [
      { name: 'users-db', type: 'postgresql', service: 'user-service' },
      { name: 'posts-db', type: 'postgresql', service: 'post-service' },
      { name: 'feed-cache', type: 'redis', service: 'feed-service' },
      { name: 'media-storage', type: 's3', service: 'media-service' }
    ],
    queues: ['feed-events', 'notification-events', 'media-processing'],
    apps: ['mobile-app', 'web-app', 'admin-dashboard']
  },
  default: {
    name: 'Generic Platform',
    services: [
      { name: 'api-gateway', type: 'gateway', port: 8080 },
      { name: 'user-service', type: 'service', port: 3001 },
      { name: 'core-service', type: 'service', port: 3002 },
      { name: 'notification-service', type: 'service', port: 3003 }
    ],
    databases: [
      { name: 'main-db', type: 'postgresql', service: 'core-service' },
      { name: 'cache', type: 'redis', service: 'api-gateway' }
    ],
    queues: ['events'],
    apps: ['web-app', 'admin-dashboard']
  }
};

// Reference apps for matching
const REFERENCE_APPS = {
  uber: ['uber', 'lyft', 'taxi', 'ride', 'rideshare', 'cab', 'driver'],
  airbnb: ['airbnb', 'rental', 'property', 'vacation', 'hotel', 'booking', 'stay'],
  instagram: ['instagram', 'social', 'photo', 'feed', 'stories', 'twitter', 'tiktok'],
  amazon: ['amazon', 'ecommerce', 'shop', 'store', 'marketplace', 'ebay'],
  netflix: ['netflix', 'streaming', 'video', 'movies', 'shows', 'youtube'],
  slack: ['slack', 'chat', 'messaging', 'teams', 'discord', 'communication'],
  stripe: ['stripe', 'payment', 'fintech', 'banking', 'wallet', 'transfer']
};

class ZeroShotArchitect {
  constructor() {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;
  }

  /**
   * Initialize the architect
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.initialized = true;
      this.logger.info('ZeroShotArchitect initialized');
    } catch (error) {
      this.logger.warn('EventBus not available, running in standalone mode');
      this.initialized = true;
    }
  }

  /**
   * Generate complete architecture from a single sentence description
   * @param {string} description - Simple description like "Build an Uber clone"
   * @returns {Promise<Object>} Complete architecture with all artifacts
   */
  async generateFromSentence(description) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info(`Generating architecture from: "${description}"`);
    const startTime = Date.now();

    // Detect app type from description
    const appType = this.detectAppType(description);
    this.logger.info(`Detected app type: ${appType}`);

    // Get base template
    const template = ARCHITECTURE_TEMPLATES[appType] || ARCHITECTURE_TEMPLATES.default;

    // Customize template based on description
    const customized = this.customizeTemplate(template, description);

    // Generate all artifacts
    const architecture = {
      metadata: {
        description,
        appType,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      overview: this.generateOverview(customized, description),
      c4Diagrams: await this.generateC4(customized),
      apiSpec: await this.generateOpenAPI(customized),
      database: await this.generateERD(customized),
      kubernetes: await this.generateK8sManifests(customized),
      terraform: await this.generateInfrastructure(customized),
      cicd: await this.generatePipelines(customized),
      docker: await this.generateDockerfiles(customized)
    };

    const processingTime = Date.now() - startTime;
    architecture.metadata.processingTimeMs = processingTime;

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'zero-shot-architect',
        type: 'architecture',
        appType,
        services: customized.services.length,
        processingTimeMs: processingTime
      });
    }

    this.logger.info(`Architecture generated in ${processingTime}ms`);

    return architecture;
  }

  /**
   * Detect app type from description
   */
  detectAppType(description) {
    const descLower = description.toLowerCase();

    for (const [appType, keywords] of Object.entries(REFERENCE_APPS)) {
      if (keywords.some(keyword => descLower.includes(keyword))) {
        return appType;
      }
    }

    return 'default';
  }

  /**
   * Customize template based on description
   */
  customizeTemplate(template, description) {
    const customized = JSON.parse(JSON.stringify(template));
    const descLower = description.toLowerCase();

    // Add extra services based on keywords
    if (descLower.includes('real-time') || descLower.includes('realtime')) {
      customized.services.push({
        name: 'websocket-service',
        type: 'service',
        port: 3099
      });
    }

    if (descLower.includes('ai') || descLower.includes('ml')) {
      customized.services.push({
        name: 'ml-service',
        type: 'service',
        port: 3098
      });
    }

    if (descLower.includes('analytics')) {
      customized.services.push({
        name: 'analytics-service',
        type: 'service',
        port: 3097
      });
      customized.databases.push({
        name: 'analytics-db',
        type: 'clickhouse',
        service: 'analytics-service'
      });
    }

    return customized;
  }

  /**
   * Generate architecture overview
   */
  generateOverview(architecture, description) {
    return {
      name: architecture.name,
      description: description,
      pattern: 'Microservices',
      services: architecture.services.length,
      databases: architecture.databases.length,
      messageQueues: architecture.queues.length,
      clientApps: architecture.apps.length,
      components: {
        services: architecture.services.map(s => s.name),
        databases: architecture.databases.map(d => d.name),
        queues: architecture.queues,
        apps: architecture.apps
      }
    };
  }

  /**
   * Generate C4 diagrams (PlantUML format)
   */
  async generateC4(architecture) {
    const diagrams = {
      context: this.generateC4Context(architecture),
      container: this.generateC4Container(architecture),
      component: this.generateC4Component(architecture)
    };

    return diagrams;
  }

  /**
   * Generate C4 Context diagram
   */
  generateC4Context(architecture) {
    const lines = [
      '@startuml C4_Context',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml',
      '',
      `title System Context diagram for ${architecture.name}`,
      '',
      'Person(user, "User", "A user of the system")',
      'Person(admin, "Admin", "System administrator")',
      '',
      `System(system, "${architecture.name}", "The main system")`,
      '',
      'System_Ext(payment, "Payment Gateway", "External payment processing")',
      'System_Ext(email, "Email Service", "External email service")',
      'System_Ext(sms, "SMS Service", "External SMS service")',
      '',
      'Rel(user, system, "Uses")',
      'Rel(admin, system, "Manages")',
      'Rel(system, payment, "Processes payments")',
      'Rel(system, email, "Sends emails")',
      'Rel(system, sms, "Sends SMS")',
      '',
      '@enduml'
    ];

    return lines.join('\n');
  }

  /**
   * Generate C4 Container diagram
   */
  generateC4Container(architecture) {
    const lines = [
      '@startuml C4_Container',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml',
      '',
      `title Container diagram for ${architecture.name}`,
      '',
      'Person(user, "User", "A user of the system")',
      '',
      `System_Boundary(system, "${architecture.name}") {`
    ];

    // Add services
    architecture.services.forEach(service => {
      const type = service.type === 'gateway' ? 'API Gateway' : 'Microservice';
      lines.push(`  Container(${service.name.replace(/-/g, '_')}, "${service.name}", "Node.js", "${type}")`);
    });

    lines.push('');

    // Add databases
    architecture.databases.forEach(db => {
      const dbType = db.type === 'postgresql' ? 'PostgreSQL' :
        db.type === 'redis' ? 'Redis' :
          db.type === 'elasticsearch' ? 'Elasticsearch' : db.type;
      lines.push(`  ContainerDb(${db.name.replace(/-/g, '_')}, "${db.name}", "${dbType}", "Database")`);
    });

    lines.push('');

    // Add message queue
    if (architecture.queues.length > 0) {
      lines.push('  Container(message_queue, "Message Queue", "RabbitMQ", "Async messaging")');
    }

    lines.push('}');
    lines.push('');

    // Add relationships
    lines.push('Rel(user, api_gateway, "Uses", "HTTPS")');
    architecture.services.forEach(service => {
      if (service.type !== 'gateway') {
        lines.push(`Rel(api_gateway, ${service.name.replace(/-/g, '_')}, "Routes to", "HTTP")`);
      }
    });

    architecture.databases.forEach(db => {
      const service = db.service.replace(/-/g, '_');
      lines.push(`Rel(${service}, ${db.name.replace(/-/g, '_')}, "Reads/Writes")`);
    });

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate C4 Component diagram (for main service)
   */
  generateC4Component(architecture) {
    const lines = [
      '@startuml C4_Component',
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml',
      '',
      'title Component diagram for Core Service',
      '',
      'Container_Boundary(service, "Core Service") {',
      '  Component(controller, "Controller", "Express Router", "Handles HTTP requests")',
      '  Component(service_layer, "Service Layer", "Business Logic", "Core business rules")',
      '  Component(repository, "Repository", "Data Access", "Database operations")',
      '  Component(event_handler, "Event Handler", "Event Consumer", "Handles async events")',
      '}',
      '',
      'ContainerDb(database, "Database", "PostgreSQL", "Data storage")',
      'Container(queue, "Message Queue", "RabbitMQ", "Events")',
      '',
      'Rel(controller, service_layer, "Uses")',
      'Rel(service_layer, repository, "Uses")',
      'Rel(service_layer, event_handler, "Publishes events")',
      'Rel(repository, database, "Reads/Writes")',
      'Rel(event_handler, queue, "Subscribes/Publishes")',
      '',
      '@enduml'
    ];

    return lines.join('\n');
  }

  /**
   * Generate OpenAPI specification
   */
  async generateOpenAPI(architecture) {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: `${architecture.name} API`,
        version: '1.0.0',
        description: `API specification for ${architecture.name}`
      },
      servers: [
        { url: 'https://api.example.com/v1', description: 'Production' },
        { url: 'https://staging-api.example.com/v1', description: 'Staging' },
        { url: 'http://localhost:8080/v1', description: 'Development' }
      ],
      tags: architecture.services
        .filter(s => s.type !== 'gateway')
        .map(s => ({
          name: s.name,
          description: `${s.name} endpoints`
        })),
      paths: this.generateAPIPaths(architecture),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: this.generateAPISchemas(architecture)
      },
      security: [{ bearerAuth: [] }]
    };

    return spec;
  }

  /**
   * Generate API paths based on architecture
   */
  generateAPIPaths(architecture) {
    const paths = {
      '/health': {
        get: {
          summary: 'Health check',
          tags: ['system'],
          security: [],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/auth/register': {
        post: {
          summary: 'Register new user',
          tags: ['auth'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' }
                }
              }
            }
          }
        }
      },
      '/auth/login': {
        post: {
          summary: 'User login',
          tags: ['auth'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' }
                }
              }
            }
          }
        }
      },
      '/users/me': {
        get: {
          summary: 'Get current user',
          tags: ['users'],
          responses: {
            '200': {
              description: 'User details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        }
      }
    };

    return paths;
  }

  /**
   * Generate API schemas
   */
  generateAPISchemas(architecture) {
    return {
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' }
        }
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              totalPages: { type: 'integer' }
            }
          }
        }
      }
    };
  }

  /**
   * Generate ERD (database schema)
   */
  async generateERD(architecture) {
    const tables = [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'] },
          { name: 'email', type: 'VARCHAR(255)', constraints: ['UNIQUE', 'NOT NULL'] },
          { name: 'password_hash', type: 'VARCHAR(255)', constraints: ['NOT NULL'] },
          { name: 'name', type: 'VARCHAR(255)', constraints: ['NOT NULL'] },
          { name: 'role', type: 'VARCHAR(50)', constraints: ['DEFAULT \'user\''] },
          { name: 'status', type: 'VARCHAR(50)', constraints: ['DEFAULT \'active\''] },
          { name: 'created_at', type: 'TIMESTAMP', constraints: ['DEFAULT CURRENT_TIMESTAMP'] },
          { name: 'updated_at', type: 'TIMESTAMP', constraints: ['DEFAULT CURRENT_TIMESTAMP'] }
        ],
        indexes: [
          { name: 'idx_users_email', columns: ['email'] },
          { name: 'idx_users_status', columns: ['status'] }
        ]
      },
      {
        name: 'sessions',
        columns: [
          { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'] },
          { name: 'user_id', type: 'UUID', constraints: ['REFERENCES users(id)', 'NOT NULL'] },
          { name: 'token_hash', type: 'VARCHAR(255)', constraints: ['UNIQUE', 'NOT NULL'] },
          { name: 'expires_at', type: 'TIMESTAMP', constraints: ['NOT NULL'] },
          { name: 'created_at', type: 'TIMESTAMP', constraints: ['DEFAULT CURRENT_TIMESTAMP'] }
        ],
        indexes: [
          { name: 'idx_sessions_user', columns: ['user_id'] },
          { name: 'idx_sessions_expires', columns: ['expires_at'] }
        ]
      }
    ];

    return {
      type: 'postgresql',
      version: '15',
      tables,
      migrations: this.generateMigrations(tables),
      seedData: this.generateSeedData()
    };
  }

  /**
   * Generate database migrations
   */
  generateMigrations(tables) {
    const migrations = [];

    tables.forEach((table, idx) => {
      const migration = {
        version: `00${idx + 1}`,
        name: `create_${table.name}_table`,
        up: this.generateCreateTableSQL(table),
        down: `DROP TABLE IF EXISTS ${table.name} CASCADE;`
      };
      migrations.push(migration);
    });

    return migrations;
  }

  /**
   * Generate CREATE TABLE SQL
   */
  generateCreateTableSQL(table) {
    const lines = [`CREATE TABLE ${table.name} (`];

    table.columns.forEach((col, idx) => {
      let line = `  ${col.name} ${col.type}`;
      if (col.constraints && col.constraints.length > 0) {
        line += ' ' + col.constraints.join(' ');
      }
      if (idx < table.columns.length - 1) {
        line += ',';
      }
      lines.push(line);
    });

    lines.push(');');
    lines.push('');

    // Add indexes
    if (table.indexes) {
      table.indexes.forEach(index => {
        lines.push(`CREATE INDEX ${index.name} ON ${table.name} (${index.columns.join(', ')});`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Generate seed data
   */
  generateSeedData() {
    return {
      users: [
        {
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin'
        }
      ]
    };
  }

  /**
   * Generate Kubernetes manifests
   */
  async generateK8sManifests(architecture) {
    const manifests = {
      namespace: this.generateK8sNamespace(architecture),
      deployments: architecture.services.map(s => this.generateK8sDeployment(s)),
      services: architecture.services.map(s => this.generateK8sService(s)),
      configMaps: [this.generateK8sConfigMap(architecture)],
      secrets: [this.generateK8sSecret(architecture)],
      ingress: this.generateK8sIngress(architecture),
      hpa: architecture.services
        .filter(s => s.type !== 'gateway')
        .map(s => this.generateK8sHPA(s))
    };

    return manifests;
  }

  /**
   * Generate Kubernetes namespace
   */
  generateK8sNamespace(architecture) {
    return {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: architecture.name.toLowerCase().replace(/\s+/g, '-'),
        labels: {
          'app.kubernetes.io/name': architecture.name.toLowerCase().replace(/\s+/g, '-')
        }
      }
    };
  }

  /**
   * Generate Kubernetes deployment
   */
  generateK8sDeployment(service) {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: service.name,
        labels: {
          app: service.name
        }
      },
      spec: {
        replicas: service.type === 'gateway' ? 2 : 3,
        selector: {
          matchLabels: {
            app: service.name
          }
        },
        template: {
          metadata: {
            labels: {
              app: service.name
            }
          },
          spec: {
            containers: [{
              name: service.name,
              image: `${service.name}:latest`,
              ports: [{
                containerPort: service.port
              }],
              env: [
                { name: 'NODE_ENV', value: 'production' },
                { name: 'PORT', value: String(service.port) }
              ],
              resources: {
                requests: {
                  cpu: '100m',
                  memory: '256Mi'
                },
                limits: {
                  cpu: '500m',
                  memory: '512Mi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: service.port
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: service.port
                },
                initialDelaySeconds: 5,
                periodSeconds: 5
              }
            }]
          }
        }
      }
    };
  }

  /**
   * Generate Kubernetes service
   */
  generateK8sService(service) {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: service.name
      },
      spec: {
        selector: {
          app: service.name
        },
        ports: [{
          port: service.port,
          targetPort: service.port
        }],
        type: service.type === 'gateway' ? 'LoadBalancer' : 'ClusterIP'
      }
    };
  }

  /**
   * Generate Kubernetes ConfigMap
   */
  generateK8sConfigMap(architecture) {
    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'app-config'
      },
      data: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      }
    };
  }

  /**
   * Generate Kubernetes Secret
   */
  generateK8sSecret(architecture) {
    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'app-secrets'
      },
      type: 'Opaque',
      data: {
        JWT_SECRET: 'REPLACE_WITH_BASE64_ENCODED_SECRET',
        DB_PASSWORD: 'REPLACE_WITH_BASE64_ENCODED_PASSWORD'
      }
    };
  }

  /**
   * Generate Kubernetes Ingress
   */
  generateK8sIngress(architecture) {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'api-ingress',
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
        }
      },
      spec: {
        tls: [{
          hosts: ['api.example.com'],
          secretName: 'api-tls'
        }],
        rules: [{
          host: 'api.example.com',
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'api-gateway',
                  port: { number: 8080 }
                }
              }
            }]
          }
        }]
      }
    };
  }

  /**
   * Generate Kubernetes HPA
   */
  generateK8sHPA(service) {
    return {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: `${service.name}-hpa`
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: service.name
        },
        minReplicas: 2,
        maxReplicas: 10,
        metrics: [{
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: 70
            }
          }
        }]
      }
    };
  }

  /**
   * Generate Terraform infrastructure
   */
  async generateInfrastructure(architecture) {
    return {
      main: this.generateTerraformMain(architecture),
      variables: this.generateTerraformVariables(),
      outputs: this.generateTerraformOutputs(),
      provider: this.generateTerraformProvider()
    };
  }

  /**
   * Generate main Terraform file
   */
  generateTerraformMain(architecture) {
    return `
# Main Terraform configuration for ${architecture.name}

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = var.project_name
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"

  tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "\${var.project_name}-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 10

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
    }
  }

  tags = local.common_tags
}

# RDS PostgreSQL
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "\${var.project_name}-db"

  engine               = "postgres"
  engine_version       = "15"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100

  db_name  = var.db_name
  username = var.db_username
  port     = 5432

  vpc_security_group_ids = [module.security_group.security_group_id]
  subnet_ids             = module.vpc.private_subnets

  backup_retention_period = 7
  deletion_protection     = var.environment == "production"

  tags = local.common_tags
}

# ElastiCache Redis
module "elasticache" {
  source  = "cloudposse/elasticache-redis/aws"
  version = "~> 0.52"

  name                       = "\${var.project_name}-cache"
  vpc_id                     = module.vpc.vpc_id
  subnets                    = module.vpc.private_subnets
  cluster_size               = var.environment == "production" ? 2 : 1
  instance_type              = "cache.t3.micro"
  engine_version             = "7.0"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = local.common_tags
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
`.trim();
  }

  /**
   * Generate Terraform variables
   */
  generateTerraformVariables() {
    return `
variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (development, staging, production)"
  type        = string
  default     = "development"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "app"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "admin"
}
`.trim();
  }

  /**
   * Generate Terraform outputs
   */
  generateTerraformOutputs() {
    return `
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.endpoint
}
`.trim();
  }

  /**
   * Generate Terraform provider
   */
  generateTerraformProvider() {
    return `
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "terraform-state-bucket"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy = "Terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}
`.trim();
  }

  /**
   * Generate CI/CD pipelines
   */
  async generatePipelines(architecture) {
    return {
      githubActions: this.generateGitHubActions(architecture),
      gitlabCI: this.generateGitLabCI(architecture)
    };
  }

  /**
   * Generate GitHub Actions workflow
   */
  generateGitHubActions(architecture) {
    return `
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name \${{ vars.EKS_CLUSTER_NAME }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/api-gateway \\
            api-gateway=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
          kubectl rollout status deployment/api-gateway
`.trim();
  }

  /**
   * Generate GitLab CI configuration
   */
  generateGitLabCI(architecture) {
    return `
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2

test:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm run lint
    - npm test -- --coverage
  coverage: /All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main
    - develop

deploy_production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context production
    - kubectl set image deployment/api-gateway api-gateway=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl rollout status deployment/api-gateway
  environment:
    name: production
  only:
    - main
  when: manual
`.trim();
  }

  /**
   * Generate Dockerfiles
   */
  async generateDockerfiles(architecture) {
    const dockerfiles = {};

    architecture.services.forEach(service => {
      dockerfiles[service.name] = this.generateDockerfile(service);
    });

    dockerfiles['docker-compose'] = this.generateDockerCompose(architecture);

    return dockerfiles;
  }

  /**
   * Generate Dockerfile for a service
   */
  generateDockerfile(service) {
    return `
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs

EXPOSE ${service.port}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:${service.port}/health || exit 1

CMD ["node", "dist/index.js"]
`.trim();
  }

  /**
   * Generate Docker Compose file
   */
  generateDockerCompose(architecture) {
    const services = {};

    architecture.services.forEach(service => {
      services[service.name] = {
        build: {
          context: `./${service.name}`,
          dockerfile: 'Dockerfile'
        },
        ports: [`${service.port}:${service.port}`],
        environment: [
          'NODE_ENV=development',
          `PORT=${service.port}`
        ],
        depends_on: service.type !== 'gateway' ? ['postgres', 'redis'] : []
      };
    });

    // Add infrastructure services
    services.postgres = {
      image: 'postgres:15-alpine',
      environment: [
        'POSTGRES_USER=admin',
        'POSTGRES_PASSWORD=password',
        'POSTGRES_DB=app'
      ],
      volumes: ['postgres_data:/var/lib/postgresql/data'],
      ports: ['5432:5432']
    };

    services.redis = {
      image: 'redis:7-alpine',
      ports: ['6379:6379']
    };

    if (architecture.queues.length > 0) {
      services.rabbitmq = {
        image: 'rabbitmq:3-management-alpine',
        ports: ['5672:5672', '15672:15672']
      };
    }

    return {
      version: '3.8',
      services,
      volumes: {
        postgres_data: {}
      },
      networks: {
        default: {
          name: `${architecture.name.toLowerCase().replace(/\s+/g, '-')}-network`
        }
      }
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ZeroShotArchitect
 * @returns {ZeroShotArchitect}
 */
export function getZeroShotArchitect() {
  if (!instance) {
    instance = new ZeroShotArchitect();
  }
  return instance;
}

export { ZeroShotArchitect };
export default ZeroShotArchitect;
