import { describe, test, expect, beforeEach } from '@jest/globals';
import { ServiceGenerator, getServiceGenerator, HTTP_METHOD } from '../skills/service-generator.js';

describe('ServiceGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ServiceGenerator({ dryRun: true });
  });

  describe('HTTP_METHOD constants', () => {
    test('should define all HTTP methods', () => {
      expect(HTTP_METHOD.GET).toBe('GET');
      expect(HTTP_METHOD.POST).toBe('POST');
      expect(HTTP_METHOD.PUT).toBe('PUT');
      expect(HTTP_METHOD.PATCH).toBe('PATCH');
      expect(HTTP_METHOD.DELETE).toBe('DELETE');
    });
  });

  describe('generate', () => {
    test('should generate a Dio-based service', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'List<User>' },
          { method: HTTP_METHOD.GET, path: '/:id', name: 'getUser', returnType: 'User' },
          { method: HTTP_METHOD.POST, path: '/', name: 'createUser', body: 'CreateUserRequest', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class UserService');
      expect(result.code).toContain('final Dio _dio');
      expect(result.code).toContain('/api/users');
    });

    test('should generate GET method', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'List<User>' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Future<List<User>> getUsers()');
      expect(result.code).toContain('_dio.get');
    });

    test('should generate POST method with body', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.POST, path: '/', name: 'createUser', body: 'CreateUserRequest', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Future<User> createUser(CreateUserRequest body)');
      expect(result.code).toContain('_dio.post');
      expect(result.code).toContain('data: body.toJson()');
    });

    test('should generate method with path parameters', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/:id', name: 'getUser', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Future<User> getUser(String id)');
      expect(result.code).toContain('/$id');
    });

    test('should generate DELETE method', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.DELETE, path: '/:id', name: 'deleteUser', returnType: 'void' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Future<void> deleteUser(String id)');
      expect(result.code).toContain('_dio.delete');
    });

    test('should include error handling', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'List<User>' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('try');
      expect(result.code).toContain('catch');
      expect(result.code).toContain('DioException');
    });

    test('should include required imports', async () => {
      const result = await generator.generate({
        name: 'UserService',
        baseUrl: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import 'package:dio/dio.dart'");
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        baseUrl: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
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
