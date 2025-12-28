/**
 * NaturalLanguageInterface - Understands casual project descriptions
 *
 * Revolutionary Enhancement: "Build me something like Uber for dogs" → Complete system
 *
 * Features:
 * - Understands vague and casual descriptions
 * - Extracts requirements from natural language
 * - Finds similar reference applications
 * - Expands feature descriptions
 * - Infers constraints from context
 * - Handles follow-up clarifications
 */

import { createLogger } from '../../../foundation/common/logger.js';
import { getEventBus } from '../../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

const logger = createLogger('NaturalLanguageInterface');

// Reference application knowledge base
const REFERENCE_APPS = {
  uber: {
    name: 'Uber',
    category: 'rideshare',
    coreFeatures: [
      'Real-time location tracking',
      'Driver-rider matching algorithm',
      'Dynamic pricing (surge)',
      'In-app payments',
      'Rating system',
      'Trip history',
      'ETA estimation',
      'Push notifications',
      'Multi-role apps (driver/rider)'
    ],
    techRequirements: [
      'Real-time WebSocket connections',
      'Geospatial database capabilities',
      'Payment gateway integration',
      'Background location services',
      'Push notification infrastructure'
    ],
    scale: 'Millions of concurrent users',
    complexity: 'high'
  },
  airbnb: {
    name: 'Airbnb',
    category: 'marketplace',
    coreFeatures: [
      'Property listings with rich media',
      'Search and filtering',
      'Booking calendar management',
      'Payment processing with escrow',
      'Messaging between host/guest',
      'Review system',
      'Identity verification',
      'Price recommendations'
    ],
    techRequirements: [
      'Search engine (Elasticsearch)',
      'Image/video storage and CDN',
      'Calendar availability system',
      'Payment split and escrow',
      'Verification service integration'
    ],
    scale: 'High traffic, seasonal spikes',
    complexity: 'high'
  },
  instagram: {
    name: 'Instagram',
    category: 'social',
    coreFeatures: [
      'Photo/video sharing',
      'Feed algorithm',
      'Stories (ephemeral content)',
      'Direct messaging',
      'Explore/discovery',
      'Hashtags and mentions',
      'Like/comment system',
      'Profile pages'
    ],
    techRequirements: [
      'Media processing pipeline',
      'CDN for media delivery',
      'Feed ranking algorithm',
      'Real-time messaging',
      'Notification system'
    ],
    scale: 'Billions of daily interactions',
    complexity: 'very high'
  },
  slack: {
    name: 'Slack',
    category: 'communication',
    coreFeatures: [
      'Real-time messaging',
      'Channels (public/private)',
      'Direct messages',
      'File sharing',
      'Search across messages',
      'App integrations',
      'Threads and replies',
      'Mentions and notifications'
    ],
    techRequirements: [
      'WebSocket for real-time',
      'Full-text search',
      'File storage',
      'Webhook/API for integrations',
      'Presence system'
    ],
    scale: 'High message throughput',
    complexity: 'high'
  },
  stripe: {
    name: 'Stripe',
    category: 'fintech',
    coreFeatures: [
      'Payment processing',
      'Subscription management',
      'Invoice generation',
      'Webhook notifications',
      'Dashboard and analytics',
      'API-first design',
      'Multi-currency support',
      'Fraud detection'
    ],
    techRequirements: [
      'PCI DSS compliance',
      'High availability (99.99%)',
      'Idempotent API design',
      'Audit logging',
      'Encryption everywhere'
    ],
    scale: 'Mission-critical reliability',
    complexity: 'very high'
  },
  netflix: {
    name: 'Netflix',
    category: 'streaming',
    coreFeatures: [
      'Video streaming',
      'Content catalog',
      'Recommendation engine',
      'User profiles',
      'Download for offline',
      'Adaptive bitrate streaming',
      'Watchlist',
      'Continue watching'
    ],
    techRequirements: [
      'Video transcoding pipeline',
      'Global CDN',
      'Recommendation ML models',
      'DRM protection',
      'Adaptive streaming (HLS/DASH)'
    ],
    scale: 'Global streaming infrastructure',
    complexity: 'very high'
  },
  notion: {
    name: 'Notion',
    category: 'productivity',
    coreFeatures: [
      'Block-based editor',
      'Databases with views',
      'Templates',
      'Real-time collaboration',
      'Sharing and permissions',
      'API for integrations',
      'Import/export',
      'Cross-linking'
    ],
    techRequirements: [
      'CRDT for collaboration',
      'Block storage system',
      'Permission system',
      'Real-time sync',
      'Offline support'
    ],
    scale: 'Collaborative workloads',
    complexity: 'high'
  },
  doordash: {
    name: 'DoorDash',
    category: 'delivery',
    coreFeatures: [
      'Restaurant listings',
      'Menu management',
      'Order placement',
      'Real-time order tracking',
      'Driver dispatch',
      'Payment processing',
      'Rating and reviews',
      'Promotions and discounts'
    ],
    techRequirements: [
      'Geospatial queries',
      'Real-time tracking',
      'Order state machine',
      'Driver matching algorithm',
      'Restaurant integration APIs'
    ],
    scale: 'High-volume order processing',
    complexity: 'high'
  }
};

