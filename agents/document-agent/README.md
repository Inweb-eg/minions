# Document Agent

**Bidirectional Code ↔ Documentation Synchronization Engine**

The Document Agent is a core component of the TukTuk autonomous development system that ensures perfect synchronization between code and documentation. It operates in two directions:

1. **Code → Docs**: Automatically update documentation when code changes
2. **Docs → Code**: Generate code implementation digests from documentation

## Architecture

### Core Principles

- **Singleton Pattern**: All components use singleton instances
- **Event-Driven**: Integrates with EventBus for autonomous orchestration
- **Incremental Processing**: Smart caching with SHA256-based change detection
- **Quality-First**: Built-in validation and conflict detection

### Components

```
document-agent/
├── document-agent.js           # Main orchestrator (NEW)
├── cli.js                      # Command-line interface (NEW)
│
├── parsers/
│   ├── code-parser/           # Code → Docs Pipeline
│   │   ├── backend-code-parser.js
│   │   ├── breaking-change-detector.js
│   │   ├── impact-analyzer.js
│   │   ├── openapi-updater.js
│   │   ├── changelog-updater.js
│   │   ├── integration-docs-updater.js
│   │   ├── document-versioner.js
│   │   └── conflict-detector.js
│   │
│   └── docs-parser/           # Docs → Code Pipeline
│       ├── api-parser.js      # OpenAPI, Markdown
│       ├── feature-parser.js  # Requirements, User Stories
│       ├── architecture-parser.js
│       ├── react-parser.js
│       └── flutter-parser.js
│
├── digest-generators/         # Code generation instructions
│   ├── backend-digest.js     # Express.js digests
│   ├── admin-digest.js       # React digests
│   ├── user-digest.js        # Flutter (Users) digests
│   └── driver-digest.js      # Flutter (Drivers) digests
│
├── validators/
│   ├── document-validator.js # Quality scoring (0-100)
│   └── digest-validator.js   # Digest validation
│
└── cache/
    └── DocumentCache.js      # SHA256-based caching
```

## Usage

### 1. Programmatic API

```javascript
import { getDocumentAgent } from './document-agent.js';

const agent = getDocumentAgent();
await agent.initialize();

// Code → Docs: Update documentation from code changes
const results = await agent.updateDocsFromCode({
  files: ['backend/src/controllers/users.js'],
  agent: 'backend-agent'
});

console.log(`Updated ${results.updated} documents`);
console.log(`Breaking changes: ${results.breakingChanges.length}`);

// Docs → Code: Parse documentation and generate code digests
const parsed = await agent.parseDocumentation([
  'docs/api.md',
  'docs/architecture.md'
]);

// Use digests with platform agents
const backendDigest = parsed.digests.backend;
// Pass to backend-agent for code generation...
```

### 2. Command-Line Interface

```bash
# Parse documentation and generate digests
node cli.js parse-docs docs/api.md docs/architecture.md

# Update docs after code changes
node cli.js update-docs backend/src/**/*.js

# Validate documentation quality
node cli.js validate docs/*.md

# Detect code-documentation conflicts
node cli.js detect-conflicts backend/src/app.js docs/api.md

# Clear cache
node cli.js clear-cache

# Show statistics
node cli.js stats
```

### 3. EventBus Integration

The Document Agent automatically subscribes to EventBus events:

```javascript
// Listens for code generation events
EventTypes.CODE_GENERATED → handleCodeGenerated()
  ↓
  Updates OpenAPI, CHANGELOG, integration docs
  ↓
  Publishes AGENT_COMPLETED event

// Listens for documentation requests
EventTypes.AGENT_STARTED (document-agent) → handleDocumentRequest()
  ↓
  Executes requested action (parse-docs, validate-docs, etc.)
  ↓
  Publishes AGENT_COMPLETED event
```

## Pipelines

### Pipeline 1: Code → Docs

**Purpose**: Keep documentation synchronized with code changes

