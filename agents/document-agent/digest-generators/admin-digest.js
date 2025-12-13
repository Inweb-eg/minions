import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('AdminDigest');

/**
 * AdminDigest - Generates React admin dashboard code generation instructions
 *
 * Takes parsed documentation from:
 * - React Parser (pages, components, hooks, contexts)
 * - API Parser (endpoints for admin operations)
 * - Feature Parser (requirements, business rules)
 *
 * Generates:
 * - React page components
 * - Reusable UI components
 * - Custom hooks
 * - Context providers for state management
 * - API service clients
 * - Route configuration
 */
class AdminDigest {
  constructor() {
    this.logger = createLogger('AdminDigest');
  }

  /**
   * Generate complete admin dashboard digest from parsed documentation
   *
   * @param {Object} params - Parsed documentation
   * @param {Object} params.react - Parsed React documentation
   * @param {Object} params.api - Parsed API documentation
   * @param {Object} params.features - Parsed feature documentation
   * @returns {Object} React admin dashboard code generation digest
   */
  generate({ react, api, features }) {
    this.logger.info('Generating admin dashboard digest...');

    const digest = {
      platform: 'react',
      app: 'admin',
      generatedAt: new Date().toISOString(),

      // Code generation instructions
      pages: [],
      components: [],
      hooks: [],
      contexts: [],
      services: [],
      routes: [],

      // Configuration
      dependencies: new Set(),
      devDependencies: new Set(),

      // Implementation guidance
      stateManagement: {},
      routing: {},
      uiFramework: {},
      apiIntegration: {},
      bestPractices: []
    };

    // Process React documentation
    if (react) {
      this.processReact(react, digest);
    }

    // Process API documentation
    if (api) {
      this.processAPI(api, digest);
    }

    // Process feature documentation
    if (features) {
      this.processFeatures(features, digest);
    }

    // Add admin-specific requirements
    this.addAdminSpecificRequirements(digest);

    // Convert Sets to Arrays
    digest.dependencies = Array.from(digest.dependencies);
    digest.devDependencies = Array.from(digest.devDependencies);

    this.logger.info(
      `Generated admin dashboard digest: ${digest.pages.length} pages, ` +
      `${digest.components.length} components, ${digest.hooks.length} hooks`
    );

    return digest;
  }

  /**
   * Process React documentation
   */
  processReact(react, digest) {
    // Process pages
    if (react.pages) {
      for (const page of react.pages) {
        digest.pages.push({
          name: page.name,
          file: `src/pages/${page.name}.jsx`,
          type: page.componentType || 'functional',
          route: page.route,
          description: page.description,
          components: page.components || [],
          hooks: page.hooks || [],
          implementation: this.generatePageImplementation(page)
        });
      }
    }

    // Process components
    if (react.components) {
      for (const component of react.components) {
        digest.components.push({
          name: component.name,
          file: `src/components/${component.name}.jsx`,
          type: component.type,
          description: component.description,
          props: component.props || [],
          implementation: this.generateComponentImplementation(component)
        });
      }
    }

    // Process hooks
    if (react.hooks) {
      for (const hook of react.hooks) {
        digest.hooks.push({
          name: hook.name,
          file: `src/hooks/${hook.name}.js`,
          description: hook.description,
          params: hook.params || [],
          returns: hook.returns,
          implementation: this.generateHookImplementation(hook)
        });
      }
    }

    // Process contexts
    if (react.contexts) {
      for (const context of react.contexts) {
        digest.contexts.push({
          name: context.name,
          file: `src/contexts/${context.name}.jsx`,
          description: context.description,
          state: context.state || [],
          actions: context.actions || [],
          implementation: this.generateContextImplementation(context)
        });
      }
    }

    // Process routes
    if (react.routes) {
      digest.routes = react.routes.map(r => ({
        path: r.path,
        component: r.component,
        implementation: `<Route path="${r.path}" element={<${r.component} />} />`
      }));
    }

    // Extract state management pattern
    if (react.stateManagement?.primary) {
      digest.stateManagement.pattern = react.stateManagement.primary;
      if (react.stateManagement.primary !== 'context') {
        digest.dependencies.add(react.stateManagement.primary);
      }
    }

    // Extract routing library
    if (react.routing?.library) {
      digest.routing.library = react.routing.library;
      digest.dependencies.add(react.routing.library);
    }

    // Extract UI framework
    if (react.uiFramework) {
      digest.uiFramework = {
        name: react.uiFramework,
        usage: this.getUIFrameworkUsage(react.uiFramework)
      };
      digest.dependencies.add(this.getUIFrameworkPackage(react.uiFramework));
    }

    // Add dependencies
    if (react.dependencies) {
      for (const dep of react.dependencies) {
        if (dep.name) {
          digest.dependencies.add(dep.name);
        }
      }
    }
  }

