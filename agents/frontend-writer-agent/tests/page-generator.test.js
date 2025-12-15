import { describe, test, expect, beforeEach } from '@jest/globals';
import { PageGenerator, getPageGenerator, PAGE_TYPE, FRAMEWORK } from '../skills/page-generator.js';

describe('PageGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new PageGenerator({ dryRun: true });
  });

  describe('PAGE_TYPE constants', () => {
    test('should define all page types', () => {
      expect(PAGE_TYPE.LIST).toBe('list');
      expect(PAGE_TYPE.DETAIL).toBe('detail');
      expect(PAGE_TYPE.FORM).toBe('form');
      expect(PAGE_TYPE.DASHBOARD).toBe('dashboard');
      expect(PAGE_TYPE.CUSTOM).toBe('custom');
    });
  });

  describe('FRAMEWORK constants', () => {
    test('should define all frameworks', () => {
      expect(FRAMEWORK.REACT).toBe('react');
      expect(FRAMEWORK.NEXTJS).toBe('nextjs');
    });
  });

  describe('generate list page', () => {
    test('should generate a list page', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUsers'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const UsersPage');
      expect(result.code).toContain('useUsers');
    });

    test('should include search functionality', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUsers',
        features: ['search']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('search');
      expect(result.code).toContain('useState');
    });

    test('should include pagination', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUsers',
        features: ['pagination']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('page');
      expect(result.code).toContain('pagination');
    });

    test('should include sorting', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUsers',
        features: ['sorting']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('sort');
    });

    test('should include CRUD actions', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUsers',
        actions: ['create', 'edit', 'delete']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('handleCreate');
      expect(result.code).toContain('handleEdit');
      expect(result.code).toContain('handleDelete');
    });
  });

  describe('generate detail page', () => {
    test('should generate a detail page', async () => {
      const result = await generator.generate({
        name: 'UserDetailPage',
        type: PAGE_TYPE.DETAIL,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUser'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const UserDetailPage');
      expect(result.code).toContain('useUser');
      expect(result.code).toContain('useParams');
    });

    test('should include loading state', async () => {
      const result = await generator.generate({
        name: 'UserDetailPage',
        type: PAGE_TYPE.DETAIL,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUser'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('isLoading');
    });

    test('should include error state', async () => {
      const result = await generator.generate({
        name: 'UserDetailPage',
        type: PAGE_TYPE.DETAIL,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUser'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('error');
    });
  });

  describe('generate form page', () => {
    test('should generate a form page', async () => {
      const result = await generator.generate({
        name: 'CreateUserPage',
        type: PAGE_TYPE.FORM,
        framework: FRAMEWORK.REACT,
        form: 'UserForm'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const CreateUserPage');
      expect(result.code).toContain('UserForm');
    });
  });

  describe('generate dashboard page', () => {
    test('should generate a dashboard page with widgets', async () => {
      const result = await generator.generate({
        name: 'DashboardPage',
        type: PAGE_TYPE.DASHBOARD,
        framework: FRAMEWORK.REACT,
        widgets: ['stats', 'chart', 'recent']
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export const DashboardPage');
      expect(result.code).toContain('stats');
      expect(result.code).toContain('chart');
    });
  });

  describe('generate Next.js page', () => {
    test('should generate Next.js page with getServerSideProps', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.NEXTJS,
        dataSource: 'useUsers',
        ssr: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('export default');
      expect(result.code).toContain('getServerSideProps');
    });

    test('should generate Next.js page with getStaticProps', async () => {
      const result = await generator.generate({
        name: 'AboutPage',
        type: PAGE_TYPE.CUSTOM,
        framework: FRAMEWORK.NEXTJS,
        ssg: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('getStaticProps');
    });
  });

  describe('layout integration', () => {
    test('should wrap with layout component', async () => {
      const result = await generator.generate({
        name: 'UsersPage',
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT,
        dataSource: 'useUsers',
        layout: 'DashboardLayout'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('DashboardLayout');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: PAGE_TYPE.LIST,
        framework: FRAMEWORK.REACT
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });
  });

  describe('singleton', () => {
    test('getPageGenerator should return singleton', () => {
      const gen1 = getPageGenerator();
      const gen2 = getPageGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
