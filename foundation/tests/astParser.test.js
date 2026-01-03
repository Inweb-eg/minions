/**
 * ASTParser Tests
 * ================
 * Tests for the JavaScript/TypeScript code parser
 */

import { jest } from '@jest/globals';
import { ASTParser, getASTParser } from '../parsers/ASTParser.js';

describe('ASTParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('Initialization', () => {
    test('creates parser with default options', () => {
      expect(parser.parserOptions).toBeDefined();
      expect(parser.parserOptions.sourceType).toBe('module');
      expect(parser.parserOptions.plugins).toContain('jsx');
      expect(parser.parserOptions.plugins).toContain('typescript');
    });
  });

  describe('Parsing', () => {
    test('parses simple JavaScript code', () => {
      const code = 'const x = 1;';
      const result = parser.parse(code);

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.metadata.parsedAt).toBeDefined();
      expect(result.metadata.nodeCount).toBeGreaterThan(0);
    });

    test('parses function declarations', () => {
      const code = `
        function greet(name) {
          return 'Hello, ' + name;
        }
      `;
      const result = parser.parse(code);

      expect(result.success).toBe(true);
      expect(result.ast.program.body.length).toBeGreaterThan(0);
    });

    test('parses ES6+ syntax', () => {
      const code = `
        const add = (a, b) => a + b;
        const [first, ...rest] = [1, 2, 3];
        const merged = { ...first, b: 2 };
      `;
      const result = parser.parse(code);

      expect(result.success).toBe(true);
    });

    test('parses async/await', () => {
      const code = `
        async function fetchData() {
          const data = await fetch('/api');
          return data.json();
        }
      `;
      const result = parser.parse(code);

      expect(result.success).toBe(true);
    });

    test('parses JSX', () => {
      const code = `
        const Component = () => <div className="test">Hello</div>;
      `;
      const result = parser.parse(code);

      expect(result.success).toBe(true);
    });

    test('parses TypeScript', () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }

        const user: User = { name: 'John', age: 30 };
      `;
      const result = parser.parse(code);

      expect(result.success).toBe(true);
    });

    test('parses class with decorators', () => {
      const code = `
        @decorator
        class MyClass {
          @readonly
          prop = 'value';
        }
      `;
      const result = parser.parse(code);

      expect(result.success).toBe(true);
    });

    test('returns error for invalid syntax', () => {
      const code = 'const x = ;'; // Invalid syntax
      const result = parser.parse(code);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('provides error location for invalid syntax', () => {
      const code = 'const = 5;';
      const result = parser.parse(code);

      expect(result.success).toBe(false);
      expect(result.location).toBeDefined();
    });

    test('accepts custom parser options', () => {
      const code = 'const x = 1;';
      const result = parser.parse(code, { sourceType: 'script' });

      expect(result.success).toBe(true);
    });
  });

  describe('Traversal', () => {
    test('traverses AST with visitor', () => {
      const code = 'const x = 1; const y = 2;';
      const { ast } = parser.parse(code);

      let variableCount = 0;
      parser.traverse(ast, {
        VariableDeclaration() {
          variableCount++;
        }
      });

      expect(variableCount).toBe(2);
    });

    test('handles nested traversal', () => {
      const code = `
        function outer() {
          function inner() {
            return 1;
          }
        }
      `;
      const { ast } = parser.parse(code);

      let functionCount = 0;
      parser.traverse(ast, {
        FunctionDeclaration() {
          functionCount++;
        }
      });

      expect(functionCount).toBe(2);
    });

    test('counts nodes correctly', () => {
      const code = 'const x = 1;';
      const { ast } = parser.parse(code);

      const count = parser.countNodes(ast);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Extract Functions', () => {
    test('extracts function declarations', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions.length).toBe(1);
      expect(functions[0].type).toBe('FunctionDeclaration');
      expect(functions[0].name).toBe('add');
      expect(functions[0].params).toEqual(['a', 'b']);
    });

    test('extracts function expressions', () => {
      const code = `
        const multiply = function mult(a, b) {
          return a * b;
        };
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions.length).toBe(1);
      expect(functions[0].type).toBe('FunctionExpression');
      expect(functions[0].name).toBe('mult');
    });

    test('extracts anonymous function expressions', () => {
      const code = `
        const fn = function() { return 1; };
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe('anonymous');
    });

    test('extracts arrow functions', () => {
      const code = `
        const arrow = (x) => x * 2;
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions.length).toBe(1);
      expect(functions[0].type).toBe('ArrowFunctionExpression');
      expect(functions[0].name).toBe('arrow');
    });

    test('identifies async functions', () => {
      const code = `
        async function fetchData() {
          return await fetch('/api');
        }
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions[0].async).toBe(true);
    });

    test('identifies generator functions', () => {
      const code = `
        function* generator() {
          yield 1;
          yield 2;
        }
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions[0].generator).toBe(true);
    });

    test('handles destructured parameters', () => {
      const code = `
        function process({ name, value }) {
          return name + value;
        }
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      expect(functions[0].params).toContain('destructured');
    });
  });

  describe('Extract Imports', () => {
    test('extracts import declarations', () => {
      const code = `
        import { foo, bar } from 'module';
      `;
      const { ast } = parser.parse(code);
      const imports = parser.extractImports(ast);

      expect(imports.length).toBe(1);
      expect(imports[0].source).toBe('module');
      expect(imports[0].specifiers.length).toBe(2);
    });

    test('extracts default imports', () => {
      const code = `
        import MyModule from 'my-module';
      `;
      const { ast } = parser.parse(code);
      const imports = parser.extractImports(ast);

      expect(imports[0].specifiers[0].type).toBe('ImportDefaultSpecifier');
      expect(imports[0].specifiers[0].local).toBe('MyModule');
    });

    test('extracts namespace imports', () => {
      const code = `
        import * as utils from 'utils';
      `;
      const { ast } = parser.parse(code);
      const imports = parser.extractImports(ast);

      expect(imports[0].specifiers[0].type).toBe('ImportNamespaceSpecifier');
    });

    test('handles multiple import statements', () => {
      const code = `
        import a from 'mod-a';
        import b from 'mod-b';
        import c from 'mod-c';
      `;
      const { ast } = parser.parse(code);
      const imports = parser.extractImports(ast);

      expect(imports.length).toBe(3);
    });
  });

  describe('Extract Exports', () => {
    test('extracts named exports', () => {
      const code = `
        export const foo = 1;
        export function bar() {}
      `;
      const { ast } = parser.parse(code);
      const exports = parser.extractExports(ast);

      expect(exports.length).toBe(2);
      expect(exports[0].type).toBe('named');
    });

    test('extracts default exports', () => {
      const code = `
        export default function main() {}
      `;
      const { ast } = parser.parse(code);
      const exports = parser.extractExports(ast);

      expect(exports.length).toBe(1);
      expect(exports[0].type).toBe('default');
    });

    test('extracts export specifiers', () => {
      const code = `
        const a = 1;
        const b = 2;
        export { a, b };
      `;
      const { ast } = parser.parse(code);
      const exports = parser.extractExports(ast);

      expect(exports.length).toBe(1);
      expect(exports[0].specifiers).toContain('a');
      expect(exports[0].specifiers).toContain('b');
    });
  });

  describe('Extract Classes', () => {
    test('extracts class declarations', () => {
      const code = `
        class Animal {
          constructor(name) {
            this.name = name;
          }

          speak() {
            console.log(this.name);
          }
        }
      `;
      const { ast } = parser.parse(code);
      const classes = parser.extractClasses(ast);

      expect(classes.length).toBe(1);
      expect(classes[0].name).toBe('Animal');
      expect(classes[0].methods.length).toBe(2);
    });

    test('extracts superclass', () => {
      const code = `
        class Dog extends Animal {
          bark() {}
        }
      `;
      const { ast } = parser.parse(code);
      const classes = parser.extractClasses(ast);

      expect(classes[0].superClass).toBe('Animal');
    });

    test('extracts method details', () => {
      const code = `
        class Service {
          static getInstance() {}
          async fetchData() {}
        }
      `;
      const { ast } = parser.parse(code);
      const classes = parser.extractClasses(ast);

      const methods = classes[0].methods;
      const staticMethod = methods.find(m => m.name === 'getInstance');
      const asyncMethod = methods.find(m => m.name === 'fetchData');

      expect(staticMethod.static).toBe(true);
      expect(asyncMethod.async).toBe(true);
    });
  });

  describe('Extract Variables', () => {
    test('extracts variable declarations', () => {
      const code = `
        const x = 1;
        let y = 2;
        var z;
      `;
      const { ast } = parser.parse(code);
      const variables = parser.extractVariables(ast);

      expect(variables.length).toBe(3);
    });

    test('identifies variable kinds', () => {
      const code = `
        const x = 1;
        let y = 2;
        var z = 3;
      `;
      const { ast } = parser.parse(code);
      const variables = parser.extractVariables(ast);

      expect(variables.find(v => v.name === 'x').kind).toBe('const');
      expect(variables.find(v => v.name === 'y').kind).toBe('let');
      expect(variables.find(v => v.name === 'z').kind).toBe('var');
    });

    test('identifies initialized vs uninitialized', () => {
      const code = `
        let x;
        let y = 1;
      `;
      const { ast } = parser.parse(code);
      const variables = parser.extractVariables(ast);

      expect(variables.find(v => v.name === 'x').initialized).toBe(false);
      expect(variables.find(v => v.name === 'y').initialized).toBe(true);
    });
  });

  describe('Complexity Calculation', () => {
    test('calculates base complexity of 1', () => {
      const code = `
        function simple() {
          return 1;
        }
      `;
      const { ast } = parser.parse(code);
      const functions = parser.extractFunctions(ast);

      // Get the actual function node from AST
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBe(1);
    });

    test('increases complexity for if statements', () => {
      const code = `
        function withIf(x) {
          if (x > 0) {
            return 1;
          }
          return 0;
        }
      `;
      const { ast } = parser.parse(code);
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBeGreaterThan(1);
    });

    test('increases complexity for loops', () => {
      const code = `
        function withLoops() {
          for (let i = 0; i < 10; i++) {}
          while (true) break;
          do {} while (false);
        }
      `;
      const { ast } = parser.parse(code);
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBeGreaterThan(3);
    });

    test('increases complexity for logical operators', () => {
      const code = `
        function withLogical(a, b, c) {
          if (a && b || c) {
            return true;
          }
          return false;
        }
      `;
      const { ast } = parser.parse(code);
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBeGreaterThan(2);
    });

    test('increases complexity for switch cases', () => {
      const code = `
        function withSwitch(x) {
          switch (x) {
            case 1: return 'one';
            case 2: return 'two';
            default: return 'other';
          }
        }
      `;
      const { ast } = parser.parse(code);
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBeGreaterThan(1);
    });

    test('increases complexity for catch clauses', () => {
      const code = `
        function withTryCatch() {
          try {
            throw new Error();
          } catch (e) {
            console.log(e);
          }
        }
      `;
      const { ast } = parser.parse(code);
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBeGreaterThan(1);
    });

    test('increases complexity for conditional expressions', () => {
      const code = `
        function withTernary(x) {
          return x > 0 ? 'positive' : 'non-positive';
        }
      `;
      const { ast } = parser.parse(code);
      const funcNode = ast.program.body[0];
      const complexity = parser.calculateComplexity(funcNode);

      expect(complexity).toBe(2); // Base + ternary
    });
  });

  describe('Type Detection', () => {
    test('identifies TypeScript type annotation', () => {
      const code = 'const x: number = 1;';
      const { ast } = parser.parse(code);

      let foundTypeAnnotation = false;
      parser.traverse(ast, {
        TSTypeAnnotation(path) {
          foundTypeAnnotation = parser.isTypeNode(path.node);
        }
      });

      expect(foundTypeAnnotation).toBe(true);
    });
  });

  describe('Location Info', () => {
    test('getLocation returns location details', () => {
      const code = 'const x = 1;';
      const { ast } = parser.parse(code);
      const node = ast.program.body[0];

      const location = parser.getLocation(node);

      expect(location).toBeDefined();
      expect(location.start.line).toBe(1);
      expect(location.start.column).toBe(0);
    });

    test('getLocation returns null for nodes without location', () => {
      const location = parser.getLocation({});
      expect(location).toBeNull();
    });
  });
});

describe('Singleton Functions', () => {
  test('getASTParser returns singleton', () => {
    const p1 = getASTParser();
    const p2 = getASTParser();

    expect(p1).toBe(p2);
  });

  test('getASTParser returns ASTParser instance', () => {
    const parser = getASTParser();
    expect(parser).toBeInstanceOf(ASTParser);
  });
});

describe('Edge Cases', () => {
  let parser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  test('handles empty code', () => {
    const result = parser.parse('');
    expect(result.success).toBe(true);
    expect(result.ast.program.body.length).toBe(0);
  });

  test('handles code with comments', () => {
    const code = `
      // Single line comment
      /* Multi
         line
         comment */
      const x = 1;
    `;
    const result = parser.parse(code);
    expect(result.success).toBe(true);
  });

  test('handles complex real-world code', () => {
    const code = `
      import React, { useState, useEffect } from 'react';

      interface Props {
        title: string;
        onSubmit: (data: any) => void;
      }

      const MyComponent: React.FC<Props> = ({ title, onSubmit }) => {
        const [value, setValue] = useState('');

        useEffect(() => {
          console.log('mounted');
          return () => console.log('unmounted');
        }, []);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          try {
            await onSubmit({ value });
          } catch (error) {
            console.error(error);
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <h1>{title}</h1>
            <input value={value} onChange={e => setValue(e.target.value)} />
            <button type="submit">Submit</button>
          </form>
        );
      };

      export default MyComponent;
    `;

    const result = parser.parse(code);
    expect(result.success).toBe(true);

    const imports = parser.extractImports(result.ast);
    expect(imports.length).toBe(1);

    const functions = parser.extractFunctions(result.ast);
    expect(functions.length).toBeGreaterThan(0);
  });

  test('handles optional chaining', () => {
    const code = 'const x = obj?.prop?.method?.();';
    const result = parser.parse(code);
    expect(result.success).toBe(true);
  });

  test('handles nullish coalescing', () => {
    const code = 'const x = value ?? defaultValue;';
    const result = parser.parse(code);
    expect(result.success).toBe(true);
  });

  test('handles dynamic imports', () => {
    const code = 'const module = await import("./module");';
    const result = parser.parse(code);
    expect(result.success).toBe(true);
  });
});
