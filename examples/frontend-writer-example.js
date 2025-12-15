/**
 * Frontend Writer Agent Example
 *
 * Demonstrates how to use the Frontend Writer Agent to generate
 * React/TypeScript frontend code including components, hooks, stores,
 * forms, API hooks, and pages.
 */

import {
  getFrontendWriterAgent,
  COMPONENT_TYPE,
  CSS_FRAMEWORK,
  HOOK_TYPE,
  STORE_TYPE,
  FORM_TYPE,
  FORM_FIELD_TYPE,
  API_CLIENT,
  FRONTEND_HTTP_METHOD,
  FRONTEND_PAGE_TYPE,
  FRAMEWORK
} from '../index.js';

async function main() {
  console.log('🚀 Frontend Writer Agent Example\n');

  // Get the Frontend Writer Agent instance
  const frontend = getFrontendWriterAgent();

  // Configure the agent
  await frontend.configure({
    projectPath: './output/frontend-app',
    framework: 'react',
    stateManagement: 'context',
    apiClient: 'react-query',
    typescript: true,
    cssFramework: 'tailwind',
    formLibrary: 'react-hook-form'
  });

  // Initialize the agent
  await frontend.initialize();
  console.log('✅ Frontend Writer Agent initialized\n');

  // 1. Generate a Component
  console.log('📦 Generating UserProfile component...');
  const component = await frontend.generateComponent({
    name: 'UserProfile',
    type: COMPONENT_TYPE.FUNCTIONAL,
    props: [
      { name: 'userId', type: 'string', required: true },
      { name: 'onUpdate', type: '(user: User) => void' },
      { name: 'showActions', type: 'boolean' },
      { name: 'className', type: 'string' }
    ],
    hooks: ['useState', 'useEffect', 'useCallback'],
    cssFramework: CSS_FRAMEWORK.TAILWIND,
    generateTest: true
  });

  if (component.success) {
    console.log(`   ✅ Component generated: ${component.filePath}`);
    console.log('   Preview:\n');
    console.log(component.code.slice(0, 500) + '...\n');
  }

  // 2. Generate a Memoized Component
  console.log('📦 Generating UserCard memoized component...');
  const memoComponent = await frontend.generateComponent({
    name: 'UserCard',
    type: COMPONENT_TYPE.MEMO,
    props: [
      { name: 'user', type: 'User', required: true },
      { name: 'onClick', type: '() => void' }
    ],
    cssFramework: CSS_FRAMEWORK.TAILWIND
  });

  if (memoComponent.success) {
    console.log(`   ✅ Memoized component generated: ${memoComponent.filePath}`);
  }

  // 3. Generate Custom Hooks
  console.log('📦 Generating useUser query hook...');
  const queryHook = await frontend.generateHook({
    name: 'useUser',
    type: HOOK_TYPE.QUERY,
    endpoint: '/api/users/:id',
    returnType: 'User',
    params: [{ name: 'id', type: 'string' }],
    options: {
      staleTime: 5000,
      cacheTime: 300000,
      refetchOnWindowFocus: false
    }
  });

  if (queryHook.success) {
    console.log(`   ✅ Query hook generated: ${queryHook.filePath}`);
    console.log('   Preview:\n');
    console.log(queryHook.code.slice(0, 400) + '...\n');
  }

  console.log('📦 Generating useCreateUser mutation hook...');
  const mutationHook = await frontend.generateHook({
    name: 'useCreateUser',
    type: HOOK_TYPE.MUTATION,
    endpoint: '/api/users',
    method: 'POST',
    body: 'CreateUserInput',
    returnType: 'User',
    invalidateQueries: ['users'],
    callbacks: {
      onSuccess: true,
      onError: true
    }
  });

  if (mutationHook.success) {
    console.log(`   ✅ Mutation hook generated: ${mutationHook.filePath}`);
  }

  // 4. Generate State Store (Context)
  console.log('📦 Generating Auth Context store...');
  const store = await frontend.generateStore({
    name: 'auth',
    type: STORE_TYPE.CONTEXT,
    state: [
      { name: 'user', type: 'User | null', initial: 'null' },
      { name: 'isAuthenticated', type: 'boolean', initial: 'false' },
      { name: 'isLoading', type: 'boolean', initial: 'false' },
      { name: 'error', type: 'string | null', initial: 'null' }
    ],
    actions: [
      { name: 'login', params: ['credentials: LoginCredentials'], async: true },
      { name: 'logout', async: true },
      { name: 'setUser', params: ['user: User'] },
      { name: 'clearError' }
    ]
  });

  if (store.success) {
    console.log(`   ✅ Store generated: ${store.filePath}`);
    console.log('   Preview:\n');
    console.log(store.code.slice(0, 500) + '...\n');
  }

  // 5. Generate Form Component
  console.log('📦 Generating LoginForm...');
  const form = await frontend.generateForm({
    name: 'LoginForm',
    type: FORM_TYPE.CONTROLLED,
    fields: [
      {
        name: 'email',
        type: FORM_FIELD_TYPE.EMAIL,
        label: 'Email Address',
        required: true,
        validation: 'email',
        placeholder: 'Enter your email'
      },
      {
        name: 'password',
        type: FORM_FIELD_TYPE.PASSWORD,
        label: 'Password',
        required: true,
        validation: 'min:8',
        placeholder: 'Enter your password'
      },
      {
        name: 'rememberMe',
        type: FORM_FIELD_TYPE.CHECKBOX,
        label: 'Remember me'
      }
    ],
    onSubmit: 'handleLogin',
    cssFramework: 'tailwind'
  });

  if (form.success) {
    console.log(`   ✅ Form generated: ${form.filePath}`);
    console.log('   Preview:\n');
    console.log(form.code.slice(0, 500) + '...\n');
  }

  // 6. Generate Registration Form
  console.log('📦 Generating RegistrationForm...');
  const regForm = await frontend.generateForm({
    name: 'RegistrationForm',
    type: FORM_TYPE.CONTROLLED,
    fields: [
      { name: 'name', type: FORM_FIELD_TYPE.TEXT, label: 'Full Name', required: true },
      { name: 'email', type: FORM_FIELD_TYPE.EMAIL, label: 'Email', required: true, validation: 'email' },
      { name: 'password', type: FORM_FIELD_TYPE.PASSWORD, label: 'Password', required: true, validation: 'min:8' },
      { name: 'confirmPassword', type: FORM_FIELD_TYPE.PASSWORD, label: 'Confirm Password', required: true },
      {
        name: 'role',
        type: FORM_FIELD_TYPE.SELECT,
        label: 'Role',
        options: [
          { value: 'user', label: 'User' },
          { value: 'admin', label: 'Admin' }
        ]
      },
      { name: 'acceptTerms', type: FORM_FIELD_TYPE.CHECKBOX, label: 'I accept the terms and conditions', required: true }
    ],
    onSubmit: 'handleRegister',
    cssFramework: 'tailwind'
  });

  if (regForm.success) {
    console.log(`   ✅ Registration form generated: ${regForm.filePath}`);
  }

  // 7. Generate API Hooks
  console.log('📦 Generating Users API hooks...');
  const apiHooks = await frontend.generateApi({
    name: 'users',
    client: API_CLIENT.REACT_QUERY,
    baseUrl: '/api/users',
    endpoints: [
      { method: FRONTEND_HTTP_METHOD.GET, path: '/', name: 'useUsers', returnType: 'User[]' },
      { method: FRONTEND_HTTP_METHOD.GET, path: '/:id', name: 'useUser', returnType: 'User' },
      { method: FRONTEND_HTTP_METHOD.POST, path: '/', name: 'useCreateUser', returnType: 'User', invalidates: ['users'] },
      { method: FRONTEND_HTTP_METHOD.PUT, path: '/:id', name: 'useUpdateUser', returnType: 'User', invalidates: ['users', 'user'] },
      { method: FRONTEND_HTTP_METHOD.DELETE, path: '/:id', name: 'useDeleteUser', returnType: 'void', invalidates: ['users'] }
    ]
  });

  if (apiHooks.success) {
    console.log(`   ✅ API hooks generated: ${apiHooks.filePath}`);
    console.log('   Preview:\n');
    console.log(apiHooks.code.slice(0, 500) + '...\n');
  }

  // 8. Generate Page Components
  console.log('📦 Generating UsersPage (list)...');
  const listPage = await frontend.generatePage({
    name: 'UsersPage',
    type: FRONTEND_PAGE_TYPE.LIST,
    framework: FRAMEWORK.REACT,
    layout: 'DashboardLayout',
    dataSource: 'useUsers',
    features: ['search', 'pagination', 'sorting'],
    actions: ['create', 'edit', 'delete']
  });

  if (listPage.success) {
    console.log(`   ✅ List page generated: ${listPage.filePath}`);
    console.log('   Preview:\n');
    console.log(listPage.code.slice(0, 500) + '...\n');
  }

  console.log('📦 Generating UserDetailPage...');
  const detailPage = await frontend.generatePage({
    name: 'UserDetailPage',
    type: FRONTEND_PAGE_TYPE.DETAIL,
    framework: FRAMEWORK.REACT,
    layout: 'DashboardLayout',
    dataSource: 'useUser'
  });

  if (detailPage.success) {
    console.log(`   ✅ Detail page generated: ${detailPage.filePath}`);
  }

  console.log('📦 Generating DashboardPage...');
  const dashboardPage = await frontend.generatePage({
    name: 'DashboardPage',
    type: FRONTEND_PAGE_TYPE.DASHBOARD,
    framework: FRAMEWORK.REACT,
    layout: 'DashboardLayout',
    widgets: ['stats', 'recentUsers', 'activityChart']
  });

  if (dashboardPage.success) {
    console.log(`   ✅ Dashboard page generated: ${dashboardPage.filePath}`);
  }

  console.log('🎉 All Frontend code generation complete!');
  console.log('\nGenerated files structure:');
  console.log(`
./output/frontend-app/
├── src/
│   ├── components/
│   │   ├── UserProfile/
│   │   │   ├── UserProfile.tsx
│   │   │   └── UserProfile.test.tsx
│   │   └── UserCard/
│   │       └── UserCard.tsx
│   ├── hooks/
│   │   ├── useUser.ts
│   │   └── useCreateUser.ts
│   ├── stores/
│   │   └── contexts/
│   │       └── AuthContext.tsx
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   └── RegistrationForm.tsx
│   ├── api/
│   │   └── users.api.ts
│   └── pages/
│       ├── UsersPage.tsx
│       ├── UserDetailPage.tsx
│       └── DashboardPage.tsx
`);
}

main().catch(console.error);
