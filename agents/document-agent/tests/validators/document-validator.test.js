import { describe, test, expect, beforeEach } from '@jest/globals';
import { getDocumentValidator } from '../../validators/document-validator.js';

describe('DocumentValidator', () => {
  let validator;

  beforeEach(() => {
    validator = getDocumentValidator();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(validator).toBeDefined();
      expect(validator.requiredSections).toBeDefined();
    });

    test('should get singleton instance', () => {
      const validator2 = getDocumentValidator();
      expect(validator2).toBe(validator);
    });
  });

  describe('Structure Validation', () => {
    test('should validate complete API documentation', () => {
      const document = {
        type: 'api',
        content: `# API Documentation

## Overview
This is the API documentation.

## Authentication
Use JWT tokens for authentication.

## Endpoints
Available endpoints are listed here.

## Error Handling
Standard error codes and messages.
`,
        metadata: { title: 'API Documentation' }
      };

      const result = validator.validate(document);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    test('should detect missing required sections', () => {
      const document = {
        type: 'api',
        content: `# API Documentation

## Overview
This is the API documentation.
`,
        metadata: { title: 'API Documentation' }
      };

      const result = validator.validate(document);

      expect(result.errors.length).toBeGreaterThan(0);
      const structureError = result.errors.find(e => e.type === 'structure');
      expect(structureError).toBeDefined();
      expect(structureError.sections).toContain('Authentication');
      expect(structureError.sections).toContain('Endpoints');
    });

    test('should detect missing title', () => {
      const document = {
        type: 'api',
        content: `## Overview
No H1 title here.
`,
        metadata: {}
      };

      const result = validator.validate(document);

      const titleError = result.errors.find(
        e => e.message.includes('title')
      );
      expect(titleError).toBeDefined();
    });

    test('should detect heading hierarchy issues', () => {
      const document = {
        type: 'feature',
        content: `# Feature

## Section 1

#### Subsection (skipped H3)

## Section 2
`,
        metadata: { title: 'Feature' }
      };

      const result = validator.validate(document);

      const hierarchyWarning = result.warnings.find(
        w => w.type === 'structure' && w.message.includes('hierarchy')
      );
      expect(hierarchyWarning).toBeDefined();
    });
  });

  describe('Content Validation', () => {
    test('should warn about short documents', () => {
      const document = {
        type: 'api',
        content: `# Short Doc

## Overview
Brief.

## Authentication
Auth.

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'Short Doc' }
      };

      const result = validator.validate(document);

      const contentWarning = result.warnings.find(
        w => w.type === 'content' && w.message.includes('short')
      );
      expect(contentWarning).toBeDefined();
    });

    test('should detect empty sections', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview

## Authentication

## Endpoints
Some content here.

## Error Handling
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const emptyWarning = result.warnings.find(
        w => w.type === 'content' && w.message.includes('empty')
      );
      expect(emptyWarning).toBeDefined();
    });

    test('should detect TODO markers', () => {
      const document = {
        type: 'feature',
        content: `# Feature

## Description
TODO: Add more details here.

## Requirements
FIXME: Complete this section.

## API
Working section.

## Testing
XXX: Need test cases.
`,
        metadata: { title: 'Feature' }
      };

      const result = validator.validate(document);

      const todoSuggestion = result.suggestions.find(
        s => s.message.includes('TODO')
      );
      expect(todoSuggestion).toBeDefined();
      expect(todoSuggestion.todos).toHaveLength(3);
    });
  });

  describe('Code Example Validation', () => {
    test('should validate code blocks', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
API documentation.

## Authentication
Use this code:

\`\`\`javascript
const token = 'Bearer xyz123';
fetch('/api/endpoint', {
  headers: { Authorization: token }
});
\`\`\`

## Endpoints
Available endpoints.

## Error Handling
Handle errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      // Should not warn about missing code examples
      const codeWarning = result.warnings.find(
        w => w.type === 'code' && w.message.includes('No code examples')
      );
      expect(codeWarning).toBeUndefined();
    });

    test('should warn when code examples are missing', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
API documentation with no examples.

## Authentication
Text only, no code.

## Endpoints
List of endpoints.

## Error Handling
Error descriptions.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const codeWarning = result.warnings.find(
        w => w.type === 'code' && w.message.includes('No code examples')
      );
      expect(codeWarning).toBeDefined();
    });

    test('should detect code blocks without language specification', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Example:

\`\`\`
// No language specified
const x = 1;
\`\`\`

## Authentication
Auth info.

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const langWarning = result.warnings.find(
        w => w.type === 'code' && w.message.includes('missing language')
      );
      expect(langWarning).toBeDefined();
    });

    test('should detect empty code blocks', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Empty code block:

\`\`\`javascript
\`\`\`

## Authentication
Auth.

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const emptyWarning = result.warnings.find(
        w => w.type === 'code' && w.message.includes('empty')
      );
      expect(emptyWarning).toBeDefined();
    });

    test('should validate JSON syntax in code blocks', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Invalid JSON example:

\`\`\`json
{
  "name": "test"
  "invalid": true
}
\`\`\`

## Authentication
Auth.

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const syntaxWarning = result.warnings.find(
        w => w.type === 'code' && w.message.includes('syntax')
      );
      expect(syntaxWarning).toBeDefined();
    });
  });

  describe('Link Validation', () => {
    test('should validate internal links', () => {
      const document = {
        type: 'api',
        content: `# API Documentation

## Overview
See [Authentication](#authentication) section.

## Authentication
JWT tokens required.

## Endpoints
Check [Error Handling](#error-handling).

## Error Handling
Standard errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const linkWarning = result.warnings.find(
        w => w.type === 'link' && w.message.includes('Broken')
      );
      expect(linkWarning).toBeUndefined();
    });

    test('should detect broken internal links', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
See [Non-existent](#non-existent) section.

## Authentication
Auth.

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const brokenLink = result.warnings.find(
        w => w.type === 'link' && w.message.includes('Broken')
      );
      expect(brokenLink).toBeDefined();
      expect(brokenLink.url).toBe('#non-existent');
    });

    test('should detect empty links', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Click [here](#) for more info.

## Authentication
Auth.

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const emptyLink = result.errors.find(
        e => e.type === 'link' && e.message.includes('Empty')
      );
      expect(emptyLink).toBeDefined();
    });
  });

  describe('Consistency Validation', () => {
    test('should detect terminology inconsistencies', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Use JWT tokens for Authentication.

## Authentication
The authentication uses jwt tokens.

## Endpoints
JWT required for all endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const consistencySuggestion = result.suggestions.find(
        s => s.type === 'consistency' && s.message.includes('terminology')
      );
      expect(consistencySuggestion).toBeDefined();
    });

    test('should detect formatting inconsistencies', () => {
      const document = {
        type: 'api',
        content: `# API



## Overview
Multiple blank lines above.

## Authentication
Trailing whitespace above.

## Endpoints
\tTabs for indentation.

## Error Handling
  Spaces for indentation.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      const formattingSuggestion = result.suggestions.find(
        s => s.type === 'consistency' && s.message.includes('Formatting')
      );
      expect(formattingSuggestion).toBeDefined();
    });
  });

  describe('Metrics Calculation', () => {
    test('should calculate completeness metric', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Complete documentation.

## Authentication
Auth details.

## Endpoints
All endpoints listed.

## Error Handling
Error handling explained.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      expect(result.metrics.completeness).toBeGreaterThan(80);
    });

    test('should calculate quality metric', () => {
      const document = {
        type: 'api',
        content: `# API

## Overview
Documentation with examples.

\`\`\`javascript
const api = require('api');
\`\`\`

## Authentication
Auth with code example.

\`\`\`bash
curl -H "Authorization: Bearer token"
\`\`\`

## Endpoints
Endpoints.

## Error Handling
Errors.
`,
        metadata: { title: 'API' }
      };

      const result = validator.validate(document);

      expect(result.metrics.quality).toBeGreaterThan(70);
    });

    test('should calculate overall score', () => {
      const document = {
        type: 'api',
        content: `# High Quality API Documentation

## Overview
Comprehensive overview of the API with detailed explanations and examples.

\`\`\`javascript
const client = new APIClient({
  baseURL: 'https://api.example.com',
  apiKey: process.env.API_KEY
});
\`\`\`

## Authentication
Authentication is handled via JWT tokens. Include the token in the Authorization header.

\`\`\`bash
curl -X GET https://api.example.com/users \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\`

## Endpoints
Detailed list of all available endpoints with parameters and responses.

### GET /users
Retrieve list of users.

### POST /users
Create a new user.

## Error Handling
The API uses standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 500: Server Error
`,
        metadata: { title: 'API Documentation' }
      };

      const result = validator.validate(document);

      expect(result.score).toBeGreaterThan(85);
      expect(result.valid).toBe(true);
    });
  });

  describe('OpenAPI Validation', () => {
    test('should validate complete OpenAPI spec', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              responses: {
                '200': {
                  description: 'Success'
                }
              }
            }
          }
        }
      };

      const result = validator.validateOpenAPI(spec);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing openapi version', () => {
      const spec = {
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {}
      };

      const result = validator.validateOpenAPI(spec);

      expect(result.valid).toBe(false);
      const error = result.errors.find(e => e.message.includes('openapi version'));
      expect(error).toBeDefined();
    });

    test('should detect missing info fields', () => {
      const spec = {
        openapi: '3.0.0',
        info: {},
        paths: {}
      };

      const result = validator.validateOpenAPI(spec);

      expect(result.valid).toBe(false);
      const error = result.errors.find(e => e.message.includes('info fields'));
      expect(error).toBeDefined();
    });

    test('should detect missing paths', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {}
      };

      const result = validator.validateOpenAPI(spec);

      expect(result.valid).toBe(false);
      const error = result.errors.find(e => e.message.includes('No paths'));
      expect(error).toBeDefined();
    });

    test('should warn about missing responses', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/users': {
            get: {
              summary: 'Get users'
              // Missing responses
            }
          }
        }
      };

      const result = validator.validateOpenAPI(spec);

      const warning = result.warnings.find(
        w => w.message.includes('No responses')
      );
      expect(warning).toBeDefined();
    });

    test('should suggest adding descriptions', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/users': {
            get: {
              // Missing summary and description
              responses: {
                '200': { description: 'Success' }
              }
            }
          }
        }
      };

      const result = validator.validateOpenAPI(spec);

      const suggestion = result.suggestions.find(
        s => s.message.includes('summary or description')
      );
      expect(suggestion).toBeDefined();
    });
  });

  describe('Helper Methods', () => {
    test('should slugify headings correctly', () => {
      expect(validator.slugify('Error Handling')).toBe('error-handling');
      expect(validator.slugify('API Overview')).toBe('api-overview');
      expect(validator.slugify('Get /users Endpoint')).toBe('get-users-endpoint');
    });

    test('should count words correctly', () => {
      const content = `# Title

This is a test document with some words.

\`\`\`javascript
// Code block should not be counted
const x = 1;
\`\`\`

More text here.`;

      const count = validator.countWords(content);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20); // Code block excluded
    });

    test('should extract headings', () => {
      const content = `# H1
## H2
### H3
## Another H2`;

      const headings = validator.extractHeadings(content);

      expect(headings).toHaveLength(4);
      expect(headings[0].level).toBe(1);
      expect(headings[1].level).toBe(2);
      expect(headings[2].level).toBe(3);
      expect(headings[3].level).toBe(2);
    });

    test('should extract code blocks', () => {
      const content = `Text

\`\`\`javascript
const x = 1;
\`\`\`

More text

\`\`\`
No language
\`\`\``;

      const blocks = validator.extractCodeBlocks(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[1].language).toBeNull();
    });

    test('should extract links', () => {
      const content = `
[Link 1](#section1)
[Link 2](https://example.com)
[Link 3](#)
`;

      const links = validator.extractLinks(content);

      expect(links).toHaveLength(3);
      expect(links[0].url).toBe('#section1');
      expect(links[1].url).toBe('https://example.com');
      expect(links[2].url).toBe('#');
    });
  });
});