  /**
   * Process API documentation for service generation
   */
  processAPI(api, digest) {
    if (!api.endpoints) return;

    // Group endpoints by resource
    const endpointsByResource = this.groupEndpointsByResource(api.endpoints);

    for (const [resource, endpoints] of Object.entries(endpointsByResource)) {
      // Check if service already exists
      if (!digest.services.find(s => s.name.toLowerCase().includes(resource))) {
        digest.services.push({
          name: `${this.capitalize(resource)}Service`,
          file: `src/services/${resource}Service.js`,
          type: 'api',
          methods: endpoints.map(e => ({
            name: this.getMethodName(e),
            httpMethod: e.method,
            endpoint: e.path,
            description: e.description || e.summary,
            parameters: e.parameters || [],
            requestBody: e.requestBody,
            returnType: this.getReturnType(resource, e),
            implementation: this.generateApiMethodImplementation(e, resource)
          }))
        });
      }
    }

    // Add axios for HTTP requests
    digest.dependencies.add('axios');
  }

  /**
   * Process feature documentation
   */
  processFeatures(features, digest) {
    // Extract admin-specific requirements
    if (features.requirements) {
      for (const req of features.requirements) {
        digest.bestPractices.push({
          requirement: req,
          category: 'implementation'
        });
      }
    }

    // Extract business rules for validation
    if (features.businessRules) {
      for (const rule of features.businessRules) {
        digest.bestPractices.push({
          businessRule: rule,
          category: 'validation',
          implementation: 'Add validation logic in forms and API calls'
        });
      }
    }
  }

  /**
   * Add admin-specific requirements
   */
  addAdminSpecificRequirements(digest) {
    // Add core React dependencies
    digest.dependencies.add('react');
    digest.dependencies.add('react-dom');

    // Add common admin dashboard dependencies
    digest.dependencies.add('react-router-dom');
    digest.dependencies.add('axios');

    // Add chart library for analytics
    if (!digest.dependencies.has('recharts') && !digest.dependencies.has('chart.js')) {
      digest.dependencies.add('recharts');
    }

    // Add date utilities
    digest.dependencies.add('date-fns');

    // Add form library
    if (!digest.dependencies.has('react-hook-form') && !digest.dependencies.has('formik')) {
      digest.dependencies.add('react-hook-form');
    }

    // Dev dependencies
    digest.devDependencies.add('vite');
    digest.devDependencies.add('eslint');
    digest.devDependencies.add('prettier');

    // Admin-specific best practices
    digest.bestPractices.push({
      category: 'security',
      practice: 'Implement role-based access control (RBAC)',
      implementation: 'Check user permissions before rendering admin features'
    });

    digest.bestPractices.push({
      category: 'ux',
      practice: 'Show loading states for all async operations',
      implementation: 'Use loading spinners and skeleton screens'
    });

    digest.bestPractices.push({
      category: 'performance',
      practice: 'Implement pagination for large data tables',
      implementation: 'Use server-side pagination with page size limits'
    });
  }

  /**
   * Generate page implementation guidance
   */
  generatePageImplementation(page) {
    return {
      structure: this.generatePageStructure(page),
      hooks: this.generatePageHooks(page),
      handlers: this.generatePageHandlers(page),
      example: this.generatePageExample(page)
    };
  }

