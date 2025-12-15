/**
 * Frontend Test Generator Skill
 *
 * Generates React/TypeScript test code including:
 * - Component tests (React Testing Library)
 * - Hook tests
 * - Store tests
 * - Integration tests
 * - E2E tests (Playwright/Cypress)
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';

export const FRONTEND_TEST_TYPE = {
  COMPONENT: 'component',
  HOOK: 'hook',
  STORE: 'store',
  FORM: 'form',
  API: 'api',
  INTEGRATION: 'integration',
  E2E: 'e2e'
};

export const E2E_FRAMEWORK = {
  PLAYWRIGHT: 'playwright',
  CYPRESS: 'cypress'
};

export class FrontendTestGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('frontend-test-generator', options);
    this.loadTemplates();
  }

  loadTemplates() {
    // Component test template (React Testing Library)
    this.loadTemplate('component-test', `import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
{{#imports}}
import {{.}};
{{/imports}}
import { {{componentName}} } from '{{componentPath}}';

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{componentName}}', () => {
  {{#setup}}
  {{.}}
  {{/setup}}

  const defaultProps = {
    {{#defaultProps}}
    {{name}}: {{value}},
    {{/defaultProps}}
  };

  const renderComponent = (props = {}) => {
    return render(
      {{#wrapper}}
      <{{wrapper}}>
        <{{componentName}} {...defaultProps} {...props} />
      </{{wrapper}}>
      {{/wrapper}}
      {{^wrapper}}
      <{{componentName}} {...defaultProps} {...props} />
      {{/wrapper}}
    );
  };

{{#tests}}
  it('{{description}}', async () => {
    {{#arrange}}
    {{.}}
    {{/arrange}}

    renderComponent({{#props}}{ {{.}} }{{/props}});

    {{#act}}
    {{.}}
    {{/act}}

    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}
});
`);

    // Hook test template
    this.loadTemplate('hook-test', `import { renderHook, act, waitFor } from '@testing-library/react';
{{#imports}}
import {{.}};
{{/imports}}
import { {{hookName}} } from '{{hookPath}}';

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

{{#wrapper}}
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <{{wrapper}}>
    {children}
  </{{wrapper}}>
);
{{/wrapper}}

describe('{{hookName}}', () => {
  {{#setup}}
  {{.}}
  {{/setup}}

  beforeEach(() => {
    jest.clearAllMocks();
  });

{{#tests}}
  it('{{description}}', async () => {
    {{#arrange}}
    {{.}}
    {{/arrange}}

    const { result } = renderHook(() => {{hookName}}({{params}}), {{#wrapper}}{ wrapper }{{/wrapper}});

    {{#act}}
    await act(async () => {
      {{.}}
    });
    {{/act}}

    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}
});
`);

    // Store test template (Context/Zustand/Redux)
    this.loadTemplate('store-test', `import { renderHook, act } from '@testing-library/react';
{{#imports}}
import {{.}};
{{/imports}}
{{#contextImport}}
import { {{providerName}}, {{hookName}} } from '{{storePath}}';
{{/contextImport}}
{{#zustandImport}}
import { {{storeName}} } from '{{storePath}}';
{{/zustandImport}}
{{#reduxImport}}
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import {{reducerName}} from '{{storePath}}';
{{/reduxImport}}

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{storeName}}', () => {
{{#contextTests}}
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <{{providerName}}>
      {children}
    </{{providerName}}>
  );

{{#tests}}
  it('{{description}}', async () => {
    {{#arrange}}
    {{.}}
    {{/arrange}}

    const { result } = renderHook(() => {{hookName}}(), { wrapper });

    {{#act}}
    await act(async () => {
      {{.}}
    });
    {{/act}}

    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}
{{/contextTests}}

{{#zustandTests}}
  beforeEach(() => {
    {{storeName}}.setState({{initialState}});
  });

{{#tests}}
  it('{{description}}', () => {
    {{#arrange}}
    {{.}}
    {{/arrange}}

    {{#act}}
    {{.}}
    {{/act}}

    const state = {{storeName}}.getState();
    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}
{{/zustandTests}}

{{#reduxTests}}
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        {{sliceName}}: {{reducerName}}
      }
    });
  });

{{#tests}}
  it('{{description}}', () => {
    {{#arrange}}
    {{.}}
    {{/arrange}}

    {{#act}}
    store.dispatch({{.}});
    {{/act}}

    const state = store.getState().{{sliceName}};
    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}
{{/reduxTests}}
});
`);

    // Form test template
    this.loadTemplate('form-test', `import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
{{#imports}}
import {{.}};
{{/imports}}
import { {{formName}} } from '{{formPath}}';

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{formName}}', () => {
  const mockOnSubmit = jest.fn();

  const defaultProps = {
    onSubmit: mockOnSubmit,
    {{#defaultProps}}
    {{name}}: {{value}},
    {{/defaultProps}}
  };

  const renderForm = (props = {}) => {
    return render(<{{formName}} {...defaultProps} {...props} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
{{#fields}}
    it('renders {{name}} field', () => {
      renderForm();
      expect(screen.getByLabelText(/{{label}}/i)).toBeInTheDocument();
    });

{{/fields}}
  });

  describe('validation', () => {
{{#validationTests}}
    it('{{description}}', async () => {
      renderForm();

      {{#fillFields}}
      await userEvent.type(screen.getByLabelText(/{{label}}/i), '{{value}}');
      {{/fillFields}}

      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

{{/validationTests}}
  });

  describe('submission', () => {
    it('calls onSubmit with form data when valid', async () => {
      renderForm();

{{#validFields}}
      await userEvent.type(screen.getByLabelText(/{{label}}/i), '{{value}}');
{{/validFields}}

      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({{expectedData}});
      });
    });
  });
});
`);

    // API hook test template
    this.loadTemplate('api-test', `import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
{{#imports}}
import {{.}};
{{/imports}}
{{#hookImports}}
import { {{.}} } from '{{apiPath}}';
{{/hookImports}}

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('{{apiName}} API Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

{{#queryHooks}}
  describe('{{hookName}}', () => {
    it('should fetch data successfully', async () => {
      {{#mockSetup}}
      {{.}}
      {{/mockSetup}}

      const { result } = renderHook(() => {{hookName}}({{params}}), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

    it('should handle error', async () => {
      {{#errorMockSetup}}
      {{.}}
      {{/errorMockSetup}}

      const { result } = renderHook(() => {{hookName}}({{params}}), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

{{/queryHooks}}

{{#mutationHooks}}
  describe('{{hookName}}', () => {
    it('should mutate data successfully', async () => {
      {{#mockSetup}}
      {{.}}
      {{/mockSetup}}

      const { result } = renderHook(() => {{hookName}}(), {
        wrapper: createWrapper()
      });

      await result.current.mutateAsync({{mutationData}});

      {{#assertions}}
      {{.}}
      {{/assertions}}
    });
  });

{{/mutationHooks}}
});
`);

    // E2E test template (Playwright)
    this.loadTemplate('e2e-playwright', `import { test, expect } from '@playwright/test';

test.describe('{{testName}}', () => {
  test.beforeEach(async ({ page }) => {
    {{#beforeEach}}
    {{.}}
    {{/beforeEach}}
  });

{{#tests}}
  test('{{description}}', async ({ page }) => {
    {{#steps}}
    // {{description}}
    {{code}}

    {{/steps}}
  });

{{/tests}}
});
`);

    // E2E test template (Cypress)
    this.loadTemplate('e2e-cypress', `describe('{{testName}}', () => {
  beforeEach(() => {
    {{#beforeEach}}
    {{.}}
    {{/beforeEach}}
  });

{{#tests}}
  it('{{description}}', () => {
    {{#steps}}
    // {{description}}
    {{code}}

    {{/steps}}
  });

{{/tests}}
});
`);
  }

  /**
   * Generate frontend test
   */
  async generate(spec) {
    const validation = this.validateSpec(spec, {
      required: ['name', 'type'],
      optional: ['target', 'framework', 'imports', 'mocks', 'tests', 'wrapper', 'fields', 'hooks']
    });

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    let code;
    let filePath;

    switch (spec.type) {
      case FRONTEND_TEST_TYPE.COMPONENT:
        code = this.generateComponentTest(spec);
        filePath = `src/components/${spec.name}/${spec.name}.test.tsx`;
        break;

      case FRONTEND_TEST_TYPE.HOOK:
        code = this.generateHookTest(spec);
        filePath = `src/hooks/${spec.name}.test.ts`;
        break;

      case FRONTEND_TEST_TYPE.STORE:
        code = this.generateStoreTest(spec);
        filePath = `src/stores/${spec.name}.test.ts`;
        break;

      case FRONTEND_TEST_TYPE.FORM:
        code = this.generateFormTest(spec);
        filePath = `src/forms/${spec.name}.test.tsx`;
        break;

      case FRONTEND_TEST_TYPE.API:
        code = this.generateApiTest(spec);
        filePath = `src/api/${spec.name}.api.test.ts`;
        break;

      case FRONTEND_TEST_TYPE.INTEGRATION:
        code = this.generateIntegrationTest(spec);
        filePath = `src/__tests__/integration/${spec.name}.test.tsx`;
        break;

      case FRONTEND_TEST_TYPE.E2E:
        code = this.generateE2ETest(spec);
        const e2eFramework = spec.e2eFramework || E2E_FRAMEWORK.PLAYWRIGHT;
        filePath = e2eFramework === E2E_FRAMEWORK.PLAYWRIGHT
          ? `e2e/${spec.name}.spec.ts`
          : `cypress/e2e/${spec.name}.cy.ts`;
        break;

      default:
        return {
          success: false,
          errors: [`Unknown test type: ${spec.type}`]
        };
    }

    code = await this.formatCode(code, LANGUAGE.TYPESCRIPT);

    if (!this.options.dryRun && this.outputPath) {
      const fullPath = `${this.outputPath}/${filePath}`;
      await this.writeFile(fullPath, code);
    }

    return {
      success: true,
      code,
      filePath,
      type: spec.type
    };
  }

  generateComponentTest(spec) {
    const data = {
      componentName: spec.name,
      componentPath: spec.componentPath || `./${spec.name}`,
      imports: spec.imports || [],
      mocks: spec.mocks || [],
      setup: spec.setup || [],
      wrapper: spec.wrapper,
      defaultProps: spec.defaultProps || [],
      tests: spec.tests || this.generateDefaultComponentTests(spec)
    };

    return this.renderTemplate('component-test', data);
  }

  generateDefaultComponentTests(spec) {
    const props = spec.props || [];
    return [
      {
        description: 'renders without crashing',
        arrange: [],
        props: null,
        act: [],
        assertions: [`expect(screen.getByTestId('${spec.name.toLowerCase()}')).toBeInTheDocument();`]
      },
      {
        description: 'renders with props',
        arrange: [],
        props: props.length > 0 ? props.map(p => `${p.name}: ${this.getTestValue(p.type)}`).join(', ') : null,
        act: [],
        assertions: ['// Add specific assertions for props']
      },
      {
        description: 'handles user interaction',
        arrange: [],
        props: null,
        act: ["await userEvent.click(screen.getByRole('button'));"],
        assertions: ['// Add assertions for interaction result']
      }
    ];
  }

  generateHookTest(spec) {
    const data = {
      hookName: spec.name,
      hookPath: spec.hookPath || `../hooks/${spec.name}`,
      imports: spec.imports || [],
      mocks: spec.mocks || [],
      setup: spec.setup || [],
      wrapper: spec.wrapper,
      tests: spec.tests || this.generateDefaultHookTests(spec)
    };

    return this.renderTemplate('hook-test', data);
  }

  generateDefaultHookTests(spec) {
    return [
      {
        description: 'returns initial state',
        arrange: [],
        params: '',
        act: [],
        assertions: ['expect(result.current).toBeDefined();']
      },
      {
        description: 'updates state correctly',
        arrange: [],
        params: '',
        act: ['result.current.update();'],
        assertions: ['// Add assertions for state update']
      }
    ];
  }

  generateStoreTest(spec) {
    const storeType = spec.storeType || 'context';
    const data = {
      storeName: spec.name,
      storePath: spec.storePath || `../stores/${spec.name}`,
      imports: spec.imports || [],
      mocks: spec.mocks || [],
      contextImport: storeType === 'context',
      zustandImport: storeType === 'zustand',
      reduxImport: storeType === 'redux',
      providerName: `${spec.name}Provider`,
      hookName: `use${spec.name}`,
      reducerName: `${spec.name.toLowerCase()}Reducer`,
      sliceName: spec.name.toLowerCase(),
      initialState: spec.initialState || '{}',
      contextTests: storeType === 'context' ? { tests: spec.tests || this.generateDefaultContextTests(spec) } : null,
      zustandTests: storeType === 'zustand' ? { tests: spec.tests || this.generateDefaultZustandTests(spec) } : null,
      reduxTests: storeType === 'redux' ? { tests: spec.tests || this.generateDefaultReduxTests(spec) } : null
    };

    return this.renderTemplate('store-test', data);
  }

  generateDefaultContextTests(spec) {
    return [
      {
        description: 'provides initial state',
        arrange: [],
        act: [],
        assertions: ['expect(result.current.state).toBeDefined();']
      },
      {
        description: 'updates state via actions',
        arrange: [],
        act: ['result.current.updateState({ key: "value" });'],
        assertions: ['expect(result.current.state.key).toBe("value");']
      }
    ];
  }

  generateDefaultZustandTests(spec) {
    return [
      {
        description: 'has initial state',
        arrange: [],
        act: [],
        assertions: ['expect(state).toBeDefined();']
      },
      {
        description: 'updates state',
        arrange: [],
        act: [`${spec.name}.getState().update({ key: 'value' });`],
        assertions: ['expect(state.key).toBe("value");']
      }
    ];
  }

  generateDefaultReduxTests(spec) {
    return [
      {
        description: 'has initial state',
        arrange: [],
        act: [],
        assertions: ['expect(state).toBeDefined();']
      },
      {
        description: 'handles action',
        arrange: [],
        act: ['someAction({ payload: "test" })'],
        assertions: ['// Add assertions for action result']
      }
    ];
  }

  generateFormTest(spec) {
    const data = {
      formName: spec.name,
      formPath: spec.formPath || `./${spec.name}`,
      imports: spec.imports || [],
      mocks: spec.mocks || [],
      defaultProps: spec.defaultProps || [],
      fields: spec.fields || [],
      validationTests: spec.validationTests || this.generateDefaultValidationTests(spec),
      validFields: spec.validFields || this.generateValidFields(spec.fields || []),
      expectedData: spec.expectedData || '{}'
    };

    return this.renderTemplate('form-test', data);
  }

  generateDefaultValidationTests(spec) {
    const fields = spec.fields || [];
    return fields
      .filter(f => f.required)
      .map(field => ({
        description: `shows error when ${field.name} is empty`,
        fillFields: [],
        assertions: [`await waitFor(() => { expect(screen.getByText(/required/i)).toBeInTheDocument(); });`]
      }));
  }

  generateValidFields(fields) {
    return fields.map(field => ({
      label: field.label || field.name,
      value: this.getValidValue(field.type)
    }));
  }

  getValidValue(type) {
    const values = {
      'email': 'test@example.com',
      'password': 'Password123!',
      'text': 'Test value',
      'number': '42',
      'tel': '555-0123',
      'url': 'https://example.com'
    };
    return values[type] || 'test';
  }

  generateApiTest(spec) {
    const data = {
      apiName: spec.name,
      apiPath: spec.apiPath || `./${spec.name}.api`,
      imports: spec.imports || [],
      hookImports: spec.hookImports || [],
      mocks: spec.mocks || [],
      queryHooks: spec.queryHooks || this.generateDefaultQueryHooks(spec),
      mutationHooks: spec.mutationHooks || this.generateDefaultMutationHooks(spec)
    };

    return this.renderTemplate('api-test', data);
  }

  generateDefaultQueryHooks(spec) {
    return [
      {
        hookName: `use${this.capitalize(spec.name)}`,
        params: '',
        mockSetup: ["jest.spyOn(api, 'fetch').mockResolvedValue({ data: [] });"],
        errorMockSetup: ["jest.spyOn(api, 'fetch').mockRejectedValue(new Error('Failed'));"],
        assertions: ['expect(result.current.data).toBeDefined();']
      }
    ];
  }

  generateDefaultMutationHooks(spec) {
    return [
      {
        hookName: `useCreate${this.capitalize(spec.name)}`,
        mutationData: '{ name: "Test" }',
        mockSetup: ["jest.spyOn(api, 'create').mockResolvedValue({ id: 1 });"],
        assertions: ['expect(api.create).toHaveBeenCalled();']
      }
    ];
  }

  generateIntegrationTest(spec) {
    // Reuse component test template with integration-specific setup
    return this.generateComponentTest({
      ...spec,
      wrapper: spec.wrapper || 'TestProviders',
      tests: spec.tests || this.generateDefaultIntegrationTests(spec)
    });
  }

  generateDefaultIntegrationTests(spec) {
    return [
      {
        description: 'completes user flow',
        arrange: [],
        props: null,
        act: [
          "await userEvent.click(screen.getByRole('button', { name: /start/i }));",
          "await waitFor(() => expect(screen.getByText(/complete/i)).toBeInTheDocument());"
        ],
        assertions: ['// Final state assertions']
      }
    ];
  }

  generateE2ETest(spec) {
    const framework = spec.e2eFramework || E2E_FRAMEWORK.PLAYWRIGHT;
    const templateName = framework === E2E_FRAMEWORK.PLAYWRIGHT ? 'e2e-playwright' : 'e2e-cypress';

    const data = {
      testName: spec.name,
      beforeEach: spec.beforeEach || [
        framework === E2E_FRAMEWORK.PLAYWRIGHT
          ? "await page.goto('/');"
          : "cy.visit('/');"
      ],
      tests: spec.tests || this.generateDefaultE2ETests(spec, framework)
    };

    return this.renderTemplate(templateName, data);
  }

  generateDefaultE2ETests(spec, framework) {
    const isPlaywright = framework === E2E_FRAMEWORK.PLAYWRIGHT;

    return [
      {
        description: 'completes user journey',
        steps: [
          {
            description: 'Navigate to page',
            code: isPlaywright
              ? "await page.goto('/feature');"
              : "cy.visit('/feature');"
          },
          {
            description: 'Interact with element',
            code: isPlaywright
              ? "await page.click('button');"
              : "cy.get('button').click();"
          },
          {
            description: 'Verify result',
            code: isPlaywright
              ? "await expect(page.locator('.result')).toBeVisible();"
              : "cy.get('.result').should('be.visible');"
          }
        ]
      }
    ];
  }

  getTestValue(type) {
    const testValues = {
      'string': "'test'",
      'number': '42',
      'boolean': 'true',
      'object': '{}',
      'array': '[]',
      'function': 'jest.fn()',
      'React.ReactNode': '<span>Test</span>',
      'Date': 'new Date()'
    };

    // Handle generic types
    if (type.includes('[]')) return '[]';
    if (type.includes('=>')) return 'jest.fn()';

    return testValues[type] || 'undefined';
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton instance
let instance = null;

export function getFrontendTestGenerator(options = {}) {
  if (!instance) {
    instance = new FrontendTestGenerator(options);
  }
  return instance;
}

export default FrontendTestGenerator;
