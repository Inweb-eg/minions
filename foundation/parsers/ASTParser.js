/**
 * ASTParser - JavaScript/TypeScript Code Parser
 *
 * Shared foundation module for AST parsing across all agents.
 * Parses JavaScript/TypeScript code into Abstract Syntax Trees (AST)
 * and provides traversal utilities for code analysis.
 *
 * Capabilities:
 * - ES6+ syntax support
 * - JSX/TSX support
 * - TypeScript support
 * - Import/export extraction
 * - Function/class extraction
 * - Complexity calculation
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { createLogger } from '../common/logger.js';

const logger = createLogger('ASTParser');

/**
 * ASTParser
 * Parses JavaScript/TypeScript code and provides traversal utilities
 */
export class ASTParser {
  constructor() {
    this.logger = logger;
    this.parserOptions = {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator'
      ]
    };
  }

  /**
   * Parse JavaScript/TypeScript code into AST
   * @param {string} code - Source code
   * @param {Object} options - Parser options
   * @returns {Object} AST and metadata
   */
  parse(code, options = {}) {
    try {
      this.logger.debug('Parsing code');

      const ast = parse(code, {
        ...this.parserOptions,
        ...options
      });

      return {
        success: true,
        ast,
        metadata: {
          parsedAt: new Date().toISOString(),
          nodeCount: this.countNodes(ast)
        }
      };
    } catch (error) {
      this.logger.error('Error parsing code:', error);
      return {
        success: false,
        error: error.message,
        location: error.loc
      };
    }
  }

  /**
   * Traverse AST with visitor pattern
   * @param {Object} ast - Abstract Syntax Tree
   * @param {Object} visitors - Visitor functions
   */
  traverse(ast, visitors) {
    try {
      const traverseFn = traverse.default || traverse;
      traverseFn(ast, visitors);
    } catch (error) {
      this.logger.error('Error traversing AST:', error);
      throw error;
    }
  }

  /**
   * Count total nodes in AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {number} Node count
   */
  countNodes(ast) {
    let count = 0;
    this.traverse(ast, {
      enter() {
        count++;
      }
    });
    return count;
  }

  /**
   * Extract all functions from AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {Array} Function declarations and expressions
   */
  extractFunctions(ast) {
    const functions = [];

    this.traverse(ast, {
      FunctionDeclaration(path) {
        functions.push({
          type: 'FunctionDeclaration',
          name: path.node.id?.name,
          params: path.node.params.map(p => p.name || 'destructured'),
          async: path.node.async,
          generator: path.node.generator,
          loc: path.node.loc
        });
      },
      FunctionExpression(path) {
        functions.push({
          type: 'FunctionExpression',
          name: path.node.id?.name || 'anonymous',
          params: path.node.params.map(p => p.name || 'destructured'),
          async: path.node.async,
          generator: path.node.generator,
          loc: path.node.loc
        });
      },
      ArrowFunctionExpression(path) {
        functions.push({
          type: 'ArrowFunctionExpression',
          name: 'arrow',
          params: path.node.params.map(p => p.name || 'destructured'),
          async: path.node.async,
          loc: path.node.loc
        });
      }
    });

    return functions;
  }

  /**
   * Extract all imports from AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {Array} Import declarations
   */
  extractImports(ast) {
    const imports = [];

    this.traverse(ast, {
      ImportDeclaration(path) {
        imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(spec => ({
            type: spec.type,
            local: spec.local.name,
            imported: spec.imported?.name
          })),
          loc: path.node.loc
        });
      }
    });

    return imports;
  }

  /**
   * Extract all exports from AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {Array} Export declarations
   */
  extractExports(ast) {
    const exports = [];

    this.traverse(ast, {
      ExportNamedDeclaration(path) {
        exports.push({
          type: 'named',
          declaration: path.node.declaration?.type,
          specifiers: path.node.specifiers?.map(s => s.exported.name),
          loc: path.node.loc
        });
      },
      ExportDefaultDeclaration(path) {
        exports.push({
          type: 'default',
          declaration: path.node.declaration?.type,
          loc: path.node.loc
        });
      }
    });

    return exports;
  }

  /**
   * Extract all classes from AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {Array} Class declarations
   */
  extractClasses(ast) {
    const classes = [];
    const self = this;

    this.traverse(ast, {
      ClassDeclaration(path) {
        classes.push({
          type: 'ClassDeclaration',
          name: path.node.id.name,
          superClass: path.node.superClass?.name,
          methods: self.extractClassMethods(path.node),
          loc: path.node.loc
        });
      }
    });

    return classes;
  }

  /**
   * Extract methods from class node
   * @param {Object} classNode - Class AST node
   * @returns {Array} Method definitions
   */
  extractClassMethods(classNode) {
    return classNode.body.body
      .filter(member => member.type === 'ClassMethod')
      .map(method => ({
        name: method.key.name,
        kind: method.kind,
        static: method.static,
        async: method.async,
        params: method.params.map(p => p.name || 'destructured')
      }));
  }

  /**
   * Extract all variables from AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {Array} Variable declarations
   */
  extractVariables(ast) {
    const variables = [];

    this.traverse(ast, {
      VariableDeclaration(path) {
        path.node.declarations.forEach(declaration => {
          variables.push({
            kind: path.node.kind,
            name: declaration.id.name,
            initialized: declaration.init !== null,
            loc: declaration.loc
          });
        });
      }
    });

    return variables;
  }

  /**
   * Calculate cyclomatic complexity for a function
   * @param {Object} functionNode - Function AST node
   * @returns {number} Complexity score
   */
  calculateComplexity(functionNode) {
    let complexity = 1; // Base complexity

    // Wrap the function node in a minimal AST for traversal
    const wrappedAST = {
      type: 'File',
      program: {
        type: 'Program',
        body: [functionNode],
        sourceType: 'module'
      }
    };

    const traverseFn = traverse.default || traverse;
    traverseFn(wrappedAST, {
      // Decision points increase complexity
      IfStatement() { complexity++; },
      ConditionalExpression() { complexity++; },
      SwitchCase(path) {
        if (path.node.test) complexity++; // Don't count default case
      },
      ForStatement() { complexity++; },
      ForInStatement() { complexity++; },
      ForOfStatement() { complexity++; },
      WhileStatement() { complexity++; },
      DoWhileStatement() { complexity++; },
      CatchClause() { complexity++; },
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      }
    });

    return complexity;
  }

  /**
   * Check if node is a type definition
   * @param {Object} node - AST node
   * @returns {boolean} True if type node
   */
  isTypeNode(node) {
    return t.isTSTypeAnnotation(node) ||
           t.isTSTypeReference(node) ||
           t.isTSTypeAliasDeclaration(node) ||
           t.isTSInterfaceDeclaration(node);
  }

  /**
   * Get node location info
   * @param {Object} node - AST node
   * @returns {Object} Location details
   */
  getLocation(node) {
    if (!node.loc) return null;

    return {
      start: {
        line: node.loc.start.line,
        column: node.loc.start.column
      },
      end: {
        line: node.loc.end.line,
        column: node.loc.end.column
      }
    };
  }
}

/**
 * Get singleton instance of ASTParser
 */
let parserInstance = null;

export function getASTParser() {
  if (!parserInstance) {
    parserInstance = new ASTParser();
  }
  return parserInstance;
}

export default ASTParser;
