import { describe, test, expect, beforeEach } from '@jest/globals';
import { LocalizationGenerator, getLocalizationGenerator, LOCALE } from '../skills/localization-generator.js';

describe('LocalizationGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new LocalizationGenerator({ dryRun: true });
  });

  describe('LOCALE constants', () => {
    test('should define common locales', () => {
      expect(LOCALE.EN).toBe('en');
      expect(LOCALE.AR).toBe('ar');
      expect(LOCALE.KU).toBe('ku');
      expect(LOCALE.ES).toBe('es');
      expect(LOCALE.FR).toBe('fr');
    });
  });

  describe('generate', () => {
    test('should generate ARB files for all locales', async () => {
      const result = await generator.generate({
        strings: {
          appTitle: 'My App',
          welcomeMessage: 'Welcome!'
        },
        locales: ['en', 'ar', 'ku']
      });

      expect(result.success).toBe(true);
      expect(result.files).toHaveProperty('en');
      expect(result.files).toHaveProperty('ar');
      expect(result.files).toHaveProperty('ku');
    });

    test('should generate valid JSON for ARB file', async () => {
      const result = await generator.generate({
        strings: {
          appTitle: 'My App',
          welcomeMessage: 'Welcome!'
        },
        locales: ['en']
      });

      expect(result.success).toBe(true);

      const arbContent = JSON.parse(result.files.en);
      expect(arbContent['@@locale']).toBe('en');
      expect(arbContent.appTitle).toBe('My App');
      expect(arbContent.welcomeMessage).toBe('Welcome!');
    });

    test('should include metadata for strings', async () => {
      const result = await generator.generate({
        strings: {
          welcomeMessage: 'Welcome, {name}!'
        },
        locales: ['en'],
        includeMetadata: true
      });

      expect(result.success).toBe(true);

      const arbContent = JSON.parse(result.files.en);
      expect(arbContent['@welcomeMessage']).toBeDefined();
      expect(arbContent['@welcomeMessage'].placeholders).toHaveProperty('name');
    });

    test('should handle plurals', async () => {
      const result = await generator.generate({
        strings: {
          itemCount: '{count, plural, =0{No items} =1{1 item} other{{count} items}}'
        },
        locales: ['en']
      });

      expect(result.success).toBe(true);

      const arbContent = JSON.parse(result.files.en);
      expect(arbContent.itemCount).toContain('plural');
    });

    test('should handle string with parameters', async () => {
      const result = await generator.generate({
        strings: {
          greeting: 'Hello, {name}! You have {count} messages.'
        },
        locales: ['en'],
        includeMetadata: true
      });

      expect(result.success).toBe(true);

      const arbContent = JSON.parse(result.files.en);
      expect(arbContent['@greeting'].placeholders).toHaveProperty('name');
      expect(arbContent['@greeting'].placeholders).toHaveProperty('count');
    });

    test('should generate file paths for each locale', async () => {
      generator.outputPath = '/project/lib/l10n';

      const result = await generator.generate({
        strings: { appTitle: 'App' },
        locales: ['en', 'ar']
      });

      expect(result.success).toBe(true);
      expect(result.filePaths.en).toContain('app_en.arb');
      expect(result.filePaths.ar).toContain('app_ar.arb');
    });

    test('should fail with missing strings', async () => {
      const result = await generator.generate({
        locales: ['en']
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'strings'");
    });

    test('should fail with missing locales', async () => {
      const result = await generator.generate({
        strings: { appTitle: 'App' }
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'locales'");
    });

    test('should fail with empty locales array', async () => {
      const result = await generator.generate({
        strings: { appTitle: 'App' },
        locales: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("'locales' array cannot be empty");
    });
  });

  describe('singleton', () => {
    test('getLocalizationGenerator should return singleton', () => {
      const gen1 = getLocalizationGenerator();
      const gen2 = getLocalizationGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
