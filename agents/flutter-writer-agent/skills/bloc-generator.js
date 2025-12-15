/**
 * BlocGenerator - Flutter Bloc/Cubit Code Generation Skill
 *
 * Generates Flutter state management:
 * - Bloc with Events and States
 * - Cubit for simpler state
 * - State classes with freezed
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT, createSkillGetter } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Bloc types
 */
export const BLOC_TYPE = {
  BLOC: 'bloc',
  CUBIT: 'cubit'
};

/**
 * BlocGenerator Skill
 */
export class BlocGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('BlocGenerator', {
      language: LANGUAGE.DART,
      ...options
    });

    this.useFreezed = options.useFreezed ?? true;
    this.registerTemplates();
  }

  registerTemplates() {
    // Bloc template
    this.registerTemplate('bloc', (data) => `
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
${data.imports || ''}

part '${this.toSnakeCase(data.name)}_event.dart';
part '${this.toSnakeCase(data.name)}_state.dart';

/// ${data.description || data.name + ' Bloc'}
class ${data.name}Bloc extends Bloc<${data.name}Event, ${data.name}State> {
  ${this.generateDependencies(data.dependencies)}

  ${data.name}Bloc(${this.generateConstructorParams(data.dependencies)}) : super(const ${data.name}Initial()) {
${this.generateEventHandlers(data)}
  }

${this.generateBlocMethods(data)}
}
`.trim());

    // Bloc Event template
    this.registerTemplate('blocEvent', (data) => `
part of '${this.toSnakeCase(data.name)}_bloc.dart';

/// ${data.name} Events
sealed class ${data.name}Event extends Equatable {
  const ${data.name}Event();

  @override
  List<Object?> get props => [];
}

${this.generateEvents(data)}
`.trim());

    // Bloc State template
    this.registerTemplate('blocState', (data) => `
part of '${this.toSnakeCase(data.name)}_bloc.dart';

/// ${data.name} States
sealed class ${data.name}State extends Equatable {
  const ${data.name}State();

  @override
  List<Object?> get props => [];
}

/// Initial state
final class ${data.name}Initial extends ${data.name}State {
  const ${data.name}Initial();
}

/// Loading state
final class ${data.name}Loading extends ${data.name}State {
  const ${data.name}Loading();
}

${this.generateStates(data)}

/// Error state
final class ${data.name}Error extends ${data.name}State {
  final String message;

  const ${data.name}Error(this.message);

  @override
  List<Object?> get props => [message];
}
`.trim());

    // Cubit template
    this.registerTemplate('cubit', (data) => `
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
${data.imports || ''}

part '${this.toSnakeCase(data.name)}_state.dart';

/// ${data.description || data.name + ' Cubit'}
class ${data.name}Cubit extends Cubit<${data.name}State> {
  ${this.generateDependencies(data.dependencies)}

  ${data.name}Cubit(${this.generateConstructorParams(data.dependencies)}) : super(const ${data.name}Initial());

${this.generateCubitMethods(data)}
}
`.trim());

    // Cubit State template (same as bloc state for consistency)
    this.registerTemplate('cubitState', (data) => `
part of '${this.toSnakeCase(data.name)}_cubit.dart';

/// ${data.name} States
sealed class ${data.name}State extends Equatable {
  const ${data.name}State();

  @override
  List<Object?> get props => [];
}

/// Initial state
final class ${data.name}Initial extends ${data.name}State {
  const ${data.name}Initial();
}

/// Loading state
final class ${data.name}Loading extends ${data.name}State {
  const ${data.name}Loading();
}

${this.generateStates(data)}

/// Error state
final class ${data.name}Error extends ${data.name}State {
  final String message;

  const ${data.name}Error(this.message);

  @override
  List<Object?> get props => [message];
}
`.trim());
  }

  /**
   * Generate dependency fields
   */
  generateDependencies(dependencies = []) {
    if (!dependencies || dependencies.length === 0) return '';
    return dependencies.map(d => `final ${d.type} _${this.toCamelCase(d.name)};`).join('\n  ');
  }

  /**
   * Generate constructor parameters
   */
  generateConstructorParams(dependencies = []) {
    if (!dependencies || dependencies.length === 0) return '';
    return dependencies.map(d => `${d.type} ${this.toCamelCase(d.name)}`).join(', ');
  }

  /**
   * Generate event handlers for Bloc
   */
  generateEventHandlers(data) {
    const events = data.events || [];
    if (events.length === 0) {
      return '    // Add event handlers here';
    }

    return events.map(event => {
      const eventName = event.name || event;
      const handlerName = `_on${eventName}`;
      return `    on<${eventName}>(${handlerName});`;
    }).join('\n');
  }

  /**
   * Generate Bloc methods
   */
  generateBlocMethods(data) {
    const events = data.events || [];
    if (events.length === 0) return '';

    return events.map(event => {
      const eventName = event.name || event;
      const handlerName = `_on${eventName}`;
      const body = event.body || `
    emit(const ${data.name}Loading());
    try {
      // TODO: Implement ${eventName} handler
      // emit(${data.name}Success(...));
    } catch (e) {
      emit(${data.name}Error(e.toString()));
    }`;

      return `
  Future<void> ${handlerName}(
    ${eventName} event,
    Emitter<${data.name}State> emit,
  ) async {${body}
  }`;
    }).join('\n');
  }

  /**
   * Generate Cubit methods
   */
  generateCubitMethods(data) {
    const methods = data.methods || [];
    if (methods.length === 0) {
      return `
  Future<void> load() async {
    emit(const ${data.name}Loading());
    try {
      // TODO: Implement load
      // emit(${data.name}Loaded(...));
    } catch (e) {
      emit(${data.name}Error(e.toString()));
    }
  }`;
    }

    return methods.map(method => {
      const params = method.params ? method.params.map(p => `${p.type} ${p.name}`).join(', ') : '';
      const body = method.body || `
    emit(const ${data.name}Loading());
    try {
      // TODO: Implement ${method.name}
    } catch (e) {
      emit(${data.name}Error(e.toString()));
    }`;

      return `
  Future<void> ${method.name}(${params}) async {${body}
  }`;
    }).join('\n');
  }

  /**
   * Generate event classes
   */
  generateEvents(data) {
    const events = data.events || [];
    if (events.length === 0) return '';

    return events.map(event => {
      const eventName = event.name || event;
      const fields = event.fields || [];
      const fieldDeclarations = fields.map(f => `  final ${f.type} ${f.name};`).join('\n');
      const constructorParams = fields.length > 0
        ? `{${fields.map(f => `required this.${f.name}`).join(', ')}}`
        : '';
      const props = fields.map(f => f.name).join(', ');

      return `
/// ${event.description || eventName + ' event'}
final class ${eventName} extends ${data.name}Event {
${fieldDeclarations}

  const ${eventName}(${constructorParams});

  @override
  List<Object?> get props => [${props}];
}`;
    }).join('\n');
  }

  /**
   * Generate state classes
   */
  generateStates(data) {
    const states = data.states || [];
    if (states.length === 0) {
      // Default success state with data
      return `
/// Success state with data
final class ${data.name}Loaded extends ${data.name}State {
  final ${data.dataType || 'dynamic'} data;

  const ${data.name}Loaded(this.data);

  @override
  List<Object?> get props => [data];
}`;
    }

    return states.map(state => {
      const stateName = state.name || state;
      const fields = state.fields || [];
      const fieldDeclarations = fields.map(f => `  final ${f.type} ${f.name};`).join('\n');
      const constructorParams = fields.length > 0
        ? fields.map(f => `this.${f.name}`).join(', ')
        : '';
      const props = fields.map(f => f.name).join(', ');

      return `
/// ${state.description || stateName + ' state'}
final class ${stateName} extends ${data.name}State {
${fieldDeclarations}

  const ${stateName}(${constructorParams});

  @override
  List<Object?> get props => [${props}];
}`;
    }).join('\n');
  }

  /**
   * Generate a Bloc or Cubit
   * @param {Object} spec - Bloc/Cubit specification
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
          type: { type: 'string', enum: Object.values(BLOC_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      const type = spec.type || BLOC_TYPE.BLOC;
      const baseName = this.toSnakeCase(spec.name);
      const baseDir = spec.outputPath || `lib/blocs/${baseName}`;

      const results = [];

      if (type === BLOC_TYPE.BLOC) {
        // Generate Bloc file
        results.push(await this.generateAndWrite(spec, 'bloc', `${baseDir}/${baseName}_bloc.dart`, {
          overwrite: spec.overwrite || false
        }));

        // Generate Event file
        results.push(await this.generateAndWrite(spec, 'blocEvent', `${baseDir}/${baseName}_event.dart`, {
          overwrite: spec.overwrite || false
        }));

        // Generate State file
        results.push(await this.generateAndWrite(spec, 'blocState', `${baseDir}/${baseName}_state.dart`, {
          overwrite: spec.overwrite || false
        }));
      } else {
        // Generate Cubit file
        results.push(await this.generateAndWrite(spec, 'cubit', `${baseDir}/${baseName}_cubit.dart`, {
          overwrite: spec.overwrite || false
        }));

        // Generate State file
        results.push(await this.generateAndWrite(spec, 'cubitState', `${baseDir}/${baseName}_state.dart`, {
          overwrite: spec.overwrite || false
        }));
      }

      const success = results.every(r => r.success);

      if (success) {
        this.publish(EventTypes.FLUTTER_BLOC_GENERATED, {
          name: spec.name,
          type,
          files: results.map(r => r.path)
        });
      }

      this.completeRun();
      return {
        success,
        results,
        type
      };
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

  /**
   * Convert to camelCase
   */
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

// Singleton getter
let instance = null;

export function getBlocGenerator(options = {}) {
  if (!instance) {
    instance = new BlocGenerator(options);
  }
  return instance;
}

export default BlocGenerator;
