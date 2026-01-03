import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ModelGenerator, getModelGenerator, MODEL_TYPE } from '../skills/model-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ModelGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'model-test-'));
    generator = new ModelGenerator({ outputPath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('MODEL_TYPE constants', () => {
    test('should define all model types', () => {
      expect(MODEL_TYPE.BASIC).toBe('basic');
      expect(MODEL_TYPE.FREEZED).toBe('freezed');
      expect(MODEL_TYPE.JSON_SERIALIZABLE).toBe('jsonSerializable');
      expect(MODEL_TYPE.EQUATABLE).toBe('equatable');
    });
  });

  describe('generate freezed model', () => {
    test('should generate a freezed model', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED,
        fields: [
          { name: 'id', type: 'String' },
          { name: 'email', type: 'String' },
          { name: 'name', type: 'String', nullable: true }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/user.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('@freezed');
      expect(content).toContain('class User with _$User');
      expect(content).toContain('required String id');
      expect(content).toContain('required String email');
      expect(content).toContain('String? name');
    });

    test('should include default values', async () => {
      const result = await generator.generate({
        name: 'Settings',
        type: MODEL_TYPE.FREEZED,
        fields: [
          { name: 'theme', type: 'String', default: "'light'" },
          { name: 'notifications', type: 'bool', default: 'true' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/settings.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain("@Default('light')");
      expect(content).toContain('@Default(true)');
    });

    test('should handle nullable fields', async () => {
      const result = await generator.generate({
        name: 'Profile',
        type: MODEL_TYPE.FREEZED,
        fields: [
          { name: 'bio', type: 'String', nullable: true },
          { name: 'avatar', type: 'String', nullable: true }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/profile.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('String? bio');
      expect(content).toContain('String? avatar');
    });

    test('should include part directive for generated code', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED,
        fields: [{ name: 'id', type: 'String' }]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/user.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain("part 'user.freezed.dart'");
      expect(content).toContain("part 'user.g.dart'");
    });
  });

  describe('generate json_serializable model', () => {
    test('should generate a json_serializable model', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.JSON_SERIALIZABLE,
        fields: [
          { name: 'id', type: 'String' },
          { name: 'createdAt', type: 'DateTime', jsonKey: 'created_at' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/user.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('@JsonSerializable');
      expect(content).toContain("@JsonKey(name: 'created_at')");
      expect(content).toContain('factory User.fromJson');
      expect(content).toContain('Map<String, dynamic> toJson()');
    });
  });

  describe('generate equatable model', () => {
    test('should generate an equatable model', async () => {
      const result = await generator.generate({
        name: 'Point',
        type: MODEL_TYPE.EQUATABLE,
        fields: [
          { name: 'x', type: 'double' },
          { name: 'y', type: 'double' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/point.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('extends Equatable');
      expect(content).toContain('List<Object?> get props');
    });
  });

  describe('generate basic model', () => {
    test('should generate a basic immutable model', async () => {
      // Disable freezed default to get basic model
      const basicGenerator = new ModelGenerator({ outputPath: tempDir, useFreezed: false });

      const result = await basicGenerator.generate({
        name: 'Config',
        type: MODEL_TYPE.BASIC,
        fields: [
          { name: 'apiKey', type: 'String' },
          { name: 'timeout', type: 'int' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/config.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('@immutable');
      expect(content).toContain('class Config');
      expect(content).toContain('copyWith');
      expect(content).toContain('operator ==');
      expect(content).toContain('hashCode');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: MODEL_TYPE.FREEZED,
        fields: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    test('should fail with missing fields', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: fields');
    });

    test('should fail with invalid name pattern', async () => {
      const result = await generator.generate({
        name: 'invalidName', // Should start with uppercase
        type: MODEL_TYPE.FREEZED,
        fields: [{ name: 'id', type: 'String' }]
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });
  });

  describe('custom output path', () => {
    test('should use custom output path from spec', async () => {
      const customPath = 'lib/features/auth/models/user.dart';

      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED,
        fields: [{ name: 'id', type: 'String' }],
        outputPath: customPath
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, customPath);
      await expect(fs.access(filePath)).resolves.not.toThrow();
    });
  });

  describe('dry run mode', () => {
    test('should not write files in dry run mode', async () => {
      const dryRunGenerator = new ModelGenerator({ dryRun: true, outputPath: tempDir });

      const result = await dryRunGenerator.generate({
        name: 'Test',
        type: MODEL_TYPE.FREEZED,
        fields: [{ name: 'id', type: 'String' }]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/models/test.dart');
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('singleton', () => {
    test('getModelGenerator should return singleton', () => {
      const gen1 = getModelGenerator();
      const gen2 = getModelGenerator();

      expect(gen1).toBe(gen2);
    });
  });

  describe('helper methods', () => {
    test('toSnakeCase should convert PascalCase to snake_case', () => {
      expect(generator.toSnakeCase('UserProfile')).toBe('user_profile');
      expect(generator.toSnakeCase('Settings')).toBe('settings');
    });
  });
});
