import { describe, test, expect, beforeEach } from '@jest/globals';
import { WidgetGenerator, getWidgetGenerator, WIDGET_TYPE, WIDGET_PATTERN } from '../skills/widget-generator.js';

describe('WidgetGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new WidgetGenerator({ dryRun: true });
  });

  describe('WIDGET_TYPE constants', () => {
    test('should define all widget types', () => {
      expect(WIDGET_TYPE.STATELESS).toBe('stateless');
      expect(WIDGET_TYPE.STATEFUL).toBe('stateful');
    });
  });

  describe('WIDGET_PATTERN constants', () => {
    test('should define all widget patterns', () => {
      expect(WIDGET_PATTERN.BASIC).toBe('basic');
      expect(WIDGET_PATTERN.LIST).toBe('list');
      expect(WIDGET_PATTERN.FORM).toBe('form');
      expect(WIDGET_PATTERN.CARD).toBe('card');
    });
  });

  describe('generate', () => {
    test('should generate a basic stateless widget', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class UserCard extends StatelessWidget');
      expect(result.code).toContain('Widget build(BuildContext context)');
    });

    test('should generate a stateful widget', async () => {
      const result = await generator.generate({
        name: 'CounterWidget',
        type: WIDGET_TYPE.STATEFUL
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('class CounterWidget extends StatefulWidget');
      expect(result.code).toContain('class _CounterWidgetState extends State<CounterWidget>');
      expect(result.code).toContain('Widget build(BuildContext context)');
    });

    test('should include props in widget', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS,
        props: [
          { name: 'user', type: 'User', required: true },
          { name: 'onTap', type: 'VoidCallback' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('final User user');
      expect(result.code).toContain('final VoidCallback? onTap');
      expect(result.code).toContain('required this.user');
    });

    test('should include imports', async () => {
      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS,
        imports: [
          'package:myapp/models/user.dart',
          'package:myapp/widgets/avatar.dart'
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import 'package:myapp/models/user.dart'");
      expect(result.code).toContain("import 'package:myapp/widgets/avatar.dart'");
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should set correct file path', async () => {
      generator.outputPath = '/project/lib/widgets';

      const result = await generator.generate({
        name: 'UserCard',
        type: WIDGET_TYPE.STATELESS
      });

      expect(result.filePath).toContain('user_card.dart');
    });
  });

  describe('singleton', () => {
    test('getWidgetGenerator should return singleton', () => {
      const gen1 = getWidgetGenerator();
      const gen2 = getWidgetGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
