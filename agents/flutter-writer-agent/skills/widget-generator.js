/**
 * WidgetGenerator - Flutter Widget Code Generation Skill
 *
 * Generates Flutter widgets:
 * - StatelessWidget
 * - StatefulWidget
 * - Common patterns (ListView, Form, Custom painters)
 * - Auto-imports
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT, createSkillGetter } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Widget types
 */
export const WIDGET_TYPE = {
  STATELESS: 'stateless',
  STATEFUL: 'stateful',
  CONSUMER: 'consumer',     // For state management
  INHERITED: 'inherited'
};

/**
 * Widget patterns
 */
export const WIDGET_PATTERN = {
  BASIC: 'basic',
  LIST_VIEW: 'listView',
  GRID_VIEW: 'gridView',
  FORM: 'form',
  CARD: 'card',
  DIALOG: 'dialog',
  BOTTOM_SHEET: 'bottomSheet'
};

/**
 * WidgetGenerator Skill
 */
export class WidgetGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('WidgetGenerator', {
      language: LANGUAGE.DART,
      ...options
    });

    this.registerTemplates();
  }

  registerTemplates() {
    // StatelessWidget template
    this.registerTemplate('stateless', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' widget'}
class ${data.name} extends StatelessWidget {
  ${this.generateConstructorParams(data.props)}

  const ${data.name}(${this.generateConstructorArgs(data.props)});

  @override
  Widget build(BuildContext context) {
    return ${data.body || 'Container()'};
  }
}
`.trim());

    // StatefulWidget template
    this.registerTemplate('stateful', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' widget'}
class ${data.name} extends StatefulWidget {
  ${this.generateConstructorParams(data.props)}

  const ${data.name}(${this.generateConstructorArgs(data.props)});

  @override
  State<${data.name}> createState() => _${data.name}State();
}

class _${data.name}State extends State<${data.name}> {
  ${data.stateVariables || ''}

  @override
  void initState() {
    super.initState();
    ${data.initState || ''}
  }

  @override
  void dispose() {
    ${data.dispose || ''}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ${data.body || 'Container()'};
  }
}
`.trim());

    // BlocConsumer widget template
    this.registerTemplate('consumer', (data) => `
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
${data.imports || ''}

/// ${data.description || data.name + ' widget with Bloc integration'}
class ${data.name} extends StatelessWidget {
  ${this.generateConstructorParams(data.props)}

  const ${data.name}(${this.generateConstructorArgs(data.props)});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<${data.blocType}, ${data.stateType}>(
      listener: (context, state) {
        ${data.listener || '// Handle state changes'}
      },
      builder: (context, state) {
        return ${data.body || 'Container()'};
      },
    );
  }
}
`.trim());

    // ListView pattern template
    this.registerTemplate('listView', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' list widget'}
class ${data.name} extends StatelessWidget {
  final List<${data.itemType || 'dynamic'}> items;
  final Function(${data.itemType || 'dynamic'})? onItemTap;

  const ${data.name}({
    super.key,
    required this.items,
    this.onItemTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ${data.itemBuilder || `ListTile(
          title: Text(item.toString()),
          onTap: () => onItemTap?.call(item),
        )`};
      },
    );
  }
}
`.trim());

    // Form pattern template
    this.registerTemplate('form', (data) => `
import 'package:flutter/material.dart';
${data.imports || ''}

/// ${data.description || data.name + ' form widget'}
class ${data.name} extends StatefulWidget {
  final Function(Map<String, dynamic>)? onSubmit;

  const ${data.name}({
    super.key,
    this.onSubmit,
  });

  @override
  State<${data.name}> createState() => _${data.name}State();
}

class _${data.name}State extends State<${data.name}> {
  final _formKey = GlobalKey<FormState>();
  ${data.formFields || ''}

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      _formKey.currentState?.save();
      widget.onSubmit?.call({
        ${data.formValues || ''}
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          ${data.formWidgets || '// Add form fields here'}
          ElevatedButton(
            onPressed: _submit,
            child: Text('${data.submitLabel || 'Submit'}'),
          ),
        ],
      ),
    );
  }
}
`.trim());
  }

  /**
   * Generate constructor parameters
   */
  generateConstructorParams(props = []) {
    if (!props || props.length === 0) return '';
    return props.map(p => {
      const required = p.required ? 'required ' : '';
      const nullable = p.nullable ? '?' : '';
      const defaultValue = p.default ? ` = ${p.default}` : '';
      return `final ${p.type}${nullable} ${p.name}${defaultValue};`;
    }).join('\n  ');
  }

  /**
   * Generate constructor arguments
   */
  generateConstructorArgs(props = []) {
    if (!props || props.length === 0) return '{super.key}';
    const args = props.map(p => {
      const required = p.required && !p.default ? 'required ' : '';
      return `${required}this.${p.name}`;
    }).join(', ');
    return `{super.key, ${args}}`;
  }

  /**
   * Generate a widget
   * @param {Object} spec - Widget specification
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
          type: { type: 'string', enum: Object.values(WIDGET_TYPE) },
          pattern: { type: 'string', enum: Object.values(WIDGET_PATTERN) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.pattern || spec.type || WIDGET_TYPE.STATELESS;

      // Build output path
      const fileName = this.toSnakeCase(spec.name) + '.dart';
      const outputPath = spec.outputPath || `lib/widgets/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FLUTTER_WIDGET_GENERATED, {
          name: spec.name,
          type: spec.type || WIDGET_TYPE.STATELESS,
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
   * Convert PascalCase to snake_case
   */
  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '_' : '') + p1.toLowerCase();
    });
  }
}

// Singleton getter
let instance = null;

export function getWidgetGenerator(options = {}) {
  if (!instance) {
    instance = new WidgetGenerator(options);
  }
  return instance;
}

export default WidgetGenerator;
