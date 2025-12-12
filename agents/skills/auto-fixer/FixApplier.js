/**
 * FixApplier - Applies generated fixes and verifies them
 *
 * Handles:
 * - Applying code changes to files
 * - Creating backups before changes
 * - Running tests to verify fixes
 * - Rolling back on failure
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createLogger } from '../../../../agents/foundation/common/logger.js';

const logger = createLogger('FixApplier');

export class FixApplier {
  constructor(options = {}) {
    this.options = {
      createBackups: true,
      backupDir: '.fix-backups',
      verifyFixes: true,
      maxRetries: 3,
      testCommand: 'npm test',
      testTimeout: 120000, // 2 minutes
      ...options
    };

    this.appliedFixes = [];
    this.backups = new Map();
  }

  /**
   * Apply a generated fix
   * @param {Object} fix - Fix object from FixGenerator
   * @returns {Object} Result of applying the fix
   */
  async applyFix(fix) {
    if (!fix || !fix.changes || fix.changes.length === 0) {
      return {
        success: false,
        message: 'No changes to apply'
      };
    }

    logger.info(`Applying fix: ${fix.pattern || 'unknown'} (${fix.changes.length} changes)`);

    const results = [];
    const appliedChanges = [];

    try {
      // Apply each change
      for (const change of fix.changes) {
        if (!change.file) {
          logger.warn('Change has no file specified, skipping');
          continue;
        }

        // Skip suggestion-only changes
        if (change.suggestion && !change.fixed && !change.type) {
          results.push({
            file: change.file,
            applied: false,
            type: 'suggestion',
            message: change.suggestion
          });
          continue;
        }

        const result = await this.applyChange(change);
        results.push(result);

        if (result.applied) {
          appliedChanges.push({
            change,
            backup: result.backup
          });
        }
      }

      // Record applied fixes
      this.appliedFixes.push({
        fix,
        results,
        appliedChanges,
        timestamp: new Date().toISOString()
      });

      const successCount = results.filter(r => r.applied).length;
      const suggestionCount = results.filter(r => r.type === 'suggestion').length;

      return {
        success: successCount > 0 || suggestionCount > 0,
        applied: successCount,
        suggestions: suggestionCount,
        total: fix.changes.length,
        results,
        message: `Applied ${successCount} fix(es), ${suggestionCount} suggestion(s)`
      };

    } catch (error) {
      logger.error('Failed to apply fix:', error);

      // Attempt rollback
      if (appliedChanges.length > 0) {
        await this.rollbackChanges(appliedChanges);
      }

      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * Apply a single change to a file
   */
  async applyChange(change) {
    const filePath = this.resolveFilePath(change.file);

    logger.info(`Applying change to ${filePath}:${change.line || 'N/A'}`);

    // Create backup
    let backupPath = null;
    if (this.options.createBackups && fs.existsSync(filePath)) {
      backupPath = await this.createBackup(filePath);
    }

    try {
      // Handle different change types
      switch (change.type) {
        case 'prepend':
          await this.prependToFile(filePath, change.fixed);
          break;
        case 'append':
          await this.appendToFile(filePath, change.fixed);
          break;
        case 'insert':
          await this.insertAtLine(filePath, change.line, change.fixed);
          break;
        case 'delete':
          await this.deleteLine(filePath, change.line);
          break;
        case 'replace':
        default:
          if (change.original && change.fixed) {
            await this.replaceInFile(filePath, change.line, change.original, change.fixed);
          } else if (change.line && change.fixed) {
            await this.replaceLineInFile(filePath, change.line, change.fixed);
          } else {
            return {
              file: change.file,
              applied: false,
              message: 'Cannot apply change: missing original or fixed content'
            };
          }
      }

      return {
        file: change.file,
        line: change.line,
        applied: true,
        backup: backupPath,
        description: change.description
      };

    } catch (error) {
      logger.error(`Failed to apply change to ${filePath}:`, error);

      // Restore from backup
      if (backupPath) {
        await this.restoreFromBackup(filePath, backupPath);
      }

      return {
        file: change.file,
        applied: false,
        error: error.message
      };
    }
  }

  /**
   * Create a backup of a file
   */
  async createBackup(filePath) {
    const backupDir = path.join(path.dirname(filePath), this.options.backupDir);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`);

    fs.copyFileSync(filePath, backupPath);
    this.backups.set(filePath, backupPath);

    logger.debug(`Created backup: ${backupPath}`);
    return backupPath;
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(filePath, backupPath) {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      logger.info(`Restored ${filePath} from backup`);
      return true;
    }
    return false;
  }

  /**
   * Prepend content to file
   */
  async prependToFile(filePath, content) {
    const existingContent = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf-8')
      : '';
    fs.writeFileSync(filePath, content + '\n' + existingContent);
  }

  /**
   * Append content to file
   */
  async appendToFile(filePath, content) {
    fs.appendFileSync(filePath, '\n' + content);
  }

  /**
   * Insert content at specific line
   */
  async insertAtLine(filePath, lineNumber, content) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const index = Math.max(0, lineNumber - 1);
    lines.splice(index, 0, content);
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  /**
   * Delete a specific line
   */
  async deleteLine(filePath, lineNumber) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const index = lineNumber - 1;
    if (index >= 0 && index < lines.length) {
      lines.splice(index, 1);
      fs.writeFileSync(filePath, lines.join('\n'));
    }
  }

  /**
   * Replace content in file at specific line
   */
  async replaceInFile(filePath, lineNumber, original, replacement) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const index = lineNumber - 1;

    if (index >= 0 && index < lines.length) {
      const currentLine = lines[index];
      const trimmedOriginal = original.trim();

      if (currentLine.includes(trimmedOriginal)) {
        // Safe replacement - original content found
        lines[index] = currentLine.replace(trimmedOriginal, replacement.trim());
        fs.writeFileSync(filePath, lines.join('\n'));
      } else {
        // Content mismatch - do NOT silently replace entire line
        // Log warning and throw error to prevent data loss
        const logger = this.logger || console;
        logger.warn(`[FixApplier] Content mismatch at ${filePath}:${lineNumber}`);
        logger.warn(`  Expected to find: "${trimmedOriginal}"`);
        logger.warn(`  Actual line content: "${currentLine.trim()}"`);
        throw new Error(
          `Cannot safely replace content at ${filePath}:${lineNumber}. ` +
          `Expected "${trimmedOriginal}" but found "${currentLine.trim()}". ` +
          `Use replaceLineInFile() for full line replacement.`
        );
      }
    } else {
      throw new Error(`Line ${lineNumber} out of range (file has ${lines.length} lines)`);
    }
  }

  /**
   * Replace entire line in file
   */
  async replaceLineInFile(filePath, lineNumber, newContent) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const index = lineNumber - 1;

    if (index >= 0 && index < lines.length) {
      // Preserve indentation
      const indent = lines[index].match(/^(\s*)/)?.[1] || '';
      lines[index] = indent + newContent.trim();
      fs.writeFileSync(filePath, lines.join('\n'));
    } else {
      throw new Error(`Line ${lineNumber} out of range`);
    }
  }

  /**
   * Verify fix by running tests
   */
  async verifyFix(testFile = null) {
    if (!this.options.verifyFixes) {
      return { verified: true, skipped: true };
    }

    logger.info('Verifying fix by running tests...');

    let command = this.options.testCommand;
    let args = [];

    // If specific test file, run only that
    if (testFile) {
      if (command.includes('npm test')) {
        command = 'npm';
        args = ['test', '--', testFile];
      } else if (command.includes('jest')) {
        args = [testFile];
      }
    } else {
      const parts = command.split(' ');
      command = parts[0];
      args = parts.slice(1);
    }

    return new Promise((resolve) => {
      const childProc = spawn(command, args, {
        cwd: this.options.projectRoot || process.cwd(),
        shell: true,
        timeout: this.options.testTimeout
      });

      let stdout = '';
      let stderr = '';

      childProc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProc.on('close', (code) => {
        const success = code === 0;
        logger.info(`Test verification ${success ? 'PASSED' : 'FAILED'} (exit code: ${code})`);

        resolve({
          verified: success,
          exitCode: code,
          stdout,
          stderr,
          message: success ? 'Tests passed after fix' : 'Tests still failing after fix'
        });
      });

      childProc.on('error', (error) => {
        logger.error('Test execution failed:', error);
        resolve({
          verified: false,
          error: error.message,
          message: 'Failed to run tests'
        });
      });
    });
  }

  /**
   * Rollback applied changes
   */
  async rollbackChanges(appliedChanges) {
    logger.info(`Rolling back ${appliedChanges.length} changes...`);

    for (const { change, backup } of appliedChanges.reverse()) {
      if (backup) {
        const filePath = this.resolveFilePath(change.file);
        await this.restoreFromBackup(filePath, backup);
      }
    }

    logger.info('Rollback complete');
  }

  /**
   * Rollback all fixes from current session
   */
  async rollbackAll() {
    logger.info('Rolling back all fixes from current session...');

    for (const { appliedChanges } of this.appliedFixes.reverse()) {
      await this.rollbackChanges(appliedChanges);
    }

    this.appliedFixes = [];
    logger.info('All fixes rolled back');
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [filePath, backupPath] of this.backups) {
      try {
        const stats = fs.statSync(backupPath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(backupPath);
          this.backups.delete(filePath);
          cleaned++;
        }
      } catch (error) {
        // Backup already deleted or inaccessible
        this.backups.delete(filePath);
      }
    }

    logger.info(`Cleaned up ${cleaned} old backup(s)`);
    return cleaned;
  }

  /**
   * Resolve file path to absolute
   */
  resolveFilePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.options.projectRoot || process.cwd(), filePath);
  }

  /**
   * Get summary of applied fixes
   */
  getSummary() {
    return {
      totalFixes: this.appliedFixes.length,
      totalChanges: this.appliedFixes.reduce((sum, f) => sum + f.appliedChanges.length, 0),
      backupCount: this.backups.size,
      fixes: this.appliedFixes.map(f => ({
        pattern: f.fix.pattern,
        applied: f.appliedChanges.length,
        timestamp: f.timestamp
      }))
    };
  }
}

// Singleton instance
let instance = null;

export function getFixApplier(options) {
  if (!instance) {
    instance = new FixApplier(options);
  }
  return instance;
}

export default FixApplier;
