# Flutter Writer Agent

A specialized code generation agent for Flutter/Dart applications with 6 skills for generating widgets, models, services, state management, pages, and localization files.

## Features

- **WidgetGenerator** - Generate Stateless and Stateful Flutter widgets
- **ModelGenerator** - Generate Freezed/JSON serializable data models
- **ServiceGenerator** - Generate Dio-based API services
- **BlocGenerator** - Generate Bloc/Cubit state management
- **PageGenerator** - Generate pages with Scaffold and navigation
- **LocalizationGenerator** - Generate ARB localization files

## Installation

The Flutter Writer Agent is included in the minions package:

```javascript
import { getFlutterWriterAgent } from 'minions';
```

## Quick Start

```javascript
import { getFlutterWriterAgent } from 'minions';

const flutter = getFlutterWriterAgent();

// Configure the agent
await flutter.configure({
  projectPath: './my-flutter-app',
  stateManagement: 'bloc',
  useFreezed: true
});

// Initialize
await flutter.initialize();

// Generate a widget
const widget = await flutter.generateWidget({
  name: 'UserCard',
  type: 'stateless',
  props: [
    { name: 'user', type: 'User', required: true },
    { name: 'onTap', type: 'VoidCallback' }
  ]
});
```

## Configuration

```javascript
await flutter.configure({
  projectPath: './my-app',           // Flutter project root
  stateManagement: 'bloc',           // 'bloc' | 'provider' | 'riverpod'
  apiClient: 'dio',                  // API client library
  useFreezed: true,                  // Use Freezed for models
  useJsonSerializable: true,         // Use JSON serialization
  nullSafety: true,                  // Enable null safety
  l10nEnabled: true,                 // Enable localization
  supportedLocales: ['en', 'ar', 'ku'] // Supported locales
});
```

## Skills

### WidgetGenerator

Generate Flutter widgets with customizable props and state.

```javascript
const result = await flutter.generateWidget({
  name: 'UserCard',
  type: 'stateless',  // 'stateless' | 'stateful'
  props: [
    { name: 'user', type: 'User', required: true },
    { name: 'onTap', type: 'VoidCallback' }
  ],
  imports: ['package:myapp/models/user.dart']
});
```

**Widget Types:**
- `stateless` - StatelessWidget
- `stateful` - StatefulWidget

### ModelGenerator

Generate data models with Freezed and JSON serialization support.

```javascript
const result = await flutter.generateModel({
  name: 'User',
  fields: [
    { name: 'id', type: 'String', required: true },
    { name: 'email', type: 'String', required: true },
    { name: 'name', type: 'String' },
    { name: 'createdAt', type: 'DateTime', jsonKey: 'created_at' }
  ],
  useFreezed: true,
  generateCopyWith: true,
  generateToJson: true
});
```

**Model Types:**
- `freezed` - Freezed immutable models
- `json_serializable` - JSON serializable models
- `equatable` - Equatable models

### ServiceGenerator

Generate Dio-based API services with error handling.

```javascript
const result = await flutter.generateService({
  name: 'UserService',
  baseUrl: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', name: 'getUsers', returnType: 'List<User>' },
    { method: 'GET', path: '/:id', name: 'getUser', returnType: 'User' },
    { method: 'POST', path: '/', name: 'createUser', body: 'CreateUserRequest', returnType: 'User' },
    { method: 'PUT', path: '/:id', name: 'updateUser', body: 'UpdateUserRequest', returnType: 'User' },
    { method: 'DELETE', path: '/:id', name: 'deleteUser', returnType: 'void' }
  ]
});
```

### BlocGenerator

Generate Bloc or Cubit state management classes.

```javascript
const result = await flutter.generateBloc({
  name: 'Auth',
  type: 'bloc',  // 'bloc' | 'cubit'
  events: ['Login', 'Logout', 'CheckStatus'],
  states: ['Initial', 'Loading', 'Authenticated', 'Unauthenticated', 'Error'],
  methods: [
    { event: 'Login', handler: '_onLogin' },
    { event: 'Logout', handler: '_onLogout' }
  ]
});
```

**State Management Types:**
- `bloc` - Full Bloc with events and states
- `cubit` - Simpler Cubit pattern

### PageGenerator

Generate page widgets with Scaffold and navigation support.

```javascript
const result = await flutter.generatePage({
  name: 'HomePage',
  hasAppBar: true,
  appBarTitle: 'Home',
  hasDrawer: true,
  hasBottomNav: false,
  hasFloatingButton: true,
  bloc: 'HomeBloc'
});
```

### LocalizationGenerator

Generate ARB localization files for internationalization.

```javascript
const result = await flutter.generateLocalization({
  strings: {
    appTitle: 'My App',
    welcomeMessage: 'Welcome, {name}!',
    itemCount: '{count, plural, =0{No items} =1{1 item} other{{count} items}}'
  },
  locales: ['en', 'ar', 'ku'],
  outputDir: 'lib/l10n'
});
```

## Output Structure

The agent generates files in the following structure:

```
lib/
├── models/           # Generated models (Freezed)
│   └── user.dart
├── services/         # API services (Dio)
│   └── user_service.dart
├── bloc/             # Bloc/Cubit state management
│   ├── auth/
│   │   ├── auth_bloc.dart
│   │   ├── auth_event.dart
│   │   └── auth_state.dart
├── pages/            # Page widgets
│   └── home_page.dart
├── widgets/          # Reusable widgets
│   └── user_card.dart
└── l10n/             # ARB localization files
    ├── app_en.arb
    ├── app_ar.arb
    └── app_ku.arb
```

## Events

The agent publishes the following events:

- `FLUTTER_WIDGET_GENERATED` - When a widget is generated
- `FLUTTER_MODEL_GENERATED` - When a model is generated
- `FLUTTER_SERVICE_GENERATED` - When a service is generated
- `FLUTTER_BLOC_GENERATED` - When a Bloc/Cubit is generated
- `FLUTTER_PAGE_GENERATED` - When a page is generated
- `FLUTTER_LOCALIZATION_GENERATED` - When localization files are generated

## License

MIT