**Flow**:
```
Backend Code Changes
  ↓
BackendCodeParser (Babel AST)
  ↓
Extract: routes, controllers, models, services
  ↓
ImpactAnalyzer (what changed?)
  ↓
BreakingChangeDetector (breaking changes?)
  ↓
┌─────────────────────────────┐
│  OpenAPIUpdater             │ → docs/api/openapi.yaml
│  ChangelogUpdater           │ → CHANGELOG.md
│  IntegrationDocsUpdater     │ → docs/integration/*.md
└─────────────────────────────┘
  ↓
DocumentVersioner (version tracking)
  ↓
ConflictDetector (validate consistency)
```

**Example**:
```javascript
// When backend-agent generates code:
const results = await agent.updateDocsFromCode({
  files: [
    'backend/src/controllers/subscriptions.js',
    'backend/src/models/Subscription.js'
  ],
  agent: 'backend-agent'
});

// Results:
// - OpenAPI spec updated with new /subscriptions endpoints
// - CHANGELOG.md updated with new features
// - Integration docs updated with API changes
// - Breaking changes detected and flagged
```

### Pipeline 2: Docs → Code

**Purpose**: Generate code implementation guidance from documentation

**Flow**:
```
Documentation Files
  ↓
┌─────────────────────────────┐
│ APIParser (OpenAPI, Markdown)     │
│ FeatureParser (Requirements)      │
│ ArchitectureParser (Design)       │
└─────────────────────────────┘
  ↓
Structured Data
  ↓
┌─────────────────────────────┐
│ BackendDigest               │ → Express.js routes, controllers, models
│ AdminDigest                 │ → React components, Redux slices
│ UserDigest                  │ → Flutter screens, widgets (Users app)
│ DriverDigest                │ → Flutter screens, widgets (Drivers app)
└─────────────────────────────┘
  ↓
DigestValidator (validate completeness)
  ↓
Code Generation Digests (used by platform agents)
```

**Example**:
```javascript
// Parse API documentation
const results = await agent.parseDocumentation([
  'docs/api/endpoints.md',
  'docs/architecture.md'
]);

// Generated backend digest includes:
const backendDigest = results.digests.backend;
console.log(backendDigest.routes);        // Express routes to generate
console.log(backendDigest.controllers);   // Controller methods
console.log(backendDigest.models);        // Mongoose models
console.log(backendDigest.services);      // Service layer

// Backend-agent uses this digest to generate code
await backendAgent.generateCode(backendDigest);
```

## Document Validation

### Quality Scoring

The DocumentValidator assigns a quality score (0-100) based on:

| Metric | Weight | Criteria |
|--------|--------|----------|
| **Completeness** | 40% | Required sections present, sufficient content |
| **Quality** | 30% | Code examples, proper formatting |
| **Consistency** | 15% | Terminology, formatting standards |
| **Readability** | 15% | Structure, heading hierarchy |

**Scoring**:
- 90-100: Excellent
- 70-89: Good
- 60-69: Acceptable (minimum passing)
- 0-59: Needs improvement

### Validation Checks

```javascript
const validation = documentValidator.validate({
  type: 'api',
  content: markdownContent,
  metadata: { title: 'User API' }
});

console.log(validation.valid);           // true/false
console.log(validation.score);           // 0-100
console.log(validation.errors);          // Critical issues
console.log(validation.warnings);        // Minor issues
console.log(validation.suggestions);     // Improvements
```

**Checks**:
- ✅ Required sections present
- ✅ Heading hierarchy valid
- ✅ Code blocks have language specification
- ✅ Code syntax valid (basic checks)
- ✅ Links not broken (internal)
- ✅ Consistent terminology
- ✅ No empty sections
- ✅ Proper formatting

## Caching System

### DocumentCache

**Features**:
- SHA256-based change detection
- Incremental parsing (only reparse changed files)
- Disk-backed with in-memory index
- Automatic cache invalidation

