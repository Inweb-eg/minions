/**
 * HookGenerator - Custom React Hooks Code Generation Skill
 *
 * Generates React hooks:
 * - Custom hooks
 * - State hooks
 * - Effect hooks
 * - Data fetching hooks
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Hook types
 */
export const HOOK_TYPE = {
  STATE: 'state',
  EFFECT: 'effect',
  FETCH: 'fetch',
  FORM: 'form',
  CUSTOM: 'custom'
};

/**
 * HookGenerator Skill
 */
export class HookGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('HookGenerator', {
      language: LANGUAGE.TYPESCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript ?? true;
    this.registerTemplates();
  }

  registerTemplates() {
    // State hook template
    this.registerTemplate('state', (data) => `
import { useState, useCallback${data.useMemo ? ', useMemo' : ''} } from 'react';

${this.generateStateTypes(data)}

/**
 * ${data.description || 'Custom state hook for ' + data.name}
 */
export function use${data.name}(${this.generateInitialParams(data)})${this.useTypeScript ? `: Use${data.name}Return` : ''} {
  const [${data.stateName || 'state'}, set${this.capitalize(data.stateName || 'state')}] = useState${this.useTypeScript ? `<${data.stateType || 'any'}>` : ''}(${data.initialValue || 'initialValue'});

  ${this.generateStateActions(data)}

  ${data.derivedValues ? this.generateDerivedValues(data) : ''}

  return {
    ${data.stateName || 'state'},
    set${this.capitalize(data.stateName || 'state')},
    ${this.generateReturnActions(data)}
    ${data.derivedValues ? data.derivedValues.map(d => d.name).join(',\n    ') + ',' : ''}
  };
}

export default use${data.name};
`.trim());

    // Effect hook template
    this.registerTemplate('effect', (data) => `
import { useEffect${data.useCallback ? ', useCallback' : ''}${data.useRef ? ', useRef' : ''} } from 'react';

${this.generateEffectTypes(data)}

/**
 * ${data.description || 'Custom effect hook for ' + data.name}
 */
export function use${data.name}(${this.generateEffectParams(data)})${this.useTypeScript ? `: ${data.returnType || 'void'}` : ''} {
  ${data.useRef ? `const ${data.refName || 'ref'} = useRef${this.useTypeScript ? `<${data.refType || 'any'}>` : ''}(${data.refInitial || 'null'});` : ''}

  ${data.callbackSetup || ''}

  useEffect(() => {
    ${data.effectBody || '// Effect logic here'}

    ${data.cleanup ? `return () => {\n      ${data.cleanup}\n    };` : ''}
  }, [${data.dependencies?.join(', ') || ''}]);

  ${data.returnStatement || ''}
}

export default use${data.name};
`.trim());

    // Fetch hook template
    this.registerTemplate('fetch', (data) => `
import { useState, useEffect, useCallback } from 'react';

${this.generateFetchTypes(data)}

/**
 * ${data.description || 'Data fetching hook for ' + data.name}
 */
export function use${data.name}${this.useTypeScript ? `<T = ${data.dataType || 'any'}>` : ''}(${this.generateFetchParams(data)})${this.useTypeScript ? `: Use${data.name}Return<T>` : ''} {
  const [data, setData] = useState${this.useTypeScript ? '<T | null>' : ''}(null);
  const [loading, setLoading] = useState(${data.loadOnMount !== false ? 'true' : 'false'});
  const [error, setError] = useState${this.useTypeScript ? '<Error | null>' : ''}(null);

  const fetchData = useCallback(async (${data.fetchParams || ''}) => {
    setLoading(true);
    setError(null);

    try {
      ${data.fetchBody || `const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch');
      }
      const result = await response.json();
      setData(result);
      return result;`}
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      ${data.onError ? data.onError : ''}
      throw error;
    } finally {
      setLoading(false);
    }
  }, [${data.fetchDeps?.join(', ') || 'url'}]);

  ${data.loadOnMount !== false ? `useEffect(() => {
    fetchData();
  }, [fetchData]);` : ''}

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    ${data.additionalReturns || ''}
  };
}

export default use${data.name};
`.trim());

    // Form hook template
    this.registerTemplate('form', (data) => `
import { useState, useCallback, ChangeEvent, FormEvent } from 'react';

${this.generateFormTypes(data)}

/**
 * ${data.description || 'Form handling hook for ' + data.name}
 */
export function use${data.name}${this.useTypeScript ? `<T extends Record<string, any>>` : ''}(${this.generateFormParams(data)})${this.useTypeScript ? `: Use${data.name}Return<T>` : ''} {
  const [values, setValues] = useState${this.useTypeScript ? '<T>' : ''}(initialValues);
  const [errors, setErrors] = useState${this.useTypeScript ? '<Partial<Record<keyof T, string>>>' : ''}({});
  const [touched, setTouched] = useState${this.useTypeScript ? '<Partial<Record<keyof T, boolean>>>' : ''}({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setValues(prev => ({ ...prev, [name]: finalValue }));

    // Clear error on change
    if (errors[name as keyof T]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleBlur = useCallback((
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    ${data.validateOnBlur ? `// Validate field on blur
    if (validate) {
      const fieldErrors = validate(values);
      if (fieldErrors[name as keyof T]) {
        setErrors(prev => ({ ...prev, [name]: fieldErrors[name as keyof T] }));
      }
    }` : ''}
  }, [values${data.validateOnBlur ? ', validate' : ''}]);

  const setFieldValue = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validate all fields
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await onSubmit(values);
      ${data.resetOnSuccess ? 'resetForm();' : ''}
    } catch (error) {
      ${data.onSubmitError || '// Handle submit error'}
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit${data.resetOnSuccess ? ', resetForm' : ''}]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    resetForm,
    isValid: Object.keys(errors).length === 0,
  };
}

export default use${data.name};
`.trim());

    // Custom hook template
    this.registerTemplate('custom', (data) => `
import { ${data.reactImports?.join(', ') || 'useState, useEffect, useCallback'} } from 'react';
${data.imports || ''}

${this.generateCustomTypes(data)}

/**
 * ${data.description || 'Custom hook: ' + data.name}
 */
export function use${data.name}(${this.generateCustomParams(data)})${this.useTypeScript && data.returnType ? `: ${data.returnType}` : ''} {
  ${data.body || '// Hook implementation here\n  return {};'}
}

export default use${data.name};
`.trim());
  }

  /**
   * Generate state types
   */
  generateStateTypes(data) {
    if (!this.useTypeScript) return '';

    const actionTypes = data.actions?.map(a => `  ${a.name}: ${a.type || '() => void'};`).join('\n') || '';
    const derivedTypes = data.derivedValues?.map(d => `  ${d.name}: ${d.type || 'any'};`).join('\n') || '';

    return `export interface Use${data.name}Return {
  ${data.stateName || 'state'}: ${data.stateType || 'any'};
  set${this.capitalize(data.stateName || 'state')}: React.Dispatch<React.SetStateAction<${data.stateType || 'any'}>>;
${actionTypes}
${derivedTypes}
}`;
  }

  /**
   * Generate initial params
   */
  generateInitialParams(data) {
    if (!this.useTypeScript) {
      return data.initialValue ? '' : 'initialValue';
    }

    if (data.initialValue) return '';
    return `initialValue: ${data.stateType || 'any'}`;
  }

  /**
   * Generate state actions
   */
  generateStateActions(data) {
    if (!data.actions || data.actions.length === 0) return '';

    return data.actions.map(action => {
      const params = action.params || '';
      return `const ${action.name} = useCallback((${params}) => {
    ${action.body || `set${this.capitalize(data.stateName || 'state')}(prev => prev);`}
  }, []);`;
    }).join('\n\n  ');
  }

  /**
   * Generate return actions
   */
  generateReturnActions(data) {
    if (!data.actions || data.actions.length === 0) return '';
    return data.actions.map(a => a.name).join(',\n    ') + ',';
  }

  /**
   * Generate derived values
   */
  generateDerivedValues(data) {
    return data.derivedValues.map(d => {
      return `const ${d.name} = useMemo(() => {
    ${d.body || 'return null;'}
  }, [${d.deps?.join(', ') || data.stateName || 'state'}]);`;
    }).join('\n\n  ');
  }

  /**
   * Generate effect types
   */
  generateEffectTypes(data) {
    if (!this.useTypeScript || !data.params) return '';

    const params = data.params.map(p => `  ${p.name}: ${p.type || 'any'};`).join('\n');
    return `export interface Use${data.name}Params {
${params}
}`;
  }

  /**
   * Generate effect params
   */
  generateEffectParams(data) {
    if (!data.params || data.params.length === 0) return '';

    if (this.useTypeScript) {
      return data.params.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
    }
    return data.params.map(p => p.name).join(', ');
  }

  /**
   * Generate fetch types
   */
  generateFetchTypes(data) {
    if (!this.useTypeScript) return '';

    return `export interface Use${data.name}Return<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<T>;
  ${data.additionalReturnTypes || ''}
}`;
  }

  /**
   * Generate fetch params
   */
  generateFetchParams(data) {
    const params = [];

    if (data.urlParam !== false) {
      params.push(this.useTypeScript ? 'url: string' : 'url');
    }

    if (data.params) {
      data.params.forEach(p => {
        params.push(this.useTypeScript ? `${p.name}: ${p.type || 'any'}` : p.name);
      });
    }

    return params.join(', ');
  }

  /**
   * Generate form types
   */
  generateFormTypes(data) {
    if (!this.useTypeScript) return '';

    return `export interface Use${data.name}Return<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e?: FormEvent) => Promise<void>;
  setFieldValue: (name: keyof T, value: any) => void;
  setFieldError: (name: keyof T, error: string) => void;
  resetForm: () => void;
  isValid: boolean;
}`;
  }

  /**
   * Generate form params
   */
  generateFormParams(data) {
    const params = [];

    params.push(this.useTypeScript ? 'initialValues: T' : 'initialValues');
    params.push(this.useTypeScript ? 'onSubmit: (values: T) => Promise<void>' : 'onSubmit');

    if (data.validate !== false) {
      params.push(this.useTypeScript
        ? 'validate?: (values: T) => Partial<Record<keyof T, string>>'
        : 'validate');
    }

    return params.join(', ');
  }

  /**
   * Generate custom types
   */
  generateCustomTypes(data) {
    if (!this.useTypeScript || !data.types) return '';
    return data.types;
  }

  /**
   * Generate custom params
   */
  generateCustomParams(data) {
    if (!data.params) return '';

    if (this.useTypeScript) {
      return data.params.map(p => `${p.name}${p.required ? '' : '?'}: ${p.type || 'any'}`).join(', ');
    }
    return data.params.map(p => p.name).join(', ');
  }

  /**
   * Generate a hook
   * @param {Object} spec - Hook specification
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
          type: { type: 'string', enum: Object.values(HOOK_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || HOOK_TYPE.CUSTOM;

      // Build output path
      const ext = this.useTypeScript ? '.ts' : '.js';
      const fileName = `use${spec.name}${ext}`;
      const outputPath = spec.outputPath || `src/hooks/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FRONTEND_HOOK_GENERATED, {
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
   * Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton getter
let instance = null;

export function getHookGenerator(options = {}) {
  if (!instance) {
    instance = new HookGenerator(options);
  }
  return instance;
}

export default HookGenerator;
