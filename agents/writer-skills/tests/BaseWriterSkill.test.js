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
      expect(LANGUAGE.HTML).toBe('html');
      expect(LANGUAGE.CSS).toBe('css');
    });
  });

  describe('GENERATION_RESULT constants', () => {
    test('should define all result constants', () => {
      expect(GENERATION_RESULT.CREATED).toBe('created');
      expect(GENERATION_RESULT.UPDATED).toBe('updated');
      expect(GENERATION_RESULT.SKIPPED).toBe('skipped');
      expect(GENERATION_RESULT.FAILED).toBe('failed');
    });
  });

  describe('template management', () => {
    test('should register and retrieve templates', () => {
      const template = 'Hello {{name}}!';
      skill.registerTemplate('greeting', template);

      const loaded = skill.templates.get('greeting');
      expect(loaded).toBe(template);
    });

    test('should check template existence with hasTemplate', () => {
      skill.registerTemplate('exists', 'template content');

      expect(skill.hasTemplate('exists')).toBe(true);
      expect(skill.hasTemplate('nonexistent')).toBe(false);
    });

    test('should get template by name', () => {
      const template = 'Hello {{name}}!';
      skill.registerTemplate('greeting', template);

      expect(skill.getTemplate('greeting')).toBe(template);
    });

    test('should throw error for missing template in getTemplate', () => {
      expect(() => skill.getTemplate('nonexistent')).toThrow('Template not found: nonexistent');
    });

    test('should render template with string interpolation', () => {
      skill.registerTemplate('greeting', 'Hello {{name}}! You are {{age}} years old.');

      const result = skill.renderTemplate('greeting', { name: 'John', age: 30 });
      expect(result).toBe('Hello John! You are 30 years old.');
    });

    test('should render template with function', () => {
      skill.registerTemplate('dynamic', (data) => `Hello ${data.name}!`);

      const result = skill.renderTemplate('dynamic', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    test('should throw error for missing template in renderTemplate', () => {
      expect(() => skill.renderTemplate('nonexistent', {})).toThrow('Template not found: nonexistent');
    });

    test('should preserve unmatched interpolation placeholders', () => {
      skill.registerTemplate('test', 'Hello {{name}}! Age: {{age}}');

      const result = skill.renderTemplate('test', { name: 'John' });
      expect(result).toBe('Hello John! Age: {{age}}');
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
      expect(result.errors).toContain('Missing required field: type');
    });

    test('should validate field types', () => {
      const spec = { name: 123, count: 'not-a-number' };
      const schema = {
        properties: {
          name: { type: 'string' },
          count: { type: 'number' }
        }
      };
      const result = skill.validateSpec(spec, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate enum values', () => {
      const spec = { status: 'invalid' };
      const schema = {
        properties: {
          status: { enum: ['active', 'inactive'] }
        }
      };
      const result = skill.validateSpec(spec, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be one of'))).toBe(true);
    });

    test('should validate pattern matching', () => {
      const spec = { email: 'invalid-email' };
      const schema = {
        properties: {
          email: { pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' }
        }
      };
      const result = skill.validateSpec(spec, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });

    test('should pass validation with valid pattern', () => {
      const spec = { email: 'test@example.com' };
      const schema = {
        properties: {
          email: { pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' }
        }
      };
      const result = skill.validateSpec(spec, schema);

      expect(result.valid).toBe(true);
    });
  });

  describe('formatCode', () => {
    test('should format JavaScript code', () => {
      const code = 'function test(){return true;}';
      const formatted = skill.formatCode(code, LANGUAGE.JAVASCRIPT);

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
      expect(formatted.endsWith('\n')).toBe(true);
    });

    test('should format TypeScript code', () => {
      const code = 'const x:number=1;';
      const formatted = skill.formatCode(code, LANGUAGE.TYPESCRIPT);

      expect(formatted).toBeTruthy();
      expect(formatted.endsWith('\n')).toBe(true);
    });

    test('should format Dart code', () => {
      const code = 'void main(){print("hello");}';
      const formatted = skill.formatCode(code, LANGUAGE.DART);

      expect(formatted).toBeTruthy();
      expect(formatted.endsWith('\n')).toBe(true);
    });

    test('should format JSON', () => {
      const code = '{"name":"test","value":123}';
      const formatted = skill.formatCode(code, LANGUAGE.JSON);

      expect(formatted).toContain('"name"');
      expect(formatted).toContain('"test"');
      expect(formatted).toContain('  '); // indentation
    });

    test('should handle invalid JSON gracefully', () => {
      const code = 'not valid json';
      const formatted = skill.formatCode(code, LANGUAGE.JSON);

      expect(formatted).toBe(code); // Returns original on error
    });

    test('should normalize line endings', () => {
      const code = 'line1\r\nline2\r\n';
      const formatted = skill.formatCode(code, LANGUAGE.JAVASCRIPT);

      expect(formatted).not.toContain('\r');
    });
  });

  describe('file operations', () => {
    test('should write file to disk', async () => {
      const filePath = path.join(tempDir, 'test.js');
      const content = 'const x = 1;';

      const result = await skill.writeFile(filePath, content);

      expect(result.success).toBe(true);
      expect(result.result).toBe(GENERATION_RESULT.CREATED);
      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    test('should create nested directories', async () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'test.js');
      const content = 'const x = 1;';

      const result = await skill.writeFile(filePath, content);

      expect(result.success).toBe(true);
      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    test('should skip writing existing files by default', async () => {
      const filePath = path.join(tempDir, 'existing.js');
      await fs.writeFile(filePath, 'original');

      const result = await skill.writeFile(filePath, 'new content');

      expect(result.success).toBe(false);
      expect(result.result).toBe(GENERATION_RESULT.SKIPPED);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('original');
    });

    test('should overwrite files when overwrite option is true', async () => {
      const filePath = path.join(tempDir, 'existing.js');
      await fs.writeFile(filePath, 'original');

      const result = await skill.writeFile(filePath, 'new content', { overwrite: true });

      expect(result.success).toBe(true);
      expect(result.result).toBe(GENERATION_RESULT.UPDATED);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    test('should skip writing in dryRun mode', async () => {
      skill.dryRun = true;
      const filePath = path.join(tempDir, 'dryrun.js');
      const content = 'const x = 1;';

      const result = await skill.writeFile(filePath, content);

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
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

    test('should check if file exists', async () => {
      const existingPath = path.join(tempDir, 'exists.js');
      await fs.writeFile(existingPath, 'content');
      const nonExistingPath = path.join(tempDir, 'not-exists.js');

      expect(await skill.fileExists(existingPath)).toBe(true);
      expect(await skill.fileExists(nonExistingPath)).toBe(false);
    });

    test('should track generated files', async () => {
      const filePath = path.join(tempDir, 'tracked.js');
      await skill.writeFile(filePath, 'content');

      const generated = skill.getGeneratedFiles();
      expect(generated.length).toBe(1);
      expect(generated[0].path).toBe(filePath);
      expect(generated[0].result).toBe(GENERATION_RESULT.CREATED);
    });

    test('should clear generated files list', async () => {
      const filePath = path.join(tempDir, 'tracked.js');
      await skill.writeFile(filePath, 'content');
      expect(skill.getGeneratedFiles().length).toBe(1);

      skill.clearGeneratedFiles();
      expect(skill.getGeneratedFiles().length).toBe(0);
    });
  });

  describe('resolvePath', () => {
    test('should return absolute paths unchanged', () => {
      const absPath = '/absolute/path/file.js';
      expect(skill.resolvePath(absPath)).toBe(absPath);
    });

    test('should resolve relative paths against outputPath', () => {
      skill.outputPath = '/base/path';
      const result = skill.resolvePath('relative/file.js');
      expect(result).toBe('/base/path/relative/file.js');
    });

    test('should resolve relative paths when no outputPath', () => {
      skill.outputPath = null;
      const result = skill.resolvePath('relative/file.js');
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('generateAndWrite', () => {
    test('should generate and write code from spec', async () => {
      skill.registerTemplate('component', (data) => `const ${data.name} = () => {};`);
      const outputFile = path.join(tempDir, 'Component.js');

      const result = await skill.generateAndWrite(
        { name: 'MyComponent' },
        'component',
        outputFile
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(outputFile, 'utf-8');
      expect(content).toContain('MyComponent');
    });

    test('should return failure for missing template', async () => {
      const outputFile = path.join(tempDir, 'output.js');

      const result = await skill.generateAndWrite({}, 'nonexistent', outputFile);

      expect(result.success).toBe(false);
      expect(result.result).toBe(GENERATION_RESULT.FAILED);
    });
  });

  describe('configuration', () => {
    test('should set output path', () => {
      skill.setOutputPath('/new/output/path');
      expect(skill.outputPath).toBe('/new/output/path');
    });

    test('should set dry run mode', () => {
      skill.setDryRun(true);
      expect(skill.dryRun).toBe(true);
    });

    test('should use default language', () => {
      expect(skill.language).toBe(LANGUAGE.JAVASCRIPT);
    });

    test('should accept custom language in constructor', () => {
      const dartSkill = new BaseWriterSkill('DartWriter', { language: LANGUAGE.DART });
      expect(dartSkill.language).toBe(LANGUAGE.DART);
    });
  });

  describe('status', () => {
    test('should return extended status with writer-specific fields', () => {
      skill.setOutputPath('/test/path');
      skill.setDryRun(true);

      const status = skill.getStatus();

      expect(status.language).toBe(LANGUAGE.JAVASCRIPT);
      expect(status.outputPath).toBe('/test/path');
      expect(status.dryRun).toBe(true);
      expect(status.generatedFilesCount).toBe(0);
    });

    test('should reset and clear generated files', async () => {
      const filePath = path.join(tempDir, 'file.js');
      await skill.writeFile(filePath, 'content');
      expect(skill.getGeneratedFiles().length).toBe(1);

      skill.reset();

      expect(skill.getGeneratedFiles().length).toBe(0);
    });
  });
});
