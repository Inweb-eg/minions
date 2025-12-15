import { describe, test, expect, beforeEach } from '@jest/globals';
import { BlocGenerator, getBlocGenerator, BLOC_TYPE } from '../skills/bloc-generator.js';

describe('BlocGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new BlocGenerator({ dryRun: true });
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
        events: ['Login', 'Logout', 'CheckStatus'],
        states: ['Initial', 'Loading', 'Authenticated', 'Unauthenticated', 'Error']
      });

      expect(result.success).toBe(true);

      // Check bloc file
      expect(result.files.bloc).toContain('class AuthBloc extends Bloc<AuthEvent, AuthState>');
      expect(result.files.bloc).toContain('on<AuthLogin>');
      expect(result.files.bloc).toContain('on<AuthLogout>');
      expect(result.files.bloc).toContain('on<AuthCheckStatus>');

      // Check events file
      expect(result.files.events).toContain('sealed class AuthEvent');
      expect(result.files.events).toContain('class AuthLogin extends AuthEvent');
      expect(result.files.events).toContain('class AuthLogout extends AuthEvent');

      // Check states file
      expect(result.files.states).toContain('sealed class AuthState');
      expect(result.files.states).toContain('class AuthInitial extends AuthState');
      expect(result.files.states).toContain('class AuthLoading extends AuthState');
      expect(result.files.states).toContain('class AuthAuthenticated extends AuthState');
    });

    test('should include event handlers', async () => {
      const result = await generator.generate({
        name: 'Counter',
        type: BLOC_TYPE.BLOC,
        events: ['Increment', 'Decrement'],
        states: ['Initial', 'Updated'],
        methods: [
          { event: 'Increment', handler: '_onIncrement' },
          { event: 'Decrement', handler: '_onDecrement' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.files.bloc).toContain('void _onIncrement');
      expect(result.files.bloc).toContain('void _onDecrement');
    });

    test('should include state properties', async () => {
      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        events: ['Login'],
        states: ['Authenticated'],
        stateProps: {
          Authenticated: [
            { name: 'user', type: 'User' },
            { name: 'token', type: 'String' }
          ]
        }
      });

      expect(result.success).toBe(true);
      expect(result.files.states).toContain('final User user');
      expect(result.files.states).toContain('final String token');
    });
  });

  describe('generate cubit', () => {
    test('should generate a cubit without events', async () => {
      const result = await generator.generate({
        name: 'Counter',
        type: BLOC_TYPE.CUBIT,
        states: ['Initial', 'Updated'],
        methods: [
          { name: 'increment' },
          { name: 'decrement' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.files.cubit).toContain('class CounterCubit extends Cubit<CounterState>');
      expect(result.files.cubit).toContain('void increment()');
      expect(result.files.cubit).toContain('void decrement()');

      // Cubit should not have events
      expect(result.files.events).toBeUndefined();
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: BLOC_TYPE.BLOC,
        events: ['Login'],
        states: ['Initial']
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail bloc without events', async () => {
      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        states: ['Initial']
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Bloc requires 'events' array");
    });

    test('should fail without states', async () => {
      const result = await generator.generate({
        name: 'Auth',
        type: BLOC_TYPE.BLOC,
        events: ['Login']
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'states'");
    });
  });

  describe('singleton', () => {
    test('getBlocGenerator should return singleton', () => {
      const gen1 = getBlocGenerator();
      const gen2 = getBlocGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
