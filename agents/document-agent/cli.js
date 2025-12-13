#!/usr/bin/env node

/**
 * Document Agent CLI
 *
 * Command-line interface for document-agent operations
 * Provides easy access to document parsing, validation, and synchronization
 *
 * Usage:
 *   node cli.js parse-docs <doc-paths...>
 *   node cli.js update-docs <code-paths...>
 *   node cli.js validate <doc-paths...>
 *   node cli.js detect-conflicts <code-paths...> <doc-paths...>
 *   node cli.js clear-cache
 *   node cli.js stats
 */

import { getDocumentAgent } from './document-agent.js';
import { createLogger } from '../../foundation/common/logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('DocumentAgentCLI');

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  const agent = getDocumentAgent();
  await agent.initialize();

  try {
    switch (command) {
      case 'parse-docs':
        await parseDocsCommand(agent, args.slice(1));
        break;

      case 'update-docs':
        await updateDocsCommand(agent, args.slice(1));
        break;

      case 'validate':
        await validateCommand(agent, args.slice(1));
        break;

      case 'detect-conflicts':
        await detectConflictsCommand(agent, args.slice(1));
        break;

      case 'generate-digests':
        await generateDigestsCommand(agent, args.slice(1));
        break;

      case 'clear-cache':
        await clearCacheCommand(agent);
        break;

      case 'stats':
        await statsCommand(agent);
        break;

      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Command failed:', error);
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse documentation files and generate code digests
 */
async function parseDocsCommand(agent, docPaths) {
  if (docPaths.length === 0) {
    console.error('Error: No documentation paths provided');
    printUsage();
    process.exit(1);
  }

  console.log(`\n📖 Parsing ${docPaths.length} documentation file(s)...\n`);

  const results = await agent.parseDocumentation(docPaths);

  console.log('✅ Parsing complete!\n');
  console.log('Parsed Documentation:');
  console.log(`  - API: ${results.parsedDocs.api ? '✓' : '✗'}`);
  console.log(`  - Architecture: ${results.parsedDocs.architecture ? '✓' : '✗'}`);
  console.log(`  - Features: ${results.parsedDocs.features ? '✓' : '✗'}`);
  console.log(`  - React: ${results.parsedDocs.react ? '✓' : '✗'}`);
  console.log(`  - Flutter: ${results.parsedDocs.flutter ? '✓' : '✗'}`);

  console.log('\nGenerated Digests:');
  console.log(`  - Backend: ${results.digests.backend ? '✓' : '✗'}`);
  console.log(`  - Admin: ${results.digests.admin ? '✓' : '✗'}`);
  console.log(`  - Users: ${results.digests.users ? '✓' : '✗'}`);
  console.log(`  - Drivers: ${results.digests.drivers ? '✓' : '✗'}`);

  if (results.digests.backend) {
    console.log('\nBackend Digest Summary:');
    console.log(`  - Routes: ${results.digests.backend.routes.length}`);
    console.log(`  - Controllers: ${results.digests.backend.controllers.length}`);
    console.log(`  - Models: ${results.digests.backend.models.length}`);
    console.log(`  - Services: ${results.digests.backend.services.length}`);
  }

  // Save results to file
  const outputPath = 'document-agent-results.json';
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}\n`);
}

/**
 * Update documentation from code changes
 */
async function updateDocsCommand(agent, codePaths) {
  if (codePaths.length === 0) {
    console.error('Error: No code paths provided');
    printUsage();
    process.exit(1);
  }

  console.log(`\n🔄 Updating documentation from ${codePaths.length} code file(s)...\n`);

  const results = await agent.updateDocsFromCode({
    files: codePaths,
    agent: 'cli'
  });

  console.log('✅ Documentation update complete!\n');
  console.log('Results:');
  console.log(`  - Files parsed: ${results.parsed}`);
  console.log(`  - Documents updated: ${results.updated}`);
  console.log(`  - Breaking changes: ${results.breakingChanges.length}`);
  console.log(`  - Conflicts detected: ${results.conflicts.length}`);

  if (results.updatedFiles.length > 0) {
    console.log('\nUpdated Files:');
    results.updatedFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
  }

  if (results.breakingChanges.length > 0) {
    console.log('\n⚠️  Breaking Changes Detected:');
    results.breakingChanges.forEach((change, i) => {
      console.log(`  ${i + 1}. ${change.description || change.type}`);
    });
  }

  // Save results to file
  const outputPath = 'docs-update-results.json';
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}\n`);
}

/**
 * Validate documentation quality
 */
async function validateCommand(agent, docPaths) {
  if (docPaths.length === 0) {
    console.error('Error: No documentation paths provided');
    printUsage();
    process.exit(1);
  }

  console.log(`\n✓ Validating ${docPaths.length} document(s)...\n`);

  // Read documents
  const documents = [];
  for (const docPath of docPaths) {
    const content = await fs.readFile(docPath, 'utf-8');
    const ext = path.extname(docPath);

    documents.push({
      type: guessDocType(docPath),
      content,
      metadata: {
        title: path.basename(docPath, ext),
        path: docPath
      }
    });
  }

  const results = await agent.validateDocumentation(documents);

  console.log('📊 Validation Results:\n');
  console.log(`Total: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);

  console.log('\nDetails:');
  results.details.forEach((detail, i) => {
    const status = detail.valid ? '✅' : '❌';
    console.log(`\n  ${i + 1}. ${status} ${detail.document} (Score: ${detail.score}/100)`);

    if (detail.errors.length > 0) {
      console.log('     Errors:');
      detail.errors.forEach(err => {
        console.log(`       - ${err.message}`);
      });
    }

    if (detail.warnings.length > 0) {
      console.log('     Warnings:');
      detail.warnings.forEach(warn => {
        console.log(`       - ${warn.message}`);
      });
    }
  });

  // Save results to file
  const outputPath = 'validation-results.json';
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}\n`);
}

