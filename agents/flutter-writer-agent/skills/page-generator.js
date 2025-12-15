/**
 * PageGenerator - Flutter Page Code Generation Skill
 *
 * Generates Flutter pages:
 * - Scaffold-based pages
 * - Navigation integration
 * - AppBar, body, bottom navigation
 * - Route configuration
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT, createSkillGetter } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Page types
 */
export const PAGE_TYPE = {
  BASIC: 'basic',
  WITH_BLOC: 'withBloc',
  WITH_TABS: 'withTabs',
  WITH_DRAWER: 'withDrawer',
  FORM: 'form'
};

/**
 * PageGenerator Skill
 */
export class PageGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('PageGenerator', {
      language: LANGUAGE.DART,
      ...options
    });

    this.registerTemplates();
  }

  registerTemplates() {
    // Basic page template
    this.registerTemplate('basic', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' page'}
class ${data.name}Page extends StatelessWidget {
  ${this.generateRouteConfig(data)}

  const ${data.name}Page({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ${this.generateAppBar(data)},
      body: ${data.body || 'const Center(child: Text(\'${data.name}\'))'},
      ${data.floatingActionButton ? `floatingActionButton: ${data.floatingActionButton},` : ''}
      ${data.bottomNavigationBar ? `bottomNavigationBar: ${data.bottomNavigationBar},` : ''}
    );
  }
}
`.trim());

    // Page with Bloc template
    this.registerTemplate('withBloc', (data) => `
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
${data.imports || ''}

/// ${data.description || data.name + ' page with Bloc'}
class ${data.name}Page extends StatelessWidget {
  ${this.generateRouteConfig(data)}

  const ${data.name}Page({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => ${data.blocName || data.name}Bloc(${data.blocParams || ''})${data.loadOnInit ? '..add(const ${data.loadEvent || "Load"}())' : ''},
      child: const _${data.name}View(),
    );
  }
}

class _${data.name}View extends StatelessWidget {
  const _${data.name}View();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ${this.generateAppBar(data)},
      body: BlocBuilder<${data.blocName || data.name}Bloc, ${data.blocName || data.name}State>(
        builder: (context, state) {
          return switch (state) {
            ${data.blocName || data.name}Initial() => const Center(child: Text('Initial')),
            ${data.blocName || data.name}Loading() => const Center(child: CircularProgressIndicator()),
            ${data.blocName || data.name}Loaded(:final data) => ${data.loadedBody || '_buildContent(data)'},
            ${data.blocName || data.name}Error(:final message) => Center(child: Text(message)),
          };
        },
      ),
      ${data.floatingActionButton ? `floatingActionButton: ${data.floatingActionButton},` : ''}
    );
  }

  ${data.contentBuilder || `Widget _buildContent(dynamic data) {
    return Center(child: Text(data.toString()));
  }`}
}
`.trim());

    // Page with tabs template
    this.registerTemplate('withTabs', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' page with tabs'}
class ${data.name}Page extends StatelessWidget {
  ${this.generateRouteConfig(data)}

  const ${data.name}Page({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: ${data.tabs?.length || 2},
      child: Scaffold(
        appBar: AppBar(
          title: ${data.title ? `Text('${data.title}')` : `Text('${data.name}')`},
          ${data.showBackButton === false ? 'automaticallyImplyLeading: false,' : ''}
          bottom: TabBar(
            tabs: [
              ${(data.tabs || ['Tab 1', 'Tab 2']).map(tab => {
                if (typeof tab === 'string') {
                  return `Tab(text: '${tab}'),`;
                }
                return `Tab(${tab.icon ? `icon: Icon(${tab.icon}), ` : ''}text: '${tab.label}'),`;
              }).join('\n              ')}
            ],
          ),
        ),
        body: TabBarView(
          children: [
            ${(data.tabViews || ['const Center(child: Text("Tab 1"))', 'const Center(child: Text("Tab 2"))']).join(',\n            ')},
          ],
        ),
      ),
    );
  }
}
`.trim());

    // Page with drawer template
    this.registerTemplate('withDrawer', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' page with drawer'}
class ${data.name}Page extends StatelessWidget {
  ${this.generateRouteConfig(data)}

