import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BlocGenerator, getBlocGenerator, BLOC_TYPE } from '../skills/bloc-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('BlocGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bloc-test-'));
    generator = new BlocGenerator({ outputPath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('BLOC_TYPE constants', () => {
    test('should define all bloc types', () => {
      expect(BLOC_TYPE.BLOC).toBe('bloc');
      expect(BLOC_TYPE.CUBIT).toBe('cubit');
    });
  });

  describe('generate bloc', () => {
    test('should generate a full bloc with events and states', async () => {
      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        events: [
          { name: 'Login' },
          { name: 'Logout' },
          { name: 'CheckStatus' }
        ],
        states: [
          { name: 'AuthAuthenticated' },
          { name: 'AuthUnauthenticated' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe(BLOC_TYPE.BLOC);
      expect(result.results).toHaveLength(3); // bloc, event, state files

      // Verify files were created
      const blocPath = path.join(tempDir, 'lib/blocs/auth/auth_bloc.dart');
      const eventPath = path.join(tempDir, 'lib/blocs/auth/auth_event.dart');
      const statePath = path.join(tempDir, 'lib/blocs/auth/auth_state.dart');

      const blocContent = await fs.readFile(blocPath, 'utf-8');
      const eventContent = await fs.readFile(eventPath, 'utf-8');
      const stateContent = await fs.readFile(statePath, 'utf-8');

      // Check bloc file
      expect(blocContent).toContain('class AuthBloc extends Bloc<AuthEvent, AuthState>');
      expect(blocContent).toContain('on<Login>');
      expect(blocContent).toContain('on<Logout>');
      expect(blocContent).toContain('on<CheckStatus>');

      // Check events file
      expect(eventContent).toContain('sealed class AuthEvent');
      expect(eventContent).toContain('class Login extends AuthEvent');
      expect(eventContent).toContain('class Logout extends AuthEvent');

      // Check states file
      expect(stateContent).toContain('sealed class AuthState');
      expect(stateContent).toContain('AuthInitial');
      expect(stateContent).toContain('AuthLoading');
    });

    test('should generate event handlers as async methods', async () => {
      const result = await generator.generate({
        name: 'Counter',
        type: BLOC_TYPE.BLOC,
        events: [
          { name: 'Increment' },
          { name: 'Decrement' }
        ]
      });

      expect(result.success).toBe(true);

      const blocPath = path.join(tempDir, 'lib/blocs/counter/counter_bloc.dart');
      const blocContent = await fs.readFile(blocPath, 'utf-8');

      expect(blocContent).toContain('Future<void> _onIncrement');
      expect(blocContent).toContain('Future<void> _onDecrement');
    });

    test('should include event fields', async () => {
      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        events: [
          {
            name: 'Login',
            fields: [
              { name: 'email', type: 'String' },
              { name: 'password', type: 'String' }
            ]
          }
        ]
      });

      expect(result.success).toBe(true);

      const eventPath = path.join(tempDir, 'lib/blocs/auth/auth_event.dart');
      const eventContent = await fs.readFile(eventPath, 'utf-8');

      expect(eventContent).toContain('final String email');
      expect(eventContent).toContain('final String password');
    });

    test('should include state fields', async () => {
      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        events: [{ name: 'Login' }],
        states: [
          {
            name: 'Authenticated',
            fields: [
              { name: 'user', type: 'User' },
              { name: 'token', type: 'String' }
            ]
          }
        ]
      });

      expect(result.success).toBe(true);

      const statePath = path.join(tempDir, 'lib/blocs/auth/auth_state.dart');
      const stateContent = await fs.readFile(statePath, 'utf-8');

      expect(stateContent).toContain('final User user');
      expect(stateContent).toContain('final String token');
    });

    test('should include dependencies in constructor', async () => {
      const result = await generator.generate({
        name: 'User',
        type: BLOC_TYPE.BLOC,
        events: [{ name: 'LoadUser' }],
        dependencies: [
          { name: 'UserRepository', type: 'UserRepository' },
          { name: 'AuthService', type: 'AuthService' }
        ]
      });

      expect(result.success).toBe(true);

      const blocPath = path.join(tempDir, 'lib/blocs/user/user_bloc.dart');
      const blocContent = await fs.readFile(blocPath, 'utf-8');

      expect(blocContent).toContain('final UserRepository _userRepository');
      expect(blocContent).toContain('final AuthService _authService');
    });
  });

  describe('generate cubit', () => {
    test('should generate a cubit with state file only', async () => {
      const result = await generator.generate({
        name: 'Counter',
        type: BLOC_TYPE.CUBIT,
        methods: [
          { name: 'increment' },
          { name: 'decrement' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.type).toBe(BLOC_TYPE.CUBIT);
      expect(result.results).toHaveLength(2); // cubit and state files only

      const cubitPath = path.join(tempDir, 'lib/blocs/counter/counter_cubit.dart');
      const statePath = path.join(tempDir, 'lib/blocs/counter/counter_state.dart');

      const cubitContent = await fs.readFile(cubitPath, 'utf-8');
      const stateContent = await fs.readFile(statePath, 'utf-8');

      expect(cubitContent).toContain('class CounterCubit extends Cubit<CounterState>');
      expect(cubitContent).toContain('increment');
      expect(cubitContent).toContain('decrement');

      expect(stateContent).toContain('sealed class CounterState');
    });

    test('should generate cubit methods with parameters', async () => {
      const result = await generator.generate({
        name: 'Settings',
        type: BLOC_TYPE.CUBIT,
        methods: [
          {
            name: 'updateTheme',
            params: [{ name: 'theme', type: 'ThemeMode' }]
          }
        ]
      });

      expect(result.success).toBe(true);

      const cubitPath = path.join(tempDir, 'lib/blocs/settings/settings_cubit.dart');
      const cubitContent = await fs.readFile(cubitPath, 'utf-8');

      expect(cubitContent).toContain('updateTheme(ThemeMode theme)');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: BLOC_TYPE.BLOC,
        events: [{ name: 'Login' }]
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    test('should fail with invalid name pattern', async () => {
      const result = await generator.generate({
        name: 'invalidName', // Should start with uppercase
        type: BLOC_TYPE.BLOC,
        events: [{ name: 'Test' }]
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });

    test('should validate bloc type enum', async () => {
      const result = await generator.generate({
        name: 'Test',
        type: 'invalid_type',
        events: [{ name: 'Test' }]
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('must be one of'))).toBe(true);
    });
  });

  describe('dry run mode', () => {
    test('should not write files in dry run mode', async () => {
      const dryRunGenerator = new BlocGenerator({ dryRun: true, outputPath: tempDir });

      const result = await dryRunGenerator.generate({
        name: 'Test',
        type: BLOC_TYPE.BLOC,
        events: [{ name: 'Test' }]
      });

      expect(result.success).toBe(true);

      // Verify no files were actually created
      const blocPath = path.join(tempDir, 'lib/blocs/test/test_bloc.dart');
      await expect(fs.access(blocPath)).rejects.toThrow();
    });
  });

  describe('custom output path', () => {
    test('should use custom output path from spec', async () => {
      const customPath = 'lib/features/auth/bloc';

      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        events: [{ name: 'Login' }],
        outputPath: customPath
      });

      expect(result.success).toBe(true);

      const blocPath = path.join(tempDir, customPath, 'auth_bloc.dart');
      await expect(fs.access(blocPath)).resolves.not.toThrow();
    });
  });

  describe('singleton', () => {
    test('getBlocGenerator should return singleton', () => {
      const gen1 = getBlocGenerator();
      const gen2 = getBlocGenerator();

      expect(gen1).toBe(gen2);
    });
  });

  describe('helper methods', () => {
    test('toSnakeCase should convert PascalCase to snake_case', () => {
      expect(generator.toSnakeCase('AuthBloc')).toBe('auth_bloc');
      expect(generator.toSnakeCase('UserProfile')).toBe('user_profile');
      expect(generator.toSnakeCase('API')).toBe('a_p_i');
    });

    test('toCamelCase should convert to camelCase', () => {
      expect(generator.toCamelCase('UserRepository')).toBe('userRepository');
      expect(generator.toCamelCase('AuthService')).toBe('authService');
    });
  });
});
