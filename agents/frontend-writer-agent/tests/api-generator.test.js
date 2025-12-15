import { describe, test, expect, beforeEach } from '@jest/globals';
import { ApiGenerator, getApiGenerator, API_CLIENT, HTTP_METHOD } from '../skills/api-generator.js';

describe('ApiGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ApiGenerator({ dryRun: true });
  });

  describe('API_CLIENT constants', () => {
    test('should define all API clients', () => {
      expect(API_CLIENT.REACT_QUERY).toBe('react-query');
      expect(API_CLIENT.SWR).toBe('swr');
      expect(API_CLIENT.AXIOS).toBe('axios');
    });
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

  describe('generate React Query hooks', () => {
    test('should generate React Query API hooks', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.REACT_QUERY,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'useUsers', returnType: 'User[]' },
          { method: HTTP_METHOD.GET, path: '/:id', name: 'useUser', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'");
      expect(result.code).toContain('export const useUsers');
      expect(result.code).toContain('export const useUser');
      expect(result.code).toContain('useQuery');
    });

    test('should generate mutation hooks', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.REACT_QUERY,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.POST, path: '/', name: 'useCreateUser', returnType: 'User' },
          { method: HTTP_METHOD.PUT, path: '/:id', name: 'useUpdateUser', returnType: 'User' },
          { method: HTTP_METHOD.DELETE, path: '/:id', name: 'useDeleteUser', returnType: 'void' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const useCreateUser');
      expect(result.code).toContain('export const useUpdateUser');
      expect(result.code).toContain('export const useDeleteUser');
      expect(result.code).toContain('useMutation');
    });

    test('should include query keys', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.REACT_QUERY,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'useUsers', returnType: 'User[]' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('queryKey');
      expect(result.code).toContain("'users'");
    });

    test('should include query invalidation on mutation', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.REACT_QUERY,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.POST, path: '/', name: 'useCreateUser', returnType: 'User', invalidates: ['users'] }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('useQueryClient');
      expect(result.code).toContain('invalidateQueries');
    });
  });

  describe('generate SWR hooks', () => {
    test('should generate SWR hooks', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.SWR,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'useUsers', returnType: 'User[]' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import useSWR from 'swr'");
      expect(result.code).toContain('useSWR');
    });

    test('should generate SWR mutation', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.SWR,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.POST, path: '/', name: 'useCreateUser', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import useSWRMutation from 'swr/mutation'");
      expect(result.code).toContain('useSWRMutation');
    });
  });

  describe('generate Axios service', () => {
    test('should generate Axios service class', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.AXIOS,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'getUsers', returnType: 'User[]' },
          { method: HTTP_METHOD.POST, path: '/', name: 'createUser', returnType: 'User' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import axios from 'axios'");
      expect(result.code).toContain('class UsersApi');
      expect(result.code).toContain('async getUsers()');
      expect(result.code).toContain('async createUser(');
      expect(result.code).toContain('axios.get');
      expect(result.code).toContain('axios.post');
    });
  });

  describe('TypeScript types', () => {
    test('should include response types', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.REACT_QUERY,
        baseUrl: '/api/users',
        endpoints: [
          { method: HTTP_METHOD.GET, path: '/', name: 'useUsers', returnType: 'User[]' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('User[]');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        client: API_CLIENT.REACT_QUERY,
        baseUrl: '/api',
        endpoints: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing baseUrl', async () => {
      const result = await generator.generate({
        name: 'users',
        client: API_CLIENT.REACT_QUERY,
        endpoints: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'baseUrl'");
    });
  });

  describe('singleton', () => {
    test('getApiGenerator should return singleton', () => {
      const gen1 = getApiGenerator();
      const gen2 = getApiGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
