import { jest } from '@jest/globals';
import {
  getConfigManager,
  resetConfigManager,
  ConfigSource
} from '../config/ConfigManager.js';

describe('ConfigManager', () => {
  let cm;

  beforeEach(() => {
    resetConfigManager();
    cm = getConfigManager();
  });

  afterEach(() => {
    resetConfigManager();
    // Clean up env vars we set
    delete process.env.MINIONS_PORT;
    delete process.env.OLLAMA_HOST;
    delete process.env.MINIONS_MAX_CONCURRENCY;
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      expect(getConfigManager()).toBe(cm);
    });

    it('should return fresh instance after reset', () => {
      resetConfigManager();
      expect(getConfigManager()).not.toBe(cm);
    });
  });

  describe('defaults', () => {
    it('should return default values before initialization', () => {
      cm.initialize();
      expect(cm.get('port')).toBe(2505);
      expect(cm.get('ollamaHost')).toBe('http://localhost:11434');
      expect(cm.get('maxConcurrency')).toBe(5);
      expect(cm.get('permissionMode')).toBe('autonomous');
    });

    it('should return fallback for unknown keys', () => {
      cm.initialize();
      expect(cm.get('unknown')).toBeUndefined();
      expect(cm.get('unknown', 'fallback')).toBe('fallback');
    });

    it('should track defaults as source', () => {
      cm.initialize();
      expect(cm.getSource('port')).toBe(ConfigSource.DEFAULT);
    });
  });

  describe('environment variables', () => {
    it('should read from environment', () => {
      process.env.MINIONS_PORT = '3000';
      process.env.OLLAMA_HOST = 'http://custom:11434';
      cm.initialize();

      expect(cm.get('port')).toBe(3000);
      expect(cm.get('ollamaHost')).toBe('http://custom:11434');
    });

    it('should coerce numeric env vars', () => {
      process.env.MINIONS_MAX_CONCURRENCY = '10';
      cm.initialize();
      expect(cm.get('maxConcurrency')).toBe(10);
    });

    it('should track env as source', () => {
      process.env.MINIONS_PORT = '3000';
      cm.initialize();
      expect(cm.getSource('port')).toBe(ConfigSource.ENV);
    });

    it('should override defaults with env vars', () => {
      process.env.MINIONS_PORT = '9999';
      cm.initialize();
      expect(cm.get('port')).toBe(9999);
    });
  });

  describe('CLI args / runtime overrides', () => {
    it('should apply CLI args', () => {
      cm.initialize({ cliArgs: { port: 4000 } });
      expect(cm.get('port')).toBe(4000);
    });

    it('should override env vars with CLI args', () => {
      process.env.MINIONS_PORT = '3000';
      cm.initialize({ cliArgs: { port: 4000 } });
      expect(cm.get('port')).toBe(4000);
    });

    it('should track runtime as source', () => {
      cm.initialize({ cliArgs: { port: 4000 } });
      expect(cm.getSource('port')).toBe(ConfigSource.RUNTIME);
    });

    it('should support runtime set()', () => {
      cm.initialize();
      cm.set('port', 5555);
      expect(cm.get('port')).toBe(5555);
      expect(cm.getSource('port')).toBe(ConfigSource.RUNTIME);
    });
  });

  describe('precedence order', () => {
    it('should follow runtime > env > default', () => {
      process.env.MINIONS_PORT = '3000';
      cm.initialize({ cliArgs: { port: 4000 } });

      expect(cm.get('port')).toBe(4000); // CLI wins

      // Remove runtime override to test env fallback
      delete cm.runtimeOverrides.port;
      expect(cm.get('port')).toBe(3000); // Env wins

      // Remove env to test default
      delete cm.envValues.port;
      expect(cm.get('port')).toBe(2505); // Default
    });
  });

  describe('getAll / getAllWithSources', () => {
    it('should return merged config', () => {
      process.env.MINIONS_PORT = '3000';
      cm.initialize({ cliArgs: { maxConcurrency: 10 } });

      const all = cm.getAll();
      expect(all.port).toBe(3000);
      expect(all.maxConcurrency).toBe(10);
      expect(all.ollamaHost).toBe('http://localhost:11434');
    });

    it('should return values with sources', () => {
      process.env.MINIONS_PORT = '3000';
      cm.initialize({ cliArgs: { maxConcurrency: 10 } });

      const withSources = cm.getAllWithSources();
      expect(withSources.port.value).toBe(3000);
      expect(withSources.port.source).toBe(ConfigSource.ENV);
      expect(withSources.maxConcurrency.value).toBe(10);
      expect(withSources.maxConcurrency.source).toBe(ConfigSource.RUNTIME);
      expect(withSources.ollamaHost.source).toBe(ConfigSource.DEFAULT);
    });
  });

  describe('config file', () => {
    it('should handle missing config file gracefully', () => {
      cm.initialize({ configPath: '/nonexistent/path.json' });
      expect(cm.get('port')).toBe(2505); // Falls back to default
    });
  });
});
