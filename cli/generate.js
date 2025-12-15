#!/usr/bin/env node
/**
 * Minions Code Generation CLI
 *
 * Command-line interface for generating code using the writer agents.
 *
 * Usage:
 *   npx minions generate flutter widget --name UserCard --type stateless
 *   npx minions generate backend route --name users --type crud
 *   npx minions generate frontend component --name Button --type functional
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import path from 'path';
import { fileURLToPath } from 'url';

// Import writer agents
import { getFlutterWriterAgent } from '../agents/flutter-writer-agent/index.js';
import { getBackendWriterAgent } from '../agents/backend-writer-agent/index.js';
import { getFrontendWriterAgent } from '../agents/frontend-writer-agent/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI version
const VERSION = '1.0.0';

// Available generators per platform
const GENERATORS = {
  flutter: ['widget', 'model', 'service', 'bloc', 'page', 'l10n', 'test'],
  backend: ['route', 'model', 'service', 'middleware', 'validator', 'controller', 'test'],
  frontend: ['component', 'hook', 'store', 'form', 'api', 'page', 'test']
};

// Type mappings
const TYPE_OPTIONS = {
  'flutter:widget': ['stateless', 'stateful', 'inherited'],
  'flutter:model': ['freezed', 'json_serializable', 'simple'],
  'flutter:bloc': ['bloc', 'cubit'],
  'flutter:test': ['widget', 'bloc', 'cubit', 'unit', 'integration', 'golden'],
  'backend:route': ['crud', 'custom', 'resource'],
  'backend:model': ['mongoose', 'sequelize'],
  'backend:service': ['crud', 'custom'],
  'backend:middleware': ['auth', 'rate_limit', 'validation', 'error_handler', 'logging'],
  'backend:test': ['api', 'service', 'controller', 'middleware', 'model', 'integration'],
  'frontend:component': ['functional', 'memo', 'forwardRef'],
  'frontend:hook': ['state', 'effect', 'query', 'mutation', 'custom'],
  'frontend:store': ['context', 'zustand', 'redux'],
  'frontend:form': ['controlled', 'uncontrolled', 'hook-form'],
  'frontend:test': ['component', 'hook', 'store', 'form', 'api', 'integration', 'e2e']
};

/**
 * Main program setup
 */
program
  .name('minions')
  .description('Code generation CLI for Minions framework')
  .version(VERSION);

/**
 * Generate command
 */
program
  .command('generate')
  .alias('g')
  .description('Generate code using writer agents')
  .argument('<platform>', 'Target platform (flutter, backend, frontend)')
  .argument('<generator>', 'Generator type (widget, model, service, etc.)')
  .option('-n, --name <name>', 'Name of the generated item')
  .option('-t, --type <type>', 'Type variant (e.g., stateless, crud, functional)')
  .option('-o, --output <path>', 'Output directory', process.cwd())
  .option('-d, --dry-run', 'Preview generated code without writing files')
  .option('-i, --interactive', 'Interactive mode with prompts')
  .option('--props <props>', 'Comma-separated list of props (name:type)')
  .option('--fields <fields>', 'Comma-separated list of fields (name:type)')
  .option('--methods <methods>', 'Comma-separated list of methods')
  .option('--endpoints <endpoints>', 'Comma-separated list of endpoints (method:path:name)')
  .action(handleGenerate);

/**
 * List command - show available generators
 */
program
  .command('list')
  .alias('ls')
  .description('List available generators')
  .argument('[platform]', 'Optional platform filter')
  .action(handleList);

/**
 * Init command - initialize project configuration
 */
program
  .command('init')
  .description('Initialize minions configuration in current directory')
  .option('-p, --platform <platform>', 'Target platform')
  .action(handleInit);

/**
 * Handle generate command
 */
