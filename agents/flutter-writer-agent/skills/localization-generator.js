/**
 * LocalizationGenerator - Flutter Localization Code Generation Skill
 *
 * Generates Flutter localization:
 * - ARB files
 * - Translation keys
 * - Multi-language support
 * - l10n configuration
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT, createSkillGetter } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Supported locales
 */
export const LOCALE = {
  EN: 'en',
  AR: 'ar',
  KU: 'ku',
  ES: 'es',
  FR: 'fr',
  DE: 'de',
  ZH: 'zh',
  JA: 'ja'
};

/**
 * LocalizationGenerator Skill
 */
export class LocalizationGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('LocalizationGenerator', {
      language: LANGUAGE.JSON,
      ...options
    });

    this.supportedLocales = options.supportedLocales || [LOCALE.EN, LOCALE.AR, LOCALE.KU];
    this.defaultLocale = options.defaultLocale || LOCALE.EN;
    this.arbDir = options.arbDir || 'lib/l10n';

    this.registerTemplates();
  }

  registerTemplates() {
    // ARB file template
    this.registerTemplate('arb', (data) => {
      const content = {
        '@@locale': data.locale,
        ...this.generateArbContent(data.translations, data.locale)
      };
      return JSON.stringify(content, null, 2);
    });

    // l10n.yaml configuration template
    this.registerTemplate('l10nConfig', (data) => `
arb-dir: ${data.arbDir || 'lib/l10n'}
template-arb-file: app_${data.defaultLocale || 'en'}.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
`.trim());

    // Localization extension template
    this.registerTemplate('extension', (data) => `
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

/// Extension for easy access to localization
extension LocalizationExtension on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
}

/// Locale helper
class LocaleHelper {
  static const List<Locale> supportedLocales = [
    ${(data.supportedLocales || ['en']).map(l => `Locale('${l}'),`).join('\n    ')}
  ];

  static const Locale defaultLocale = Locale('${data.defaultLocale || 'en'}');

  static String getLanguageName(String code) {
    switch (code) {
      case 'en':
        return 'English';
      case 'ar':
        return 'العربية';
      case 'ku':
        return 'کوردی';
      case 'es':
        return 'Español';
      case 'fr':
        return 'Français';
      case 'de':
        return 'Deutsch';
      default:
        return code;
    }
  }

  static bool isRTL(String code) {
    return ['ar', 'ku', 'fa', 'he'].contains(code);
  }
}
`.trim());
  }

  /**
   * Generate ARB content from translations
   */
  generateArbContent(translations = {}, locale) {
    const content = {};

    for (const [key, value] of Object.entries(translations)) {
      if (typeof value === 'object') {
        // Handle value with metadata
        const translation = value[locale] || value[this.defaultLocale] || value.en || '';
        content[key] = translation;

        // Add metadata if present
        if (value.description) {
          content[`@${key}`] = {
            description: value.description,
            ...(value.placeholders ? { placeholders: value.placeholders } : {})
          };
        }
      } else {
        // Simple string value
        content[key] = value;
      }
    }

    return content;
  }

  /**
   * Generate ARB files for all locales
   * @param {Object} spec - Localization specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      const translations = spec.translations || {};
      const locales = spec.locales || this.supportedLocales;
      const results = [];

      // Generate ARB file for each locale
      for (const locale of locales) {
        const arbData = {
          locale,
          translations
        };

        const fileName = `app_${locale}.arb`;
        const outputPath = `${this.arbDir}/${fileName}`;

        const result = await this.generateAndWrite(arbData, 'arb', outputPath, {
          overwrite: spec.overwrite ?? true // ARB files are usually overwritten
        });

        results.push(result);
      }

      const success = results.every(r => r.success);

      if (success) {
        this.publish(EventTypes.FLUTTER_L10N_GENERATED, {
          locales,
          translationCount: Object.keys(translations).length,
          files: results.map(r => r.path)
        });
      }

      this.completeRun();
      return {
        success,
        results,
        locales
      };
    } catch (error) {
      this.failRun(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate l10n.yaml configuration file
   * @param {Object} spec - Configuration specification
   * @returns {Promise<Object>} Generation result
   */
  async generateConfig(spec = {}) {
    const configData = {
      arbDir: spec.arbDir || this.arbDir,
      defaultLocale: spec.defaultLocale || this.defaultLocale
    };

    return await this.generateAndWrite(configData, 'l10nConfig', 'l10n.yaml', {
      overwrite: spec.overwrite || false
    });
  }

  /**
   * Generate localization extension file
   * @param {Object} spec - Extension specification
   * @returns {Promise<Object>} Generation result
   */
  async generateExtension(spec = {}) {
    const extensionData = {
      supportedLocales: spec.supportedLocales || this.supportedLocales,
      defaultLocale: spec.defaultLocale || this.defaultLocale
    };

    const outputPath = spec.outputPath || 'lib/core/extensions/localization_extension.dart';

    return await this.generateAndWrite(extensionData, 'extension', outputPath, {
      overwrite: spec.overwrite || false,
      language: LANGUAGE.DART
    });
  }

  /**
   * Add a translation key to existing ARB files
   * @param {string} key - Translation key
   * @param {Object} translations - Translations by locale
   * @param {Object} metadata - Optional metadata (description, placeholders)
   * @returns {Promise<Object>} Update result
   */
  async addTranslation(key, translations, metadata = {}) {
    this.startRun();

    try {
      const results = [];

      for (const locale of this.supportedLocales) {
        const fileName = `app_${locale}.arb`;
        const filePath = `${this.arbDir}/${fileName}`;

        // Read existing ARB file
        let existingContent = {};
        const content = await this.readFile(filePath);
        if (content) {
          try {
            existingContent = JSON.parse(content);
          } catch {
            existingContent = { '@@locale': locale };
          }
        } else {
          existingContent = { '@@locale': locale };
        }

        // Add new translation
        existingContent[key] = translations[locale] || translations[this.defaultLocale] || '';

        // Add metadata if present
        if (metadata.description) {
          existingContent[`@${key}`] = {
            description: metadata.description,
            ...(metadata.placeholders ? { placeholders: metadata.placeholders } : {})
          };
        }

        // Write back
        const result = await this.writeFile(filePath, JSON.stringify(existingContent, null, 2), {
          overwrite: true
        });

        results.push(result);
      }

      this.completeRun();
      return {
        success: results.every(r => r.success),
        results,
        key
      };
    } catch (error) {
      this.failRun(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate translations from a spec with multiple keys
   * @param {Object} spec - Specification with multiple translations
   * @returns {Promise<Object>} Generation result
   */
  async generateBatch(spec) {
    const translations = spec.translations || {};
    const locales = spec.locales || this.supportedLocales;

    // Transform to per-locale format
    const perLocale = {};

    for (const locale of locales) {
      perLocale[locale] = {};
      for (const [key, value] of Object.entries(translations)) {
        if (typeof value === 'object' && !value.description) {
          // Value is translations per locale
          perLocale[locale][key] = value[locale] || value[this.defaultLocale] || '';
        } else if (typeof value === 'object' && value.description) {
          // Value has metadata
          perLocale[locale][key] = value[locale] || value[this.defaultLocale] || '';
          perLocale[locale][`@${key}`] = {
            description: value.description,
            ...(value.placeholders ? { placeholders: value.placeholders } : {})
          };
        } else {
          // Simple string (same for all locales)
          perLocale[locale][key] = value;
        }
      }
    }

    return await this.generate({
      translations,
      locales,
      overwrite: spec.overwrite
    });
  }

  /**
   * Set supported locales
   * @param {string[]} locales - Locale codes
   */
  setSupportedLocales(locales) {
    this.supportedLocales = locales;
  }

  /**
   * Set ARB directory
   * @param {string} dir - Directory path
   */
  setArbDir(dir) {
    this.arbDir = dir;
  }
}

// Singleton getter
let instance = null;

export function getLocalizationGenerator(options = {}) {
  if (!instance) {
    instance = new LocalizationGenerator(options);
  }
  return instance;
}

export default LocalizationGenerator;
