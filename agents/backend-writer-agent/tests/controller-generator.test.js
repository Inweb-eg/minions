import { describe, test, expect, beforeEach } from '@jest/globals';
import { ControllerGenerator, getControllerGenerator, CONTROLLER_TYPE } from '../skills/controller-generator.js';

describe('ControllerGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ControllerGenerator({ dryRun: true });
  });

  describe('CONTROLLER_TYPE constants', () => {
    test('should define all controller types', () => {
      expect(CONTROLLER_TYPE.REST).toBe('rest');
      expect(CONTROLLER_TYPE.CUSTOM).toBe('custom');
    });
  });

  describe('generate REST controller', () => {
    test('should generate a REST controller with CRUD methods', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class UserController');
      expect(result.code).toContain('async list(req, res)');
      expect(result.code).toContain('async create(req, res)');
      expect(result.code).toContain('async getById(req, res)');
      expect(result.code).toContain('async update(req, res)');
      expect(result.code).toContain('async delete(req, res)');
    });

    test('should include service dependency', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const UserService = require");
      expect(result.code).toContain('this.service');
    });

    test('should handle request body', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('req.body');
    });

    test('should handle request params', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('req.params.id');
    });

    test('should include error handling', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('try');
      expect(result.code).toContain('catch');
      expect(result.code).toContain('res.status(');
    });

    test('should return proper status codes', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('res.status(200)');
      expect(result.code).toContain('res.status(201)');
      expect(result.code).toContain('res.status(204)');
      expect(result.code).toContain('res.status(404)');
      expect(result.code).toContain('res.status(500)');
    });
  });

  describe('generate custom controller', () => {
    test('should generate controller with custom methods', async () => {
      const result = await generator.generate({
        name: 'AuthController',
        type: CONTROLLER_TYPE.CUSTOM,
        service: 'AuthService',
        methods: [
          { name: 'login', httpMethod: 'POST', path: '/login' },
          { name: 'logout', httpMethod: 'POST', path: '/logout' },
          { name: 'me', httpMethod: 'GET', path: '/me' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('async login(req, res)');
      expect(result.code).toContain('async logout(req, res)');
      expect(result.code).toContain('async me(req, res)');
    });
  });

  describe('export', () => {
    test('should export controller instance', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('module.exports = new UserController()');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: CONTROLLER_TYPE.REST,
        service: 'UserService'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing service', async () => {
      const result = await generator.generate({
        name: 'UserController',
        type: CONTROLLER_TYPE.REST
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'service'");
    });
  });

  describe('singleton', () => {
    test('getControllerGenerator should return singleton', () => {
      const gen1 = getControllerGenerator();
      const gen2 = getControllerGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
