/**
 * Flutter Writer Agent - Main Entry Point
 *
 * Flutter/Dart code generation agent with 6 specialized skills:
 * - WidgetGenerator
 * - ModelGenerator
 * - ServiceGenerator
 * - BlocGenerator
 * - PageGenerator
 * - LocalizationGenerator
 */

export { FlutterWriterAgent, getFlutterWriterAgent } from './flutter-writer-agent.js';

// Skills exports
export {
  WidgetGenerator,
  getWidgetGenerator,
  WIDGET_TYPE,
  WIDGET_PATTERN
} from './skills/widget-generator.js';

export {
  ModelGenerator,
  getModelGenerator,
  MODEL_TYPE
} from './skills/model-generator.js';

export {
  ServiceGenerator,
  getServiceGenerator,
  HTTP_METHOD
} from './skills/service-generator.js';

export {
  BlocGenerator,
  getBlocGenerator,
  BLOC_TYPE
} from './skills/bloc-generator.js';

export {
  PageGenerator,
  getPageGenerator,
  PAGE_TYPE
} from './skills/page-generator.js';

export {
  LocalizationGenerator,
  getLocalizationGenerator,
  LOCALE
} from './skills/localization-generator.js';

// Utilities
export { createLogger } from './utils/logger.js';

/**
 * Agent version
 */
export const VERSION = '1.0.0';

/**
 * Agent info
 */
export const INFO = {
  name: 'flutter-writer-agent',
  version: VERSION,
  description: 'Flutter/Dart code generation agent',
  skills: [
    'widget-generator',
    'model-generator',
    'service-generator',
    'bloc-generator',
    'page-generator',
    'localization-generator'
  ],
  defaultConfig: {
    stateManagement: 'bloc',
    apiClient: 'dio',
    useFreezed: true,
    useJsonSerializable: true,
    supportedLocales: ['en', 'ar', 'ku']
  }
};
