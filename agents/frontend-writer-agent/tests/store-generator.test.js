import { describe, test, expect, beforeEach } from '@jest/globals';
import { StoreGenerator, getStoreGenerator, STORE_TYPE } from '../skills/store-generator.js';

describe('StoreGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new StoreGenerator({ dryRun: true });
  });

  describe('STORE_TYPE constants', () => {
    test('should define all store types', () => {
      expect(STORE_TYPE.CONTEXT).toBe('context');
      expect(STORE_TYPE.ZUSTAND).toBe('zustand');
      expect(STORE_TYPE.REDUX).toBe('redux');
    });
  });

  describe('generate Context store', () => {
    test('should generate React Context provider', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: STORE_TYPE.CONTEXT,
        state: [
          { name: 'user', type: 'User | null', initial: 'null' },
          { name: 'isAuthenticated', type: 'boolean', initial: 'false' }
        ],
        actions: [
          { name: 'login', params: ['credentials: LoginCredentials'], async: true },
          { name: 'logout', async: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import React, { createContext, useContext, useReducer } from 'react'");
      expect(result.code).toContain('const AuthContext = createContext');
      expect(result.code).toContain('export const AuthProvider');
      expect(result.code).toContain('export const useAuth');
      expect(result.code).toContain('useReducer');
    });

    test('should include reducer with action types', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: STORE_TYPE.CONTEXT,
        state: [{ name: 'user', type: 'User | null', initial: 'null' }],
        actions: [{ name: 'setUser', params: ['user: User'] }]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('authReducer');
      expect(result.code).toContain('SET_USER');
      expect(result.code).toContain('switch');
      expect(result.code).toContain('case');
    });

    test('should include TypeScript types', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: STORE_TYPE.CONTEXT,
        state: [
          { name: 'user', type: 'User | null', initial: 'null' }
        ],
        actions: []
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('interface AuthState');
      expect(result.code).toContain('interface AuthContextValue');
    });
  });

  describe('generate Zustand store', () => {
    test('should generate Zustand store', async () => {
      const result = await generator.generate({
        name: 'counter',
        type: STORE_TYPE.ZUSTAND,
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
      expect(result.code).toContain("import { create } from 'zustand'");
      expect(result.code).toContain('export const useCounterStore = create');
      expect(result.code).toContain('count: 0');
      expect(result.code).toContain('increment:');
      expect(result.code).toContain('decrement:');
      expect(result.code).toContain('reset:');
    });

    test('should include persist middleware', async () => {
      const result = await generator.generate({
        name: 'settings',
        type: STORE_TYPE.ZUSTAND,
        state: [{ name: 'theme', type: 'string', initial: "'light'" }],
        actions: [{ name: 'toggleTheme' }],
        persist: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { persist } from 'zustand/middleware'");
      expect(result.code).toContain('persist(');
      expect(result.code).toContain("name: 'settings-storage'");
    });

    test('should include devtools', async () => {
      const result = await generator.generate({
        name: 'counter',
        type: STORE_TYPE.ZUSTAND,
        state: [{ name: 'count', type: 'number', initial: '0' }],
        actions: [],
        devtools: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { devtools } from 'zustand/middleware'");
    });
  });

  describe('generate Redux slice', () => {
    test('should generate Redux Toolkit slice', async () => {
      const result = await generator.generate({
        name: 'counter',
        type: STORE_TYPE.REDUX,
        state: [
          { name: 'value', type: 'number', initial: '0' }
        ],
        actions: [
          { name: 'increment' },
          { name: 'decrement' },
          { name: 'incrementByAmount', params: ['amount: number'] }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { createSlice } from '@reduxjs/toolkit'");
      expect(result.code).toContain('createSlice');
      expect(result.code).toContain("name: 'counter'");
      expect(result.code).toContain('initialState');
      expect(result.code).toContain('reducers:');
      expect(result.code).toContain('increment:');
      expect(result.code).toContain('export const { increment, decrement, incrementByAmount }');
      expect(result.code).toContain('export default counterSlice.reducer');
    });

    test('should include async thunks', async () => {
      const result = await generator.generate({
        name: 'users',
        type: STORE_TYPE.REDUX,
        state: [
          { name: 'data', type: 'User[]', initial: '[]' },
          { name: 'loading', type: 'boolean', initial: 'false' }
        ],
        actions: [],
        asyncActions: [
          { name: 'fetchUsers', endpoint: '/api/users' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'");
      expect(result.code).toContain('createAsyncThunk');
      expect(result.code).toContain('fetchUsers');
      expect(result.code).toContain('extraReducers');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: STORE_TYPE.CONTEXT,
        state: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing state', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: STORE_TYPE.CONTEXT
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'state'");
    });
  });

  describe('singleton', () => {
    test('getStoreGenerator should return singleton', () => {
      const gen1 = getStoreGenerator();
      const gen2 = getStoreGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
