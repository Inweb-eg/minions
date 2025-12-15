/**
 * Frontend Writer Agent - Main Entry Point
 *
 * React/TypeScript frontend code generation agent with 6 specialized skills:
 * - ComponentGenerator
 * - HookGenerator
 * - StoreGenerator
 * - FormGenerator
 * - ApiGenerator
 * - PageGenerator
 */

export { FrontendWriterAgent, getFrontendWriterAgent } from './frontend-writer-agent.js';

// Skills exports
export {
  ComponentGenerator,
  getComponentGenerator,
  COMPONENT_TYPE,
  CSS_FRAMEWORK
} from './skills/component-generator.js';

export {
  HookGenerator,
  getHookGenerator,
  HOOK_TYPE
} from './skills/hook-generator.js';

export {
  StoreGenerator,
  getStoreGenerator,
  STORE_TYPE
} from './skills/store-generator.js';

export {
  FormGenerator,
  getFormGenerator,
  FORM_TYPE,
  FORM_FIELD_TYPE
} from './skills/form-generator.js';

export {
  ApiGenerator,
  getApiGenerator,
  API_CLIENT,
  HTTP_METHOD
} from './skills/api-generator.js';

export {
  PageGenerator,
  getPageGenerator,
  PAGE_TYPE,
  FRAMEWORK
} from './skills/page-generator.js';

export {
  FrontendTestGenerator,
  getFrontendTestGenerator,
  FRONTEND_TEST_TYPE,
  E2E_FRAMEWORK
} from './skills/test-generator.js';

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
  name: 'frontend-writer-agent',
  version: VERSION,
  description: 'React/TypeScript frontend code generation agent',
  skills: [
    'component-generator',
    'hook-generator',
    'store-generator',
    'form-generator',
    'api-generator',
    'page-generator',
    'test-generator'
  ],
  defaultConfig: {
    useTypeScript: true,
    cssFramework: 'tailwind',
    stateManagement: 'context',
    apiClient: 'react-query',
    framework: 'react'
  }
};
