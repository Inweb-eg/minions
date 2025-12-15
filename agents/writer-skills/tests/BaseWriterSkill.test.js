import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../BaseWriterSkill.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('BaseWriterSkill', () => {
  let skill;
  let tempDir;

  beforeEach(async () => {
    skill = new BaseWriterSkill('TestWriter', {});
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'writer-test-'));
    skill.outputPath = tempDir;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('LANGUAGE constants', () => {
    test('should define all language constants', () => {
      expect(LANGUAGE.JAVASCRIPT).toBe('javascript');
      expect(LANGUAGE.TYPESCRIPT).toBe('typescript');
      expect(LANGUAGE.DART).toBe('dart');
      expect(LANGUAGE.JSON).toBe('json');
      expect(LANGUAGE.YAML).toBe('yaml');
    });
  });

  describe('GENERATION_RESULT constants', () => {
    test('should define all result constants', () => {
      expect(GENERATION_RESULT.SUCCESS).toBe('success');
      expect(GENERATION_RESULT.SKIPPED).toBe('skipped');
      expect(GENERATION_RESULT.ERROR).toBe('error');
    });
  });

  describe('template management', () => {
    test('should load and retrieve templates', () => {
      const template = 'Hello {{name}}!';
      skill.loadTemplate('greeting', template);

      const loaded = skill.templates.get('greeting');
      expect(loaded).toBe(template);
    });

    test('should render template with interpolation', () => {
      skill.loadTemplate('greeting', 'Hello {{name}}! You are {{age}} years old.');

      const result = skill.renderTemplate('greeting', { name: 'John', age: 30 });
      expect(result).toBe('Hello John! You are 30 years old.');
    });

    test('should handle missing template gracefully', () => {
      const result = skill.renderTemplate('nonexistent', {});
      expect(result).toBe('');
    });

    test('should handle missing interpolation values', () => {
      skill.loadTemplate('test', 'Hello {{name}}!');

      const result = skill.renderTemplate('test', {});
      expect(result).toBe('Hello {{name}}!');
    });
  });

  describe('validateSpec', () => {
    test('should pass validation with all required fields', () => {
      const spec = { name: 'Test', type: 'widget' };
      const result = skill.validateSpec(spec, { required: ['name', 'type'] });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation with missing required fields', () => {
      const spec = { name: 'Test' };
      const result = skill.validateSpec(spec, { required: ['name', 'type'] });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: 'type'");
    });

    test('should apply default values', () => {
      const spec = { name: 'Test' };
      const result = skill.validateSpec(spec, {
        required: ['name'],
        defaults: { type: 'default-type', count: 0 }
      });

      expect(result.valid).toBe(true);
      expect(spec.type).toBe('default-type');
      expect(spec.count).toBe(0);
    });

    test('should not override existing values with defaults', () => {
      const spec = { name: 'Test', type: 'custom' };
      skill.validateSpec(spec, {
        required: ['name'],
        defaults: { type: 'default-type' }
      });

      expect(spec.type).toBe('custom');
    });
  });

  describe('formatCode', () => {
    test('should format JavaScript code', () => {
      const code = 'function test(){return true;}';
      const formatted = skill.formatCode(code, LANGUAGE.JAVASCRIPT);

      // Should add some formatting (basic implementation)
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    test('should format TypeScript code', () => {
      const code = 'const x:number=1;';
      const formatted = skill.formatCode(code, LANGUAGE.TYPESCRIPT);

      expect(formatted).toBeTruthy();
    });

    test('should format Dart code', () => {
      const code = 'void main(){print("hello");}';
      const formatted = skill.formatCode(code, LANGUAGE.DART);

      expect(formatted).toBeTruthy();
    });

    test('should format JSON', () => {
      const code = '{"name":"test","value":123}';
      const formatted = skill.formatCode(code, LANGUAGE.JSON);

      expect(formatted).toContain('"name"');
      expect(formatted).toContain('"test"');
    });

    test('should handle invalid JSON gracefully', () => {
      const code = 'not valid json';
      const formatted = skill.formatCode(code, LANGUAGE.JSON);

      expect(formatted).toBe(code); // Returns original on error
    });
  });

  describe('file operations', () => {
    test('should write file to disk', async () => {
      const filePath = path.join(tempDir, 'test.js');
      const content = 'const x = 1;';

      await skill.writeFile(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    test('should create nested directories', async () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'test.js');
      const content = 'const x = 1;';

      await skill.writeFile(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    test('should skip writing in dryRun mode', async () => {
      skill.dryRun = true;
      const filePath = path.join(tempDir, 'dryrun.js');
      const content = 'const x = 1;';

      await skill.writeFile(filePath, content);

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    test('should read existing file', async () => {
      const filePath = path.join(tempDir, 'existing.js');
      const content = 'const x = 1;';
      await fs.writeFile(filePath, content);

      const read = await skill.readFile(filePath);
      expect(read).toBe(content);
    });

    test('should return null for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.js');

      const read = await skill.readFile(filePath);
      expect(read).toBeNull();
    });
  });

  describe('ensureDir', () => {
    test('should create directory if not exists', async () => {
      const dirPath = path.join(tempDir, 'newdir');

      await skill.ensureDir(dirPath);

      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    test('should not fail if directory already exists', async () => {
      const dirPath = path.join(tempDir, 'existingdir');
      await fs.mkdir(dirPath);

      await expect(skill.ensureDir(dirPath)).resolves.not.toThrow();
    });
  });
});
