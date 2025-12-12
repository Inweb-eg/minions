import pino from 'pino';
import pretty from 'pino-pretty';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a logger instance for a specific component
 * @param {string} name - Component name (e.g., 'EventBus', 'MetricsCollector')
 * @returns {pino.Logger} Configured logger instance
 */
export function createLogger(name) {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const config = {
    name,
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'localhost'
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  };

  if (isDevelopment) {
    // Pretty print in development
    const stream = pretty({
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      messageFormat: `[${name}] {msg}`
    });
    return pino(config, stream);
  }

  // JSON logs in production
  return pino(config);
}

/**
 * Log levels:
 * - trace: Very detailed debugging
 * - debug: Debugging information
 * - info: General information
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors (application crash)
 */
export const LOG_LEVELS = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
};