// Feature keyword mappings
const FEATURE_KEYWORDS = {
  authentication: ['login', 'signup', 'auth', 'account', 'register', 'signin', 'sso', 'oauth'],
  realtime: ['real-time', 'realtime', 'live', 'instant', 'sync', 'websocket', 'chat', 'notifications'],
  payments: ['payment', 'pay', 'checkout', 'billing', 'subscription', 'pricing', 'money', 'transaction'],
  search: ['search', 'find', 'filter', 'sort', 'query', 'discover', 'browse', 'explore'],
  social: ['follow', 'like', 'share', 'comment', 'friend', 'feed', 'post', 'profile'],
  media: ['photo', 'video', 'image', 'upload', 'media', 'file', 'document', 'attachment'],
  location: ['location', 'map', 'gps', 'track', 'geo', 'nearby', 'distance', 'route'],
  messaging: ['message', 'chat', 'dm', 'inbox', 'conversation', 'thread', 'communicate'],
  scheduling: ['schedule', 'calendar', 'booking', 'appointment', 'reservation', 'availability'],
  ecommerce: ['cart', 'order', 'product', 'inventory', 'catalog', 'shipping', 'delivery'],
  analytics: ['analytics', 'dashboard', 'metrics', 'report', 'stats', 'insights', 'data'],
  admin: ['admin', 'manage', 'moderate', 'control', 'configure', 'settings']
};

// Constraint indicators
const CONSTRAINT_INDICATORS = {
  scale: {
    high: ['millions', 'scale', 'enterprise', 'global', 'worldwide', 'massive'],
    medium: ['thousands', 'growing', 'startup', 'business'],
    low: ['small', 'simple', 'mvp', 'prototype', 'basic']
  },
  security: {
    high: ['secure', 'hipaa', 'pci', 'compliance', 'financial', 'healthcare', 'sensitive'],
    medium: ['protected', 'private', 'authenticated'],
    low: ['public', 'open']
  },
  speed: {
    high: ['fast', 'quick', 'asap', 'urgent', 'deadline', 'mvp'],
    medium: ['reasonable', 'standard'],
    low: ['thorough', 'complete', 'comprehensive']
  }
};

// Domain modifiers (X for Y pattern)
const DOMAIN_MODIFIERS = {
  pets: ['dogs', 'cats', 'pets', 'animals', 'veterinary'],
  kids: ['kids', 'children', 'parents', 'family', 'school', 'education'],
  seniors: ['seniors', 'elderly', 'retirement', 'care'],
  fitness: ['fitness', 'gym', 'workout', 'exercise', 'health', 'wellness'],
  food: ['food', 'restaurant', 'dining', 'meal', 'cuisine', 'cooking'],
  travel: ['travel', 'vacation', 'trip', 'tourism', 'adventure'],
  business: ['business', 'b2b', 'enterprise', 'corporate', 'professional'],
  local: ['local', 'neighborhood', 'community', 'nearby']
};

