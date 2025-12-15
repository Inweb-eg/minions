/**
 * Template Loader
 *
 * Utility for loading and managing customizable code templates.
 * Supports per-project template overrides.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default templates directory
const DEFAULT_TEMPLATES_DIR = __dirname;

/**
 * Template cache
 */
const templateCache = new Map();

/**
 * Template loader configuration
 */
let config = {
  projectTemplatesDir: null,
  cacheEnabled: true
};

/**
 * Configure the template loader
 *
 * @param {Object} options - Configuration options
 * @param {string} options.projectRoot - Project root directory
 * @param {boolean} options.cacheEnabled - Enable template caching
 */
export function configureTemplateLoader(options = {}) {
  if (options.projectRoot) {
    config.projectTemplatesDir = path.join(options.projectRoot, 'templates');
  }
  if (options.cacheEnabled !== undefined) {
    config.cacheEnabled = options.cacheEnabled;
  }
}

/**
 * Load a template by platform and name
 *
 * @param {string} platform - Platform (flutter, backend, frontend)
 * @param {string} templateName - Template name (widget, model, etc.)
 * @param {string} extension - File extension (dart, js, tsx)
 * @returns {Promise<string>} Template content
 */
export async function loadTemplate(platform, templateName, extension = null) {
  const cacheKey = `${platform}:${templateName}`;

  // Check cache
  if (config.cacheEnabled && templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey);
  }

  // Determine file extension based on platform
  const ext = extension || getDefaultExtension(platform);
  const fileName = `${templateName}.template.${ext}`;

  let templateContent = null;

  // Try project templates first
  if (config.projectTemplatesDir) {
    const projectPath = path.join(config.projectTemplatesDir, platform, fileName);
    templateContent = await tryReadFile(projectPath);
  }

  // Fall back to default templates
  if (!templateContent) {
    const defaultPath = path.join(DEFAULT_TEMPLATES_DIR, platform, fileName);
    templateContent = await tryReadFile(defaultPath);
  }

  if (!templateContent) {
    throw new Error(`Template not found: ${platform}/${fileName}`);
  }

  // Cache the template
  if (config.cacheEnabled) {
    templateCache.set(cacheKey, templateContent);
  }

  return templateContent;
}

/**
 * Load all templates for a platform
 *
 * @param {string} platform - Platform (flutter, backend, frontend)
 * @returns {Promise<Map<string, string>>} Map of template name to content
 */
export async function loadAllTemplates(platform) {
  const templates = new Map();
  const ext = getDefaultExtension(platform);

  // Get list of template files
  const dirs = [
    path.join(DEFAULT_TEMPLATES_DIR, platform)
  ];

  if (config.projectTemplatesDir) {
    dirs.unshift(path.join(config.projectTemplatesDir, platform));
  }

  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir);
      const templateFiles = files.filter(f => f.endsWith(`.template.${ext}`));

      for (const file of templateFiles) {
        const name = file.replace(`.template.${ext}`, '');
        if (!templates.has(name)) {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          templates.set(name, content);
        }
      }
    } catch (e) {
      // Directory doesn't exist, skip
    }
  }

  return templates;
}

/**
 * Check if a custom template exists
 *
 * @param {string} platform - Platform
 * @param {string} templateName - Template name
 * @returns {Promise<boolean>} True if custom template exists
 */
export async function hasCustomTemplate(platform, templateName) {
  if (!config.projectTemplatesDir) return false;

  const ext = getDefaultExtension(platform);
  const fileName = `${templateName}.template.${ext}`;
  const customPath = path.join(config.projectTemplatesDir, platform, fileName);

  try {
    await fs.access(customPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List available templates
 *
 * @param {string} platform - Optional platform filter
 * @returns {Promise<Object>} Available templates by platform
 */
export async function listTemplates(platform = null) {
  const result = {};
  const platforms = platform ? [platform] : ['flutter', 'backend', 'frontend'];

  for (const p of platforms) {
    result[p] = [];
    const ext = getDefaultExtension(p);

    // Check default templates
    const defaultDir = path.join(DEFAULT_TEMPLATES_DIR, p);
    try {
      const files = await fs.readdir(defaultDir);
      const templates = files
        .filter(f => f.endsWith(`.template.${ext}`))
        .map(f => ({
          name: f.replace(`.template.${ext}`, ''),
          source: 'default'
        }));
      result[p].push(...templates);
    } catch (e) {
      // Directory doesn't exist
    }

    // Check project templates
    if (config.projectTemplatesDir) {
      const projectDir = path.join(config.projectTemplatesDir, p);
      try {
        const files = await fs.readdir(projectDir);
        const templates = files
          .filter(f => f.endsWith(`.template.${ext}`))
          .map(f => f.replace(`.template.${ext}`, ''));

        for (const name of templates) {
          const existing = result[p].find(t => t.name === name);
          if (existing) {
            existing.source = 'custom (override)';
          } else {
            result[p].push({ name, source: 'custom' });
          }
        }
      } catch (e) {
        // Directory doesn't exist
      }
    }
  }

  return result;
}

/**
 * Clear the template cache
 */
export function clearCache() {
  templateCache.clear();
}

/**
 * Create a custom template from default
 *
 * @param {string} platform - Platform
 * @param {string} templateName - Template name
 * @param {string} projectRoot - Project root directory
 */
export async function createCustomTemplate(platform, templateName, projectRoot) {
  const ext = getDefaultExtension(platform);
  const fileName = `${templateName}.template.${ext}`;

  // Load default template
  const defaultPath = path.join(DEFAULT_TEMPLATES_DIR, platform, fileName);
  const content = await fs.readFile(defaultPath, 'utf-8');

  // Create project templates directory
  const projectDir = path.join(projectRoot, 'templates', platform);
  await fs.mkdir(projectDir, { recursive: true });

  // Write custom template
  const customPath = path.join(projectDir, fileName);
  await fs.writeFile(customPath, content);

  return customPath;
}

/**
 * Get default file extension for platform
 */
function getDefaultExtension(platform) {
  const extensions = {
    flutter: 'dart',
    backend: 'js',
    frontend: 'tsx'
  };
  return extensions[platform] || 'txt';
}

/**
 * Try to read a file, return null if not found
 */
async function tryReadFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

export default {
  configureTemplateLoader,
  loadTemplate,
  loadAllTemplates,
  hasCustomTemplate,
  listTemplates,
  clearCache,
  createCustomTemplate
};
