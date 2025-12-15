# Frontend Writer Agent

A specialized code generation agent for React/TypeScript frontend applications with 6 skills for generating components, hooks, stores, forms, API integration, and pages.

## Features

- **ComponentGenerator** - Generate React functional components with TypeScript
- **HookGenerator** - Generate custom hooks (state, query, mutation)
- **StoreGenerator** - Generate Context/Zustand/Redux stores
- **FormGenerator** - Generate form components with React Hook Form
- **ApiGenerator** - Generate React Query/SWR API hooks
- **PageGenerator** - Generate page components with layouts

## Installation

The Frontend Writer Agent is included in the minions package:

```javascript
import { getFrontendWriterAgent } from 'minions';
```

## Quick Start

```javascript
import { getFrontendWriterAgent } from 'minions';

const frontend = getFrontendWriterAgent();

// Configure the agent
await frontend.configure({
  projectPath: './my-frontend',
  stateManagement: 'context',
  cssFramework: 'tailwind',
  typescript: true
});

// Initialize
await frontend.initialize();

// Generate a component
const component = await frontend.generateComponent({
  name: 'UserProfile',
  type: 'functional',
  props: [{ name: 'userId', type: 'string', required: true }]
});
```

## Configuration

```javascript
await frontend.configure({
  projectPath: './my-frontend',       // Frontend project root
  framework: 'react',                 // 'react' | 'nextjs'
  stateManagement: 'context',         // 'context' | 'zustand' | 'redux'
  apiClient: 'react-query',           // 'react-query' | 'swr' | 'axios'
  typescript: true,                   // Use TypeScript
  cssFramework: 'tailwind',           // 'tailwind' | 'styled-components' | 'css-modules'
  formLibrary: 'react-hook-form'      // Form library
});
```

## Skills

### ComponentGenerator

Generate React functional components with TypeScript interfaces.

```javascript
const result = await frontend.generateComponent({
  name: 'UserProfile',
  type: 'functional',
  props: [
    { name: 'userId', type: 'string', required: true },
    { name: 'onUpdate', type: '(user: User) => void' },
    { name: 'className', type: 'string' }
  ],
  hooks: ['useState', 'useEffect'],
  cssFramework: 'tailwind',
  withMemo: true
});
```

**Component Types:**
- `functional` - Functional component
- `memo` - Memoized component

**CSS Frameworks:**
- `tailwind` - Tailwind CSS classes
- `styled-components` - Styled Components
- `css-modules` - CSS Modules

### HookGenerator

Generate custom React hooks.

```javascript
const result = await frontend.generateHook({
  name: 'useUser',
  type: 'query',
  endpoint: '/api/users/:id',
  returnType: 'User',
  params: [{ name: 'id', type: 'string' }],
  options: {
    staleTime: 5000,
    cacheTime: 300000
  }
});
```

**Hook Types:**
- `state` - useState-based hook
- `query` - Data fetching hook (React Query)
- `mutation` - Data mutation hook
- `subscription` - WebSocket subscription hook
- `custom` - Custom hook logic

### StoreGenerator

Generate state management stores.

```javascript
const result = await frontend.generateStore({
  name: 'auth',
  type: 'context',
  state: [
    { name: 'user', type: 'User | null', initial: 'null' },
    { name: 'isAuthenticated', type: 'boolean', initial: 'false' },
    { name: 'loading', type: 'boolean', initial: 'false' }
  ],
  actions: [
    { name: 'login', params: ['credentials: LoginCredentials'], async: true },
    { name: 'logout', async: true },
    { name: 'setUser', params: ['user: User'] }
  ]
});
```

**Store Types:**
- `context` - React Context + useReducer
- `zustand` - Zustand store
- `redux` - Redux Toolkit slice

### FormGenerator

Generate form components with validation.

```javascript
const result = await frontend.generateForm({
  name: 'LoginForm',
  type: 'controlled',
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true, validation: 'email' },
    { name: 'password', type: 'password', label: 'Password', required: true, validation: 'min:8' },
    { name: 'rememberMe', type: 'checkbox', label: 'Remember me' }
  ],
  onSubmit: 'handleLogin',
  useReactHookForm: true,
  cssFramework: 'tailwind'
});
```

**Form Types:**
- `controlled` - Controlled form with React Hook Form
- `uncontrolled` - Uncontrolled form with refs

**Field Types:**
- `text`, `email`, `password`, `number`
- `textarea`, `select`, `checkbox`, `radio`
- `date`, `file`

### ApiGenerator

Generate API integration hooks.

```javascript
const result = await frontend.generateApi({
  name: 'users',
  client: 'react-query',
  baseUrl: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', name: 'useUsers', returnType: 'User[]' },
    { method: 'GET', path: '/:id', name: 'useUser', returnType: 'User' },
    { method: 'POST', path: '/', name: 'useCreateUser', returnType: 'User' },
    { method: 'PUT', path: '/:id', name: 'useUpdateUser', returnType: 'User' },
    { method: 'DELETE', path: '/:id', name: 'useDeleteUser', returnType: 'void' }
  ]
});
```

**API Clients:**
- `react-query` - TanStack Query
- `swr` - SWR
- `axios` - Plain Axios

### PageGenerator

Generate page components with layouts.

```javascript
const result = await frontend.generatePage({
  name: 'UsersPage',
  type: 'list',
  framework: 'react',
  layout: 'DashboardLayout',
  dataSource: 'useUsers',
  features: ['search', 'pagination', 'sorting'],
  actions: ['create', 'edit', 'delete']
});
```

**Page Types:**
- `list` - List/table page
- `detail` - Detail view page
- `form` - Form page
- `dashboard` - Dashboard with widgets
- `custom` - Custom page

## Output Structure

The agent generates files in the following structure:

```
src/
├── components/       # React components
│   └── UserProfile/
│       ├── UserProfile.tsx
│       ├── UserProfile.test.tsx
│       └── index.ts
├── hooks/            # Custom hooks
│   ├── useUser.ts
│   └── useAuth.ts
├── stores/           # State management
│   └── contexts/
│       └── AuthContext.tsx
├── forms/            # Form components
│   └── LoginForm.tsx
├── api/              # API integration hooks
│   └── users.api.ts
└── pages/            # Page components
    └── UsersPage.tsx
```

## Events

The agent publishes the following events:

- `FRONTEND_COMPONENT_GENERATED` - When a component is generated
- `FRONTEND_HOOK_GENERATED` - When a hook is generated
- `FRONTEND_STORE_GENERATED` - When a store is generated
- `FRONTEND_FORM_GENERATED` - When a form is generated
- `FRONTEND_API_GENERATED` - When API hooks are generated
- `FRONTEND_PAGE_GENERATED` - When a page is generated

## License

MIT