  /**
   * Generate page structure
   */
  generatePageStructure(page) {
    const nameLower = page.name.toLowerCase();

    if (nameLower.includes('dashboard')) {
      return {
        sections: ['Header', 'Stats Cards', 'Charts', 'Recent Activity'],
        layout: 'Grid'
      };
    }

    if (nameLower.includes('management') || nameLower.includes('list')) {
      return {
        sections: ['Header', 'Filters', 'Data Table', 'Pagination'],
        layout: 'Vertical'
      };
    }

    if (nameLower.includes('form') || nameLower.includes('edit')) {
      return {
        sections: ['Header', 'Form Fields', 'Action Buttons'],
        layout: 'Vertical'
      };
    }

    return {
      sections: ['Header', 'Content'],
      layout: 'Vertical'
    };
  }

  /**
   * Generate hooks used in page
   */
  generatePageHooks(page) {
    const hooks = ['useState', 'useEffect'];
    const nameLower = page.name.toLowerCase();

    if (nameLower.includes('form')) {
      hooks.push('useForm'); // from react-hook-form
    }

    if (page.hooks && page.hooks.includes('useContext')) {
      hooks.push('useContext');
    }

    return hooks;
  }

  /**
   * Generate event handlers for page
   */
  generatePageHandlers(page) {
    const handlers = [];
    const nameLower = page.name.toLowerCase();

    if (nameLower.includes('list') || nameLower.includes('management')) {
      handlers.push({ name: 'handleSearch', purpose: 'Search/filter data' });
      handlers.push({ name: 'handlePageChange', purpose: 'Navigate pages' });
      handlers.push({ name: 'handleDelete', purpose: 'Delete item' });
    }

    if (nameLower.includes('form') || nameLower.includes('edit')) {
      handlers.push({ name: 'handleSubmit', purpose: 'Submit form' });
      handlers.push({ name: 'handleCancel', purpose: 'Cancel and go back' });
    }

    return handlers;
  }

  /**
   * Generate page code example
   */
  generatePageExample(page) {
    return `
import { useState, useEffect } from 'react';

function ${page.name}() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch data from API
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="${this.toKebabCase(page.name)}">
      <h1>${page.name}</h1>
      {/* Your content here */}
    </div>
  );
}

export default ${page.name};`.trim();
  }

  /**
   * Generate component implementation guidance
   */
  generateComponentImplementation(component) {
    return {
      props: this.extractProps(component),
      example: this.generateComponentExample(component)
    };
  }

  /**
   * Extract props from component
   */
  extractProps(component) {
    return component.props || [];
  }

  /**
   * Generate component code example
   */
  generateComponentExample(component) {
    const props = component.props?.slice(0, 3).map(p => {
      const match = p.match(/(\w+):\s*(\w+)/);
      return match ? match[1] : p;
    }).join(', ') || 'children';

    return `
function ${component.name}({ ${props} }) {
  return (
    <div className="${this.toKebabCase(component.name)}">
      {/* Component implementation */}
    </div>
  );
}

export default ${component.name};`.trim();
  }

  /**
   * Generate hook implementation guidance
   */
  generateHookImplementation(hook) {
    return {
      usage: `const result = ${hook.name}(${hook.params?.join(', ') || ''});`,
      example: this.generateHookExample(hook)
    };
  }

  /**
   * Generate hook code example
   */
  generateHookExample(hook) {
    return `
import { useState, useEffect } from 'react';

function ${hook.name}(${hook.params?.join(', ') || ''}) {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Hook logic here
  }, []);

  return state;
}

export default ${hook.name};`.trim();
  }

  /**
   * Generate context implementation guidance
   */
  generateContextImplementation(context) {
    return {
      provider: `${context.name}Provider`,
      hook: `use${context.name}`,
      example: this.generateContextExample(context)
    };
  }

  /**
   * Generate context code example
   */
  generateContextExample(context) {
    return `
import { createContext, useContext, useState } from 'react';

const ${context.name}Context = createContext();

export function ${context.name}Provider({ children }) {
  const [state, setState] = useState({});

  const value = {
    state,
    setState,
    // Add your context methods here
  };

  return (
    <${context.name}Context.Provider value={value}>
      {children}
    </${context.name}Context.Provider>
  );
}

export function use${context.name}() {
  const context = useContext(${context.name}Context);
  if (!context) {
    throw new Error('use${context.name} must be used within ${context.name}Provider');
  }
  return context;
}`.trim();
  }