**Usage**:
```javascript
import { getDocumentCache } from './cache/DocumentCache.js';

const cache = getDocumentCache();
await cache.initialize();

// Check if file changed
const changed = await cache.hasChanged('docs/api.md');

// Get cached result (null if changed or not cached)
const cached = await cache.get('docs/api.md');

// Set cache
await cache.set('docs/api.md', parsedResult);

// Clear cache
await cache.clear('docs/api.md');
await cache.clearAll();
```

**Cache Location**: `./.cache/documents/`

## Integration with Manager-Agent

The Document Agent is integrated into the dependency graph:

```
Level 0 (No dependencies):
└─ document-agent ← Runs first

Level 1 (Depends on docs):
├─ backend-agent
├─ admin-agent
├─ users-agent
└─ drivers-agent ← Use digests from document-agent

Level 2+:
└─ tester-agent, docker-agent, github-agent
```

### Autonomous Loop Integration

```javascript
// Manager-Agent orchestrates:
1. Document-Agent parses docs → generates digests
2. Backend-Agent uses backend digest → generates code
3. Admin-Agent uses admin digest → generates React components
4. Users-Agent uses users digest → generates Flutter app
5. Tester-Agent runs tests
6. If tests fail → autonomous loop → fix → retest
7. Document-Agent updates docs with code changes
```

## Event Types

### Published Events

```javascript
// Initialization
EventTypes.AGENT_STARTED
{
  agent: 'document-agent',
  action: 'initialize'
}

// Documentation updated
EventTypes.AGENT_COMPLETED
{
  agent: 'document-agent',
  action: 'update-docs',
  results: {
    parsed: 5,
    updated: 3,
    breakingChanges: [],
    updatedFiles: ['docs/api/openapi.yaml', 'CHANGELOG.md']
  }
}

// Error occurred
EventTypes.AGENT_FAILED
{
  agent: 'document-agent',
  action: 'parse-docs',
  error: 'Parse error message'
}
```

### Subscribed Events

```javascript
// Code generation completed
EventTypes.CODE_GENERATED
{
  agent: 'backend-agent',
  filesModified: ['backend/src/controllers/users.js']
}
→ Triggers updateDocsFromCode()

// Document request
EventTypes.AGENT_STARTED
{
  agent: 'document-agent',
  action: 'parse-docs',
  docPaths: ['docs/api.md']
}
→ Triggers handleDocumentRequest()
```

## Best Practices

### 1. Document Structure

**API Documentation**:
```markdown
# API Title

## Overview
Brief description

## Authentication
Auth scheme details

## Endpoints
### GET /api/resource
Description, parameters, responses

## Error Handling
Error codes and messages
```

**Feature Documentation**:
```markdown
# Feature Name

## Description
What it does

## Requirements
Functional requirements

## API
Related endpoints

## Testing
Test scenarios
```

### 2. OpenAPI Specifications

Use OpenAPI 3.0+ format:
```yaml
openapi: 3.0.0
info:
  title: API Name
  version: 1.0.0
paths:
  /api/resource:
    get:
      summary: Get resource
      responses:
        200:
          description: Success
```

### 3. Digest Usage

```javascript
// 1. Parse docs
const parsed = await documentAgent.parseDocumentation(['docs/api.md']);

// 2. Validate digest
const validation = digestValidator.validate(parsed.digests.backend);
if (!validation.valid) {
  console.error('Digest validation failed:', validation.errors);
}

// 3. Use with platform agent
const code = await backendAgent.generateCode(parsed.digests.backend);
```

### 4. Cache Management

```bash
# Clear cache when changing parsers
node cli.js clear-cache

# Check cache usage
node cli.js stats
```

## Testing

### Unit Tests

```bash
cd .claude/agents/document-agent
npm test
```

**Test Coverage**:
- Code parsers: 31+ tests
- Docs parsers: 36+ tests
- Digest generators: 40+ tests
- Validators: 72+ tests
- Integration: 8+ tests

