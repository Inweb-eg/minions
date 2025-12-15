/**
 * ModelGenerator - Flutter Model Code Generation Skill
 *
 * Generates Flutter data models:
 * - Basic data classes
 * - Freezed models
 * - JSON serialization
 * - Equatable classes
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT, createSkillGetter } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Model types
 */
export const MODEL_TYPE = {
  BASIC: 'basic',
  FREEZED: 'freezed',
  EQUATABLE: 'equatable',
  JSON_SERIALIZABLE: 'jsonSerializable'
};

/**
 * ModelGenerator Skill
 */
export class ModelGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ModelGenerator', {
      language: LANGUAGE.DART,
      ...options
    });

    this.useFreezed = options.useFreezed ?? true;
    this.useJsonSerializable = options.useJsonSerializable ?? true;

    this.registerTemplates();
  }

  registerTemplates() {
    // Basic model template
    this.registerTemplate('basic', (data) => `
import 'package:flutter/foundation.dart';
${data.imports || ''}

/// ${data.description || data.name + ' model'}
@immutable
class ${data.name} {
${this.generateFields(data.fields)}

  const ${data.name}(${this.generateConstructorArgs(data.fields)});

${this.generateCopyWith(data)}
${this.generateEquality(data)}
${this.generateToString(data)}
}
`.trim());

    // Freezed model template
    this.registerTemplate('freezed', (data) => `
import 'package:freezed_annotation/freezed_annotation.dart';
${data.useJson ? "import 'package:json_annotation/json_annotation.dart';" : ''}
${data.imports || ''}

part '${this.toSnakeCase(data.name)}.freezed.dart';
${data.useJson ? `part '${this.toSnakeCase(data.name)}.g.dart';` : ''}

/// ${data.description || data.name + ' model'}
@freezed
class ${data.name} with _$${data.name} {
  const factory ${data.name}(${this.generateFreezedParams(data.fields)}) = _${data.name};

${data.useJson ? `  factory ${data.name}.fromJson(Map<String, dynamic> json) => _$${data.name}FromJson(json);` : ''}
}
`.trim());

    // JSON Serializable model template
    this.registerTemplate('jsonSerializable', (data) => `
import 'package:json_annotation/json_annotation.dart';
${data.imports || ''}

part '${this.toSnakeCase(data.name)}.g.dart';

/// ${data.description || data.name + ' model'}
@JsonSerializable()
class ${data.name} {
${this.generateFields(data.fields)}

  ${data.name}(${this.generateConstructorArgs(data.fields)});

  factory ${data.name}.fromJson(Map<String, dynamic> json) => _$${data.name}FromJson(json);

  Map<String, dynamic> toJson() => _$${data.name}ToJson(this);

${this.generateCopyWith(data)}
}
`.trim());

    // Equatable model template
    this.registerTemplate('equatable', (data) => `
import 'package:equatable/equatable.dart';
${data.imports || ''}

/// ${data.description || data.name + ' model'}
class ${data.name} extends Equatable {
${this.generateFields(data.fields)}

  const ${data.name}(${this.generateConstructorArgs(data.fields)});

  @override
  List<Object?> get props => [${data.fields.map(f => f.name).join(', ')}];

${this.generateCopyWith(data)}
}
`.trim());
  }

  /**
   * Generate field declarations
   */
  generateFields(fields = []) {
    return fields.map(f => {
      const nullable = f.nullable ? '?' : '';
      const jsonKey = f.jsonKey ? `  @JsonKey(name: '${f.jsonKey}')\n` : '';
      return `${jsonKey}  final ${f.type}${nullable} ${f.name};`;
    }).join('\n');
  }

  /**
   * Generate constructor arguments
   */
  generateConstructorArgs(fields = []) {
    if (!fields || fields.length === 0) return '';
    const args = fields.map(f => {
      const required = !f.nullable && !f.default ? 'required ' : '';
      const defaultValue = f.default ? ' = ${f.default}' : '';
      return `${required}this.${f.name}${defaultValue}`;
    }).join(', ');
    return `{${args}}`;
  }

  /**
   * Generate freezed parameters
   */
  generateFreezedParams(fields = []) {
    if (!fields || fields.length === 0) return '';
    const params = fields.map(f => {
      const nullable = f.nullable ? '?' : '';
      const required = !f.nullable && !f.default ? 'required ' : '';
      const defaultValue = f.default ? ` @Default(${f.default})` : '';
      const jsonKey = f.jsonKey ? ` @JsonKey(name: '${f.jsonKey}')` : '';
      return `${defaultValue}${jsonKey} ${required}${f.type}${nullable} ${f.name}`;
    }).join(',\n    ');
    return `{\n    ${params},\n  }`;
  }

  /**
   * Generate copyWith method
   */
  generateCopyWith(data) {
    const fields = data.fields || [];
    if (fields.length === 0) return '';

    const params = fields.map(f => {
      const nullable = f.nullable ? '?' : '';
      return `${f.type}${nullable}? ${f.name}`;
    }).join(', ');

    const assignments = fields.map(f => {
      return `${f.name}: ${f.name} ?? this.${f.name}`;
    }).join(',\n      ');

    return `
  ${data.name} copyWith({${params}}) {
    return ${data.name}(
      ${assignments},
    );
  }`;
  }

  /**
   * Generate equality methods
   */
  generateEquality(data) {
    const fields = data.fields || [];
    if (fields.length === 0) return '';

    const comparisons = fields.map(f => `${f.name} == other.${f.name}`).join(' &&\n        ');
    const hashCodes = fields.map(f => `${f.name}.hashCode`).join(' ^ ');

    return `
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ${data.name} &&
        ${comparisons};
  }

  @override
  int get hashCode => ${hashCodes};`;
  }

  /**
   * Generate toString method
   */
  generateToString(data) {
    const fields = data.fields || [];
    const fieldStrings = fields.map(f => `${f.name}: $${f.name}`).join(', ');
    return `
  @override
  String toString() => '${data.name}(${fieldStrings})';`;
  }

  /**
   * Generate a model
   * @param {Object} spec - Model specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      // Validate spec
      const validation = this.validateSpec(spec, {
        required: ['name', 'fields'],
        properties: {
          name: { type: 'string', pattern: '^[A-Z][a-zA-Z0-9]*$' },
          type: { type: 'string', enum: Object.values(MODEL_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      let templateName = spec.type || MODEL_TYPE.BASIC;
      if (this.useFreezed && templateName === MODEL_TYPE.BASIC) {
        templateName = MODEL_TYPE.FREEZED;
      }

      // Add JSON support flag
      const specWithJson = {
        ...spec,
        useJson: this.useJsonSerializable || spec.type === MODEL_TYPE.JSON_SERIALIZABLE
      };

      // Build output path
      const fileName = this.toSnakeCase(spec.name) + '.dart';
      const outputPath = spec.outputPath || `lib/models/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(specWithJson, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FLUTTER_MODEL_GENERATED, {
          name: spec.name,
          type: templateName,
          fields: spec.fields.length,
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

export function getModelGenerator(options = {}) {
  if (!instance) {
    instance = new ModelGenerator(options);
  }
  return instance;
}

export default ModelGenerator;
