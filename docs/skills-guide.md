# Skills Guide

Guide for using and creating skills in the Minions framework.

## Table of Contents

- [What are Skills?](#what-are-skills)
- [Skills vs Specialized Agents](#skills-vs-specialized-agents)
- [Built-in Skills](#built-in-skills)
- [Writer Skills](#writer-skills)
- [Using Skills](#using-skills)
- [Creating Custom Skills](#creating-custom-skills)
- [Creating Writer Skills](#creating-writer-skills)
- [Skill Best Practices](#skill-best-practices)

---

## What are Skills?

Skills are reusable capabilities that agents can leverage. They encapsulate specific functionality like:

- Code review and quality analysis
- Security scanning
- Test generation
- Dependency analysis
- Auto-fixing issues

Skills differ from agents:

| Aspect | Agents | Skills |
|--------|--------|--------|
| Purpose | Autonomous task execution | Reusable capability |
| Lifecycle | Registered with orchestrator | Used by agents |
| Communication | Publishes events | Returns results |
| State | Has execution state | Has issue tracking |

---

## Skills vs Specialized Agents

The framework provides both **Skills** and **Specialized Agents**. Here's when to use each:

### Skills

Low-level, focused capabilities that are composed by agents:

```javascript
import { getCodeReviewer, getSecurityScanner } from 'minions';

// Skills are simple, focused tools
const reviewer = getCodeReviewer();
const result = await reviewer.review('src/api.js');
```

**Use Skills when:**
- You need a single, focused capability
- You're building a custom agent that combines multiple capabilities
- You need fine-grained control over the workflow

### Specialized Agents

High-level, comprehensive agents with multiple sub-components:

```javascript
import { getTesterAgent, getCodebaseAnalyzer } from 'minions';

// Specialized agents provide complete workflows
const tester = getTesterAgent();
const results = await tester.runTests({
  platform: 'backend',
  coverage: true
});
```

**Use Specialized Agents when:**
- You need a complete workflow (testing, Docker, GitHub, etc.)
- You want built-in integration between related capabilities
- You need platform-specific functionality

### Comparison Table

| Feature | Skills | Specialized Agents |
|---------|--------|-------------------|
| Scope | Single capability | Complete workflow |
| Complexity | Simple API | Rich API with sub-components |
| Integration | Manual composition | Built-in integration |
| Examples | CodeReviewer, SecurityScanner | TesterAgent, DockerAgent |
| Use Case | Building blocks | End-to-end workflows |

### Combining Skills and Specialized Agents

You can use both together:

```javascript
import {
  getTesterAgent,
  getCodeReviewer,
  getSecurityScanner
} from 'minions';

class QualityPipeline {
  async run() {
    // Use specialized agent for testing
    const tester = getTesterAgent();
    const testResults = await tester.runTests({
      platform: 'backend',
      coverage: true
    });

    // Use skills for additional analysis
    const reviewer = getCodeReviewer();
    const scanner = getSecurityScanner();

    const changedFiles = this.getChangedFiles();
    for (const file of changedFiles) {
      await reviewer.review(file);
    }

    const securityResults = await scanner.scan('./src');

    return {
      tests: testResults,
      codeQuality: reviewer.generateSummary(),
      security: securityResults
    };
  }
}
```

---

## Built-in Skills

### AutoFixer

Automatically fixes test failures using pattern matching.

```javascript
import { getAutoFixer } from 'minions';

const autoFixer = getAutoFixer({
  projectRoot: '/path/to/project',
  maxIterations: 5,
  testTimeout: 120000
});

await autoFixer.initialize();

// Handle test failure
const result = await autoFixer.handleTestFailure({
  testOutput: '...',     // Raw test output
  failedTests: [...],    // Parsed failures
  platform: 'backend'    // Platform identifier
});

console.log('Fixes applied:', result.fixesApplied);
console.log('Remaining failures:', result.remainingFailures);
```

**Fix Patterns Supported:**
- Null/undefined checks
- Missing imports
- Type mismatches
- Missing functions
- Async/await issues
- Missing mocks

### CodeReviewer

Reviews code for quality, security, and performance issues.

```javascript
import { getCodeReviewer } from 'minions';

const reviewer = getCodeReviewer();
await reviewer.initialize();

// Review a file
const result = await reviewer.review('/path/to/file.js');

console.log('Quality Score:', result.qualityScore);
console.log('Issues Found:', result.issues.length);

result.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.message}`);
  console.log(`  Location: ${issue.location.file}:${issue.location.line}`);
  if (issue.suggestion) {
    console.log(`  Suggestion: ${issue.suggestion}`);
  }
});

// Review multiple files
const multiResult = await reviewer.reviewFiles([
  'src/api.js',
  'src/utils.js'
]);

// Review a diff
const diffResult = await reviewer.reviewDiff(gitDiff);
```

**Checks Performed:**

| Category | Checks |
|----------|--------|
| Quality | Long functions, high complexity, deep nesting, duplicate code |
| Security | Hardcoded secrets, SQL injection, XSS, eval usage |
| Performance | N+1 queries, memory leaks, sync in async |
| Style | Inconsistent naming, missing JSDoc, console.log |

### SecurityScanner

Scans code for security vulnerabilities.

```javascript
import { getSecurityScanner } from 'minions';

const scanner = getSecurityScanner();

// Scan a project
const results = await scanner.scan('/path/to/project');

console.log('Vulnerabilities found:', results.issues.length);

results.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.type}`);
  console.log(`  File: ${issue.location.file}:${issue.location.line}`);
  console.log(`  Message: ${issue.message}`);
});

// Scan specific file
const fileResults = await scanner.scanFile('/path/to/file.js');
```

**Vulnerabilities Detected:**
- Hardcoded secrets (API keys, passwords, tokens)
- SQL injection
- XSS vulnerabilities
- Weak authentication
- Missing rate limiting
- CORS misconfiguration
- Weak hashing algorithms
- JWT without expiry

### TestGenerator

Generates test cases for source code.

```javascript
import { getTestGenerator } from 'minions';

const generator = getTestGenerator();
await generator.initialize();

// Generate tests for a file
const tests = await generator.generate('/path/to/source.js');

console.log('Test file:', tests.testFile);
console.log('Test cases:', tests.testCases.length);

tests.testCases.forEach(tc => {
  console.log(`- ${tc.name}`);
  console.log(`  Tests: ${tc.description}`);
});
```

### DependencyAnalyzer

Analyzes project dependencies.

```javascript
import { getDependencyAnalyzer } from 'minions';

const analyzer = getDependencyAnalyzer();

// Analyze dependencies
const deps = await analyzer.analyze('/path/to/project');

console.log('Direct dependencies:', deps.direct.length);
console.log('Dev dependencies:', deps.dev.length);
console.log('Outdated:', deps.outdated.length);
console.log('Vulnerabilities:', deps.vulnerabilities.length);

// Check for updates
const updates = await analyzer.checkUpdates();
updates.forEach(pkg => {
  console.log(`${pkg.name}: ${pkg.current} → ${pkg.latest}`);
});
```

---

## Writer Skills

Writer skills are specialized skills for code generation. They extend `BaseWriterSkill` which provides additional capabilities for template management, file operations, and code formatting.

### BaseWriterSkill

The foundation class for all code generation skills:

```javascript
import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from 'minions';

// Available languages
LANGUAGE.JAVASCRIPT
LANGUAGE.TYPESCRIPT
LANGUAGE.DART
LANGUAGE.JSON
LANGUAGE.YAML

// Generation results
GENERATION_RESULT.SUCCESS
GENERATION_RESULT.SKIPPED
GENERATION_RESULT.ERROR
```

### Flutter Writer Skills

| Skill | Description |
|-------|-------------|
| **WidgetGenerator** | Generate Stateless/Stateful Flutter widgets |
| **ModelGenerator** | Generate Freezed/JSON serializable data models |
| **ServiceGenerator** | Generate Dio-based API services |
| **BlocGenerator** | Generate Bloc/Cubit state management |
| **PageGenerator** | Generate pages with Scaffold |
| **LocalizationGenerator** | Generate ARB localization files |

```javascript
import {
  getWidgetGenerator,
  getFlutterModelGenerator,
  getFlutterServiceGenerator,
  getBlocGenerator,
  getFlutterPageGenerator,
  getLocalizationGenerator
} from 'minions';

// Generate a Flutter widget
const widgetGen = getWidgetGenerator();
const widget = await widgetGen.generate({
  name: 'UserCard',
  type: 'stateless',
  props: [{ name: 'user', type: 'User', required: true }]
});

// Generate a Bloc
const blocGen = getBlocGenerator();
const bloc = await blocGen.generate({
  name: 'Auth',
  type: 'bloc',
  events: ['Login', 'Logout'],
  states: ['Initial', 'Loading', 'Authenticated', 'Error']
});
```

### Backend Writer Skills

| Skill | Description |
|-------|-------------|
| **RouteGenerator** | Generate Express routes with middleware |
| **ModelGenerator** | Generate Mongoose/Sequelize models |
| **ServiceGenerator** | Generate service layer with repository pattern |
| **MiddlewareGenerator** | Generate auth, validation, rate limiting middleware |
| **ValidatorGenerator** | Generate Joi/Zod validation schemas |
| **ControllerGenerator** | Generate REST controllers |

```javascript
import {
  getRouteGenerator,
  getBackendModelGenerator,
  getBackendServiceGenerator,
  getMiddlewareGenerator,
  getValidatorGenerator,
  getControllerGenerator
} from 'minions';

// Generate an Express route
const routeGen = getRouteGenerator();
const route = await routeGen.generate({
  name: 'users',
  basePath: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', handler: 'list' },
    { method: 'POST', path: '/', handler: 'create' }
  ]
});

// Generate a Mongoose model
const modelGen = getBackendModelGenerator();
const model = await modelGen.generate({
  name: 'User',
  orm: 'mongoose',
  fields: [
    { name: 'email', type: 'string', required: true, unique: true },
    { name: 'name', type: 'string', required: true }
  ]
});
```

### Frontend Writer Skills

| Skill | Description |
|-------|-------------|
| **ComponentGenerator** | Generate React functional components |
| **HookGenerator** | Generate custom hooks (state, query, mutation) |
| **StoreGenerator** | Generate Context/Zustand/Redux stores |
| **FormGenerator** | Generate form components with React Hook Form |
| **ApiGenerator** | Generate React Query/SWR API hooks |
| **PageGenerator** | Generate page components with layouts |

```javascript
import {
  getComponentGenerator,
  getHookGenerator,
  getStoreGenerator,
  getFormGenerator,
  getApiGenerator,
  getFrontendPageGenerator
} from 'minions';

// Generate a React component
const componentGen = getComponentGenerator();
const component = await componentGen.generate({
  name: 'UserProfile',
  type: 'functional',
  props: [{ name: 'userId', type: 'string', required: true }],
  hooks: ['useState', 'useEffect']
});

// Generate a custom hook
const hookGen = getHookGenerator();
const hook = await hookGen.generate({
  name: 'useUser',
  type: 'query',
  endpoint: '/api/users/:id',
  returnType: 'User'
});

// Generate a Context store
const storeGen = getStoreGenerator();
const store = await storeGen.generate({
  name: 'auth',
  type: 'context',
  state: [
    { name: 'user', type: 'User | null', initial: 'null' },
    { name: 'isAuthenticated', type: 'boolean', initial: 'false' }
  ],
  actions: [
    { name: 'login', params: ['credentials'], async: true },
    { name: 'logout', async: true }
  ]
});
```

---

## Using Skills

### In an Agent

```javascript
import {
  getEventBus,
  EventTypes,
  getCodeReviewer,
  getSecurityScanner
} from 'minions';

class QualityAgent {
  constructor() {
    this.name = 'quality-agent';
    this.eventBus = getEventBus();
  }

  async initialize() {
    // Get skill instances
    this.reviewer = getCodeReviewer();
    this.scanner = getSecurityScanner();

    // Initialize skills
    await this.reviewer.initialize();
    await this.scanner.initialize();
  }

  async execute() {
    await this.initialize();

    const files = await this.getFilesToAnalyze();
    const results = {
      reviews: [],
      security: []
    };

    // Use code reviewer skill
    for (const file of files) {
      const review = await this.reviewer.review(file);
      results.reviews.push({ file, ...review });
    }

    // Use security scanner skill
    const securityResults = await this.scanner.scan(this.projectRoot);
    results.security = securityResults.issues;

    // Publish combined results
    this.eventBus.publish(EventTypes.CODE_ANALYZED, {
      agent: this.name,
      results
    });

    return results;
  }
}
```

### Standalone Usage

```javascript
import { getCodeReviewer, getSecurityScanner } from 'minions';

async function analyzeCode() {
  const reviewer = getCodeReviewer();
  const scanner = getSecurityScanner();

  await reviewer.initialize();
  await scanner.initialize();

  // Review code
  const review = await reviewer.review('src/api.js');
  console.log('Quality Score:', review.qualityScore);

  // Security scan
  const security = await scanner.scanFile('src/api.js');
  console.log('Security Issues:', security.issues.length);

  return { review, security };
}

analyzeCode();
```

---

## Creating Custom Skills

### Extending BaseSkill

```javascript
import { BaseSkill, SEVERITY, CATEGORY } from 'minions';

class CustomSkill extends BaseSkill {
  constructor(options = {}) {
    super('CustomSkill', options);

    // Custom configuration
    this.threshold = options.threshold || 10;
  }

  /**
   * Custom initialization
   */
  async onInitialize() {
    this.logger.info('Custom initialization...');
    // Setup resources, connections, etc.
  }

  /**
   * Custom shutdown
   */
  async onShutdown() {
    this.logger.info('Custom shutdown...');
    // Cleanup resources
  }

  /**
   * Main execution method
   */
  async execute(input) {
    this.startRun();  // Sets status to running

    try {
      // Analyze input
      const issues = await this.analyze(input);

      // Track issues
      issues.forEach(issue => this.addIssue(issue));

      // Complete
      this.completeRun();

      return {
        success: true,
        issues: this.getIssues(),
        summary: this.generateSummary()
      };

    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }

  /**
   * Custom analysis logic
   */
  async analyze(input) {
    const issues = [];

    // Your analysis logic here
    if (input.value > this.threshold) {
      issues.push(this.createIssue({
        type: 'threshold-exceeded',
        severity: SEVERITY.HIGH,
        category: CATEGORY.QUALITY,
        message: `Value ${input.value} exceeds threshold ${this.threshold}`,
        suggestion: `Reduce value to below ${this.threshold}`
      }));
    }

    return issues;
  }
}

// Singleton factory
let instance = null;
export function getCustomSkill(options = {}) {
  if (!instance) {
    instance = new CustomSkill(options);
  }
  return instance;
}

export default CustomSkill;
```

### Skill with Event Integration

```javascript
import { BaseSkill, SEVERITY, CATEGORY, EventTypes } from 'minions';

class AnalyzerSkill extends BaseSkill {
  constructor(options = {}) {
    super('AnalyzerSkill', options);
  }

  /**
   * Subscribe to relevant events
   */
  subscribeToEvents() {
    // React to code changes
    this.subscribe(EventTypes.CODE_GENERATED, this.handleCodeGenerated);
    this.subscribe(EventTypes.CODE_UPDATED, this.handleCodeUpdated);
  }

  async handleCodeGenerated(data) {
    this.logger.info(`Code generated by ${data.agent}`);

    if (data.files) {
      for (const file of data.files) {
        await this.analyzeFile(file);
      }
    }
  }

  async handleCodeUpdated(data) {
    this.logger.info(`Code updated by ${data.agent}`);
    // React to updates
  }

  async analyzeFile(filePath) {
    // Analysis logic
    const issues = [];

    // Add issues found
    this.addIssue(this.createIssue({
      type: 'file-issue',
      severity: SEVERITY.MEDIUM,
      category: CATEGORY.QUALITY,
      message: 'Issue found',
      file: filePath
    }));

    // Publish analysis complete
    this.publish(EventTypes.CODE_ANALYZED, {
      file: filePath,
      issues: this.getIssues()
    });
  }

  async execute(files) {
    this.startRun();

    try {
      for (const file of files) {
        await this.analyzeFile(file);
      }

      this.completeRun();
      return {
        success: true,
        issues: this.getIssues(),
        statistics: this.getStatistics()
      };

    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }
}
```

### Skill with External Tools

```javascript
import { BaseSkill, SEVERITY, CATEGORY } from 'minions';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LintingSkill extends BaseSkill {
  constructor(options = {}) {
    super('LintingSkill', options);
    this.lintCommand = options.lintCommand || 'eslint';
  }

  async execute(files) {
    this.startRun();

    try {
      // Run external linting tool
      const { stdout, stderr } = await execAsync(
        `${this.lintCommand} ${files.join(' ')} --format json`
      );

      // Parse results
      const lintResults = JSON.parse(stdout);

      // Convert to skill issues
      lintResults.forEach(result => {
        result.messages.forEach(msg => {
          this.addIssue(this.createIssue({
            type: msg.ruleId,
            severity: this.mapSeverity(msg.severity),
            category: CATEGORY.STYLE,
            message: msg.message,
            file: result.filePath,
            line: msg.line,
            column: msg.column,
            suggestion: msg.fix ? 'Auto-fixable' : null,
            fixable: !!msg.fix
          }));
        });
      });

      this.completeRun();

      return {
        success: true,
        issues: this.getIssues(),
        summary: this.generateSummary()
      };

    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }

  mapSeverity(eslintSeverity) {
    switch (eslintSeverity) {
      case 2: return SEVERITY.HIGH;
      case 1: return SEVERITY.MEDIUM;
      default: return SEVERITY.LOW;
    }
  }
}
```

---

## Creating Writer Skills

Writer skills extend `BaseWriterSkill` for code generation with template support.

### Basic Writer Skill

```javascript
import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from 'minions';

class CustomGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('CustomGenerator', options);

    // Load templates
    this.loadTemplate('default', `
// Generated by CustomGenerator
// {{timestamp}}

{{content}}
`);
  }

  async generate(spec) {
    // Validate spec
    const validation = this.validateSpec(spec, {
      required: ['name', 'content']
    });

    if (!validation.valid) {
      return {
        success: false,
        result: GENERATION_RESULT.ERROR,
        errors: validation.errors
      };
    }

    // Render template
    const code = this.renderTemplate('default', {
      timestamp: new Date().toISOString(),
      content: spec.content
    });

    // Format code
    const formatted = this.formatCode(code, LANGUAGE.JAVASCRIPT);

    // Write file (respects dryRun option)
    const filePath = `${this.outputPath}/${spec.name}.js`;
    await this.writeFile(filePath, formatted);

    return {
      success: true,
      result: GENERATION_RESULT.SUCCESS,
      filePath,
      code: formatted
    };
  }
}

// Singleton factory
let instance = null;
export function getCustomGenerator(options = {}) {
  if (!instance) {
    instance = new CustomGenerator(options);
  }
  return instance;
}
```

### Writer Skill with Multiple Templates

```javascript
import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from 'minions';

class ComponentGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ComponentGenerator', options);

    // Load multiple templates
    this.loadTemplate('functional', `
import React from 'react';
{{imports}}

{{propsInterface}}

export const {{name}}: React.FC<{{name}}Props> = ({{destructuredProps}}) => {
  {{hooks}}

  return (
    {{jsx}}
  );
};
`);

    this.loadTemplate('memo', `
import React, { memo } from 'react';
{{imports}}

{{propsInterface}}

export const {{name}} = memo<{{name}}Props>(({{destructuredProps}}) => {
  {{hooks}}

  return (
    {{jsx}}
  );
});
`);
  }

  async generate(spec) {
    const validation = this.validateSpec(spec, {
      required: ['name'],
      defaults: {
        type: 'functional',
        props: [],
        hooks: [],
        withMemo: false
      }
    });

    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Select template based on options
    const templateName = spec.withMemo ? 'memo' : 'functional';

    // Prepare template data
    const data = {
      name: spec.name,
      imports: this.generateImports(spec),
      propsInterface: this.generatePropsInterface(spec),
      destructuredProps: this.generateDestructuredProps(spec),
      hooks: this.generateHooks(spec),
      jsx: spec.jsx || '<div>TODO</div>'
    };

    // Render and format
    const code = this.renderTemplate(templateName, data);
    const formatted = this.formatCode(code, LANGUAGE.TYPESCRIPT);

    // Write file
    const filePath = `${this.outputPath}/components/${spec.name}.tsx`;
    await this.writeFile(filePath, formatted);

    return {
      success: true,
      result: GENERATION_RESULT.SUCCESS,
      filePath,
      code: formatted
    };
  }

  generateImports(spec) {
    // Custom import generation logic
    return spec.imports?.join('\\n') || '';
  }

  generatePropsInterface(spec) {
    if (!spec.props?.length) {
      return `interface ${spec.name}Props {}`;
    }

    const fields = spec.props.map(p =>
      `  ${p.name}${p.required ? '' : '?'}: ${p.type};`
    ).join('\\n');

    return `interface ${spec.name}Props {\\n${fields}\\n}`;
  }

  generateDestructuredProps(spec) {
    if (!spec.props?.length) return '{}';
    return `{ ${spec.props.map(p => p.name).join(', ')} }`;
  }

  generateHooks(spec) {
    return spec.hooks?.map(h => `  // ${h}`).join('\\n') || '';
  }
}
```

### Writer Skill with Event Integration

```javascript
import { BaseWriterSkill, EventTypes, GENERATION_RESULT } from 'minions';

class ModelGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ModelGenerator', options);
  }

  subscribeToEvents() {
    // React to architecture decisions
    this.subscribe(EventTypes.ARCHITECTURE_DECISION_MADE, this.handleArchitectureDecision);
  }

  async handleArchitectureDecision(data) {
    if (data.decision.type === 'model-definition') {
      await this.generate(data.decision.spec);
    }
  }

  async generate(spec) {
    // Generation logic...
    const result = await this.doGenerate(spec);

    // Publish event on success
    if (result.success) {
      this.publish(EventTypes.BACKEND_MODEL_GENERATED, {
        model: spec.name,
        filePath: result.filePath,
        fields: spec.fields
      });
    }

    return result;
  }
}
```

### Dry Run Mode

All writer skills support dry run mode for previewing changes:

```javascript
const generator = getComponentGenerator({
  outputPath: './src',
  dryRun: true  // Don't write files
});

