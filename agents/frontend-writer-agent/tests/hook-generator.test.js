import { describe, test, expect, beforeEach } from '@jest/globals';
import { HookGenerator, getHookGenerator, HOOK_TYPE } from '../skills/hook-generator.js';

describe('HookGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new HookGenerator({ dryRun: true });
  });

  describe('HOOK_TYPE constants', () => {
    test('should define all hook types', () => {
      expect(HOOK_TYPE.STATE).toBe('state');
      expect(HOOK_TYPE.QUERY).toBe('query');
      expect(HOOK_TYPE.MUTATION).toBe('mutation');
      expect(HOOK_TYPE.SUBSCRIPTION).toBe('subscription');
      expect(HOOK_TYPE.CUSTOM).toBe('custom');
    });
  });

  describe('generate state hook', () => {
    test('should generate a state hook', async () => {
      const result = await generator.generate({
        name: 'useCounter',
        type: HOOK_TYPE.STATE,
        state: [
          { name: 'count', type: 'number', initial: '0' }
        ],
        actions: [
          { name: 'increment' },
          { name: 'decrement' },
          { name: 'reset' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const useCounter');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('const [count, setCount] = useState(0)');
      expect(result.code).toContain('increment');
      expect(result.code).toContain('decrement');
      expect(result.code).toContain('reset');
    });
  });

  describe('generate query hook', () => {
    test('should generate a React Query hook', async () => {
      const result = await generator.generate({
        name: 'useUser',
        type: HOOK_TYPE.QUERY,
        endpoint: '/api/users/:id',
        returnType: 'User',
        params: [{ name: 'id', type: 'string' }]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { useQuery } from '@tanstack/react-query'");
      expect(result.code).toContain('export const useUser');
      expect(result.code).toContain('useQuery');
      expect(result.code).toContain('/api/users');
    });

    test('should include query options', async () => {
      const result = await generator.generate({
        name: 'useUsers',
        type: HOOK_TYPE.QUERY,
        endpoint: '/api/users',
        returnType: 'User[]',
        options: {
          staleTime: 5000,
          cacheTime: 300000,
          refetchOnWindowFocus: false
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('staleTime: 5000');
      expect(result.code).toContain('cacheTime: 300000');
      expect(result.code).toContain('refetchOnWindowFocus: false');
    });

    test('should handle query with multiple params', async () => {
      const result = await generator.generate({
        name: 'useUserPosts',
        type: HOOK_TYPE.QUERY,
        endpoint: '/api/users/:userId/posts',
        returnType: 'Post[]',
        params: [
          { name: 'userId', type: 'string' },
          { name: 'limit', type: 'number' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('userId');
      expect(result.code).toContain('limit');
    });
  });

  describe('generate mutation hook', () => {
    test('should generate a mutation hook', async () => {
      const result = await generator.generate({
        name: 'useCreateUser',
        type: HOOK_TYPE.MUTATION,
        endpoint: '/api/users',
        method: 'POST',
        body: 'CreateUserInput',
        returnType: 'User'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { useMutation } from '@tanstack/react-query'");
      expect(result.code).toContain('export const useCreateUser');
      expect(result.code).toContain('useMutation');
      expect(result.code).toContain('POST');
    });

    test('should include mutation callbacks', async () => {
      const result = await generator.generate({
        name: 'useUpdateUser',
        type: HOOK_TYPE.MUTATION,
        endpoint: '/api/users/:id',
        method: 'PUT',
        body: 'UpdateUserInput',
        returnType: 'User',
        callbacks: {
          onSuccess: true,
          onError: true,
          onSettled: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('onSuccess');
      expect(result.code).toContain('onError');
      expect(result.code).toContain('onSettled');
    });

    test('should include query invalidation', async () => {
      const result = await generator.generate({
        name: 'useDeleteUser',
        type: HOOK_TYPE.MUTATION,
        endpoint: '/api/users/:id',
        method: 'DELETE',
        invalidateQueries: ['users']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('queryClient');
      expect(result.code).toContain('invalidateQueries');
      expect(result.code).toContain('users');
    });
  });

  describe('generate custom hook', () => {
    test('should generate a custom hook template', async () => {
      const result = await generator.generate({
        name: 'useLocalStorage',
        type: HOOK_TYPE.CUSTOM,
        params: [
          { name: 'key', type: 'string' },
          { name: 'initialValue', type: 'T' }
        ],
        returnType: '[T, (value: T) => void]'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const useLocalStorage');
      expect(result.code).toContain('key: string');
      expect(result.code).toContain('initialValue');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: HOOK_TYPE.STATE
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail query hook without endpoint', async () => {
      const result = await generator.generate({
        name: 'useUser',
        type: HOOK_TYPE.QUERY
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Query hook requires 'endpoint'");
    });
  });

  describe('singleton', () => {
    test('getHookGenerator should return singleton', () => {
      const gen1 = getHookGenerator();
      const gen2 = getHookGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
