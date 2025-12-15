import { describe, test, expect, beforeEach } from '@jest/globals';
import { ModelGenerator, getModelGenerator, ORM_TYPE, MONGOOSE_TYPE } from '../skills/model-generator.js';

describe('ModelGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ModelGenerator({ dryRun: true });
  });

  describe('ORM_TYPE constants', () => {
    test('should define all ORM types', () => {
      expect(ORM_TYPE.MONGOOSE).toBe('mongoose');
      expect(ORM_TYPE.SEQUELIZE).toBe('sequelize');
    });
  });

  describe('MONGOOSE_TYPE constants', () => {
    test('should define Mongoose field types', () => {
      expect(MONGOOSE_TYPE.STRING).toBe('String');
      expect(MONGOOSE_TYPE.NUMBER).toBe('Number');
      expect(MONGOOSE_TYPE.BOOLEAN).toBe('Boolean');
      expect(MONGOOSE_TYPE.DATE).toBe('Date');
      expect(MONGOOSE_TYPE.OBJECT_ID).toBe('ObjectId');
      expect(MONGOOSE_TYPE.ARRAY).toBe('Array');
      expect(MONGOOSE_TYPE.MIXED).toBe('Mixed');
    });
  });

  describe('generate Mongoose model', () => {
    test('should generate a basic Mongoose schema', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'email', type: 'string', required: true },
          { name: 'name', type: 'string', required: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const mongoose = require('mongoose')");
      expect(result.code).toContain('const userSchema = new mongoose.Schema');
      expect(result.code).toContain("email: { type: String, required: true }");
      expect(result.code).toContain("name: { type: String, required: true }");
    });

    test('should include unique constraint', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'email', type: 'string', required: true, unique: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('unique: true');
    });

    test('should include index', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'email', type: 'string', index: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('index: true');
    });

    test('should include enum values', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'role', type: 'string', enum: ['admin', 'user', 'guest'] }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("enum: ['admin', 'user', 'guest']");
    });

    test('should include default values', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'role', type: 'string', default: 'user' },
          { name: 'active', type: 'boolean', default: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("default: 'user'");
      expect(result.code).toContain('default: true');
    });

    test('should include select: false for sensitive fields', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'password', type: 'string', select: false }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('select: false');
    });

    test('should include references', async () => {
      const result = await generator.generate({
        name: 'Post',
        orm: ORM_TYPE.MONGOOSE,
        fields: [
          { name: 'author', type: 'ref', ref: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('mongoose.Schema.Types.ObjectId');
      expect(result.code).toContain("ref: 'User'");
    });

    test('should include timestamps option', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [],
        timestamps: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('timestamps: true');
    });

    test('should include instance methods', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [],
        methods: ['comparePassword', 'generateToken']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('userSchema.methods.comparePassword');
      expect(result.code).toContain('userSchema.methods.generateToken');
    });

    test('should include static methods', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: [],
        statics: ['findByEmail', 'findActive']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('userSchema.statics.findByEmail');
      expect(result.code).toContain('userSchema.statics.findActive');
    });

    test('should export model', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE,
        fields: []
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("module.exports = mongoose.model('User', userSchema)");
    });
  });

  describe('generate Sequelize model', () => {
    test('should generate a basic Sequelize model', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.SEQUELIZE,
        fields: [
          { name: 'email', type: 'string', required: true },
          { name: 'name', type: 'string', required: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('DataTypes');
      expect(result.code).toContain('sequelize.define');
      expect(result.code).toContain('DataTypes.STRING');
      expect(result.code).toContain('allowNull: false');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        orm: ORM_TYPE.MONGOOSE,
        fields: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing fields', async () => {
      const result = await generator.generate({
        name: 'User',
        orm: ORM_TYPE.MONGOOSE
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
