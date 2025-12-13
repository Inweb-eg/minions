/**
 * React Test Generator - Vitest Test Generation
 *
 * Phase 7.2: Intelligent Test Generators
 * Generates Vitest tests for React components and hooks
 */

import { BaseTestGenerator, TEST_TYPE, EDGE_CASE } from './base-test-generator.js';
import * as path from 'path';
import * as t from '@babel/types';

/**
 * ReactTestGenerator
 * Generates Vitest tests for React components and hooks
 */
export class ReactTestGenerator extends BaseTestGenerator {
  constructor() {
    super('ReactTestGenerator', 'react');
  }

  /**
   * Generate tests for source file
   * @param {string} sourceFile - Source file path
   * @param {Object} options - Generation options
   * @returns {Object} Generated test info
   */
  async generateTests(sourceFile, options = {}) {
    this.logger.info(`Generating React tests for: ${sourceFile}`);

    const content = this.readFile(sourceFile);
    if (!content) {
      return { success: false, error: 'Failed to read source file' };
    }

    const ast = this.parseCode(content, sourceFile);
    if (!ast) {
      return { success: false, error: 'Failed to parse source file' };
    }

    // Detect what to test
    const components = this.extractComponents(ast);
    const hooks = this.extractHooks(ast);

    this.logger.info(`Found ${components.length} components and ${hooks.length} hooks`);

    if (components.length === 0 && hooks.length === 0) {
      return { success: false, error: 'No testable components or hooks found' };
    }

    // Generate appropriate test file
    let testContent;
    if (components.length > 0) {
      testContent = this.generateComponentTestFile(sourceFile, components, options);
    } else if (hooks.length > 0) {
      testContent = this.generateHookTestFile(sourceFile, hooks, options);
    }

    const testFilePath = this.getTestFilePath(sourceFile, options);

    if (!options.dryRun) {
      this.writeFile(testFilePath, testContent);
    }

    this.generatedTests.push({
      sourceFile,
      testFile: testFilePath,
      componentsCount: components.length,
      hooksCount: hooks.length,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      testFilePath,
      componentsCount: components.length,
      hooksCount: hooks.length
    };
  }

  /**
   * Extract React components
   * @param {Object} ast - AST
   * @returns {Array} Components
   */
  extractComponents(ast) {
    const components = [];

    this.traverse(ast, {
      // Function components
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name && /^[A-Z]/.test(name)) {  // Starts with capital
          // Check if it returns JSX
          if (this.returnsJSX(path.node)) {
            components.push({
              type: 'function',
              name,
              params: path.node.params,
              exported: this.isExported(path),
              node: path.node
            });
          }
        }
      },

      // Arrow function components
      VariableDeclarator: (path) => {
        const name = path.node.id?.name;
        if (name && /^[A-Z]/.test(name)) {
          if (path.node.init && path.node.init.type === 'ArrowFunctionExpression') {
            if (this.returnsJSX(path.node.init)) {
              components.push({
                type: 'arrow',
                name,
                params: path.node.init.params,
                exported: this.isExported(path.parentPath.parentPath),
                node: path.node.init
              });
            }
          }
        }
      },

      // Class components
      ClassDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name && /^[A-Z]/.test(name)) {
          // Check if extends React.Component or Component
          const superClass = path.node.superClass;
          if (superClass) {
            components.push({
              type: 'class',
              name,
              exported: this.isExported(path),
              node: path.node
            });
          }
        }
      }
    });

    return components;
  }

  /**
   * Extract React hooks
   * @param {Object} ast - AST
   * @returns {Array} Hooks
   */
  extractHooks(ast) {
    const hooks = [];

    this.traverse(ast, {
      // Function hooks
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name && name.startsWith('use') && /^use[A-Z]/.test(name)) {
          hooks.push({
            type: 'function',
            name,
            params: path.node.params,
            exported: this.isExported(path),
            node: path.node
          });
        }
      },

      // Arrow function hooks
      VariableDeclarator: (path) => {
        const name = path.node.id?.name;
        if (name && name.startsWith('use') && /^use[A-Z]/.test(name)) {
          if (path.node.init && path.node.init.type === 'ArrowFunctionExpression') {
            hooks.push({
              type: 'arrow',
              name,
              params: path.node.init.params,
              exported: this.isExported(path.parentPath.parentPath),
              node: path.node.init
            });
          }
        }
      }
    });

    return hooks;
  }

  /**
   * Check if function returns JSX
   * @param {Object} node - Function node
   * @returns {boolean} True if returns JSX
   */
  returnsJSX(node) {
    let hasJSX = false;

    this.traverse({ type: 'Program', body: [node] }, {
      JSXElement: () => {
        hasJSX = true;
      },
      JSXFragment: () => {
        hasJSX = true;
      }
    });

    return hasJSX;
  }

  /**
   * Generate component test file
   * @param {string} sourceFile - Source file path
   * @param {Array} components - Components
   * @param {Object} options - Options
   * @returns {string} Test content
   */
  generateComponentTestFile(sourceFile, components, options = {}) {
    const lines = [];
    const fileName = path.basename(sourceFile, path.extname(sourceFile));
    const relativePath = path.relative(path.dirname(this.getTestFilePath(sourceFile, options)), sourceFile);

    // Imports
    lines.push("import { describe, it, expect, vi } from 'vitest';");
    lines.push("import { render, screen, fireEvent } from '@testing-library/react';");

    // Import components
    const exportedComponents = components.filter(c => c.exported);
    if (exportedComponents.length > 0) {
      const imports = exportedComponents.map(c => c.name).join(', ');
      lines.push(`import { ${imports} } from '${relativePath}';`);
    }

    lines.push('');

    // Test suite for each component
    components.forEach(component => {
      if (component.exported || options.includePrivate) {
        lines.push(this.generateComponentTests(component, options));
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate tests for component
   * @param {Object} component - Component info
   * @param {Object} options - Options
   * @returns {string} Test code
   */
  generateComponentTests(component, options = {}) {
    const lines = [];

    lines.push(`describe('${component.name}', () => {`);

    // Render test
    lines.push(this.generateRenderTest(component));

    // Props tests
    if (component.params && component.params.length > 0) {
      lines.push(this.generatePropsTest(component));
    }

    // Interaction tests
    if (options.includeInteractions !== false) {
      lines.push(this.generateInteractionTest(component));
    }

    // Snapshot test
    if (options.includeSnapshots !== false) {
      lines.push(this.generateSnapshotTest(component));
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate render test
   * @param {Object} component - Component info
   * @returns {string} Test code
   */
  generateRenderTest(component) {
    const lines = [];

    lines.push(`  it('should render without crashing', () => {`);
    lines.push(`    const { container } = render(<${component.name} />);`);
    lines.push(`    expect(container).toBeDefined();`);
    lines.push('  });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate props test
   * @param {Object} component - Component info
   * @returns {string} Test code
   */
  generatePropsTest(component) {
    const lines = [];

    lines.push(`  it('should handle props correctly', () => {`);
    lines.push(`    const props = {`);

    // Generate mock props
    component.params.forEach(param => {
      const name = param.name || 'props';
      if (name === 'props') {
        // Destructured props - generate sample
        lines.push(`      title: 'Test Title',`);
        lines.push(`      onClick: vi.fn(),`);
      }
    });

    lines.push(`    };`);
    lines.push(`    const { container } = render(<${component.name} {...props} />);`);
    lines.push(`    expect(container).toBeDefined();`);
    lines.push(`    // TODO: Add specific prop assertions`);
    lines.push('  });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate interaction test
   * @param {Object} component - Component info
   * @returns {string} Test code
   */
  generateInteractionTest(component) {
    const lines = [];

    lines.push(`  it('should handle user interactions', () => {`);
    lines.push(`    const handleClick = vi.fn();`);
    lines.push(`    const { container } = render(<${component.name} onClick={handleClick} />);`);
    lines.push(``);
    lines.push(`    // TODO: Find and click interactive elements`);
    lines.push(`    // const button = screen.getByRole('button');`);
    lines.push(`    // fireEvent.click(button);`);
    lines.push(`    // expect(handleClick).toHaveBeenCalled();`);
    lines.push('  });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate snapshot test
   * @param {Object} component - Component info
   * @returns {string} Test code
   */
  generateSnapshotTest(component) {
    const lines = [];

    lines.push(`  it('should match snapshot', () => {`);
    lines.push(`    const { container } = render(<${component.name} />);`);
    lines.push(`    expect(container).toMatchSnapshot();`);
    lines.push('  });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate hook test file
   * @param {string} sourceFile - Source file path
   * @param {Array} hooks - Hooks
   * @param {Object} options - Options
   * @returns {string} Test content
   */
  generateHookTestFile(sourceFile, hooks, options = {}) {
    const lines = [];
    const fileName = path.basename(sourceFile, path.extname(sourceFile));
    const relativePath = path.relative(path.dirname(this.getTestFilePath(sourceFile, options)), sourceFile);

    // Imports
    lines.push("import { describe, it, expect } from 'vitest';");
    lines.push("import { renderHook, act } from '@testing-library/react';");

    // Import hooks
    const exportedHooks = hooks.filter(h => h.exported);
    if (exportedHooks.length > 0) {
      const imports = exportedHooks.map(h => h.name).join(', ');
      lines.push(`import { ${imports} } from '${relativePath}';`);
    }

    lines.push('');

    // Test suite for each hook
    hooks.forEach(hook => {
      if (hook.exported || options.includePrivate) {
        lines.push(this.generateHookTests(hook, options));
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate tests for hook
   * @param {Object} hook - Hook info
   * @param {Object} options - Options
   * @returns {string} Test code
   */
  generateHookTests(hook, options = {}) {
    const lines = [];

    lines.push(`describe('${hook.name}', () => {`);

    // Basic test
    lines.push(`  it('should initialize correctly', () => {`);
    lines.push(`    const { result } = renderHook(() => ${hook.name}());`);
    lines.push(`    expect(result.current).toBeDefined();`);
    lines.push(`    // TODO: Add specific assertions`);
    lines.push('  });');
    lines.push('');

    // Update test
    lines.push(`  it('should update correctly', () => {`);
    lines.push(`    const { result } = renderHook(() => ${hook.name}());`);
    lines.push(``);
    lines.push(`    act(() => {`);
    lines.push(`      // TODO: Trigger hook update`);
    lines.push(`    });`);
    lines.push(``);
    lines.push(`    // expect(result.current).toBe(expectedValue);`);
    lines.push('  });');

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get test file path
   * @param {string} sourceFile - Source file path
   * @param {Object} options - Options
   * @returns {string} Test file path
   */
  getTestFilePath(sourceFile, options = {}) {
    const dir = path.dirname(sourceFile);
    const ext = path.extname(sourceFile);
    const basename = path.basename(sourceFile, ext);

    // For components: ComponentName.test.jsx
    // For hooks: useHook.test.js
    return path.join(dir, `${basename}.test${ext}`);
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getReactTestGenerator() {
  if (!generatorInstance) {
    generatorInstance = new ReactTestGenerator();
  }
  return generatorInstance;
}
