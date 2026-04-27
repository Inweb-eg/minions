/**
 * ConfigManager
 * -------------
 * Centralized configuration with 3-level precedence.
 * Inspired by Claude Code's layered settings system.
 *
 * Precedence (highest to lowest):
 * 1. CLI arguments / runtime overrides
 * 2. Environment variables
 * 3. Config file (minions.config.json)
 * 4. Built-in defaults
 *
 * Features:
 * - Source tracking (which level provided each value)
 * - Runtime updates via set()
 * - Config file loading (fail-open: missing file = use defaults)
 */

import { createLogger } from '../common/logger.js';
import fs from 'fs';
import path from 'path';

const logger = createLogger('ConfigManager');

/**
 * Configuration sources in precedence order (highest first)
 */
export const ConfigSource = {
  RUNTIME: 'runtime',     // set() calls, CLI overrides
  ENV: 'env',             // Environment variables
  FILE: 'file',           // minions.config.json
  DEFAULT: 'default'      // Built-in defaults
};

/**
 * Built-in defaults
 */
const DEFAULTS = {
  // Server
  port: 2505,
  fallbackPort: 8005,

  // Ollama / LLM
  ollamaHost: 'http://localhost:11434',
  ollamaModel: 'deepseek-coder:6.7b',
  geminiApiKey: '',

  // Orchestrator
  maxConcurrency: 5,
  agentTimeout: 300000,       // 5 minutes

  // Permissions
  permissionMode: 'autonomous',

  // Recovery
  maxRetries: 2,
  backoffBase: 1000,
  backoffMax: 10000,

  // Knowledge
  similarityThreshold: 0.7,
  stalenessThresholdDays: 1,

  // Logging
  logLevel: 'info',

  // Data
  dataDir: './foundation/data',
  checkpointsDir: './checkpoints'
};

/**
 * Environment variable mapping: config key → env var name
 */
const ENV_MAP = {
  port: 'MINIONS_PORT',
  ollamaHost: 'OLLAMA_HOST',
  ollamaModel: 'OLLAMA_MODEL',
  geminiApiKey: 'GEMINI_API_KEY',
  logLevel: 'LOG_LEVEL',
  maxConcurrency: 'MINIONS_MAX_CONCURRENCY',
  permissionMode: 'MINIONS_PERMISSION_MODE',
  dataDir: 'MINIONS_DATA_DIR'
};

/**
 * Type coercion for env vars (all env vars are strings)
 */
const TYPE_MAP = {
  port: 'number',
  fallbackPort: 'number',
  maxConcurrency: 'number',
  agentTimeout: 'number',
  maxRetries: 'number',
  backoffBase: 'number',
  backoffMax: 'number',
  similarityThreshold: 'number',
  stalenessThresholdDays: 'number'
};

class ConfigManager {
  constructor() {
    this.runtimeOverrides = {};    // Level 1: Runtime/CLI
    this.envValues = {};           // Level 2: Environment (cached)
    this.fileValues = {};          // Level 3: Config file
    this.defaults = { ...DEFAULTS }; // Level 4: Built-in

    this.sources = new Map();      // Track which source provided each key
    this.configFilePath = null;
    this.initialized = false;
  }

  /**
   * Initialize - load config file and cache env vars
   * @param {object} options - { configPath, cliArgs }
   */
  initialize(options = {}) {
    // Load env vars
    this._loadEnvVars();

    // Load config file
    this.configFilePath = options.configPath || this._findConfigFile();
    if (this.configFilePath) {
      this._loadConfigFile(this.configFilePath);
    }

    // Apply CLI args as runtime overrides
    if (options.cliArgs) {
      for (const [key, value] of Object.entries(options.cliArgs)) {
        if (value !== undefined && value !== null) {
          this.runtimeOverrides[key] = value;
        }
      }
    }

    // Build source tracking
    this._buildSourceMap();

    this.initialized = true;
    logger.info(`ConfigManager initialized (file: ${this.configFilePath || 'none'})`);
  }

  /**
   * Get a configuration value (respects precedence)
   * @param {string} key
   * @param {*} fallback - Optional fallback if key not found anywhere
   * @returns {*}
   */
  get(key, fallback) {
    // Precedence: runtime > env > file > defaults
    if (key in this.runtimeOverrides) return this.runtimeOverrides[key];
    if (key in this.envValues) return this.envValues[key];
    if (key in this.fileValues) return this.fileValues[key];
    if (key in this.defaults) return this.defaults[key];
    return fallback;
  }

