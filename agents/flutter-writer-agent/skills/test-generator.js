/**
 * Flutter Test Generator Skill
 *
 * Generates Flutter test code including:
 * - Widget tests
 * - Bloc/Cubit tests
 * - Unit tests
 * - Integration tests
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';

export const TEST_TYPE = {
  WIDGET: 'widget',
  BLOC: 'bloc',
  CUBIT: 'cubit',
  UNIT: 'unit',
  INTEGRATION: 'integration',
  GOLDEN: 'golden'
};

export class FlutterTestGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('flutter-test-generator', options);
    this.loadTemplates();
  }

  loadTemplates() {
    // Widget test template
    this.loadTemplate('widget-test', `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
{{#imports}}
import '{{.}}';
{{/imports}}

void main() {
  group('{{widgetName}}', () {
{{#tests}}
    testWidgets('{{description}}', (WidgetTester tester) async {
      // Arrange
      {{#arrange}}
      {{.}}
      {{/arrange}}

      // Act
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: {{widgetName}}(
{{#props}}
              {{name}}: {{testValue}},
{{/props}}
            ),
          ),
        ),
      );
      {{#act}}
      {{.}}
      {{/act}}

      // Assert
      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

{{/tests}}
  });
}
`);

    // Bloc test template
    this.loadTemplate('bloc-test', `import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
{{#mockImports}}
import 'package:mocktail/mocktail.dart';
{{/mockImports}}
{{#imports}}
import '{{.}}';
{{/imports}}

{{#mocks}}
class Mock{{name}} extends Mock implements {{type}} {}
{{/mocks}}

void main() {
  group('{{blocName}}', () {
    {{#dependencies}}
    late {{type}} {{name}};
    {{/dependencies}}
    late {{blocName}} bloc;

    setUp(() {
      {{#dependencies}}
      {{name}} = Mock{{type}}();
      {{/dependencies}}
      bloc = {{blocName}}(
        {{#dependencies}}
        {{name}}: {{name}},
        {{/dependencies}}
      );
    });

    tearDown(() {
      bloc.close();
    });

    test('initial state is {{initialState}}', () {
      expect(bloc.state, equals({{initialStateValue}}));
    });

{{#blocTests}}
    blocTest<{{blocName}}, {{stateName}}>(
      '{{description}}',
      build: () {
        {{#arrange}}
        {{.}}
        {{/arrange}}
        return bloc;
      },
      {{#seed}}
      seed: () => {{.}},
      {{/seed}}
      act: (bloc) => bloc.add({{event}}),
      expect: () => [
        {{#expectedStates}}
        {{.}},
        {{/expectedStates}}
      ],
      {{#verify}}
      verify: (_) {
        {{#verifications}}
        {{.}}
        {{/verifications}}
      },
      {{/verify}}
    );

{{/blocTests}}
  });
}
`);

    // Unit test template
    this.loadTemplate('unit-test', `import 'package:flutter_test/flutter_test.dart';
{{#mockImports}}
import 'package:mocktail/mocktail.dart';
{{/mockImports}}
{{#imports}}
import '{{.}}';
{{/imports}}

{{#mocks}}
class Mock{{name}} extends Mock implements {{type}} {}
{{/mocks}}

void main() {
  group('{{className}}', () {
    {{#dependencies}}
    late {{type}} {{name}};
    {{/dependencies}}
    late {{className}} sut;

    setUp(() {
      {{#dependencies}}
      {{name}} = Mock{{type}}();
      {{/dependencies}}
      sut = {{className}}(
        {{#dependencies}}
        {{name}}: {{name}},
        {{/dependencies}}
      );
    });

{{#tests}}
    test('{{description}}', () async {
      // Arrange
      {{#arrange}}
      {{.}}
      {{/arrange}}

      // Act
      {{#act}}
      {{actCode}}
      {{/act}}

      // Assert
      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

{{/tests}}
  });
}
`);

    // Integration test template
    this.loadTemplate('integration-test', `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
{{#imports}}
import '{{.}}';
{{/imports}}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('{{testName}}', () {
{{#tests}}
    testWidgets('{{description}}', (WidgetTester tester) async {
      // Start the app
      app.main();
      await tester.pumpAndSettle();

{{#steps}}
      // {{description}}
      {{code}}
      await tester.pumpAndSettle();

{{/steps}}
    });

{{/tests}}
  });
}
`);

    // Golden test template
    this.loadTemplate('golden-test', `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:golden_toolkit/golden_toolkit.dart';
{{#imports}}
import '{{.}}';
{{/imports}}

void main() {
  group('{{widgetName}} Golden Tests', () {
{{#goldens}}
    testGoldens('{{description}}', (WidgetTester tester) async {
      final builder = GoldenBuilder.grid(
        columns: {{columns}},
        widthToHeightRatio: {{ratio}},
      )
{{#scenarios}}
        ..addScenario(
          '{{name}}',
          {{widgetName}}(
{{#props}}
            {{name}}: {{value}},
{{/props}}
          ),
        )
{{/scenarios}}
      ;

      await tester.pumpWidgetBuilder(
        builder.build(),
        surfaceSize: Size({{width}}, {{height}}),
      );

      await screenMatchesGolden(tester, '{{goldenName}}');
    });

{{/goldens}}
  });
}
`);
  }

  /**
   * Generate Flutter test
   */
  async generate(spec) {
    const validation = this.validateSpec(spec, {
      required: ['name', 'type'],
      optional: ['target', 'imports', 'tests', 'mocks', 'dependencies', 'blocTests', 'goldens', 'steps']
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
      case TEST_TYPE.WIDGET:
        code = this.generateWidgetTest(spec);
        filePath = `test/widgets/${this.toSnakeCase(spec.name)}_test.dart`;
        break;

      case TEST_TYPE.BLOC:
        code = this.generateBlocTest(spec);
        filePath = `test/blocs/${this.toSnakeCase(spec.name)}_bloc_test.dart`;
        break;

      case TEST_TYPE.CUBIT:
        code = this.generateCubitTest(spec);
        filePath = `test/cubits/${this.toSnakeCase(spec.name)}_cubit_test.dart`;
        break;

      case TEST_TYPE.UNIT:
        code = this.generateUnitTest(spec);
        filePath = `test/unit/${this.toSnakeCase(spec.name)}_test.dart`;
        break;

      case TEST_TYPE.INTEGRATION:
        code = this.generateIntegrationTest(spec);
        filePath = `integration_test/${this.toSnakeCase(spec.name)}_test.dart`;
        break;

      case TEST_TYPE.GOLDEN:
        code = this.generateGoldenTest(spec);
        filePath = `test/goldens/${this.toSnakeCase(spec.name)}_golden_test.dart`;
        break;

      default:
        return {
          success: false,
          errors: [`Unknown test type: ${spec.type}`]
        };
    }

    code = await this.formatCode(code, LANGUAGE.DART);

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

  generateWidgetTest(spec) {
    const data = {
      widgetName: spec.name,
      imports: spec.imports || [`package:myapp/widgets/${this.toSnakeCase(spec.name)}.dart`],
      tests: spec.tests || this.generateDefaultWidgetTests(spec)
    };

    return this.renderTemplate('widget-test', data);
  }

  generateDefaultWidgetTests(spec) {
    const props = spec.props || [];
    return [
      {
        description: 'renders correctly',
        arrange: [],
        props: props.map(p => ({
          name: p.name,
          testValue: this.getTestValue(p.type)
        })),
        act: [],
        assertions: ['expect(find.byType(${spec.name}), findsOneWidget);']
      },
      {
        description: 'displays expected content',
        arrange: [],
        props: props.map(p => ({
          name: p.name,
          testValue: this.getTestValue(p.type)
        })),
        act: [],
        assertions: ['// Add specific content assertions here']
      }
    ];
  }

  generateBlocTest(spec) {
    const data = {
      blocName: `${spec.name}Bloc`,
      stateName: `${spec.name}State`,
      imports: spec.imports || [`package:myapp/blocs/${this.toSnakeCase(spec.name)}_bloc.dart`],
      mockImports: spec.mocks && spec.mocks.length > 0,
      mocks: spec.mocks || [],
      dependencies: spec.dependencies || [],
      initialState: spec.initialState || `${spec.name}Initial`,
      initialStateValue: spec.initialStateValue || `const ${spec.name}State.initial()`,
      blocTests: spec.blocTests || this.generateDefaultBlocTests(spec)
    };

    return this.renderTemplate('bloc-test', data);
  }

  generateDefaultBlocTests(spec) {
    const events = spec.events || ['Load', 'Refresh'];
    return events.map(event => ({
      description: `emits states when ${event}${spec.name} is added`,
      blocName: `${spec.name}Bloc`,
      stateName: `${spec.name}State`,
      arrange: [],
      event: `${event}${spec.name}()`,
      expectedStates: [`${spec.name}Loading()`, `${spec.name}Loaded()`],
      verify: false
    }));
  }

  generateCubitTest(spec) {
    // Reuse bloc test template with cubit-specific naming
    return this.generateBlocTest({
      ...spec,
      blocTests: spec.cubitTests || this.generateDefaultCubitTests(spec)
    });
  }

  generateDefaultCubitTests(spec) {
    const methods = spec.methods || ['load', 'refresh'];
    return methods.map(method => ({
      description: `emits states when ${method} is called`,
      blocName: `${spec.name}Cubit`,
      stateName: `${spec.name}State`,
      arrange: [],
      event: `cubit.${method}()`,
      expectedStates: [`${spec.name}Loading()`, `${spec.name}Loaded()`],
      verify: false
    }));
  }

  generateUnitTest(spec) {
    const data = {
      className: spec.name,
      imports: spec.imports || [`package:myapp/services/${this.toSnakeCase(spec.name)}.dart`],
      mockImports: spec.mocks && spec.mocks.length > 0,
      mocks: spec.mocks || [],
      dependencies: spec.dependencies || [],
      tests: spec.tests || this.generateDefaultUnitTests(spec)
    };

    return this.renderTemplate('unit-test', data);
  }

  generateDefaultUnitTests(spec) {
    const methods = spec.methods || [];
    return methods.map(method => ({
      description: `${method.name} returns expected result`,
      arrange: method.arrange || [],
      act: { actCode: `final result = await sut.${method.name}(${method.params?.join(', ') || ''});` },
      assertions: method.assertions || ['expect(result, isNotNull);']
    }));
  }

  generateIntegrationTest(spec) {
    const data = {
      testName: spec.name,
      imports: spec.imports || ['package:myapp/main.dart as app'],
      tests: spec.tests || this.generateDefaultIntegrationTests(spec)
    };

    return this.renderTemplate('integration-test', data);
  }

  generateDefaultIntegrationTests(spec) {
    return [
      {
        description: `completes ${spec.name} flow`,
        steps: spec.steps || [
          { description: 'Navigate to screen', code: "await tester.tap(find.byKey(Key('navigation_button')));" },
          { description: 'Verify screen loaded', code: 'expect(find.text(\'Expected Title\'), findsOneWidget);' }
        ]
      }
    ];
  }

  generateGoldenTest(spec) {
    const data = {
      widgetName: spec.name,
      imports: spec.imports || [`package:myapp/widgets/${this.toSnakeCase(spec.name)}.dart`],
      goldens: spec.goldens || this.generateDefaultGoldens(spec)
    };

    return this.renderTemplate('golden-test', data);
  }

  generateDefaultGoldens(spec) {
    return [
      {
        description: 'matches golden for default state',
        columns: 2,
        ratio: 1.0,
        scenarios: [
          { name: 'default', widgetName: spec.name, props: spec.props || [] }
        ],
        width: 400,
        height: 300,
        goldenName: `${this.toSnakeCase(spec.name)}_default`
      }
    ];
  }

  getTestValue(type) {
    const testValues = {
      'String': "'test'",
      'int': '1',
      'double': '1.0',
      'bool': 'true',
      'DateTime': 'DateTime.now()',
      'VoidCallback': '() {}',
      'Widget': 'Container()',
      'List': '[]',
      'Map': '{}'
    };

    return testValues[type] || `mock${type}`;
  }

  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}

// Singleton instance
let instance = null;

export function getFlutterTestGenerator(options = {}) {
  if (!instance) {
    instance = new FlutterTestGenerator(options);
  }
  return instance;
}

export default FlutterTestGenerator;