const result = await generator.generate({
  name: 'UserCard',
  props: [{ name: 'user', type: 'User' }]
});

console.log('Would write to:', result.filePath);
console.log('Generated code:\\n', result.code);
```

---

## Skill Best Practices

### 1. Use the Issue System

```javascript
// Good: Use createIssue for consistency
this.addIssue(this.createIssue({
  type: 'my-issue-type',
  severity: SEVERITY.MEDIUM,
  category: CATEGORY.QUALITY,
  message: 'Clear description',
  file: '/path/to/file.js',
  line: 42,
  suggestion: 'How to fix it',
  fixable: true
}));

// Bad: Inconsistent issue format
this.issues.push({
  msg: 'Something wrong',
  sev: 'med'
});
```

### 2. Clear State Between Runs

```javascript
async execute(input) {
  // startRun() automatically clears issues and results
  this.startRun();

  // Or manually if needed
  this.clearIssues();
  this.clearResults();

  // ... execution logic
}
```

### 3. Provide Actionable Suggestions

```javascript
// Good: Actionable suggestion
this.createIssue({
  type: 'sql-injection',
  severity: SEVERITY.CRITICAL,
  message: 'Potential SQL injection vulnerability',
  suggestion: 'Use parameterized queries instead of string concatenation'
});

// Bad: No guidance
this.createIssue({
  type: 'security-issue',
  message: 'Security problem found'
});
```

### 4. Use Appropriate Severity Levels

```javascript
SEVERITY.CRITICAL  // Security breaches, data loss risk
SEVERITY.HIGH      // Bugs, major quality issues
SEVERITY.MEDIUM    // Performance issues, code smells
SEVERITY.LOW       // Style issues, minor improvements
SEVERITY.INFO      // Informational only
```

### 5. Categorize Issues Correctly

```javascript
CATEGORY.SECURITY     // Vulnerabilities
CATEGORY.PERFORMANCE  // Speed/resource issues
CATEGORY.QUALITY      // Code quality
CATEGORY.STYLE        // Formatting/conventions
CATEGORY.BUG          // Actual bugs
CATEGORY.TEST         // Testing issues
CATEGORY.DEPENDENCY   // Package issues
```

### 6. Return Comprehensive Results

```javascript
async execute(input) {
  this.startRun();

  try {
    // ... analysis

    this.completeRun();

    return {
      success: true,
      issues: this.getIssues(),
      statistics: this.getStatistics(),
      summary: this.generateSummary(),
      metadata: {
        filesAnalyzed: files.length,
        duration: Date.now() - startTime
      }
    };

  } catch (error) {
    this.failRun(error);
    return {
      success: false,
      error: error.message,
      partialIssues: this.getIssues()
    };
  }
}
```

### 7. Make Skills Configurable

```javascript
class FlexibleSkill extends BaseSkill {
  constructor(options = {}) {
    super('FlexibleSkill', options);

    // Configurable thresholds
    this.config = {
      maxComplexity: options.maxComplexity || 10,
      maxLineLength: options.maxLineLength || 120,
      ignorePatterns: options.ignorePatterns || [],
      severityOverrides: options.severityOverrides || {}
    };
  }

  getSeverity(issueType) {
    return this.config.severityOverrides[issueType] ||
           this.defaultSeverities[issueType];
  }
}

// Usage
const skill = new FlexibleSkill({
  maxComplexity: 15,
  severityOverrides: {
    'long-line': SEVERITY.LOW
  }
});
```

### 8. Document Your Skill

```javascript
/**
 * CustomAnalyzerSkill
 *
 * Analyzes code for custom patterns and issues.
 *
 * Configuration Options:
 * - threshold (number): Issue threshold (default: 10)
 * - patterns (string[]): Patterns to check
 *
 * Issue Types:
 * - threshold-exceeded: Value exceeds configured threshold
 * - pattern-violation: Code violates configured pattern
 *
 * Usage:
 * ```javascript
 * const skill = getCustomAnalyzerSkill({ threshold: 5 });
 * await skill.initialize();
 * const result = await skill.execute(code);
 * ```
 */
class CustomAnalyzerSkill extends BaseSkill { ... }
```