async function handleGenerate(platform, generator, options) {
  // Validate platform
  if (!GENERATORS[platform]) {
    console.error(chalk.red(`Unknown platform: ${platform}`));
    console.log(chalk.gray(`Available platforms: ${Object.keys(GENERATORS).join(', ')}`));
    process.exit(1);
  }

  // Validate generator
  if (!GENERATORS[platform].includes(generator)) {
    console.error(chalk.red(`Unknown generator: ${generator} for platform ${platform}`));
    console.log(chalk.gray(`Available generators: ${GENERATORS[platform].join(', ')}`));
    process.exit(1);
  }

  let spec = {};

  // Interactive mode
  if (options.interactive || !options.name) {
    spec = await promptForSpec(platform, generator, options);
  } else {
    spec = buildSpecFromOptions(platform, generator, options);
  }

  // Generate code
  const spinner = ora(`Generating ${platform} ${generator}...`).start();

  try {
    const result = await generateCode(platform, generator, spec, options);

    if (result.success) {
      spinner.succeed(chalk.green(`Generated ${generator}: ${result.filePath || 'preview mode'}`));

      if (options.dryRun) {
        console.log(chalk.gray('\n--- Preview ---\n'));
        console.log(result.code);
        console.log(chalk.gray('\n--- End Preview ---\n'));
      }
    } else {
      spinner.fail(chalk.red(`Generation failed: ${result.errors?.join(', ')}`));
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle list command
 */
function handleList(platform) {
  console.log(chalk.bold('\nMinions Code Generators\n'));

  const platforms = platform ? [platform] : Object.keys(GENERATORS);

  platforms.forEach(p => {
    if (!GENERATORS[p]) {
      console.error(chalk.red(`Unknown platform: ${p}`));
      return;
    }

    console.log(chalk.cyan(`${p.toUpperCase()}`));
    GENERATORS[p].forEach(g => {
      const typeKey = `${p}:${g}`;
      const types = TYPE_OPTIONS[typeKey];
      const typeStr = types ? chalk.gray(` (${types.join(', ')})`) : '';
      console.log(`  ${chalk.green('•')} ${g}${typeStr}`);
    });
    console.log('');
  });
}

/**
 * Handle init command
 */
async function handleInit(options) {
  console.log(chalk.bold('\nInitialize Minions Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Select target platform:',
      choices: Object.keys(GENERATORS),
      default: options.platform
    },
    {
      type: 'input',
      name: 'outputPath',
      message: 'Output directory:',
      default: './src'
    }
  ]);

  // Platform-specific questions
  let config = {
    platform: answers.platform,
    outputPath: answers.outputPath
  };

  if (answers.platform === 'flutter') {
    const flutterAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'stateManagement',
        message: 'State management:',
        choices: ['bloc', 'provider', 'riverpod'],
        default: 'bloc'
      },
      {
        type: 'confirm',
        name: 'useFreezed',
        message: 'Use Freezed for models?',
        default: true
      },
      {
        type: 'input',
        name: 'locales',
        message: 'Supported locales (comma-separated):',
        default: 'en,ar,ku'
      }
    ]);
    config = { ...config, ...flutterAnswers };
  }

  if (answers.platform === 'backend') {
    const backendAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'orm',
        message: 'ORM:',
        choices: ['mongoose', 'sequelize', 'prisma'],
        default: 'mongoose'
      },
      {
        type: 'list',
        name: 'validator',
        message: 'Validator library:',
        choices: ['joi', 'zod', 'yup'],
        default: 'joi'
      }
    ]);
    config = { ...config, ...backendAnswers };
  }

  if (answers.platform === 'frontend') {
    const frontendAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'stateManagement',
        message: 'State management:',
        choices: ['context', 'zustand', 'redux'],
        default: 'context'
      },
      {
        type: 'list',
        name: 'cssFramework',
        message: 'CSS framework:',
        choices: ['tailwind', 'styled-components', 'css-modules', 'none'],
        default: 'tailwind'
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript?',
        default: true
      }
    ]);
    config = { ...config, ...frontendAnswers };
  }

  // Write config file
  const configPath = path.join(process.cwd(), 'minions.config.json');
  const fs = await import('fs/promises');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(chalk.green(`\nConfiguration saved to ${configPath}`));
}

/**
 * Prompt for specification in interactive mode
 */
