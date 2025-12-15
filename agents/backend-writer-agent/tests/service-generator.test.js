import { describe, test, expect, beforeEach } from '@jest/globals';
import { ServiceGenerator, getServiceGenerator, SERVICE_TYPE } from '../skills/service-generator.js';

describe('ServiceGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ServiceGenerator({ dryRun: true });
  });

  describe('SERVICE_TYPE constants', () => {
    test('should define all service types', () => {
      expect(SERVICE_TYPE.CRUD).toBe('crud');
      expect(SERVICE_TYPE.CUSTOM).toBe('custom');
    });
  });

  describe('generate', () => {
    test('should generate a CRUD service', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD,
        model: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class UserService');
      expect(result.code).toContain('async findAll');
      expect(result.code).toContain('async findById');
      expect(result.code).toContain('async create');
      expect(result.code).toContain('async update');
      expect(result.code).toContain('async delete');
    });

    test('should include model import', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD,
        model: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const User = require");
    });

    test('should generate custom methods', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CUSTOM,
        model: 'User',
        methods: [
          { name: 'findByEmail', params: ['email'], returns: 'User' },
          { name: 'updatePassword', params: ['userId', 'newPassword'], returns: 'void' },
          { name: 'findActiveUsers', params: [], returns: 'User[]' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('async findByEmail(email)');
      expect(result.code).toContain('async updatePassword(userId, newPassword)');
      expect(result.code).toContain('async findActiveUsers()');
    });

    test('should include repository pattern', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD,
        model: 'User',
        useRepository: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('repository');
      expect(result.code).toContain('this.repository');
    });

    test('should include transaction support', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD,
        model: 'User',
        useTransactions: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('session');
      expect(result.code).toContain('startSession');
      expect(result.code).toContain('abortTransaction');
      expect(result.code).toContain('commitTransaction');
    });

    test('should include error handling', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD,
        model: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('try');
      expect(result.code).toContain('catch');
      expect(result.code).toContain('throw');
    });

    test('should export service class', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD,
        model: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('module.exports = UserService');
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: SERVICE_TYPE.CRUD,
        model: 'User'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing model', async () => {
      const result = await generator.generate({
        name: 'UserService',
        type: SERVICE_TYPE.CRUD
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'model'");
    });
  });

  describe('singleton', () => {
    test('getServiceGenerator should return singleton', () => {
      const gen1 = getServiceGenerator();
      const gen2 = getServiceGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
