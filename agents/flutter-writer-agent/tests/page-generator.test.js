import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PageGenerator, getPageGenerator, PAGE_TYPE } from '../skills/page-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('PageGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-test-'));
    generator = new PageGenerator({ outputPath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('PAGE_TYPE constants', () => {
    test('should define all page types', () => {
      expect(PAGE_TYPE.BASIC).toBe('basic');
      expect(PAGE_TYPE.WITH_BLOC).toBe('withBloc');
      expect(PAGE_TYPE.WITH_TABS).toBe('withTabs');
      expect(PAGE_TYPE.WITH_DRAWER).toBe('withDrawer');
      expect(PAGE_TYPE.FORM).toBe('form');
    });
  });

  describe('generate basic page', () => {
    test('should generate a basic page with scaffold', async () => {
      const result = await generator.generate({
        name: 'Home',
        type: PAGE_TYPE.BASIC,
        appBarTitle: 'Home'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/home.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('class HomePage extends StatelessWidget');
      expect(content).toContain('Scaffold');
      expect(content).toContain('AppBar');
    });

    test('should include floating action button when specified', async () => {
      const result = await generator.generate({
        name: 'Home',
        type: PAGE_TYPE.BASIC,
        floatingActionButton: 'FloatingActionButton(onPressed: () {}, child: Icon(Icons.add))'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/home.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('floatingActionButton');
      expect(content).toContain('FloatingActionButton');
    });

    test('should include bottom navigation when specified', async () => {
      const result = await generator.generate({
        name: 'Home',
        type: PAGE_TYPE.BASIC,
        bottomNavigationBar: 'BottomNavigationBar(items: [])'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/home.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('bottomNavigationBar');
      expect(content).toContain('BottomNavigationBar');
    });
  });

  describe('generate page with Bloc', () => {
    test('should generate page with Bloc integration', async () => {
      const result = await generator.generate({
        name: 'Home',
        type: PAGE_TYPE.WITH_BLOC,
        blocName: 'Home'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/home.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('BlocBuilder');
      expect(content).toContain('HomeBloc');
      expect(content).toContain('HomeState');
      expect(content).toContain('BlocProvider');
    });

    test('should load on init when specified', async () => {
      const result = await generator.generate({
        name: 'Home',
        type: PAGE_TYPE.WITH_BLOC,
        blocName: 'Home',
        loadOnInit: true,
        loadEvent: 'LoadData'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/home.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('LoadData');
    });
  });

  describe('generate page with tabs', () => {
    test('should generate page with tabs', async () => {
      const result = await generator.generate({
        name: 'Dashboard',
        type: PAGE_TYPE.WITH_TABS,
        tabs: [
          { label: 'Overview', body: 'OverviewTab()' },
          { label: 'Settings', body: 'SettingsTab()' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/dashboard.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('TabBar');
      expect(content).toContain('TabBarView');
    });
  });

  describe('generate page with drawer', () => {
    test('should generate page with drawer', async () => {
      const result = await generator.generate({
        name: 'Home',
        type: PAGE_TYPE.WITH_DRAWER,
        drawerItems: [
          { icon: 'Icons.home', label: 'Home', route: '/home' }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/home.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('Drawer');
    });
  });

  describe('route configuration', () => {
    test('should include route path constant', async () => {
      const result = await generator.generate({
        name: 'Profile',
        type: PAGE_TYPE.BASIC,
        routePath: '/profile'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/profile.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain("routePath = '/profile'");
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: PAGE_TYPE.BASIC
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    test('should fail with invalid name pattern', async () => {
      const result = await generator.generate({
        name: 'invalidName', // Should start with uppercase
        type: PAGE_TYPE.BASIC
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });
  });

  describe('dry run mode', () => {
    test('should not write files in dry run mode', async () => {
      const dryRunGenerator = new PageGenerator({ dryRun: true, outputPath: tempDir });

      const result = await dryRunGenerator.generate({
        name: 'Test',
        type: PAGE_TYPE.BASIC
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/pages/test.dart');
      await expect(fs.access(filePath)).rejects.toThrow();
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
