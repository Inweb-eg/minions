/**
 * FormGenerator - React Form Component Code Generation Skill
 *
 * Generates form components:
 * - React Hook Form integration
 * - Form fields
 * - Validation schemas
 * - Submit handling
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Form types
 */
export const FORM_TYPE = {
  BASIC: 'basic',
  REACT_HOOK_FORM: 'reactHookForm',
  FORMIK: 'formik'
};

/**
 * Field types
 */
export const FORM_FIELD_TYPE = {
  TEXT: 'text',
  EMAIL: 'email',
  PASSWORD: 'password',
  NUMBER: 'number',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DATE: 'date',
  FILE: 'file',
  CUSTOM: 'custom'
};

/**
 * FormGenerator Skill
 */
export class FormGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('FormGenerator', {
      language: LANGUAGE.TYPESCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript ?? true;
    this.cssFramework = options.cssFramework || 'tailwind';
    this.registerTemplates();
  }

  registerTemplates() {
    // Basic form template
    this.registerTemplate('basic', (data) => `
import React, { useState, FormEvent, ChangeEvent } from 'react';
${data.imports || ''}

${this.generateFormTypes(data)}

/**
 * ${data.description || data.name + ' Form'}
 */
export const ${data.name}Form${this.useTypeScript ? `: React.FC<${data.name}FormProps>` : ''} = ({
  onSubmit,
  initialValues,
  ${data.additionalProps || ''}
}) => {
  const [values, setValues] = useState${this.useTypeScript ? `<${data.name}FormValues>` : ''}(initialValues || ${this.generateDefaultValues(data)});
  const [errors, setErrors] = useState${this.useTypeScript ? '<Record<string, string>>' : ''}({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setValues(prev => ({ ...prev, [name]: finalValue }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = ()${this.useTypeScript ? ': Record<string, string>' : ''} => {
    const newErrors${this.useTypeScript ? ': Record<string, string>' : ''} = {};
${this.generateBasicValidation(data.fields)}
    return newErrors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      ${data.resetOnSuccess ? `setValues(initialValues || ${this.generateDefaultValues(data)});` : ''}
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="${data.formClassName || 'space-y-4'}">
${this.generateBasicFormFields(data.fields)}
      <button
        type="submit"
        disabled={isSubmitting}
        className="${data.submitClassName || 'w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'}"
      >
        {isSubmitting ? '${data.loadingText || 'Submitting...'}' : '${data.submitText || 'Submit'}'}
      </button>
    </form>
  );
};

export default ${data.name}Form;
`.trim());

    // React Hook Form template
    this.registerTemplate('reactHookForm', (data) => `
import React from 'react';
import { useForm${data.useFieldArray ? ', useFieldArray' : ''} } from 'react-hook-form';
${data.useZod ? "import { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';" : ''}
${data.imports || ''}

${this.generateRHFTypes(data)}

${data.useZod ? this.generateZodSchema(data) : ''}

/**
 * ${data.description || data.name + ' Form'}
 */
export const ${data.name}Form${this.useTypeScript ? `: React.FC<${data.name}FormProps>` : ''} = ({
  onSubmit,
  defaultValues,
  ${data.additionalProps || ''}
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    ${data.watch ? 'watch,' : ''}
    ${data.setValue ? 'setValue,' : ''}
    ${data.useFieldArray ? 'control,' : ''}
  } = useForm${this.useTypeScript ? `<${data.name}FormValues>` : ''}({
    defaultValues: defaultValues || ${this.generateDefaultValues(data)},
    ${data.useZod ? `resolver: zodResolver(${this.toCamelCase(data.name)}Schema),` : ''}
    ${data.mode ? `mode: '${data.mode}',` : ''}
  });

  ${data.useFieldArray ? this.generateFieldArraySetup(data) : ''}

  const onFormSubmit = async (data${this.useTypeScript ? `: ${data.name}FormValues` : ''}) => {
    try {
      await onSubmit(data);
      ${data.resetOnSuccess ? 'reset();' : ''}
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="${data.formClassName || 'space-y-4'}">
${this.generateRHFFormFields(data.fields)}
${data.useFieldArray ? this.generateFieldArrayUI(data) : ''}
      <button
        type="submit"
        disabled={isSubmitting}
        className="${data.submitClassName || 'w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'}"
      >
        {isSubmitting ? '${data.loadingText || 'Submitting...'}' : '${data.submitText || 'Submit'}'}
      </button>
    </form>
  );
};

export default ${data.name}Form;
`.trim());

    // Formik form template
    this.registerTemplate('formik', (data) => `
import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
${data.useYup ? "import * as Yup from 'yup';" : ''}
${data.imports || ''}

${this.generateFormikTypes(data)}

${data.useYup ? this.generateYupSchema(data) : ''}

/**
 * ${data.description || data.name + ' Form'}
 */
export const ${data.name}Form${this.useTypeScript ? `: React.FC<${data.name}FormProps>` : ''} = ({
  onSubmit,
  initialValues,
  ${data.additionalProps || ''}
}) => {
  return (
    <Formik
      initialValues={initialValues || ${this.generateDefaultValues(data)}}
      ${data.useYup ? `validationSchema={${this.toCamelCase(data.name)}Schema}` : ''}
      onSubmit={async (values, { setSubmitting${data.resetOnSuccess ? ', resetForm' : ''} }) => {
        try {
          await onSubmit(values);
          ${data.resetOnSuccess ? 'resetForm();' : ''}
        } catch (error) {
          console.error('Form submission error:', error);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, errors, touched }) => (
        <Form className="${data.formClassName || 'space-y-4'}">
${this.generateFormikFormFields(data.fields)}
          <button
            type="submit"
            disabled={isSubmitting}
            className="${data.submitClassName || 'w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'}"
          >
            {isSubmitting ? '${data.loadingText || 'Submitting...'}' : '${data.submitText || 'Submit'}'}
          </button>
        </Form>
      )}
    </Formik>
  );
};

export default ${data.name}Form;
`.trim());
  }

  /**
   * Generate form types
   */
  generateFormTypes(data) {
    if (!this.useTypeScript) return '';

    const valueTypes = (data.fields || []).map(f =>
      `  ${f.name}: ${this.getFieldTypeScript(f)};`
    ).join('\n');

    return `export interface ${data.name}FormValues {
${valueTypes}
}

export interface ${data.name}FormProps {
  onSubmit: (values: ${data.name}FormValues) => Promise<void>;
  initialValues?: Partial<${data.name}FormValues>;
  ${data.additionalPropTypes || ''}
}`;
  }

  /**
   * Generate RHF types
   */
  generateRHFTypes(data) {
    if (!this.useTypeScript) return '';

    const valueTypes = (data.fields || []).map(f =>
      `  ${f.name}: ${this.getFieldTypeScript(f)};`
    ).join('\n');

    return `export interface ${data.name}FormValues {
${valueTypes}
}

export interface ${data.name}FormProps {
  onSubmit: (values: ${data.name}FormValues) => Promise<void>;
  defaultValues?: Partial<${data.name}FormValues>;
  ${data.additionalPropTypes || ''}
}`;
  }

  /**
   * Generate Formik types
   */
  generateFormikTypes(data) {
    return this.generateFormTypes(data);
  }

  /**
   * Get TypeScript type for field
   */
  getFieldTypeScript(field) {
    switch (field.type) {
      case FORM_FIELD_TYPE.NUMBER:
        return 'number';
      case FORM_FIELD_TYPE.CHECKBOX:
        return 'boolean';
      case FORM_FIELD_TYPE.SELECT:
        if (field.multiple) return 'string[]';
        return field.options
          ? field.options.map(o => `'${o.value}'`).join(' | ')
          : 'string';
      case FORM_FIELD_TYPE.FILE:
        return field.multiple ? 'FileList | null' : 'File | null';
      case FORM_FIELD_TYPE.DATE:
        return 'Date | string';
      default:
        return 'string';
    }
  }

  /**
   * Generate default values
   */
  generateDefaultValues(data) {
    const defaults = (data.fields || []).reduce((acc, f) => {
      switch (f.type) {
        case FORM_FIELD_TYPE.NUMBER:
          acc[f.name] = f.default !== undefined ? f.default : 0;
          break;
        case FORM_FIELD_TYPE.CHECKBOX:
          acc[f.name] = f.default !== undefined ? f.default : false;
          break;
        case FORM_FIELD_TYPE.SELECT:
          acc[f.name] = f.default || (f.multiple ? [] : '');
          break;
        default:
          acc[f.name] = f.default || '';
      }
      return acc;
    }, {});

    return JSON.stringify(defaults, null, 2).replace(/\n/g, '\n  ');
  }

  /**
   * Generate Zod schema
   */
  generateZodSchema(data) {
    const fields = (data.fields || []).map(f => {
      let schema = this.fieldToZodSchema(f);
      return `  ${f.name}: ${schema},`;
    }).join('\n');

    return `const ${this.toCamelCase(data.name)}Schema = z.object({
${fields}
});`;
  }

  /**
   * Convert field to Zod schema
   */
  fieldToZodSchema(field) {
    let schema;

    switch (field.type) {
      case FORM_FIELD_TYPE.EMAIL:
        schema = "z.string().email('Invalid email')";
        break;
      case FORM_FIELD_TYPE.NUMBER:
        schema = 'z.coerce.number()';
        if (field.min !== undefined) schema += `.min(${field.min})`;
        if (field.max !== undefined) schema += `.max(${field.max})`;
        break;
      case FORM_FIELD_TYPE.CHECKBOX:
        schema = 'z.boolean()';
        break;
      case FORM_FIELD_TYPE.SELECT:
        if (field.options) {
          const values = field.options.map(o => `'${o.value}'`).join(', ');
          schema = `z.enum([${values}])`;
        } else {
          schema = 'z.string()';
        }
        break;
      case FORM_FIELD_TYPE.DATE:
        schema = 'z.coerce.date()';
        break;
      default:
        schema = 'z.string()';
        if (field.minLength) schema += `.min(${field.minLength})`;
        if (field.maxLength) schema += `.max(${field.maxLength})`;
        if (field.pattern) schema += `.regex(${field.pattern})`;
    }

    if (field.required) {
      if (field.type === FORM_FIELD_TYPE.CHECKBOX) {
        schema += `.refine(val => val === true, { message: '${field.requiredMessage || 'Required'}' })`;
      }
    } else {
      schema += '.optional()';
    }

    return schema;
  }

  /**
   * Generate Yup schema
   */
  generateYupSchema(data) {
    const fields = (data.fields || []).map(f => {
      let schema = this.fieldToYupSchema(f);
      return `  ${f.name}: ${schema},`;
    }).join('\n');

    return `const ${this.toCamelCase(data.name)}Schema = Yup.object({
${fields}
});`;
  }

  /**
   * Convert field to Yup schema
   */
  fieldToYupSchema(field) {
    let schema;

    switch (field.type) {
      case FORM_FIELD_TYPE.EMAIL:
        schema = "Yup.string().email('Invalid email')";
        break;
      case FORM_FIELD_TYPE.NUMBER:
        schema = 'Yup.number()';
        if (field.min !== undefined) schema += `.min(${field.min})`;
        if (field.max !== undefined) schema += `.max(${field.max})`;
        break;
      case FORM_FIELD_TYPE.CHECKBOX:
        schema = 'Yup.boolean()';
        break;
      default:
        schema = 'Yup.string()';
        if (field.minLength) schema += `.min(${field.minLength})`;
        if (field.maxLength) schema += `.max(${field.maxLength})`;
    }

    if (field.required) {
      schema += `.required('${field.requiredMessage || field.label + ' is required'}')`;
    }

    return schema;
  }

  /**
   * Generate basic form fields
   */
  generateBasicFormFields(fields = []) {
    return fields.map(f => this.generateBasicField(f)).join('\n');
  }

  /**
   * Generate basic field
   */
  generateBasicField(field) {
    const label = `      <label className="block text-sm font-medium mb-1">${field.label || field.name}</label>`;
    const error = `      {errors.${field.name} && <p className="text-red-500 text-sm mt-1">{errors.${field.name}}</p>}`;
    const inputClass = field.className || 'w-full p-2 border rounded focus:ring-2 focus:ring-blue-500';

    let input;
    switch (field.type) {
      case FORM_FIELD_TYPE.TEXTAREA:
        input = `      <textarea
        name="${field.name}"
        value={values.${field.name}}
        onChange={handleChange}
        placeholder="${field.placeholder || ''}"
        rows={${field.rows || 4}}
        className="${inputClass}"
      />`;
        break;
      case FORM_FIELD_TYPE.SELECT:
        input = `      <select
        name="${field.name}"
        value={values.${field.name}}
        onChange={handleChange}
        className="${inputClass}"
      >
        <option value="">${field.placeholder || 'Select...'}</option>
${(field.options || []).map(o => `        <option value="${o.value}">${o.label}</option>`).join('\n')}
      </select>`;
        break;
      case FORM_FIELD_TYPE.CHECKBOX:
        return `      <div className="flex items-center">
        <input
          type="checkbox"
          name="${field.name}"
          checked={values.${field.name}}
          onChange={handleChange}
          className="mr-2"
        />
        <label className="text-sm">${field.label || field.name}</label>
      </div>
      {errors.${field.name} && <p className="text-red-500 text-sm">{errors.${field.name}}</p>}`;
      default:
        input = `      <input
        type="${field.type || 'text'}"
        name="${field.name}"
        value={values.${field.name}}
        onChange={handleChange}
        placeholder="${field.placeholder || ''}"
        className="${inputClass}"
      />`;
    }

    return `      <div>
${label}
${input}
${error}
      </div>`;
  }

  /**
   * Generate basic validation
   */
  generateBasicValidation(fields = []) {
    return fields.filter(f => f.required || f.validation).map(f => {
      let validation = '';

      if (f.required) {
        if (f.type === FORM_FIELD_TYPE.CHECKBOX) {
          validation += `    if (!values.${f.name}) newErrors.${f.name} = '${f.requiredMessage || f.label + ' is required'}';\n`;
        } else {
          validation += `    if (!values.${f.name}) newErrors.${f.name} = '${f.requiredMessage || f.label + ' is required'}';\n`;
        }
      }

      if (f.type === FORM_FIELD_TYPE.EMAIL) {
        validation += `    if (values.${f.name} && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i.test(values.${f.name})) {
      newErrors.${f.name} = 'Invalid email address';
    }\n`;
      }

      if (f.minLength) {
        validation += `    if (values.${f.name} && values.${f.name}.length < ${f.minLength}) {
      newErrors.${f.name} = 'Must be at least ${f.minLength} characters';
    }\n`;
      }

      return validation;
    }).join('');
  }

  /**
   * Generate RHF form fields
   */
  generateRHFFormFields(fields = []) {
    return fields.map(f => this.generateRHFField(f)).join('\n');
  }

  /**
   * Generate RHF field
   */
  generateRHFField(field) {
    const label = `      <label className="block text-sm font-medium mb-1">${field.label || field.name}</label>`;
    const error = `      {errors.${field.name} && <p className="text-red-500 text-sm mt-1">{errors.${field.name}?.message}</p>}`;
    const inputClass = field.className || 'w-full p-2 border rounded focus:ring-2 focus:ring-blue-500';

    let input;
    switch (field.type) {
      case FORM_FIELD_TYPE.TEXTAREA:
        input = `      <textarea
        {...register('${field.name}')}
        placeholder="${field.placeholder || ''}"
        rows={${field.rows || 4}}
        className="${inputClass}"
      />`;
        break;
      case FORM_FIELD_TYPE.SELECT:
        input = `      <select
        {...register('${field.name}')}
        className="${inputClass}"
      >
        <option value="">${field.placeholder || 'Select...'}</option>
${(field.options || []).map(o => `        <option value="${o.value}">${o.label}</option>`).join('\n')}
      </select>`;
        break;
      case FORM_FIELD_TYPE.CHECKBOX:
        return `      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('${field.name}')}
          className="mr-2"
        />
        <label className="text-sm">${field.label || field.name}</label>
      </div>
      {errors.${field.name} && <p className="text-red-500 text-sm">{errors.${field.name}?.message}</p>}`;
      default:
        input = `      <input
        type="${field.type || 'text'}"
        {...register('${field.name}')}
        placeholder="${field.placeholder || ''}"
        className="${inputClass}"
      />`;
    }

    return `      <div>
${label}
${input}
${error}
      </div>`;
  }

  /**
   * Generate Formik form fields
   */
  generateFormikFormFields(fields = []) {
    return fields.map(f => this.generateFormikField(f)).join('\n');
  }

  /**
   * Generate Formik field
   */
  generateFormikField(field) {
    const label = `      <label className="block text-sm font-medium mb-1">${field.label || field.name}</label>`;
    const error = `      <ErrorMessage name="${field.name}" component="p" className="text-red-500 text-sm mt-1" />`;
    const inputClass = field.className || 'w-full p-2 border rounded focus:ring-2 focus:ring-blue-500';

    let input;
    switch (field.type) {
      case FORM_FIELD_TYPE.TEXTAREA:
        input = `      <Field
        as="textarea"
        name="${field.name}"
        placeholder="${field.placeholder || ''}"
        rows={${field.rows || 4}}
        className="${inputClass}"
      />`;
        break;
      case FORM_FIELD_TYPE.SELECT:
        input = `      <Field
        as="select"
        name="${field.name}"
        className="${inputClass}"
      >
        <option value="">${field.placeholder || 'Select...'}</option>
${(field.options || []).map(o => `        <option value="${o.value}">${o.label}</option>`).join('\n')}
      </Field>`;
        break;
      case FORM_FIELD_TYPE.CHECKBOX:
        return `      <div className="flex items-center">
        <Field
          type="checkbox"
          name="${field.name}"
          className="mr-2"
        />
        <label className="text-sm">${field.label || field.name}</label>
      </div>
      <ErrorMessage name="${field.name}" component="p" className="text-red-500 text-sm" />`;
      default:
        input = `      <Field
        type="${field.type || 'text'}"
        name="${field.name}"
        placeholder="${field.placeholder || ''}"
        className="${inputClass}"
      />`;
    }

    return `      <div>
${label}
${input}
${error}
      </div>`;
  }

  /**
   * Generate field array setup
   */
  generateFieldArraySetup(data) {
    if (!data.fieldArrayName) return '';
    return `const { fields, append, remove } = useFieldArray({
    control,
    name: '${data.fieldArrayName}',
  });`;
  }

  /**
   * Generate field array UI
   */
  generateFieldArrayUI(data) {
    if (!data.fieldArrayName) return '';
    return `      <div>
        <label className="block text-sm font-medium mb-2">${data.fieldArrayLabel || data.fieldArrayName}</label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 mb-2">
            <input
              {...register(\`${data.fieldArrayName}.\${index}.value\`)}
              className="flex-1 p-2 border rounded"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="px-3 py-2 bg-red-500 text-white rounded"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => append({ value: '' })}
          className="mt-2 px-4 py-2 bg-gray-200 rounded"
        >
          Add Item
        </button>
      </div>`;
  }

  /**
   * Generate a form
   * @param {Object} spec - Form specification
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
          type: { type: 'string', enum: Object.values(FORM_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || FORM_TYPE.REACT_HOOK_FORM;

      // Build output path
      const ext = this.useTypeScript ? '.tsx' : '.jsx';
      const fileName = `${spec.name}Form${ext}`;
      const outputPath = spec.outputPath || `src/components/forms/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FRONTEND_FORM_GENERATED, {
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
   * Convert to camelCase
   */
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

// Singleton getter
let instance = null;

export function getFormGenerator(options = {}) {
  if (!instance) {
    instance = new FormGenerator(options);
  }
  return instance;
}

export default FormGenerator;