class NaturalLanguageInterface {
  constructor() {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;
    this.conversationHistory = [];
  }

  /**
   * Initialize the interface
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.initialized = true;
      this.logger.info('NaturalLanguageInterface initialized');
    } catch (error) {
      this.logger.warn('EventBus not available, running in standalone mode');
      this.initialized = true;
    }
  }

  /**
   * Understand user intent from natural language
   * @param {string} userInput - Casual description like "Make it like Facebook but for dogs"
   * @returns {Promise<Object>} Structured understanding
   */
  async understandIntent(userInput) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info(`Processing input: "${userInput}"`);
    const startTime = Date.now();

    // Store in conversation history
    this.conversationHistory.push({
      type: 'user',
      content: userInput,
      timestamp: new Date().toISOString()
    });

    // Parse the input
    const parsed = {
      original: userInput,
      normalized: this.normalizeInput(userInput),
      tokens: this.tokenize(userInput)
    };

    // Extract all components
    const understanding = {
      // Core requirements
      requirements: await this.extractRequirements(parsed),

      // Reference applications
      references: await this.findSimilarApps(parsed),

      // Expanded features
      features: await this.expandFeatures(parsed),

      // Inferred constraints
      constraints: await this.inferConstraints(parsed),

      // Domain context
      domain: this.extractDomain(parsed),

      // Target users
      users: this.extractUserTypes(parsed),

      // Clarification questions
      clarifications: this.generateClarifications(parsed),

      // Confidence scores
      confidence: this.calculateConfidence(parsed)
    };

