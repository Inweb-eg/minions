import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WidgetGenerator, getWidgetGenerator, WIDGET_TYPE, WIDGET_PATTERN } from '../skills/widget-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('WidgetGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'widget-test-'));
    generator = new WidgetGenerator({ outputPath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('WIDGET_TYPE constants', () => {
    test('should define all widget types', () => {
      expect(WIDGET_TYPE.STATELESS).toBe('stateless');
      expect(WIDGET_TYPE.STATEFUL).toBe('stateful');
      expect(WIDGET_TYPE.CONSUMER).toBe('consumer');
      expect(WIDGET_TYPE.INHERITED).toBe('inherited');
    });
  });

  describe('WIDGET_PATTERN constants', () => {
    test('should define all widget patterns', () => {
      expect(WIDGET_PATTERN.BASIC).toBe('basic');
      expect(WIDGET_PATTERN.LIST_VIEW).toBe('listView');
      expect(WIDGET_PATTERN.GRID_VIEW).toBe('gridView');
      expect(WIDGET_PATTERN.FORM).toBe('form');
      expect(WIDGET_PATTERN.CARD).toBe('card');
      expect(WIDGET_PATTERN.DIALOG).toBe('dialog');
      expect(WIDGET_PATTERN.BOTTOM_SHEET).toBe('bottomSheet');
    });
  });

  describe('generate stateless widget', () => {
    test('should generate a basic stateless widget', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/user_card.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('class UserCard extends StatelessWidget');
      expect(content).toContain('Widget build(BuildContext context)');
    });

    test('should include props in widget', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS,
        props: [
          { name: 'user', type: 'User', required: true },
          { name: 'onTap', type: 'VoidCallback', nullable: true }
        ]
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/user_card.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('final User user');
      expect(content).toContain('final VoidCallback? onTap');
      expect(content).toContain('required this.user');
    });
  });

  describe('generate stateful widget', () => {
    test('should generate a stateful widget', async () => {
      const result = await generator.generate({
        name: 'CounterWidget',
        type: WIDGET_TYPE.STATEFUL
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/counter_widget.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('class CounterWidget extends StatefulWidget');
      expect(content).toContain('class _CounterWidgetState extends State<CounterWidget>');
      expect(content).toContain('Widget build(BuildContext context)');
      expect(content).toContain('initState');
      expect(content).toContain('dispose');
    });

    test('should include state variables', async () => {
      const result = await generator.generate({
        name: 'Timer',
        type: WIDGET_TYPE.STATEFUL,
        stateVariables: 'int _count = 0;'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/timer.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('int _count = 0');
    });
  });

  describe('generate consumer widget', () => {
    test('should generate a BlocConsumer widget', async () => {
      const result = await generator.generate({
        name: 'UserProfile',
        type: WIDGET_TYPE.CONSUMER,
        blocType: 'UserBloc',
        stateType: 'UserState'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/user_profile.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('BlocConsumer<UserBloc, UserState>');
      expect(content).toContain('flutter_bloc/flutter_bloc.dart');
    });
  });

  describe('generate with patterns', () => {
    test('should generate a list view pattern', async () => {
      const result = await generator.generate({
        name: 'UserList',
        pattern: WIDGET_PATTERN.LIST_VIEW,
        itemType: 'User'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/user_list.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('ListView.builder');
      expect(content).toContain('List<User> items');
    });

    test('should generate a form pattern', async () => {
      const result = await generator.generate({
        name: 'LoginForm',
        pattern: WIDGET_PATTERN.FORM,
        submitLabel: 'Login'
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/login_form.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('GlobalKey<FormState>');
      expect(content).toContain('Form(');
      expect(content).toContain("Text('Login')");
    });
  });

  describe('imports', () => {
    test('should include custom imports', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS,
        imports: "import 'package:myapp/models/user.dart';\nimport 'package:myapp/widgets/avatar.dart';"
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/user_card.dart');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain("import 'package:myapp/models/user.dart'");
      expect(content).toContain("import 'package:myapp/widgets/avatar.dart'");
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    test('should fail with invalid name pattern', async () => {
      const result = await generator.generate({
        name: 'invalidName', // Should start with uppercase
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });
  });

  describe('file path', () => {
    test('should set correct file path', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('user_card.dart');
    });

    test('should use custom output path', async () => {
      const customPath = 'lib/features/profile/widgets/user_card.dart';

      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS,
        outputPath: customPath
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, customPath);
      await expect(fs.access(filePath)).resolves.not.toThrow();
    });
  });

  describe('dry run mode', () => {
    test('should not write files in dry run mode', async () => {
      const dryRunGenerator = new WidgetGenerator({ dryRun: true, outputPath: tempDir });

      const result = await dryRunGenerator.generate({
        name: 'Test',
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(true);

      const filePath = path.join(tempDir, 'lib/widgets/test.dart');
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('singleton', () => {
    test('getWidgetGenerator should return singleton', () => {
      const gen1 = getWidgetGenerator();
      const gen2 = getWidgetGenerator();

      expect(gen1).toBe(gen2);
    });
  });

  describe('helper methods', () => {
    test('toSnakeCase should convert PascalCase to snake_case', () => {
      expect(generator.toSnakeCase('UserCard')).toBe('user_card');
      expect(generator.toSnakeCase('ProfilePage')).toBe('profile_page');
    });
  });
});