  /**
   * Set a runtime override (highest precedence)
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this.runtimeOverrides[key] = value;
    this.sources.set(key, ConfigSource.RUNTIME);
    logger.debug(`Config override: ${key} = ${typeof value === 'string' ? value : JSON.stringify(value)} (runtime)`);
  }

  /**
   * Get all configuration as a flat object
   * @returns {object}
   */
  getAll() {
    return {
      ...this.defaults,
      ...this.fileValues,
      ...this.envValues,
      ...this.runtimeOverrides
    };
  }

  /**
   * Get the source that provided a specific key
   * @param {string} key
   * @returns {string} One of ConfigSource values
   */
  getSource(key) {
    return this.sources.get(key) || ConfigSource.DEFAULT;
  }

  /**
   * Get all values with their sources (for debugging/UI)
   * @returns {object} { key: { value, source } }
   */
  getAllWithSources() {
    const all = this.getAll();
    const result = {};
    for (const [key, value] of Object.entries(all)) {
      result[key] = { value, source: this.getSource(key) };
    }
    return result;
  }

  /**
   * Load environment variables into cache
   */
  _loadEnvVars() {
    for (const [configKey, envVar] of Object.entries(ENV_MAP)) {
      const raw = process.env[envVar];
      if (raw !== undefined && raw !== '') {
        this.envValues[configKey] = this._coerce(configKey, raw);
      }
    }
  }

  /**
   * Find config file by searching up from cwd
   * @returns {string|null}
   */
  _findConfigFile() {
    const names = ['minions.config.json', '.minionsrc.json'];
    let dir = process.cwd();

    for (let i = 0; i < 5; i++) { // Max 5 levels up
      for (const name of names) {
        const filePath = path.join(dir, name);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break; // Reached root
      dir = parent;
    }

    return null;
  }

  /**
   * Load and parse config file (fail-open: errors = empty config)
   */
  _loadConfigFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      if (typeof parsed !== 'object' || parsed === null) {
        logger.warn(`Config file is not an object: ${filePath}`);
        return;
      }

      // Flatten nested config (e.g., { orchestrator: { maxConcurrency: 3 } } → { maxConcurrency: 3 })
      this.fileValues = this._flattenConfig(parsed);
      logger.info(`Loaded config from ${filePath} (${Object.keys(this.fileValues).length} values)`);

    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`No config file at ${filePath}`);
      } else {
        logger.warn(`Failed to load config file ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Flatten nested config object to dot-free keys
   * { server: { port: 3000 } } → { port: 3000 }
   * Only flattens one level (known config keys take priority)
   */
  _flattenConfig(obj) {
    const flat = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Nested section: flatten its keys
        for (const [subKey, subValue] of Object.entries(value)) {
          if (subKey in DEFAULTS) {
            flat[subKey] = this._coerce(subKey, subValue);
          }
        }
      } else if (key in DEFAULTS) {
        flat[key] = this._coerce(key, value);
      }
    }

    return flat;
  }

  /**
   * Type coercion based on expected type
   */
  _coerce(key, value) {
    const type = TYPE_MAP[key];
    if (!type) return value;

    switch (type) {
      case 'number': {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }
      case 'boolean':
        return value === 'true' || value === true;
      default:
        return value;
    }
  }

  /**
   * Build source map for all known keys
   */
  _buildSourceMap() {
    // Start with defaults
    for (const key of Object.keys(this.defaults)) {
      this.sources.set(key, ConfigSource.DEFAULT);
    }
    // Override with file
    for (const key of Object.keys(this.fileValues)) {
      this.sources.set(key, ConfigSource.FILE);
    }
    // Override with env
    for (const key of Object.keys(this.envValues)) {
      this.sources.set(key, ConfigSource.ENV);
    }
    // Override with runtime
    for (const key of Object.keys(this.runtimeOverrides)) {
      this.sources.set(key, ConfigSource.RUNTIME);
    }
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.runtimeOverrides = {};
    this.envValues = {};
    this.fileValues = {};
    this.defaults = { ...DEFAULTS };
    this.sources.clear();
    this.configFilePath = null;
    this.initialized = false;
  }
}

// Singleton
let instance = null;

export function getConfigManager() {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

export function resetConfigManager() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default ConfigManager;
