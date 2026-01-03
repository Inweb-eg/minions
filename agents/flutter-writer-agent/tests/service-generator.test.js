import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ServiceGenerator, getServiceGenerator, HTTP_METHOD } from '../skills/service-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ServiceGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'service-test-'));
    generator = new ServiceGenerator({ outputPath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('HTTP_METHOD constants', () => {
    test('should define all HTTP methods', () => {
      expect(HTTP_METHOD.GET).toBe('get');
      expect(HTTP_METHOD.POST).toBe('post');
      expect(HTTP_METHOD.PUT).toBe('put');
      expect(HTTP_METHOD.PATCH).toBe('patch');
      expect(HTTP_METHOD.DELETE).toBe('delete');
    });
  });

  describe('generate service', () => {
    test('should generate a Dio-based service', async () => {
      const result = await generator.generate({
        name: 'UserService',
        basePath: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'List<User>' },
          { method: HTTP_METHOD.GET, path: '/:id', name: 'getUser', returnType: 'User' },
          { method: HTTP_METHOD.POST, path: '/', name: 'createUser', body: 'CreateUserRequest', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user_service.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('class UserService');
      expect(content).toContain('final Dio _dio');
      expect(content).toContain('/api/users');
    });

    test('should generate GET method', async () => {
      const result = await generator.generate({
        name: 'UserService',
        basePath: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'List<User>' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user_service.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('Future<List<User>> getUsers');
      expect(content).toContain('_dio.get');
    });

    test('should generate POST method with body', async () => {
      const result = await generator.generate({
        name: 'UserService',
        basePath: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.POST, path: '/', name: 'createUser', body: 'CreateUserRequest', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user_service.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('createUser');
      expect(content).toContain('_dio.post');
    });

    test('should generate method with path parameters', async () => {
      const result = await generator.generate({
        name: 'UserService',
        basePath: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/:id', name: 'getUser', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user_service.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('getUser');
    });

    test('should generate DELETE method', async () => {
      const result = await generator.generate({
        name: 'UserService',
        basePath: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.DELETE, path: '/:id', name: 'deleteUser', returnType: 'void' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user_service.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('deleteUser');
      expect(content).toContain('_dio.delete');
    });

    test('should include required imports', async () => {
      const result = await generator.generate({
        name: 'UserService',
        basePath: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user_service.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain("import 'package:dio/dio.dart'");
    });
  });

  describe('generate repository', () => {
    test('should generate a repository pattern', async () => {
      const result = await generator.generate({
        name: 'User',
        type: 'repository',
        basePath: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'List<User>' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/user.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('abstract class UserRepository');
      expect(content).toContain('class UserRepositoryImpl implements UserRepository');
    });
  });

  describe('generate Dio client', () => {
    test('should generate a Dio client configuration', async () => {
      const result = await generator.generate({
        name: 'DioClient',
        type: 'dioClient',
        baseUrl: 'https://api.example.com',
        connectTimeout: 15,
        receiveTimeout: 15
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/dio_client.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('class DioClient');
      expect(content).toContain('https://api.example.com');
      expect(content).toContain('LogInterceptor');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        basePath: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    test('should fail with invalid name pattern', async () => {
      const result = await generator.generate({
        name: 'invalidName', // Should start with uppercase
        basePath: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });
  });

  describe('dry run mode', () => {
    test('should not write files in dry run mode', async () => {
      const dryRunGenerator = new ServiceGenerator({ dryRun: true, outputPath: tempDir });

      const result = await dryRunGenerator.generate({
        name: 'TestService',
        basePath: '/api/test',
        endpoints: []
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/services/test_service.dart');
      await expect(fs.access(filePath)).rejects.toThrow();
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