  /**
   * Generate API method implementation
   */
  generateApiMethodImplementation(endpoint, resource) {
    const method = endpoint.method.toLowerCase();

    return {
      axiosCall: `axios.${method}(\`\${BASE_URL}${endpoint.path}\`)`,
      responseHandling: 'Extract data from response.data',
      errorHandling: 'Catch and throw formatted error',
      example: `
// ${method.toUpperCase()} ${endpoint.path}
export const ${this.getMethodName(endpoint)} = async (${this.getMethodParams(endpoint)}) => {
  try {
    const response = await axios.${method}(\`\${BASE_URL}${endpoint.path}\`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Request failed');
  }
};`.trim()
    };
  }

  /**
   * Get method parameters
   */
  getMethodParams(endpoint) {
    const params = [];

    if (endpoint.path.includes(':id')) {
      params.push('id');
    }

    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      params.push('data');
    }

    return params.join(', ');
  }

  /**
   * Group endpoints by resource
   */
  groupEndpointsByResource(endpoints) {
    const grouped = {};

    for (const endpoint of endpoints) {
      const match = endpoint.path.match(/\/api\/([^/]+)/);
      const resource = match ? match[1] : 'default';

      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(endpoint);
    }

    return grouped;
  }

  /**
   * Get method name from endpoint
   */
  getMethodName(endpoint) {
    const method = endpoint.method.toLowerCase();
    const parts = endpoint.path.split('/').filter(p => p && p !== 'api');
    const resource = parts[0];

    if (method === 'get' && endpoint.path.includes(':id')) {
      return `get${this.capitalize(resource)}ById`;
    } else if (method === 'get') {
      return `getAll${this.capitalize(resource)}`;
    } else if (method === 'post') {
      return `create${this.capitalize(resource)}`;
    } else if (method === 'put') {
      return `update${this.capitalize(resource)}`;
    } else if (method === 'delete') {
      return `delete${this.capitalize(resource)}`;
    }

    return `${method}${this.capitalize(resource)}`;
  }

  /**
   * Get return type for method
   */
  getReturnType(resource, endpoint) {
    const method = endpoint.method.toLowerCase();

    if (method === 'get' && !endpoint.path.includes(':id')) {
      return `Promise<${this.capitalize(resource)}[]>`;
    }

    if (method === 'delete') {
      return 'Promise<void>';
    }

    return `Promise<${this.capitalize(resource)}>`;
  }

  /**
   * Get UI framework package name
   */
  getUIFrameworkPackage(framework) {
    const packages = {
      'material-ui': '@mui/material',
      'mui': '@mui/material',
      'chakra': '@chakra-ui/react',
      'chakra-ui': '@chakra-ui/react',
      'ant-design': 'antd',
      'antd': 'antd',
      'tailwind': 'tailwindcss'
    };

    // Handle both string and object types
    const frameworkName = typeof framework === 'string' ? framework : (framework?.name || '');
    return packages[frameworkName.toLowerCase()] || frameworkName;
  }

  /**
   * Get UI framework usage guidance
   */
  getUIFrameworkUsage(framework) {
    const usageMap = {
      'material-ui': 'Import components from @mui/material',
      'mui': 'Import components from @mui/material',
      'chakra-ui': 'Wrap app with ChakraProvider',
      'ant-design': 'Import components from antd, import antd styles',
      'tailwind': 'Use utility classes in className'
    };

    // Handle both string and object types
    const frameworkName = typeof framework === 'string' ? framework : (framework?.name || '');
    return usageMap[frameworkName.toLowerCase()] || 'Follow framework documentation';
  }

  /**
   * Convert string to kebab-case
   */
  toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Capitalize string
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of AdminDigest
 * @returns {AdminDigest}
 */
export function getAdminDigest() {
  if (!instance) {
    instance = new AdminDigest();
  }
  return instance;
}

export { AdminDigest };
export default AdminDigest;
