import { describe, test, expect, beforeEach } from '@jest/globals';
import { ModelGenerator, getModelGenerator, MODEL_TYPE } from '../skills/model-generator.js';

describe('ModelGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ModelGenerator({ dryRun: true });
  });

  describe('MODEL_TYPE constants', () => {
    test('should define all model types', () => {
      expect(MODEL_TYPE.FREEZED).toBe('freezed');
      expect(MODEL_TYPE.JSON_SERIALIZABLE).toBe('json_serializable');
      expect(MODEL_TYPE.EQUATABLE).toBe('equatable');
    });
  });

  describe('generate', () => {
    test('should generate a freezed model', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED,
        fields: [
          { name: 'id', type: 'String', required: true },
          { name: 'email', type: 'String', required: true },
          { name: 'name', type: 'String' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('@freezed');
      expect(result.code).toContain('class User with _$User');
      expect(result.code).toContain('required String id');
      expect(result.code).toContain('required String email');
      expect(result.code).toContain('String? name');
    });

    test('should generate a json_serializable model', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.JSON_SERIALIZABLE,
        fields: [
          { name: 'id', type: 'String', required: true },
          { name: 'createdAt', type: 'DateTime', jsonKey: 'created_at' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('@JsonSerializable');
      expect(result.code).toContain("@JsonKey(name: 'created_at')");
      expect(result.code).toContain('factory User.fromJson');
      expect(result.code).toContain('Map<String, dynamic> toJson()');
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
      expect(result.code).toContain("@Default('light')");
      expect(result.code).toContain('@Default(true)');
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
      expect(result.code).toContain('String? bio');
      expect(result.code).toContain('String? avatar');
    });

    test('should include part directive for generated code', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED,
        fields: [{ name: 'id', type: 'String', required: true }]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("part 'user.freezed.dart'");
      expect(result.code).toContain("part 'user.g.dart'");
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: MODEL_TYPE.FREEZED,
        fields: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing fields', async () => {
      const result = await generator.generate({
        name: 'User',
        type: MODEL_TYPE.FREEZED
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'fields'");
    });
  });

  describe('singleton', () => {
    test('getModelGenerator should return singleton', () => {
      const gen1 = getModelGenerator();
      const gen2 = getModelGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
