import { describe, test, expect, beforeEach } from '@jest/globals';
import { FormGenerator, getFormGenerator, FORM_TYPE, FORM_FIELD_TYPE } from '../skills/form-generator.js';

describe('FormGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new FormGenerator({ dryRun: true });
  });

  describe('FORM_TYPE constants', () => {
    test('should define all form types', () => {
      expect(FORM_TYPE.CONTROLLED).toBe('controlled');
      expect(FORM_TYPE.UNCONTROLLED).toBe('uncontrolled');
    });
  });

  describe('FORM_FIELD_TYPE constants', () => {
    test('should define all field types', () => {
      expect(FORM_FIELD_TYPE.TEXT).toBe('text');
      expect(FORM_FIELD_TYPE.EMAIL).toBe('email');
      expect(FORM_FIELD_TYPE.PASSWORD).toBe('password');
      expect(FORM_FIELD_TYPE.NUMBER).toBe('number');
      expect(FORM_FIELD_TYPE.TEXTAREA).toBe('textarea');
      expect(FORM_FIELD_TYPE.SELECT).toBe('select');
      expect(FORM_FIELD_TYPE.CHECKBOX).toBe('checkbox');
      expect(FORM_FIELD_TYPE.RADIO).toBe('radio');
      expect(FORM_FIELD_TYPE.DATE).toBe('date');
      expect(FORM_FIELD_TYPE.FILE).toBe('file');
    });
  });

  describe('generate controlled form', () => {
    test('should generate a form with React Hook Form', async () => {
      const result = await generator.generate({
        name: 'LoginForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'email', type: FORM_FIELD_TYPE.EMAIL, label: 'Email', required: true },
          { name: 'password', type: FORM_FIELD_TYPE.PASSWORD, label: 'Password', required: true }
        ],
        onSubmit: 'handleLogin'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("import { useForm } from 'react-hook-form'");
      expect(result.code).toContain('export const LoginForm');
      expect(result.code).toContain('useForm');
      expect(result.code).toContain('handleSubmit');
      expect(result.code).toContain('register');
    });

    test('should include field validation', async () => {
      const result = await generator.generate({
        name: 'RegistrationForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'email', type: FORM_FIELD_TYPE.EMAIL, label: 'Email', required: true, validation: 'email' },
          { name: 'password', type: FORM_FIELD_TYPE.PASSWORD, label: 'Password', required: true, validation: 'min:8' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('required:');
      expect(result.code).toContain('pattern:');
      expect(result.code).toContain('minLength:');
    });

    test('should include error messages', async () => {
      const result = await generator.generate({
        name: 'ContactForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'name', type: FORM_FIELD_TYPE.TEXT, label: 'Name', required: true }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('errors');
      expect(result.code).toContain('formState');
    });

    test('should generate text input', async () => {
      const result = await generator.generate({
        name: 'ProfileForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'name', type: FORM_FIELD_TYPE.TEXT, label: 'Full Name' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('type="text"');
    });

    test('should generate textarea', async () => {
      const result = await generator.generate({
        name: 'FeedbackForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'message', type: FORM_FIELD_TYPE.TEXTAREA, label: 'Message' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('<textarea');
    });

    test('should generate select dropdown', async () => {
      const result = await generator.generate({
        name: 'SettingsForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          {
            name: 'country',
            type: FORM_FIELD_TYPE.SELECT,
            label: 'Country',
            options: [
              { value: 'us', label: 'United States' },
              { value: 'uk', label: 'United Kingdom' }
            ]
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('<select');
      expect(result.code).toContain('<option');
      expect(result.code).toContain('United States');
    });

    test('should generate checkbox', async () => {
      const result = await generator.generate({
        name: 'ConsentForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'agree', type: FORM_FIELD_TYPE.CHECKBOX, label: 'I agree to terms' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('type="checkbox"');
    });

    test('should use Tailwind CSS', async () => {
      const result = await generator.generate({
        name: 'LoginForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'email', type: FORM_FIELD_TYPE.EMAIL, label: 'Email' }
        ],
        cssFramework: 'tailwind'
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('className=');
    });
  });

  describe('generate uncontrolled form', () => {
    test('should generate uncontrolled form with refs', async () => {
      const result = await generator.generate({
        name: 'SearchForm',
        type: FORM_TYPE.UNCONTROLLED,
        fields: [
          { name: 'query', type: FORM_FIELD_TYPE.TEXT, label: 'Search' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('useRef');
    });
  });

  describe('TypeScript types', () => {
    test('should generate form data interface', async () => {
      const result = await generator.generate({
        name: 'UserForm',
        type: FORM_TYPE.CONTROLLED,
        fields: [
          { name: 'name', type: FORM_FIELD_TYPE.TEXT, label: 'Name' },
          { name: 'age', type: FORM_FIELD_TYPE.NUMBER, label: 'Age' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('interface UserFormData');
      expect(result.code).toContain('name: string');
      expect(result.code).toContain('age: number');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: FORM_TYPE.CONTROLLED,
        fields: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });

    test('should fail with missing fields', async () => {
      const result = await generator.generate({
        name: 'TestForm',
        type: FORM_TYPE.CONTROLLED
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'fields'");
    });
  });

  describe('singleton', () => {
    test('getFormGenerator should return singleton', () => {
      const gen1 = getFormGenerator();
      const gen2 = getFormGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