### Integration Tests

```javascript
// Test full pipeline
import { getDocumentAgent } from './document-agent.js';

test('Code → Docs → Code round-trip', async () => {
  const agent = getDocumentAgent();
  await agent.initialize();

  // 1. Generate docs from code
  const docsResult = await agent.updateDocsFromCode({
    files: ['test-backend.js']
  });

  // 2. Parse generated docs
  const parsed = await agent.parseDocumentation(docsResult.updatedFiles);

  // 3. Verify digest matches original code structure
  expect(parsed.digests.backend.routes).toBeDefined();
});
```

## Troubleshooting

### Issue: Cache not invalidating

**Solution**:
```bash
node cli.js clear-cache
```

### Issue: Parse errors

**Cause**: Malformed documentation or unsupported syntax

**Solution**:
1. Validate document structure
2. Check for required sections
3. Ensure code blocks have language tags

```bash
node cli.js validate docs/problematic.md
```

### Issue: Breaking changes not detected

**Cause**: Code changes not significant enough

**Solution**: Breaking changes are detected for:
- Changed route paths
- Removed endpoints
- Modified response schemas
- Changed authentication requirements

### Issue: Digest validation fails

**Cause**: Incomplete documentation

**Solution**:
```javascript
const validation = digestValidator.validate(digest);
console.log(validation.errors);  // Shows missing fields
```

## Performance

### Metrics

- **Parse time**: ~50-200ms per document (cached: ~5ms)
- **Cache hit rate**: Typically 80-95% in development
- **Memory usage**: ~50MB for 1000 cached documents
- **Disk usage**: ~1-5KB per cached document

### Optimization Tips

1. **Use caching**: Don't clear cache unnecessarily
2. **Batch operations**: Parse multiple files at once
3. **Filter files**: Only parse changed files
4. **Async processing**: Use Promise.all for parallel parsing

## Future Enhancements

### Planned Features

- [ ] Real-time documentation validation in CI/CD
- [ ] Machine learning for better conflict detection
- [ ] Multi-language support (Spanish, French, etc.)
- [ ] Visual diff viewer for documentation changes
- [ ] Automatic diagram generation from code
- [ ] Integration with popular doc platforms (ReadTheDocs, GitBook)

### Potential Improvements

- [ ] GraphQL schema support
- [ ] gRPC proto file parsing
- [ ] Markdown linting integration
- [ ] Spell check integration
- [ ] Accessibility (a11y) validation
- [ ] SEO optimization suggestions

## Contributing

When adding new parsers or updaters:

1. **Follow singleton pattern**:
```javascript
let instance = null;
export function getMyParser() {
  if (!instance) {
    instance = new MyParser();
  }
  return instance;
}
```

2. **Integrate with cache**:
```javascript
import { getDocumentCache } from '../cache/DocumentCache.js';

class MyParser {
  constructor() {
    this.cache = getDocumentCache();
  }

  async parse(filePath) {
    const cached = await this.cache.get(filePath);
    if (cached) return cached;

    // Parse...
    await this.cache.set(filePath, result);
    return result;
  }
}
```

3. **Add comprehensive tests**:
```javascript
describe('MyParser', () => {
  test('parses valid input', async () => {
    const parser = getMyParser();
    const result = await parser.parse('test.md');
    expect(result).toBeDefined();
  });
});
```

4. **Update main orchestrator**:
```javascript
// In document-agent.js
import { getMyParser } from './parsers/my-parser.js';

export class DocumentAgent {
  constructor() {
    this.myParser = getMyParser();
  }
}
```

## License

Part of the TukTuk autonomous development system.

## Support

For issues or questions:
1. Check this README
2. Review test files for examples
3. Check agent logs: `~/.cache/agents/logs/`
4. Open an issue in the repository

---

**Document Agent v2.0** - Bidirectional Code-Documentation Synchronization
