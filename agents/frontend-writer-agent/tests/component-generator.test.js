import { describe, test, expect, beforeEach } from '@jest/globals';
import { ComponentGenerator, getComponentGenerator, COMPONENT_TYPE, CSS_FRAMEWORK } from '../skills/component-generator.js';

describe('ComponentGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ComponentGenerator({ dryRun: true });
  });

  describe('COMPONENT_TYPE constants', () => {
    test('should define all component types', () => {
      expect(COMPONENT_TYPE.FUNCTIONAL).toBe('functional');
      expect(COMPONENT_TYPE.MEMO).toBe('memo');
    });
  });

  describe('CSS_FRAMEWORK constants', () => {
    test('should define all CSS frameworks', () => {
      expect(CSS_FRAMEWORK.TAILWIND).toBe('tailwind');
      expect(CSS_FRAMEWORK.STYLED_COMPONENTS).toBe('styled-components');
      expect(CSS_FRAMEWORK.CSS_MODULES).toBe('css-modules');
    });
  });

  describe('generate', () => {
    test('should generate a functional component', async () => {
      const result = await generator.generate({
        name: 'UserProfile',
        type: COMPONENT_TYPE.FUNCTIONAL
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import React from 'react'");
      expect(result.code).toContain('export const UserProfile');
      expect(result.code).toContain('React.FC');
    });

    test('should generate a memoized component', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: COMPONENT_TYPE.MEMO
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import React, { memo } from 'react'");
      expect(result.code).toContain('export const UserCard = memo');
    });

    test('should include TypeScript interface for props', async () => {
      const result = await generator.generate({
        name: 'UserProfile',
        type: COMPONENT_TYPE.FUNCTIONAL,
        props: [
          { name: 'userId', type: 'string', required: true },
          { name: 'onUpdate', type: '(user: User) => void' },
          { name: 'className', type: 'string' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('interface UserProfileProps');
      expect(result.code).toContain('userId: string');
      expect(result.code).toContain('onUpdate?: (user: User) => void');
      expect(result.code).toContain('className?: string');
    });

    test('should include React hooks', async () => {
      const result = await generator.generate({
        name: 'UserProfile',
        type: COMPONENT_TYPE.FUNCTIONAL,
        hooks: ['useState', 'useEffect', 'useCallback']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('useState');
      expect(result.code).toContain('useEffect');
      expect(result.code).toContain('useCallback');
    });

    test('should use Tailwind CSS classes', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: COMPONENT_TYPE.FUNCTIONAL,
        cssFramework: CSS_FRAMEWORK.TAILWIND
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('className=');
    });

    test('should use styled-components', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: COMPONENT_TYPE.FUNCTIONAL,
        cssFramework: CSS_FRAMEWORK.STYLED_COMPONENTS
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import styled from 'styled-components'");
      expect(result.code).toContain('styled.');
    });

    test('should use CSS modules', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: COMPONENT_TYPE.FUNCTIONAL,
        cssFramework: CSS_FRAMEWORK.CSS_MODULES
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import styles from './UserCard.module.css'");
      expect(result.code).toContain('styles.');
    });

    test('should generate test file', async () => {
      const result = await generator.generate({
        name: 'UserProfile',
        type: COMPONENT_TYPE.FUNCTIONAL,
        generateTest: true
      });

      expect(result.success).toBe(true);
      expect(result.testCode).toBeDefined();
      expect(result.testCode).toContain("describe('UserProfile'");
      expect(result.testCode).toContain('render');
    });

    test('should destructure props', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: COMPONENT_TYPE.FUNCTIONAL,
        props: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('{ name, age }');
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: COMPONENT_TYPE.FUNCTIONAL
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });
  });

  describe('singleton', () => {
    test('getComponentGenerator should return singleton', () => {
      const gen1 = getComponentGenerator();
      const gen2 = getComponentGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
