import { describe, test, expect, beforeEach } from '@jest/globals';
import { PageGenerator, getPageGenerator, PAGE_TYPE } from '../skills/page-generator.js';

describe('PageGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new PageGenerator({ dryRun: true });
  });

  describe('PAGE_TYPE constants', () => {
    test('should define all page types', () => {
      expect(PAGE_TYPE.BASIC).toBe('basic');
      expect(PAGE_TYPE.LIST).toBe('list');
      expect(PAGE_TYPE.DETAIL).toBe('detail');
      expect(PAGE_TYPE.FORM).toBe('form');
    });
  });

  describe('generate', () => {
    test('should generate a basic page with scaffold', async () => {
      const result = await generator.generate({
        name: 'HomePage',
        hasAppBar: true,
        appBarTitle: 'Home'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class HomePage extends StatelessWidget');
      expect(result.code).toContain('Scaffold');
      expect(result.code).toContain('AppBar');
      expect(result.code).toContain("title: Text('Home')");
    });

    test('should generate page with drawer', async () => {
      const result = await generator.generate({
        name: 'HomePage',
        hasDrawer: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('drawer:');
      expect(result.code).toContain('Drawer');
    });

    test('should generate page with bottom navigation', async () => {
      const result = await generator.generate({
        name: 'HomePage',
        hasBottomNav: true,
        bottomNavItems: [
          { icon: 'Icons.home', label: 'Home' },
          { icon: 'Icons.search', label: 'Search' },
          { icon: 'Icons.person', label: 'Profile' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('bottomNavigationBar:');
      expect(result.code).toContain('BottomNavigationBar');
      expect(result.code).toContain('Icons.home');
    });

    test('should generate page with floating action button', async () => {
      const result = await generator.generate({
        name: 'HomePage',
        hasFloatingButton: true,
        floatingButtonIcon: 'Icons.add'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('floatingActionButton:');
      expect(result.code).toContain('FloatingActionButton');
      expect(result.code).toContain('Icons.add');
    });

    test('should generate page with Bloc integration', async () => {
      const result = await generator.generate({
        name: 'HomePage',
        bloc: 'HomeBloc'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('BlocBuilder');
      expect(result.code).toContain('HomeBloc');
      expect(result.code).toContain('HomeState');
    });

    test('should generate stateful page', async () => {
      const result = await generator.generate({
        name: 'SettingsPage',
        stateful: true
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class SettingsPage extends StatefulWidget');
      expect(result.code).toContain('class _SettingsPageState extends State<SettingsPage>');
    });

    test('should include route name constant', async () => {
      const result = await generator.generate({
        name: 'ProfilePage',
        routeName: '/profile'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("static const routeName = '/profile'");
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        hasAppBar: true
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