    const processingTime = Date.now() - startTime;

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'nl-interface',
        type: 'intent-understanding',
        inputLength: userInput.length,
        referencesFound: understanding.references.length,
        processingTimeMs: processingTime
      });
    }

    // Store understanding in history
    this.conversationHistory.push({
      type: 'system',
      content: understanding,
      timestamp: new Date().toISOString()
    });

    return {
      understanding,
      summary: this.generateSummary(understanding),
      nextSteps: this.suggestNextSteps(understanding),
      metadata: {
        processingTimeMs: processingTime,
        conversationTurn: Math.floor(this.conversationHistory.length / 2)
      }
    };
  }

  /**
   * Normalize input for processing
   */
  normalizeInput(input) {
    return input
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize input into meaningful parts
   */
  tokenize(input) {
    const normalized = this.normalizeInput(input);
    const words = normalized.split(' ');

    // Extract n-grams (1-3 words)
    const ngrams = [];
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
      }
    }

    return {
      words,
      ngrams,
      length: words.length
    };
  }

  /**
   * Extract requirements from natural language
   */
  async extractRequirements(parsed) {
    const requirements = {
      functional: [],
      nonFunctional: [],
      implied: []
    };

    const input = parsed.normalized;

    // Pattern: "I want/need X"
    const wantPatterns = input.match(/(?:i )?(?:want|need|looking for|require)\s+(.+?)(?:\.|,|$)/g);
    if (wantPatterns) {
      wantPatterns.forEach(match => {
        const req = match.replace(/(?:i )?(?:want|need|looking for|require)\s+/, '').trim();
        requirements.functional.push({
          text: req,
          source: 'explicit',
          confidence: 0.9
        });
      });
    }

    // Pattern: "should X" or "must X"
    const shouldPatterns = input.match(/(?:should|must|has to|needs to)\s+(.+?)(?:\.|,|$)/g);
    if (shouldPatterns) {
      shouldPatterns.forEach(match => {
        const req = match.replace(/(?:should|must|has to|needs to)\s+/, '').trim();
        requirements.functional.push({
          text: req,
          source: 'explicit',
          confidence: 0.85
        });
      });
    }

    // Extract feature-based requirements
    for (const [category, keywords] of Object.entries(FEATURE_KEYWORDS)) {
      if (keywords.some(kw => input.includes(kw))) {
        requirements.implied.push({
          category,
          text: `Implement ${category} functionality`,
          source: 'keyword-inference',
          confidence: 0.7
        });
      }
    }

    // Extract scale requirements
    if (CONSTRAINT_INDICATORS.scale.high.some(kw => input.includes(kw))) {
      requirements.nonFunctional.push({
        text: 'Must support high scale (millions of users)',
        source: 'scale-inference',
        confidence: 0.8
      });
    }

    // Extract security requirements
    if (CONSTRAINT_INDICATORS.security.high.some(kw => input.includes(kw))) {
      requirements.nonFunctional.push({
        text: 'Must implement enterprise-grade security',
        source: 'security-inference',
        confidence: 0.85
      });
    }

    return requirements;
  }

  /**
   * Find similar reference applications
   */
  async findSimilarApps(parsed) {
    const references = [];
    const input = parsed.normalized;

    // Check for explicit "like X" patterns
    const likePattern = input.match(/(?:like|similar to|clone of|copy of|inspired by)\s+(\w+)/);
    if (likePattern) {
      const appName = likePattern[1].toLowerCase();
      const matchedApp = Object.entries(REFERENCE_APPS).find(([key, app]) =>
        key === appName || app.name.toLowerCase() === appName
      );

      if (matchedApp) {
        references.push({
          ...matchedApp[1],
          matchType: 'explicit',
          confidence: 0.95,
          relevantFeatures: matchedApp[1].coreFeatures
        });
      }
    }

    // Check for category matches
    for (const [key, app] of Object.entries(REFERENCE_APPS)) {
      // Check if app name is mentioned
      if (input.includes(key) || input.includes(app.name.toLowerCase())) {
        if (!references.find(r => r.name === app.name)) {
          references.push({
            ...app,
            matchType: 'name-mention',
            confidence: 0.90,
            relevantFeatures: app.coreFeatures
          });
        }
      }

      // Check category keywords
      const categoryKeywords = {
        rideshare: ['ride', 'taxi', 'driver', 'pickup', 'drop'],
        marketplace: ['marketplace', 'buy', 'sell', 'listing', 'rental'],
        social: ['social', 'friend', 'follow', 'post', 'share'],
        communication: ['chat', 'message', 'team', 'workspace'],
        fintech: ['payment', 'money', 'bank', 'transaction'],
        streaming: ['stream', 'video', 'watch', 'content'],
        productivity: ['note', 'document', 'collaborate', 'workspace'],
        delivery: ['delivery', 'order', 'food', 'restaurant']
      };

      const keywords = categoryKeywords[app.category] || [];
      if (keywords.some(kw => input.includes(kw))) {
        if (!references.find(r => r.name === app.name)) {
          references.push({
            ...app,
            matchType: 'category-inference',
            confidence: 0.70,
            relevantFeatures: app.coreFeatures.slice(0, 5)
          });
        }
      }
    }

    return references.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Expand features based on context
   */
  async expandFeatures(parsed) {
    const features = {
      core: [],
      supporting: [],
      optional: []
    };

    const input = parsed.normalized;

    // Always include authentication
    features.core.push({
      name: 'User Authentication',
      description: 'Registration, login, password reset',
      priority: 'must-have'
    });

    // Detect and expand feature categories
    for (const [category, keywords] of Object.entries(FEATURE_KEYWORDS)) {
      if (keywords.some(kw => input.includes(kw))) {
        const categoryFeatures = this.getExpandedFeatures(category);
        features.core.push(...categoryFeatures.core);
        features.supporting.push(...categoryFeatures.supporting);
      }
    }

    // Add domain-specific features
    const domain = this.extractDomain(parsed);
    if (domain.modifier) {
      const domainFeatures = this.getDomainFeatures(domain.modifier);
      features.supporting.push(...domainFeatures);
    }

    // Deduplicate
    features.core = this.deduplicateFeatures(features.core);
    features.supporting = this.deduplicateFeatures(features.supporting);

    return features;
  }

  /**
   * Get expanded features for a category
   */
  getExpandedFeatures(category) {
    const expansions = {
      authentication: {
        core: [
          { name: 'Email/Password Login', description: 'Standard email authentication', priority: 'must-have' },
          { name: 'OAuth Social Login', description: 'Login with Google, Apple, etc.', priority: 'should-have' }
        ],
        supporting: [
          { name: 'Password Reset', description: 'Email-based password recovery', priority: 'must-have' },
          { name: 'Two-Factor Authentication', description: 'Additional security layer', priority: 'could-have' }
        ]
      },
      realtime: {
        core: [
          { name: 'WebSocket Connection', description: 'Real-time data sync', priority: 'must-have' },
          { name: 'Push Notifications', description: 'Mobile and web notifications', priority: 'should-have' }
        ],
        supporting: [
          { name: 'Presence System', description: 'Online/offline status', priority: 'could-have' },
          { name: 'Typing Indicators', description: 'Real-time typing status', priority: 'could-have' }
        ]
      },
      payments: {
        core: [
          { name: 'Payment Processing', description: 'Credit card payments via Stripe', priority: 'must-have' },
          { name: 'Order Management', description: 'Order creation and tracking', priority: 'must-have' }
        ],
        supporting: [
          { name: 'Refund Processing', description: 'Handle refunds and disputes', priority: 'should-have' },
          { name: 'Subscription Billing', description: 'Recurring payments', priority: 'could-have' }
        ]
      },
      search: {
        core: [
          { name: 'Full-text Search', description: 'Search across content', priority: 'must-have' },
          { name: 'Filtering', description: 'Filter results by criteria', priority: 'should-have' }
        ],
        supporting: [
          { name: 'Autocomplete', description: 'Search suggestions', priority: 'should-have' },
          { name: 'Faceted Search', description: 'Category-based filtering', priority: 'could-have' }
        ]
      },
      location: {
        core: [
          { name: 'Map Integration', description: 'Interactive maps', priority: 'must-have' },
          { name: 'Geolocation', description: 'User location detection', priority: 'must-have' }
        ],
        supporting: [
          { name: 'Route Planning', description: 'Navigation and directions', priority: 'should-have' },
          { name: 'Geofencing', description: 'Location-based triggers', priority: 'could-have' }
        ]
      }
    };

    return expansions[category] || { core: [], supporting: [] };
  }

  /**
   * Get domain-specific features
   */
  getDomainFeatures(modifier) {
    const domainFeatures = {
      pets: [
        { name: 'Pet Profiles', description: 'Manage pet information', priority: 'should-have' },
        { name: 'Breed Database', description: 'Pet breed information', priority: 'could-have' }
      ],
      kids: [
        { name: 'Parental Controls', description: 'Content restrictions', priority: 'must-have' },
        { name: 'Age Verification', description: 'Age-appropriate content', priority: 'must-have' }
      ],
      fitness: [
        { name: 'Activity Tracking', description: 'Track workouts and progress', priority: 'must-have' },
        { name: 'Health Metrics', description: 'Track health data', priority: 'should-have' }
      ],
      food: [
        { name: 'Menu Management', description: 'Restaurant menu system', priority: 'must-have' },
        { name: 'Dietary Filters', description: 'Filter by dietary needs', priority: 'should-have' }
      ],
      business: [
        { name: 'Team Management', description: 'Manage team members', priority: 'must-have' },
        { name: 'Roles & Permissions', description: 'Access control', priority: 'must-have' }
      ]
    };

    return domainFeatures[modifier] || [];
  }

  /**
   * Deduplicate features
   */
  deduplicateFeatures(features) {
    const seen = new Set();
    return features.filter(f => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });
  }

  /**
   * Infer constraints from input
   */
  async inferConstraints(parsed) {
    const input = parsed.normalized;
    const constraints = {
      scale: 'medium',
      security: 'medium',
      speed: 'medium',
      budget: 'medium',
      platform: [],
      integrations: []
    };

    // Infer scale
    if (CONSTRAINT_INDICATORS.scale.high.some(kw => input.includes(kw))) {
      constraints.scale = 'high';
    } else if (CONSTRAINT_INDICATORS.scale.low.some(kw => input.includes(kw))) {
      constraints.scale = 'low';
    }

    // Infer security
    if (CONSTRAINT_INDICATORS.security.high.some(kw => input.includes(kw))) {
      constraints.security = 'high';
    }

    // Infer speed/timeline
    if (CONSTRAINT_INDICATORS.speed.high.some(kw => input.includes(kw))) {
      constraints.speed = 'high';
    }

    // Detect platforms
    const platformKeywords = {
      'web': ['web', 'website', 'browser'],
      'mobile': ['mobile', 'app', 'phone', 'ios', 'android'],
      'desktop': ['desktop', 'windows', 'mac', 'electron']
    };

    for (const [platform, keywords] of Object.entries(platformKeywords)) {
      if (keywords.some(kw => input.includes(kw))) {
        constraints.platform.push(platform);
      }
    }

    // Default to web + mobile if not specified
    if (constraints.platform.length === 0) {
      constraints.platform = ['web', 'mobile'];
    }

    // Detect integrations
    const integrationKeywords = ['stripe', 'paypal', 'google', 'facebook', 'apple', 'twilio', 'sendgrid'];
    integrationKeywords.forEach(integration => {
      if (input.includes(integration)) {
        constraints.integrations.push(integration);
      }
    });

    return constraints;
  }

  /**
   * Extract domain context
   */
  extractDomain(parsed) {
    const input = parsed.normalized;
    let modifier = null;
    let base = null;

    // Check for "X for Y" pattern
    const forPattern = input.match(/(.+)\s+(?:for|but for|targeting)\s+(\w+)/);
    if (forPattern) {
      base = forPattern[1].trim();

      for (const [domain, keywords] of Object.entries(DOMAIN_MODIFIERS)) {
        if (keywords.some(kw => forPattern[2].includes(kw))) {
          modifier = domain;
          break;
        }
      }
    }

    // Determine overall category
    let category = 'general';
    const categoryPatterns = {
      rideshare: /(?:ride|taxi|driver|transport|uber|lyft)/,
      marketplace: /(?:marketplace|buy|sell|listing|rental|shop)/,
      social: /(?:social|friend|follow|share|community)/,
      saas: /(?:saas|dashboard|analytics|b2b|enterprise)/,
      delivery: /(?:delivery|food|restaurant|order)/,
      fintech: /(?:payment|bank|money|finance)/
    };

    for (const [cat, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(input)) {
        category = cat;
        break;
      }
    }

    return {
      category,
      modifier,
      base,
      description: modifier ? `${category} platform for ${modifier}` : `${category} platform`
    };
  }

  /**
   * Extract user types mentioned
   */
  extractUserTypes(parsed) {
    const input = parsed.normalized;
    const users = [];

    const userPatterns = {
      customer: /(?:customer|client|buyer|user|consumer)/,
      seller: /(?:seller|vendor|merchant|shop owner)/,
      driver: /(?:driver|courier|delivery)/,
      admin: /(?:admin|administrator|manager|moderator)/,
      guest: /(?:guest|visitor|anonymous)/
    };

    for (const [type, pattern] of Object.entries(userPatterns)) {
      if (pattern.test(input)) {
        users.push(type);
      }
    }

    // Default users if none detected
    if (users.length === 0) {
      users.push('user', 'admin');
    }

    return users;
  }

  /**
   * Generate clarification questions
   */
  generateClarifications(parsed) {
    const questions = [];
    const input = parsed.normalized;

    // Check if scale is unclear
    if (!CONSTRAINT_INDICATORS.scale.high.some(kw => input.includes(kw)) &&
        !CONSTRAINT_INDICATORS.scale.low.some(kw => input.includes(kw))) {
      questions.push({
        question: 'What scale do you expect? (thousands or millions of users)',
        type: 'scale',
        options: ['Small (< 10K users)', 'Medium (10K-100K users)', 'Large (> 100K users)']
      });
    }

    // Check if platform is unclear
    if (!input.includes('web') && !input.includes('mobile') && !input.includes('app')) {
      questions.push({
        question: 'What platforms do you need?',
        type: 'platform',
        options: ['Web only', 'Mobile only', 'Both web and mobile']
      });
    }

    // Check if timeline is unclear
    if (!CONSTRAINT_INDICATORS.speed.high.some(kw => input.includes(kw))) {
      questions.push({
        question: 'What is your timeline preference?',
        type: 'timeline',
        options: ['MVP in 2-4 weeks', 'Full product in 2-3 months', 'No rush - quality first']
      });
    }

    return questions;
  }

  /**
   * Calculate confidence scores
   */
  calculateConfidence(parsed) {
    const input = parsed.normalized;
    const scores = {
      overall: 0,
      requirements: 0,
      features: 0,
      constraints: 0
    };

    // More specific input = higher confidence
    const specificity = parsed.tokens.words.length / 20; // Normalize to 0-1
    scores.requirements = Math.min(0.9, 0.5 + specificity);

    // Reference apps found = higher feature confidence
    const hasReference = Object.keys(REFERENCE_APPS).some(key =>
      input.includes(key) || input.includes('like')
    );
    scores.features = hasReference ? 0.85 : 0.6;

    // Explicit constraints mentioned = higher confidence
    const hasConstraints = CONSTRAINT_INDICATORS.scale.high.concat(
      CONSTRAINT_INDICATORS.security.high,
      CONSTRAINT_INDICATORS.speed.high
    ).some(kw => input.includes(kw));
    scores.constraints = hasConstraints ? 0.8 : 0.5;

    // Overall confidence
    scores.overall = (scores.requirements + scores.features + scores.constraints) / 3;

    return scores;
  }

  /**
   * Generate summary of understanding
   */
  generateSummary(understanding) {
    const parts = [];

    // Domain summary
    parts.push(`Building a ${understanding.domain.description}`);

    // Reference summary
    if (understanding.references.length > 0) {
      const refs = understanding.references.map(r => r.name).join(', ');
      parts.push(`Similar to: ${refs}`);
    }

    // Feature summary
    const coreCount = understanding.features.core.length;
    parts.push(`${coreCount} core features identified`);

    // Constraint summary
    parts.push(`Scale: ${understanding.constraints.scale}, Security: ${understanding.constraints.security}`);

    // Platform summary
    parts.push(`Platforms: ${understanding.constraints.platform.join(', ')}`);

    return {
      oneLiner: parts[0],
      detailed: parts.join('. '),
      bulletPoints: parts
    };
  }

  /**
   * Suggest next steps
   */
  suggestNextSteps(understanding) {
    const steps = [];

    // If low confidence, suggest clarification
    if (understanding.confidence.overall < 0.7) {
      steps.push({
        type: 'clarification',
        action: 'Answer clarification questions to refine requirements',
        priority: 'high'
      });
    }

    // If references found, suggest review
    if (understanding.references.length > 0) {
      steps.push({
        type: 'review',
        action: 'Review reference app features and select relevant ones',
        priority: 'medium'
      });
    }

    // Always suggest amplification
    steps.push({
      type: 'amplify',
      action: 'Run README Amplifier to generate complete specification',
      priority: 'high'
    });

    // Suggest architecture generation
    steps.push({
      type: 'architect',
      action: 'Generate system architecture with Zero-Shot Architect',
      priority: 'medium'
    });

    return steps;
  }

  /**
   * Process follow-up input
   */
  async processFollowUp(followUpInput) {
    // Get previous understanding
    const previousUnderstanding = this.conversationHistory
      .filter(h => h.type === 'system')
      .pop()?.content;

    if (!previousUnderstanding) {
      return this.understandIntent(followUpInput);
    }

    // Merge new input with previous understanding
    const combined = await this.understandIntent(followUpInput);

    // Update with previous context
    combined.understanding.references = [
      ...previousUnderstanding.references,
      ...combined.understanding.references
    ].filter((r, i, arr) => arr.findIndex(x => x.name === r.name) === i);

    return combined;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.logger.info('Conversation history cleared');
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of NaturalLanguageInterface
 * @returns {NaturalLanguageInterface}
 */
export function getNaturalLanguageInterface() {
  if (!instance) {
    instance = new NaturalLanguageInterface();
  }
  return instance;
}

export { NaturalLanguageInterface };
export default NaturalLanguageInterface;