  const ${data.name}Page({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ${this.generateAppBar(data)},
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
              ),
              child: ${data.drawerHeader || "const Text('Menu', style: TextStyle(color: Colors.white, fontSize: 24))"},
            ),
            ${(data.drawerItems || []).map(item => `
            ListTile(
              leading: Icon(${item.icon || 'Icons.circle'}),
              title: Text('${item.title}'),
              onTap: () {
                Navigator.pop(context);
                ${item.onTap || ''}
              },
            ),`).join('')}
          ],
        ),
      ),
      body: ${data.body || 'const Center(child: Text(\'${data.name}\'))'},
    );
  }
}
`.trim());

    // Form page template
    this.registerTemplate('form', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' form page'}
class ${data.name}Page extends StatefulWidget {
  ${this.generateRouteConfig(data)}

  const ${data.name}Page({super.key});

  @override
  State<${data.name}Page> createState() => _${data.name}PageState();
}

class _${data.name}PageState extends State<${data.name}Page> {
  final _formKey = GlobalKey<FormState>();
  ${this.generateFormControllers(data.fields)}
  bool _isLoading = false;

  @override
  void dispose() {
    ${this.generateControllerDispose(data.fields)}
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _isLoading = true);

    try {
      // TODO: Implement form submission
      ${data.onSubmit || ''}

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('${data.successMessage || 'Success!'}')),
        );
        ${data.navigateOnSuccess ? `Navigator.of(context).pop();` : ''}
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ${this.generateAppBar(data)},
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ${this.generateFormFields(data.fields)}
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('${data.submitLabel || 'Submit'}'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`.trim());

    // Route configuration template
    this.registerTemplate('routes', (data) => `
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${this.generateRouteImports(data.pages)}

/// App routes configuration
final router = GoRouter(
  initialLocation: '${data.initialRoute || '/'}',
  routes: [
${this.generateRoutes(data.pages)}
  ],
);

/// Route names
class Routes {
${(data.pages || []).map(p => `  static const String ${this.toCamelCase(p.name)} = '${p.path || '/' + this.toKebabCase(p.name)}';`).join('\n')}
}
`.trim());
  }

  /**
   * Generate AppBar
   */
  generateAppBar(data) {
    if (data.appBar === false) return 'null';

    const title = data.title ? `Text('${data.title}')` : `Text('${data.name}')`;
    const actions = data.actions ? `actions: [${data.actions.join(', ')}],` : '';
    const leading = data.showBackButton === false ? 'automaticallyImplyLeading: false,' : '';

    return `AppBar(
      title: ${title},
      ${leading}
      ${actions}
    )`;
  }

  /**
   * Generate route config static property
   */
  generateRouteConfig(data) {
    if (!data.routePath) return '';
    return `static const String routePath = '${data.routePath}';`;
  }

  /**
   * Generate form controllers
   */
  generateFormControllers(fields = []) {
    return fields.map(f => {
      return `final _${f.name}Controller = TextEditingController();`;
    }).join('\n  ');
  }

  /**
   * Generate controller dispose calls
   */
  generateControllerDispose(fields = []) {
    return fields.map(f => {
      return `_${f.name}Controller.dispose();`;
    }).join('\n    ');
  }

  /**
   * Generate form fields
   */
  generateFormFields(fields = []) {
    if (!fields || fields.length === 0) {
      return '// Add form fields here';
    }

    return fields.map(f => {
      const obscure = f.type === 'password' ? 'obscureText: true,' : '';
      const keyboard = f.keyboardType ? `keyboardType: ${f.keyboardType},` : '';
      const validator = f.validator || `(value) {
                if (value?.isEmpty ?? true) {
                  return '${f.label || f.name} is required';
                }
                return null;
              }`;

      return `TextFormField(
                controller: _${f.name}Controller,
                decoration: InputDecoration(
                  labelText: '${f.label || f.name}',
                  ${f.hint ? `hintText: '${f.hint}',` : ''}
                ),
                ${obscure}
                ${keyboard}
                validator: ${validator},
              ),
              const SizedBox(height: 16),`;
    }).join('\n              ');
  }

  /**
   * Generate route imports
   */
  generateRouteImports(pages = []) {
    return pages.map(p => {
      const fileName = this.toSnakeCase(p.name) + '_page.dart';
      return `import '${p.importPath || 'pages/' + fileName}';`;
    }).join('\n');
  }

  /**
   * Generate routes
   */
  generateRoutes(pages = [], indent = '    ') {
    return pages.map(p => {
      const path = p.path || '/' + this.toKebabCase(p.name);
      const children = p.children
        ? `,\n${indent}  routes: [\n${this.generateRoutes(p.children, indent + '    ')}\n${indent}  ]`
        : '';

      return `${indent}GoRoute(
${indent}  path: '${path}',
${indent}  builder: (context, state) => const ${p.name}Page()${children},
${indent}),`;
    }).join('\n');
  }

  /**
   * Generate a page
   * @param {Object} spec - Page specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      // Validate spec
      const validation = this.validateSpec(spec, {
        required: ['name'],
        properties: {
          name: { type: 'string', pattern: '^[A-Z][a-zA-Z0-9]*$' },
          type: { type: 'string', enum: Object.values(PAGE_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || PAGE_TYPE.BASIC;

      // Build output path
      const fileName = this.toSnakeCase(spec.name) + '_page.dart';
      const outputPath = spec.outputPath || `lib/pages/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FLUTTER_PAGE_GENERATED, {
          name: spec.name,
          type: templateName,
          path: result.path
        });
      }

      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate routes file
   * @param {Object} spec - Routes specification
   * @returns {Promise<Object>} Generation result
   */
  async generateRoutes(spec) {
    const outputPath = spec.outputPath || 'lib/core/routes.dart';
    return await this.generateAndWrite(spec, 'routes', outputPath, {
      overwrite: spec.overwrite || false
    });
  }

  /**
   * Convert PascalCase to snake_case
   */
  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '_' : '') + p1.toLowerCase();
    });
  }

  /**
   * Convert PascalCase to kebab-case
   */
  toKebabCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '-' : '') + p1.toLowerCase();
    });
  }

  /**
   * Convert to camelCase
   */
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

// Singleton getter
let instance = null;

export function getPageGenerator(options = {}) {
  if (!instance) {
    instance = new PageGenerator(options);
  }
  return instance;
}

export default PageGenerator;
