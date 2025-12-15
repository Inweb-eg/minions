/**
 * Orchestrator Writer Integration Example
 *
 * Demonstrates how to use the code writer agents with the orchestrator
 * for automated, event-driven code generation.
 */

import {
  initializeMinions,
  EventTypes,
  requestCodeGeneration,
  generateCode,
  WriterAgentType,
  getWriterAgent,
  configureWriterAgent,
  WIDGET_TYPE,
  ROUTE_TYPE,
  COMPONENT_TYPE
} from '../index.js';

async function main() {
  console.log('🚀 Orchestrator Writer Integration Example\n');

  // Initialize the Minions framework with writer agents enabled
  const { eventBus, orchestrator, writerAgentsInitialized } = await initializeMinions({
    enableMetrics: false,
    enableHealth: false,
    enableAlerting: false,
    enableMemoryStore: false,
    enableWriterAgents: true,
    writerAgentOptions: {
      flutterConfig: {
        projectPath: './output/flutter-app',
        stateManagement: 'bloc'
      },
      backendConfig: {
        projectPath: './output/backend-app',
        orm: 'mongoose'
      },
      frontendConfig: {
        projectPath: './output/frontend-app',
        typescript: true
      }
    }
  });

  console.log(`✅ Framework initialized`);
  console.log(`   Writer agents: ${writerAgentsInitialized ? 'enabled' : 'disabled'}\n`);

  // Example 1: Subscribe to generation events for monitoring
  console.log('📡 Setting up event listeners...\n');

  eventBus.subscribe(EventTypes.CODE_GENERATION_STARTED, (data) => {
    console.log(`   [EVENT] Generation started: ${data.type} (${data.requestId})`);
  });

  eventBus.subscribe(EventTypes.CODE_GENERATION_COMPLETED, (data) => {
    console.log(`   [EVENT] Generation completed: ${data.type}`);
    console.log(`           File: ${data.result.filePath}`);
  });

  eventBus.subscribe(EventTypes.CODE_GENERATION_FAILED, (data) => {
    console.log(`   [EVENT] Generation failed: ${data.type}`);
    console.log(`           Error: ${data.error}`);
  });

  // Subscribe to platform-specific events
  eventBus.subscribe(EventTypes.FLUTTER_WIDGET_GENERATED, (data) => {
    console.log(`   [FLUTTER] Widget generated: ${data.filePath}`);
  });

  eventBus.subscribe(EventTypes.BACKEND_ROUTE_GENERATED, (data) => {
    console.log(`   [BACKEND] Route generated: ${data.filePath}`);
  });

  eventBus.subscribe(EventTypes.FRONTEND_COMPONENT_GENERATED, (data) => {
    console.log(`   [FRONTEND] Component generated: ${data.filePath}`);
  });

  // Example 2: Fire-and-forget code generation via events
  console.log('\n📝 Example 2: Fire-and-forget generation via events\n');

  // Request Flutter widget generation (async, non-blocking)
  const widgetRequestId = requestCodeGeneration('flutter:widget', {
    name: 'ProductCard',
    type: WIDGET_TYPE.STATELESS,
    props: [
      { name: 'product', type: 'Product', required: true },
      { name: 'onTap', type: 'VoidCallback' }
    ]
  });
  console.log(`   Requested Flutter widget: ${widgetRequestId}`);

  // Request Backend route generation
  const routeRequestId = requestCodeGeneration('backend:route', {
    name: 'products',
    basePath: '/api/products',
    type: ROUTE_TYPE.CRUD,
    controller: 'productController'
  });
  console.log(`   Requested Backend route: ${routeRequestId}`);

  // Request Frontend component generation
  const componentRequestId = requestCodeGeneration('frontend:component', {
    name: 'ProductList',
    type: COMPONENT_TYPE.FUNCTIONAL,
    props: [
      { name: 'products', type: 'Product[]', required: true },
      { name: 'onSelect', type: '(product: Product) => void' }
    ]
  });
  console.log(`   Requested Frontend component: ${componentRequestId}`);

  // Wait a bit for events to process
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example 3: Synchronous code generation with await
  console.log('\n📝 Example 3: Synchronous generation with await\n');

  try {
    // Generate and wait for result
    const result = await generateCode('flutter:model', {
      name: 'Product',
      type: 'freezed',
      fields: [
        { name: 'id', type: 'String', required: true },
        { name: 'name', type: 'String', required: true },
        { name: 'price', type: 'double', required: true },
        { name: 'description', type: 'String', nullable: true }
      ]
    }, 5000); // 5 second timeout

    console.log(`   Generated: ${result.filePath}`);
    console.log(`   Success: ${result.success}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Example 4: Direct agent access
  console.log('\n📝 Example 4: Direct agent access\n');

  // Get agent directly for batch operations
  const flutterAgent = await getWriterAgent(WriterAgentType.FLUTTER);

  // Configure for specific project
  await configureWriterAgent(WriterAgentType.FLUTTER, {
    projectPath: './output/another-flutter-app',
    useFreezed: true
  });

  // Generate multiple items in sequence
  const widgets = ['Header', 'Footer', 'Sidebar'];
  for (const widgetName of widgets) {
    const result = await flutterAgent.generateWidget({
      name: `${widgetName}Widget`,
      type: WIDGET_TYPE.STATELESS
    });
    console.log(`   Generated ${widgetName}: ${result.success ? '✅' : '❌'}`);
  }

  // Example 5: Full-stack feature generation
  console.log('\n📝 Example 5: Full-stack feature generation\n');

  async function generateUserFeature() {
    const results = {
      backend: [],
      frontend: [],
      flutter: []
    };

    // Backend components
    console.log('   Generating backend...');
    const backendAgent = await getWriterAgent(WriterAgentType.BACKEND);

    results.backend.push(await backendAgent.generateModel({
      name: 'User',
      orm: 'mongoose',
      fields: [
        { name: 'email', type: 'string', required: true, unique: true },
        { name: 'name', type: 'string', required: true },
        { name: 'role', type: 'string', enum: ['admin', 'user'], default: 'user' }
      ]
    }));

    results.backend.push(await backendAgent.generateService({
      name: 'UserService',
      type: 'crud',
      model: 'User'
    }));

    results.backend.push(await backendAgent.generateController({
      name: 'UserController',
      type: 'rest',
      service: 'UserService'
    }));

    results.backend.push(await backendAgent.generateRoute({
      name: 'users',
      basePath: '/api/users',
      type: 'crud',
      controller: 'UserController'
    }));

    // Frontend components
    console.log('   Generating frontend...');
    const frontendAgent = await getWriterAgent(WriterAgentType.FRONTEND);

    results.frontend.push(await frontendAgent.generateApi({
      name: 'users',
      client: 'react-query',
      baseUrl: '/api/users',
      endpoints: [
        { method: 'GET', path: '/', name: 'useUsers', returnType: 'User[]' },
        { method: 'POST', path: '/', name: 'useCreateUser', returnType: 'User' }
      ]
    }));

    results.frontend.push(await frontendAgent.generateComponent({
      name: 'UserList',
      type: 'functional',
      props: [{ name: 'users', type: 'User[]', required: true }]
    }));

    results.frontend.push(await frontendAgent.generatePage({
      name: 'UsersPage',
      type: 'list',
      dataSource: 'useUsers'
    }));

    // Flutter components
    console.log('   Generating Flutter...');

    results.flutter.push(await flutterAgent.generateModel({
      name: 'User',
      type: 'freezed',
      fields: [
        { name: 'id', type: 'String', required: true },
        { name: 'email', type: 'String', required: true },
        { name: 'name', type: 'String', required: true },
        { name: 'role', type: 'String' }
      ]
    }));

    results.flutter.push(await flutterAgent.generateService({
      name: 'UserService',
      baseUrl: '/api/users',
      endpoints: [
        { method: 'GET', path: '/', name: 'getUsers', returnType: 'List<User>' },
        { method: 'POST', path: '/', name: 'createUser', returnType: 'User' }
      ]
    }));

    results.flutter.push(await flutterAgent.generateBloc({
      name: 'User',
      type: 'bloc',
      events: ['LoadUsers', 'CreateUser'],
      states: ['Initial', 'Loading', 'Loaded', 'Error']
    }));

    // Summary
    console.log('\n   Feature generation complete:');
    console.log(`   - Backend: ${results.backend.filter(r => r.success).length}/${results.backend.length} succeeded`);
    console.log(`   - Frontend: ${results.frontend.filter(r => r.success).length}/${results.frontend.length} succeeded`);
    console.log(`   - Flutter: ${results.flutter.filter(r => r.success).length}/${results.flutter.length} succeeded`);

    return results;
  }

  await generateUserFeature();

  console.log('\n🎉 Example complete!');
  console.log('\nKey takeaways:');
  console.log('1. Use initializeMinions with enableWriterAgents: true');
  console.log('2. Subscribe to events for monitoring and coordination');
  console.log('3. Use requestCodeGeneration for fire-and-forget');
  console.log('4. Use generateCode for synchronous generation');
  console.log('5. Use getWriterAgent for direct access and batch operations');
}

main().catch(console.error);