async function promptForSpec(platform, generator, options) {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: `${generator} name:`,
      default: options.name,
      validate: (input) => input.length > 0 || 'Name is required'
    }
  ];

  // Add type question if applicable
  const typeKey = `${platform}:${generator}`;
  if (TYPE_OPTIONS[typeKey]) {
    questions.push({
      type: 'list',
      name: 'type',
      message: `${generator} type:`,
      choices: TYPE_OPTIONS[typeKey],
      default: options.type || TYPE_OPTIONS[typeKey][0]
    });
  }

  // Add platform-specific questions
  if (generator === 'widget' || generator === 'component') {
    questions.push({
      type: 'input',
      name: 'propsInput',
      message: 'Props (format: name:type, comma-separated):',
      default: options.props || ''
    });
  }

  if (generator === 'model') {
    questions.push({
      type: 'input',
      name: 'fieldsInput',
      message: 'Fields (format: name:type, comma-separated):',
      default: options.fields || ''
    });
  }

  if (generator === 'service' || generator === 'api') {
    questions.push({
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      default: `/api/${options.name?.toLowerCase() || 'resource'}`
    });
  }

  const answers = await inquirer.prompt(questions);

  // Build spec from answers
  const spec = {
    name: answers.name,
    type: answers.type
  };

  if (answers.propsInput) {
    spec.props = parseProps(answers.propsInput);
  }

  if (answers.fieldsInput) {
    spec.fields = parseFields(answers.fieldsInput);
  }

  if (answers.baseUrl) {
    spec.baseUrl = answers.baseUrl;
  }

  return spec;
}

/**
 * Build spec from command line options
 */
function buildSpecFromOptions(platform, generator, options) {
  const spec = {
    name: options.name,
    type: options.type
  };

  if (options.props) {
    spec.props = parseProps(options.props);
  }

  if (options.fields) {
    spec.fields = parseFields(options.fields);
  }

  if (options.methods) {
    spec.methods = options.methods.split(',').map(m => m.trim());
  }

  if (options.endpoints) {
    spec.endpoints = parseEndpoints(options.endpoints);
  }

  return spec;
}

/**
 * Parse props string
 */
function parseProps(propsStr) {
  return propsStr.split(',').map(prop => {
    const [name, type = 'string', required] = prop.trim().split(':');
    return {
      name: name.trim(),
      type: type.trim(),
      required: required === 'required'
    };
  }).filter(p => p.name);
}

/**
 * Parse fields string
 */
function parseFields(fieldsStr) {
  return fieldsStr.split(',').map(field => {
    const [name, type = 'string', ...flags] = field.trim().split(':');
    return {
      name: name.trim(),
      type: type.trim(),
      required: flags.includes('required'),
      unique: flags.includes('unique')
    };
  }).filter(f => f.name);
}

/**
 * Parse endpoints string
 */
function parseEndpoints(endpointsStr) {
  return endpointsStr.split(',').map(ep => {
    const [method, path, name] = ep.trim().split(':');
    return { method, path, name };
  }).filter(e => e.method && e.path);
}

/**
 * Generate code using the appropriate agent
 */
async function generateCode(platform, generator, spec, options) {
  let agent;
  let method;

  // Configure output path
  const outputPath = path.resolve(options.output);

  // Get the appropriate agent
  switch (platform) {
    case 'flutter':
      agent = getFlutterWriterAgent();
      await agent.configure({ projectPath: outputPath });
      break;
    case 'backend':
      agent = getBackendWriterAgent();
      await agent.configure({ projectPath: outputPath });
      break;
    case 'frontend':
      agent = getFrontendWriterAgent();
      await agent.configure({ projectPath: outputPath });
      break;
  }

  // Initialize agent
  await agent.initialize();

  // Map generator to method
  const methodMap = {
    flutter: {
      widget: 'generateWidget',
      model: 'generateModel',
      service: 'generateService',
      bloc: 'generateBloc',
      page: 'generatePage',
      l10n: 'generateLocalization',
      test: 'generateTest'
    },
    backend: {
      route: 'generateRoute',
      model: 'generateModel',
      service: 'generateService',
      middleware: 'generateMiddleware',
      validator: 'generateValidator',
      controller: 'generateController',
      test: 'generateTest'
    },
    frontend: {
      component: 'generateComponent',
      hook: 'generateHook',
      store: 'generateStore',
      form: 'generateForm',
      api: 'generateApi',
      page: 'generatePage',
      test: 'generateTest'
    }
  };

  method = methodMap[platform][generator];

  if (!method || typeof agent[method] !== 'function') {
    throw new Error(`Generator not found: ${platform}:${generator}`);
  }

  // Set dry run option
  if (options.dryRun) {
    agent.skills = agent.skills || {};
    Object.values(agent.skills).forEach(skill => {
      if (skill && skill.options) {
        skill.options.dryRun = true;
      }
    });
  }

  // Generate code
  return await agent[method](spec);
}

// Export handlers for use by the main CLI
export { handleGenerate, handleList, handleInit };

// Run the program if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  program.parse();
}
