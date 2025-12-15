import { describe, test, expect, beforeEach } from '@jest/globals';
import { ValidatorGenerator, getValidatorGenerator, VALIDATOR_LIB, FIELD_TYPE } from '../skills/validator-generator.js';

describe('ValidatorGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ValidatorGenerator({ dryRun: true });
  });

  describe('VALIDATOR_LIB constants', () => {
    test('should define all validator libraries', () => {
      expect(VALIDATOR_LIB.JOI).toBe('joi');
      expect(VALIDATOR_LIB.ZOD).toBe('zod');
    });
  });

  describe('FIELD_TYPE constants', () => {
    test('should define all field types', () => {
      expect(FIELD_TYPE.STRING).toBe('string');
      expect(FIELD_TYPE.NUMBER).toBe('number');
      expect(FIELD_TYPE.BOOLEAN).toBe('boolean');
      expect(FIELD_TYPE.EMAIL).toBe('email');
      expect(FIELD_TYPE.DATE).toBe('date');
      expect(FIELD_TYPE.ARRAY).toBe('array');
      expect(FIELD_TYPE.OBJECT).toBe('object');
    });
  });

  describe('generate Joi validator', () => {
    test('should generate Joi validation schema', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          create: [
            { field: 'email', type: 'string', rules: ['email', 'required'] },
            { field: 'password', type: 'string', rules: ['min:8', 'required'] },
            { field: 'name', type: 'string', rules: ['required'] }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const Joi = require('joi')");
      expect(result.code).toContain('Joi.string()');
      expect(result.code).toContain('.email()');
      expect(result.code).toContain('.required()');
      expect(result.code).toContain('.min(8)');
    });

    test('should generate multiple schemas', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          create: [
            { field: 'email', type: 'string', rules: ['email', 'required'] }
          ],
          update: [
            { field: 'email', type: 'string', rules: ['email'] }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('createSchema');
      expect(result.code).toContain('updateSchema');
    });

    test('should handle max rule', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          create: [
            { field: 'name', type: 'string', rules: ['max:100'] }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('.max(100)');
    });

    test('should handle number type', async () => {
      const result = await generator.generate({
        name: 'product',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          create: [
            { field: 'price', type: 'number', rules: ['required', 'min:0'] }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Joi.number()');
    });

    test('should handle boolean type', async () => {
      const result = await generator.generate({
        name: 'settings',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          update: [
            { field: 'active', type: 'boolean' }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Joi.boolean()');
    });

    test('should handle array type', async () => {
      const result = await generator.generate({
        name: 'post',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          create: [
            { field: 'tags', type: 'array', rules: ['required'] }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Joi.array()');
    });

    test('should export schemas', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.JOI,
        schemas: {
          create: []
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('module.exports');
    });
  });

  describe('generate Zod validator', () => {
    test('should generate Zod validation schema', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.ZOD,
        schemas: {
          create: [
            { field: 'email', type: 'string', rules: ['email', 'required'] },
            { field: 'name', type: 'string', rules: ['required'] }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const { z } = require('zod')");
      expect(result.code).toContain('z.string()');
      expect(result.code).toContain('.email()');
    });

    test('should handle optional fields in Zod', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.ZOD,
        schemas: {
          update: [
            { field: 'name', type: 'string' } // no required rule
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('.optional()');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        library: VALIDATOR_LIB.JOI,
        schemas: {}
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing schemas', async () => {
      const result = await generator.generate({
        name: 'user',
        library: VALIDATOR_LIB.JOI
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'schemas'");
    });
  });

  describe('singleton', () => {
    test('getValidatorGenerator should return singleton', () => {
      const gen1 = getValidatorGenerator();
      const gen2 = getValidatorGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