/**
 * Detect conflicts between code and documentation
 */
async function detectConflictsCommand(agent, paths) {
  if (paths.length < 2) {
    console.error('Error: Need both code and documentation paths');
    console.error('Usage: detect-conflicts <code-path> <doc-path>');
    process.exit(1);
  }

  const codePaths = [paths[0]];
  const docPaths = paths.slice(1);

  console.log(`\n🔍 Detecting conflicts...\n`);
  console.log(`Code files: ${codePaths.length}`);
  console.log(`Doc files: ${docPaths.length}\n`);

  const results = await agent.detectConflicts(codePaths, docPaths);

  console.log('✅ Conflict detection complete!\n');
  console.log(`Conflicts found: ${results.conflicts.length}`);

  if (results.conflicts.length > 0) {
    console.log('\n⚠️  Conflicts:');
    results.conflicts.forEach((conflict, i) => {
      console.log(`\n  ${i + 1}. ${conflict.type || 'Conflict'}`);
      console.log(`     ${conflict.message || conflict.description}`);
      if (conflict.location) {
        console.log(`     Location: ${conflict.location}`);
      }
    });
  }

  // Save results to file
  const outputPath = 'conflicts-results.json';
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}\n`);
}

/**
 * Generate code digests from documentation
 */
async function generateDigestsCommand(agent, docPaths) {
  if (docPaths.length === 0) {
    console.error('Error: No documentation paths provided');
    printUsage();
    process.exit(1);
  }

  console.log(`\n⚙️  Generating code digests from ${docPaths.length} document(s)...\n`);

  const parsedDocs = await agent.parseDocumentation(docPaths);
  const digests = parsedDocs.digests;

  console.log('✅ Digest generation complete!\n');

  Object.entries(digests).forEach(([platform, digest]) => {
    if (digest) {
      console.log(`\n${platform.toUpperCase()} Digest:`);
      console.log(`  Platform: ${digest.platform}`);
      console.log(`  Framework: ${digest.framework || 'N/A'}`);

      if (digest.routes) {
        console.log(`  Routes: ${digest.routes.length}`);
      }
      if (digest.controllers) {
        console.log(`  Controllers: ${digest.controllers.length}`);
      }
      if (digest.models) {
        console.log(`  Models: ${digest.models.length}`);
      }
      if (digest.services) {
        console.log(`  Services: ${digest.services.length}`);
      }
      if (digest.components) {
        console.log(`  Components: ${digest.components.length}`);
      }
    }
  });

  // Save digests to files
  for (const [platform, digest] of Object.entries(digests)) {
    if (digest) {
      const outputPath = `${platform}-digest.json`;
      await fs.writeFile(outputPath, JSON.stringify(digest, null, 2));
      console.log(`\n💾 ${platform} digest saved to: ${outputPath}`);
    }
  }

  console.log();
}

/**
 * Clear document cache
 */
async function clearCacheCommand(agent) {
  console.log('\n🗑️  Clearing document cache...\n');
  await agent.clearCache();
  console.log('✅ Cache cleared successfully!\n');
}

/**
 * Display cache statistics
 */
async function statsCommand(agent) {
  console.log('\n📊 Document Agent Statistics:\n');

  const stats = agent.getCacheStats();

  console.log('Cache:');
  console.log(`  - Entries: ${stats.entries}`);
  console.log(`  - Total size: ${formatBytes(stats.totalSizeBytes)}`);
  console.log(`  - Cache directory: ${stats.cacheDir}`);

  console.log();
}

/**
 * Guess document type from file path
 */
function guessDocType(filePath) {
  const lower = filePath.toLowerCase();

  if (lower.includes('api') || lower.includes('openapi')) return 'api';
  if (lower.includes('architecture')) return 'architecture';
  if (lower.includes('feature') || lower.includes('requirements')) return 'feature';

  return 'general';
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
📚 Document Agent CLI

Usage:
  node cli.js <command> [options]

Commands:
  parse-docs <doc-paths...>              Parse documentation and generate code digests
  update-docs <code-paths...>            Update documentation from code changes
  validate <doc-paths...>                Validate documentation quality
  detect-conflicts <code> <docs...>      Detect code-documentation conflicts
  generate-digests <doc-paths...>        Generate code digests only
  clear-cache                            Clear document cache
  stats                                  Show cache statistics
  help                                   Show this help message

Examples:
  # Parse API documentation
  node cli.js parse-docs docs/api.md

  # Update docs after code changes
  node cli.js update-docs backend/src/controllers/users.js

  # Validate documentation
  node cli.js validate docs/*.md

  # Detect conflicts
  node cli.js detect-conflicts backend/src/app.js docs/api.md

  # Clear cache
  node cli.js clear-cache

For more information, see the documentation at .claude/agents/document-agent/README.md
`);
}

// Run CLI
main().catch(error => {
  logger.error('Fatal error:', error);
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
