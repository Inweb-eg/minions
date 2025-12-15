/**
 * Backend Writer Agent - Main Entry Point
 *
 * Node.js/Express backend code generation agent with 6 specialized skills:
 * - RouteGenerator
 * - ModelGenerator
 * - ServiceGenerator
 * - MiddlewareGenerator
 * - ValidatorGenerator
 * - ControllerGenerator
 */

export { BackendWriterAgent, getBackendWriterAgent } from './backend-writer-agent.js';

// Skills exports
export {
  RouteGenerator,
  getRouteGenerator,
  HTTP_METHOD,
  ROUTE_TYPE
} from './skills/route-generator.js';

export {
  ModelGenerator,
  getModelGenerator,
  ORM_TYPE,
  MONGOOSE_TYPE
} from './skills/model-generator.js';

export {
  ServiceGenerator,
  getServiceGenerator,
  SERVICE_TYPE
} from './skills/service-generator.js';

export {
  MiddlewareGenerator,
  getMiddlewareGenerator,
  MIDDLEWARE_TYPE
} from './skills/middleware-generator.js';

export {
  ValidatorGenerator,
  getValidatorGenerator,
  VALIDATOR_LIB,
  FIELD_TYPE
} from './skills/validator-generator.js';

export {
  ControllerGenerator,
  getControllerGenerator,
  CONTROLLER_TYPE
} from './skills/controller-generator.js';

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
  name: 'backend-writer-agent',
  version: VERSION,
  description: 'Node.js/Express backend code generation agent',
  skills: [
    'route-generator',
    'model-generator',
    'service-generator',
    'middleware-generator',
    'validator-generator',
    'controller-generator'
  ],
  defaultConfig: {
    framework: 'express',
    orm: 'mongoose',
    validator: 'joi',
    useRepository: true,
    useService: true
  }
};
