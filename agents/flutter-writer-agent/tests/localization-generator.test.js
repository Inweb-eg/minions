import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LocalizationGenerator, getLocalizationGenerator, LOCALE } from '../skills/localization-generator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('LocalizationGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'l10n-test-'));
    generator = new LocalizationGenerator({ outputPath: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('LOCALE constants', () => {
    test('should define common locales', () => {
      expect(LOCALE.EN).toBe('en');
      expect(LOCALE.AR).toBe('ar');
      expect(LOCALE.KU).toBe('ku');
      expect(LOCALE.ES).toBe('es');
      expect(LOCALE.FR).toBe('fr');
      expect(LOCALE.DE).toBe('de');
      expect(LOCALE.ZH).toBe('zh');
      expect(LOCALE.JA).toBe('ja');
    });
  });

  describe('generate ARB files', () => {
    test('should generate ARB files for all locales', async () => {
      const result = await generator.generate({
        translations: {
          appTitle: 'My App',
          welcomeMessage: 'Welcome!'
        },
        locales: ['en', 'ar', 'ku']
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.locales).toEqual(['en', 'ar', 'ku']);

      // Verify files were created
      const enPath = path.join(tempDir, 'lib/l10n/app_en.arb');
      const arPath = path.join(tempDir, 'lib/l10n/app_ar.arb');
      const kuPath = path.join(tempDir, 'lib/l10n/app_ku.arb');

      await expect(fs.access(enPath)).resolves.not.toThrow();
      await expect(fs.access(arPath)).resolves.not.toThrow();
      await expect(fs.access(kuPath)).resolves.not.toThrow();
    });

    test('should generate valid JSON for ARB file', async () => {
      const result = await generator.generate({
        translations: {
          appTitle: 'My App',
          welcomeMessage: 'Welcome!'
        },
        locales: ['en']
      });

      expect(result.success).toBe(true);

      const enPath = path.join(tempDir, 'lib/l10n/app_en.arb');
      const content = await fs.readFile(enPath, 'utf-8');
      const arbContent = JSON.parse(content);

      expect(arbContent['@@locale']).toBe('en');
      expect(arbContent.appTitle).toBe('My App');
      expect(arbContent.welcomeMessage).toBe('Welcome!');
    });

    test('should handle translations with locale-specific values', async () => {
      const result = await generator.generate({
        translations: {
          greeting: {
            en: 'Hello',
            ar: 'مرحبا',
            description: 'Greeting message'
          }
        },
        locales: ['en', 'ar']
      });

      expect(result.success).toBe(true);

      const enPath = path.join(tempDir, 'lib/l10n/app_en.arb');
      const arPath = path.join(tempDir, 'lib/l10n/app_ar.arb');

      const enContent = JSON.parse(await fs.readFile(enPath, 'utf-8'));
      const arContent = JSON.parse(await fs.readFile(arPath, 'utf-8'));

      expect(enContent.greeting).toBe('Hello');
      expect(arContent.greeting).toBe('مرحبا');
    });

    test('should use default locales when not specified', async () => {
      const result = await generator.generate({
        translations: {
          appTitle: 'App'
        }
      });

      expect(result.success).toBe(true);
      // Default locales: EN, AR, KU
      expect(result.locales).toEqual(['en', 'ar', 'ku']);
    });
  });

  describe('generate l10n configuration', () => {
    test('should generate l10n.yaml config', async () => {
      const result = await generator.generate({
        translations: { appTitle: 'App' },
        locales: ['en'],
        generateConfig: true
      });

      expect(result.success).toBe(true);

      const configPath = path.join(tempDir, 'l10n.yaml');
      const content = await fs.readFile(configPath, 'utf-8');

      expect(content).toContain('arb-dir:');
      expect(content).toContain('template-arb-file:');
      expect(content).toContain('output-class: AppLocalizations');
    });
  });

  describe('generate localization extension', () => {
    test('should generate Dart extension for easy l10n access', async () => {
      const result = await generator.generate({
        translations: { appTitle: 'App' },
        locales: ['en', 'ar'],
        generateExtension: true
      });

      expect(result.success).toBe(true);

      const extensionPath = path.join(tempDir, 'lib/l10n/localization_extension.dart');
      const content = await fs.readFile(extensionPath, 'utf-8');

      expect(content).toContain('extension LocalizationExtension');
      expect(content).toContain('AppLocalizations.of(this)');
      expect(content).toContain('LocaleHelper');
    });
  });

  describe('dry run mode', () => {
    test('should not write files in dry run mode', async () => {
      const dryRunGenerator = new LocalizationGenerator({ dryRun: true, outputPath: tempDir });

      const result = await dryRunGenerator.generate({
        translations: { appTitle: 'App' },
        locales: ['en']
      });

      expect(result.success).toBe(true);

      const enPath = path.join(tempDir, 'lib/l10n/app_en.arb');
      await expect(fs.access(enPath)).rejects.toThrow();
    });
  });

  describe('singleton', () => {
    test('getLocalizationGenerator should return singleton', () => {
      const gen1 = getLocalizationGenerator();
      const gen2 = getLocalizationGenerator();

      expect(gen1).toBe(gen2);
    });
  });

  describe('helper methods', () => {
    test('should generate ARB content from translations', () => {
      const translations = {
        title: 'Hello',
        message: 'World'
      };

      const content = generator.generateArbContent(translations, 'en');

      expect(content.title).toBe('Hello');
      expect(content.message).toBe('World');
    });
  });
});
