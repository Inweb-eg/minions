/**
 * Flutter Writer Agent Example
 *
 * Demonstrates how to use the Flutter Writer Agent to generate
 * Flutter/Dart code including widgets, models, services, blocs, and pages.
 */

import {
  getFlutterWriterAgent,
  WIDGET_TYPE,
  MODEL_TYPE,
  BLOC_TYPE,
  LOCALE
} from '../index.js';

async function main() {
  console.log('🚀 Flutter Writer Agent Example\n');

  // Get the Flutter Writer Agent instance
  const flutter = getFlutterWriterAgent();

  // Configure the agent
  await flutter.configure({
    projectPath: './output/flutter-app',
    stateManagement: 'bloc',
    useFreezed: true,
    l10nEnabled: true,
    supportedLocales: ['en', 'ar', 'ku']
  });

  // Initialize the agent
  await flutter.initialize();
  console.log('✅ Flutter Writer Agent initialized\n');

  // 1. Generate a Widget
  console.log('📦 Generating UserCard widget...');
  const widget = await flutter.generateWidget({
    name: 'UserCard',
    type: WIDGET_TYPE.STATELESS,
    props: [
      { name: 'user', type: 'User', required: true },
      { name: 'onTap', type: 'VoidCallback' },
      { name: 'showAvatar', type: 'bool', default: 'true' }
    ],
    imports: ['package:myapp/models/user.dart']
  });

  if (widget.success) {
    console.log(`   ✅ Widget generated: ${widget.filePath}`);
    console.log('   Preview:\n');
    console.log(widget.code.slice(0, 500) + '...\n');
  }

  // 2. Generate a Model with Freezed
  console.log('📦 Generating User model with Freezed...');
  const model = await flutter.generateModel({
    name: 'User',
    type: MODEL_TYPE.FREEZED,
    fields: [
      { name: 'id', type: 'String', required: true },
      { name: 'email', type: 'String', required: true },
      { name: 'name', type: 'String', required: true },
      { name: 'avatar', type: 'String', nullable: true },
      { name: 'role', type: 'UserRole', default: 'UserRole.user' },
      { name: 'createdAt', type: 'DateTime', jsonKey: 'created_at' }
    ],
    generateCopyWith: true,
    generateToJson: true
  });

  if (model.success) {
    console.log(`   ✅ Model generated: ${model.filePath}`);
    console.log('   Preview:\n');
    console.log(model.code.slice(0, 500) + '...\n');
  }

  // 3. Generate a Dio-based Service
  console.log('📦 Generating UserService...');
  const service = await flutter.generateService({
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

  if (service.success) {
    console.log(`   ✅ Service generated: ${service.filePath}`);
    console.log('   Preview:\n');
    console.log(service.code.slice(0, 500) + '...\n');
  }

  // 4. Generate a Bloc
  console.log('📦 Generating AuthBloc...');
  const bloc = await flutter.generateBloc({
    name: 'Auth',
    type: BLOC_TYPE.BLOC,
    events: ['Login', 'Logout', 'CheckStatus', 'UpdateProfile'],
    states: ['Initial', 'Loading', 'Authenticated', 'Unauthenticated', 'Error'],
    stateProps: {
      Authenticated: [
        { name: 'user', type: 'User' },
        { name: 'token', type: 'String' }
      ],
      Error: [
        { name: 'message', type: 'String' }
      ]
    }
  });

  if (bloc.success) {
    console.log(`   ✅ Bloc generated:`);
    console.log(`      - ${bloc.filePaths.bloc}`);
    console.log(`      - ${bloc.filePaths.events}`);
    console.log(`      - ${bloc.filePaths.states}`);
    console.log('   Bloc Preview:\n');
    console.log(bloc.files.bloc.slice(0, 400) + '...\n');
  }

  // 5. Generate a Page
  console.log('📦 Generating HomePage...');
  const page = await flutter.generatePage({
    name: 'HomePage',
    hasAppBar: true,
    appBarTitle: 'Home',
    hasDrawer: true,
    hasFloatingButton: true,
    floatingButtonIcon: 'Icons.add',
    bloc: 'HomeBloc',
    routeName: '/home'
  });

  if (page.success) {
    console.log(`   ✅ Page generated: ${page.filePath}`);
    console.log('   Preview:\n');
    console.log(page.code.slice(0, 500) + '...\n');
  }

  // 6. Generate Localization
  console.log('📦 Generating localization files...');
  const l10n = await flutter.generateLocalization({
    strings: {
      appTitle: 'My App',
      welcomeMessage: 'Welcome, {name}!',
      loginButton: 'Login',
      logoutButton: 'Logout',
      errorGeneric: 'Something went wrong',
      itemCount: '{count, plural, =0{No items} =1{1 item} other{{count} items}}'
    },
    locales: ['en', 'ar', 'ku'],
    includeMetadata: true
  });

  if (l10n.success) {
    console.log(`   ✅ Localization files generated:`);
    Object.keys(l10n.filePaths).forEach(locale => {
      console.log(`      - ${l10n.filePaths[locale]}`);
    });
    console.log('   English ARB Preview:\n');
    console.log(l10n.files.en.slice(0, 400) + '...\n');
  }

  console.log('🎉 All Flutter code generation complete!');
}

main().catch(console.error);
