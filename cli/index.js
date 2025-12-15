#!/usr/bin/env node
/**
 * Minions CLI Entry Point
 *
 * Main entry point for the minions command-line interface.
 * Provides commands for code generation, project initialization, and more.
 */

import { program } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let version = '1.0.0';

try {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  version = packageJson.version || '1.0.0';
} catch (e) {
  // Use default version
}

// ASCII art banner
const banner = `
${chalk.cyan('╔══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.yellow('███╗   ███╗██╗███╗   ██╗██╗ ██████╗ ███╗   ██╗███████╗')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('████╗ ████║██║████╗  ██║██║██╔═══██╗████╗  ██║██╔════╝')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('██╔████╔██║██║██╔██╗ ██║██║██║   ██║██╔██╗ ██║███████╗')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('██║╚██╔╝██║██║██║╚██╗██║██║██║   ██║██║╚██╗██║╚════██║')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('██║ ╚═╝ ██║██║██║ ╚████║██║╚██████╔╝██║ ╚████║███████║')}  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.yellow('╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝')}  ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════╝')}
${chalk.gray('           Multi-Agent Code Generation Framework')}
`;

// Print banner on help
program.addHelpText('beforeAll', banner);

program
  .name('minions')
  .description('Multi-agent framework for code generation')
  .version(version);

// Import and register subcommands
const registerCommands = async () => {
  // Generate command
  program
    .command('generate <platform> <generator>')
    .alias('g')
    .description('Generate code using writer agents')
    .option('-n, --name <name>', 'Name of the generated item')
    .option('-t, --type <type>', 'Type variant')
    .option('-o, --output <path>', 'Output directory', process.cwd())
    .option('-d, --dry-run', 'Preview without writing files')
    .option('-i, --interactive', 'Interactive mode')
    .option('--props <props>', 'Props (name:type,name:type)')
    .option('--fields <fields>', 'Fields (name:type,name:type)')
    .action(async (platform, generator, options) => {
      const { handleGenerate } = await import('./generate.js');
      await handleGenerate(platform, generator, options);
    });

  // List command
  program
    .command('list [platform]')
    .alias('ls')
    .description('List available generators')
    .action(async (platform) => {
      const { handleList } = await import('./generate.js');
      handleList(platform);
    });

  // Init command
  program
    .command('init')
    .description('Initialize minions configuration')
    .option('-p, --platform <platform>', 'Target platform')
    .action(async (options) => {
      const { handleInit } = await import('./generate.js');
      await handleInit(options);
    });

  // Quick generation shortcuts
  program
    .command('flutter <generator>')
    .description('Generate Flutter code (shortcut)')
    .option('-n, --name <name>', 'Name')
    .option('-t, --type <type>', 'Type')
    .option('-o, --output <path>', 'Output', process.cwd())
    .option('-d, --dry-run', 'Dry run')
    .action(async (generator, options) => {
      const { handleGenerate } = await import('./generate.js');
      await handleGenerate('flutter', generator, options);
    });

  program
    .command('backend <generator>')
    .description('Generate backend code (shortcut)')
    .option('-n, --name <name>', 'Name')
    .option('-t, --type <type>', 'Type')
    .option('-o, --output <path>', 'Output', process.cwd())
    .option('-d, --dry-run', 'Dry run')
    .action(async (generator, options) => {
      const { handleGenerate } = await import('./generate.js');
      await handleGenerate('backend', generator, options);
    });

  program
    .command('frontend <generator>')
    .description('Generate frontend code (shortcut)')
    .option('-n, --name <name>', 'Name')
    .option('-t, --type <type>', 'Type')
    .option('-o, --output <path>', 'Output', process.cwd())
    .option('-d, --dry-run', 'Dry run')
    .action(async (generator, options) => {
      const { handleGenerate } = await import('./generate.js');
      await handleGenerate('frontend', generator, options);
    });
};

// Register commands and parse
registerCommands().then(() => {
  program.parse();
}).catch(error => {
  console.error(chalk.red('Error initializing CLI:'), error.message);
  process.exit(1);
});
