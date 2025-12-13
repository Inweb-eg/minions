import { describe, test, expect, beforeEach } from '@jest/globals';
import AdminDigest, { getAdminDigest } from '../../digest-generators/admin-digest.js';

describe('AdminDigest', () => {
  let digest;

  beforeEach(() => {
    digest = new AdminDigest();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(digest).toBeDefined();
      expect(digest.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getAdminDigest();
      const instance2 = getAdminDigest();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Digest Generation', () => {
    test('should generate complete admin dashboard digest', () => {
      const mockReact = {
        pages: [
          { name: 'Dashboard', componentType: 'functional', route: '/dashboard' }
        ],
        components: [
          { name: 'DataTable', type: 'functional' }
        ],
        hooks: [
          { name: 'useAuth', params: [] }
        ]
      };

      const result = digest.generate({ react: mockReact });

      expect(result).toBeDefined();
      expect(result.platform).toBe('react');
      expect(result.app).toBe('admin');
      expect(result.pages).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.hooks).toBeDefined();
    });

    test('should handle empty input', () => {
      const result = digest.generate({});

      expect(result).toBeDefined();
      expect(result.pages).toHaveLength(0);
      expect(result.components).toHaveLength(0);
      expect(result.hooks).toHaveLength(0);
    });
  });

  describe('React Processing', () => {
    test('should process pages', () => {
      const mockReact = {
        pages: [
          {
            name: 'Dashboard',
            componentType: 'functional',
            route: '/dashboard',
            description: 'Main dashboard page'
          }
        ]
      };

      const result = digest.generate({ react: mockReact });

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].name).toBe('Dashboard');
      expect(result.pages[0].type).toBe('functional');
      expect(result.pages[0].file).toBe('src/pages/Dashboard.jsx');
    });

    test('should process components', () => {
      const mockReact = {
        components: [
          { name: 'DataTable', type: 'functional', props: ['data: Array', 'columns: Array'] }
        ]
      };

      const result = digest.generate({ react: mockReact });

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('DataTable');
      expect(result.components[0].file).toBe('src/components/DataTable.jsx');
    });

    test('should process hooks', () => {
      const mockReact = {
        hooks: [
          { name: 'useAuth', params: [], returns: 'AuthState' }
        ]
      };

      const result = digest.generate({ react: mockReact });

      expect(result.hooks).toHaveLength(1);
      expect(result.hooks[0].name).toBe('useAuth');
      expect(result.hooks[0].file).toBe('src/hooks/useAuth.js');
    });

    test('should process contexts', () => {
      const mockReact = {
        contexts: [
          { name: 'Auth', state: ['user', 'token'], actions: ['login', 'logout'] }
        ]
      };

      const result = digest.generate({ react: mockReact });

      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].name).toBe('Auth');
      expect(result.contexts[0].file).toBe('src/contexts/Auth.jsx');
    });

    test('should extract state management pattern', () => {
      const mockReact = {
        stateManagement: { primary: 'redux' }
      };

      const result = digest.generate({ react: mockReact });

      expect(result.stateManagement.pattern).toBe('redux');
      expect(result.dependencies).toContain('redux');
    });

    test('should not add context as dependency', () => {
      const mockReact = {
        stateManagement: { primary: 'context' }
      };

      const result = digest.generate({ react: mockReact });

      expect(result.stateManagement.pattern).toBe('context');
      expect(result.dependencies).not.toContain('context');
    });

    test('should extract routing library', () => {
      const mockReact = {
        routing: { library: 'react-router-dom' }
      };

      const result = digest.generate({ react: mockReact });

      expect(result.routing.library).toBe('react-router-dom');
      expect(result.dependencies).toContain('react-router-dom');
    });

    test('should extract UI framework', () => {
      const mockReact = {
        uiFramework: 'material-ui'
      };

      const result = digest.generate({ react: mockReact });

      expect(result.uiFramework.name).toBe('material-ui');
      expect(result.dependencies).toContain('@mui/material');
    });

    test('should process routes', () => {
      const mockReact = {
        routes: [
          { path: '/dashboard', component: 'Dashboard' },
          { path: '/users', component: 'UserManagement' }
        ]
      };

      const result = digest.generate({ react: mockReact });

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].path).toBe('/dashboard');
    });
  });

  describe('Admin-Specific Requirements', () => {
    test('should add core React dependencies', () => {
      const result = digest.generate({});

      expect(result.dependencies).toContain('react');
      expect(result.dependencies).toContain('react-dom');
      expect(result.dependencies).toContain('react-router-dom');
      expect(result.dependencies).toContain('axios');
    });

    test('should add chart library', () => {
      const result = digest.generate({});

      expect(result.dependencies).toContain('recharts');
    });

    test('should add date utilities', () => {
      const result = digest.generate({});

      expect(result.dependencies).toContain('date-fns');
    });

    test('should add form library', () => {
      const result = digest.generate({});

      expect(result.dependencies).toContain('react-hook-form');
    });

    test('should add dev dependencies', () => {
      const result = digest.generate({});

      expect(result.devDependencies).toContain('vite');
      expect(result.devDependencies).toContain('eslint');
      expect(result.devDependencies).toContain('prettier');
    });

    test('should add admin best practices', () => {
      const result = digest.generate({});

      expect(result.bestPractices.length).toBeGreaterThan(0);
      expect(result.bestPractices.some(p => p.category === 'security')).toBe(true);
      expect(result.bestPractices.some(p => p.category === 'ux')).toBe(true);
      expect(result.bestPractices.some(p => p.category === 'performance')).toBe(true);
    });
  });

  describe('API Processing', () => {
    test('should generate API services from endpoints', () => {
      const mockAPI = {
        endpoints: [
          { path: '/api/users', method: 'GET', summary: 'Get users' }
        ]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.services.length).toBeGreaterThan(0);
      const apiService = result.services.find(s => s.type === 'api');
      expect(apiService).toBeDefined();
    });

    test('should add axios dependency', () => {
      const mockAPI = {
        endpoints: [{ path: '/api/test', method: 'GET' }]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.dependencies).toContain('axios');
    });
  });

  describe('Method Name Generation', () => {
    test('should generate correct method names', () => {
      expect(digest.getMethodName({ method: 'GET', path: '/api/users' }))
        .toBe('getAllUsers');

      expect(digest.getMethodName({ method: 'GET', path: '/api/users/:id' }))
        .toBe('getUsersById');

      expect(digest.getMethodName({ method: 'POST', path: '/api/users' }))
        .toBe('createUsers');

      expect(digest.getMethodName({ method: 'PUT', path: '/api/users/:id' }))
        .toBe('updateUsers');

      expect(digest.getMethodName({ method: 'DELETE', path: '/api/users/:id' }))
        .toBe('deleteUsers');
    });
  });

  describe('Return Type Generation', () => {
    test('should generate correct return types', () => {
      expect(digest.getReturnType('users', { method: 'GET', path: '/api/users' }))
        .toBe('Promise<Users[]>');

      expect(digest.getReturnType('users', { method: 'GET', path: '/api/users/:id' }))
        .toBe('Promise<Users>');

      expect(digest.getReturnType('users', { method: 'DELETE', path: '/api/users/:id' }))
        .toBe('Promise<void>');
    });
  });

  describe('Page Implementation', () => {
    test('should generate page implementation guidance', () => {
      const page = {
        name: 'Dashboard',
        componentType: 'functional'
      };

      const impl = digest.generatePageImplementation(page);

      expect(impl.structure).toBeDefined();
      expect(impl.hooks).toBeDefined();
      expect(impl.handlers).toBeDefined();
      expect(impl.example).toBeDefined();
    });

    test('should generate dashboard page structure', () => {
      const page = { name: 'Dashboard' };

      const structure = digest.generatePageStructure(page);

      expect(structure.sections).toContain('Header');
      expect(structure.sections).toContain('Stats Cards');
      expect(structure.sections).toContain('Charts');
      expect(structure.layout).toBe('Grid');
    });

    test('should generate management page structure', () => {
      const page = { name: 'UserManagement' };

      const structure = digest.generatePageStructure(page);

      expect(structure.sections).toContain('Data Table');
      expect(structure.sections).toContain('Filters');
      expect(structure.layout).toBe('Vertical');
    });

    test('should generate form page structure', () => {
      const page = { name: 'UserForm' };

      const structure = digest.generatePageStructure(page);

      expect(structure.sections).toContain('Form Fields');
      expect(structure.sections).toContain('Action Buttons');
    });

    test('should generate page hooks', () => {
      const page = { name: 'UserForm' };

      const hooks = digest.generatePageHooks(page);

      expect(hooks).toContain('useState');
      expect(hooks).toContain('useEffect');
      expect(hooks).toContain('useForm');
    });

    test('should generate page handlers for list pages', () => {
      const page = { name: 'UserList' };

      const handlers = digest.generatePageHandlers(page);

      expect(handlers.some(h => h.name === 'handleSearch')).toBe(true);
      expect(handlers.some(h => h.name === 'handlePageChange')).toBe(true);
      expect(handlers.some(h => h.name === 'handleDelete')).toBe(true);
    });

    test('should generate page handlers for form pages', () => {
      const page = { name: 'UserForm' };

      const handlers = digest.generatePageHandlers(page);

      expect(handlers.some(h => h.name === 'handleSubmit')).toBe(true);
      expect(handlers.some(h => h.name === 'handleCancel')).toBe(true);
    });

    test('should generate page example', () => {
      const page = { name: 'Dashboard' };

      const example = digest.generatePageExample(page);

      expect(example).toContain('function Dashboard');
      expect(example).toContain('useState');
      expect(example).toContain('useEffect');
    });
  });

  describe('Component Implementation', () => {
    test('should generate component implementation', () => {
      const component = {
        name: 'DataTable',
        type: 'functional',
        props: ['data: Array', 'columns: Array']
      };

      const impl = digest.generateComponentImplementation(component);

      expect(impl.props).toBeDefined();
      expect(impl.example).toBeDefined();
    });

    test('should generate component example', () => {
      const component = {
        name: 'Button',
        props: ['onClick: Function', 'children: ReactNode']
      };

      const example = digest.generateComponentExample(component);

      expect(example).toContain('function Button');
      expect(example).toContain('onClick');
      expect(example).toContain('children');
    });
  });

  describe('Hook Implementation', () => {
    test('should generate hook implementation', () => {
      const hook = {
        name: 'useAuth',
        params: [],
        returns: 'AuthState'
      };

      const impl = digest.generateHookImplementation(hook);

      expect(impl.usage).toBe('const result = useAuth();');
      expect(impl.example).toBeDefined();
    });

    test('should generate hook example', () => {
      const hook = {
        name: 'useFetch',
        params: ['url']
      };

      const example = digest.generateHookExample(hook);

      expect(example).toContain('function useFetch');
      expect(example).toContain('useState');
      expect(example).toContain('useEffect');
    });
  });

  describe('Context Implementation', () => {
    test('should generate context implementation', () => {
      const context = {
        name: 'Auth',
        state: ['user', 'token'],
        actions: ['login', 'logout']
      };

      const impl = digest.generateContextImplementation(context);

      expect(impl.provider).toBe('AuthProvider');
      expect(impl.hook).toBe('useAuth');
      expect(impl.example).toBeDefined();
    });

    test('should generate context example', () => {
      const context = {
        name: 'Theme'
      };

      const example = digest.generateContextExample(context);

      expect(example).toContain('ThemeContext');
      expect(example).toContain('ThemeProvider');
      expect(example).toContain('useTheme');
    });
  });

  describe('API Method Implementation', () => {
    test('should generate API method implementation', () => {
      const endpoint = {
        method: 'GET',
        path: '/api/users/:id'
      };

      const impl = digest.generateApiMethodImplementation(endpoint, 'users');

      expect(impl.axiosCall).toContain('axios.get');
      expect(impl.example).toContain('export const');
      expect(impl.example).toContain('async');
    });

    test('should get method parameters', () => {
      expect(digest.getMethodParams({ method: 'GET', path: '/api/users/:id' }))
        .toBe('id');

      expect(digest.getMethodParams({ method: 'POST', path: '/api/users' }))
        .toBe('data');

      expect(digest.getMethodParams({ method: 'PUT', path: '/api/users/:id' }))
        .toBe('id, data');
    });
  });

  describe('Feature Processing', () => {
    test('should extract requirements', () => {
      const mockFeatures = {
        requirements: [
          'Support 1000 concurrent users',
          'Response time < 2 seconds'
        ]
      };

      const result = digest.generate({ features: mockFeatures });

      expect(result.bestPractices.some(p => p.category === 'implementation')).toBe(true);
    });

    test('should extract business rules', () => {
      const mockFeatures = {
        businessRules: [
          'Admin must have valid credentials',
          'Only superadmin can delete users'
        ]
      };

      const result = digest.generate({ features: mockFeatures });

      expect(result.bestPractices.some(p => p.category === 'validation')).toBe(true);
    });
  });

  describe('UI Framework', () => {
    test('should get UI framework package', () => {
      expect(digest.getUIFrameworkPackage('material-ui')).toBe('@mui/material');
      expect(digest.getUIFrameworkPackage('mui')).toBe('@mui/material');
      expect(digest.getUIFrameworkPackage('chakra-ui')).toBe('@chakra-ui/react');
      expect(digest.getUIFrameworkPackage('ant-design')).toBe('antd');
      expect(digest.getUIFrameworkPackage('tailwind')).toBe('tailwindcss');
    });

    test('should get UI framework usage', () => {
      const usage = digest.getUIFrameworkUsage('material-ui');
      expect(usage).toContain('Import components from @mui/material');
    });
  });

  describe('Utility Methods', () => {
    test('should convert to kebab-case', () => {
      expect(digest.toKebabCase('Dashboard')).toBe('dashboard');
      expect(digest.toKebabCase('UserManagement')).toBe('user-management');
      expect(digest.toKebabCase('DataTable')).toBe('data-table');
    });

    test('should capitalize strings', () => {
      expect(digest.capitalize('user')).toBe('User');
      expect(digest.capitalize('admin')).toBe('Admin');
      expect(digest.capitalize('')).toBe('');
    });

    test('should group endpoints by resource', () => {
      const endpoints = [
        { path: '/api/users', method: 'GET' },
        { path: '/api/users/:id', method: 'GET' },
        { path: '/api/rides', method: 'POST' }
      ];

      const grouped = digest.groupEndpointsByResource(endpoints);

      expect(grouped.users).toHaveLength(2);
      expect(grouped.rides).toHaveLength(1);
    });
  });
});
