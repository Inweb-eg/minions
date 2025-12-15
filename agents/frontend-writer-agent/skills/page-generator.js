/**
 * PageGenerator - React Page Component Code Generation Skill
 *
 * Generates page components:
 * - Page layouts
 * - Route setup
 * - Data fetching integration
 * - SEO handling
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Page types
 */
export const PAGE_TYPE = {
  BASIC: 'basic',
  LIST: 'list',
  DETAIL: 'detail',
  FORM: 'form',
  DASHBOARD: 'dashboard',
  AUTH: 'auth'
};

/**
 * Framework types
 */
export const FRAMEWORK = {
  REACT: 'react',
  NEXTJS: 'nextjs',
  REMIX: 'remix'
};

/**
 * PageGenerator Skill
 */
export class PageGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('PageGenerator', {
      language: LANGUAGE.TYPESCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript ?? true;
    this.framework = options.framework || FRAMEWORK.REACT;
    this.cssFramework = options.cssFramework || 'tailwind';
    this.registerTemplates();
  }

  registerTemplates() {
    // Basic page template
    this.registerTemplate('basic', (data) => `
${this.generatePageImports(data)}

${this.generatePageTypes(data)}

/**
 * ${data.description || data.name + ' Page'}
 */
${this.generatePageComponent(data)}

export default ${data.name}Page;
`.trim());

    // List page template
    this.registerTemplate('list', (data) => `
${this.generatePageImports(data)}
import { use${data.resourceName || data.name}List${data.useInfinite ? ', use' + (data.resourceName || data.name) + 'Infinite' : ''} } from '${data.apiHooksPath || '../hooks/api/use' + (data.resourceName || data.name)}';
${data.useDelete ? `import { use${data.resourceName || data.name}Delete } from '${data.apiHooksPath || '../hooks/api/use' + (data.resourceName || data.name)}';` : ''}

${this.generatePageTypes(data)}

/**
 * ${data.description || data.name + ' List Page'}
 */
export default function ${data.name}Page() {
  ${this.generateListState(data)}

  const { data: response, isLoading, error${data.useInfinite ? ', fetchNextPage, hasNextPage, isFetchingNextPage' : ''} } = use${data.resourceName || data.name}${data.useInfinite ? 'Infinite' : 'List'}(${data.defaultFilters ? JSON.stringify(data.defaultFilters) : ''});
  ${data.useDelete ? `const { mutate: deleteItem, isPending: isDeleting } = use${data.resourceName || data.name}Delete();` : ''}

  ${this.generateListHandlers(data)}

  if (isLoading) {
    return (
      <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
        <div className="flex justify-center items-center min-h-[200px]">
          <${data.loadingComponent || 'div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"'} />
        </div>
      </${data.layoutComponent || 'div'}>
    );
  }

  if (error) {
    return (
      <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
        <div className="text-red-500">Error: {error.message}</div>
      </${data.layoutComponent || 'div'}>
    );
  }

  const items = ${data.useInfinite ? 'response?.pages.flatMap(page => page.data) || []' : 'response?.data || []'};

  return (
    <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
      ${this.generateListHeader(data)}

      ${this.generateListContent(data)}

      ${data.useInfinite ? this.generateInfiniteScrollButton(data) : this.generatePagination(data)}
    </${data.layoutComponent || 'div'}>
  );
}
`.trim());

    // Detail page template
    this.registerTemplate('detail', (data) => `
${this.generatePageImports(data)}
import { useParams${this.framework === FRAMEWORK.NEXTJS ? '' : ', useNavigate'} } from '${this.framework === FRAMEWORK.NEXTJS ? 'next/navigation' : 'react-router-dom'}';
import { use${data.resourceName || data.name} } from '${data.apiHooksPath || '../hooks/api/use' + (data.resourceName || data.name)}';
${data.useDelete ? `import { use${data.resourceName || data.name}Delete } from '${data.apiHooksPath || '../hooks/api/use' + (data.resourceName || data.name)}';` : ''}

${this.generatePageTypes(data)}

/**
 * ${data.description || data.name + ' Detail Page'}
 */
export default function ${data.name}Page() {
  const { ${data.paramName || 'id'} } = useParams${this.useTypeScript ? '<{ ' + (data.paramName || 'id') + ': string }>' : ''}();
  ${this.framework !== FRAMEWORK.NEXTJS ? 'const navigate = useNavigate();' : `const router = useRouter();`}

  const { data: item, isLoading, error } = use${data.resourceName || data.name}(${data.paramName || 'id'});
  ${data.useDelete ? `const { mutate: deleteItem, isPending: isDeleting } = use${data.resourceName || data.name}Delete();` : ''}

  ${this.generateDetailHandlers(data)}

  if (isLoading) {
    return (
      <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
        <div className="flex justify-center items-center min-h-[200px]">
          <${data.loadingComponent || 'div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"'} />
        </div>
      </${data.layoutComponent || 'div'}>
    );
  }

  if (error || !item) {
    return (
      <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
        <div className="text-red-500">
          {error ? \`Error: \${error.message}\` : '${data.resourceName || data.name} not found'}
        </div>
      </${data.layoutComponent || 'div'}>
    );
  }

  return (
    <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
      ${this.generateDetailHeader(data)}

      ${this.generateDetailContent(data)}

      ${data.useDelete ? this.generateDeleteButton(data) : ''}
    </${data.layoutComponent || 'div'}>
  );
}
`.trim());

    // Form page template
    this.registerTemplate('form', (data) => `
${this.generatePageImports(data)}
${data.isEdit ? `import { useParams${this.framework === FRAMEWORK.NEXTJS ? '' : ', useNavigate'} } from '${this.framework === FRAMEWORK.NEXTJS ? 'next/navigation' : 'react-router-dom'}';
import { use${data.resourceName || data.name} } from '${data.apiHooksPath || '../hooks/api/use' + (data.resourceName || data.name)}';` : ''}
import { use${data.resourceName || data.name}${data.isEdit ? 'Update' : 'Create'} } from '${data.apiHooksPath || '../hooks/api/use' + (data.resourceName || data.name)}';
import { ${data.formComponent || (data.resourceName || data.name) + 'Form'} } from '${data.formPath || '../components/forms/' + (data.resourceName || data.name) + 'Form'}';

${this.generatePageTypes(data)}

/**
 * ${data.description || (data.isEdit ? 'Edit' : 'Create') + ' ' + (data.resourceName || data.name) + ' Page'}
 */
export default function ${data.name}Page() {
  ${data.isEdit ? `const { ${data.paramName || 'id'} } = useParams${this.useTypeScript ? '<{ ' + (data.paramName || 'id') + ': string }>' : ''}();` : ''}
  ${this.framework !== FRAMEWORK.NEXTJS ? 'const navigate = useNavigate();' : `const router = useRouter();`}

  ${data.isEdit ? `const { data: item, isLoading, error } = use${data.resourceName || data.name}(${data.paramName || 'id'});` : ''}
  const { mutate: ${data.isEdit ? 'update' : 'create'}${data.resourceName || data.name}, isPending } = use${data.resourceName || data.name}${data.isEdit ? 'Update' : 'Create'}();

  const handleSubmit = async (values${this.useTypeScript ? `: ${data.resourceName || data.name}FormValues` : ''}) => {
    ${data.isEdit
      ? `await update${data.resourceName || data.name}({ id: ${data.paramName || 'id'}!, data: values });`
      : `await create${data.resourceName || data.name}(values);`}
    ${this.framework !== FRAMEWORK.NEXTJS
      ? `navigate('${data.successRedirect || '/' + this.toKebabCase(data.resourceName || data.name)}');`
      : `router.push('${data.successRedirect || '/' + this.toKebabCase(data.resourceName || data.name)}');`}
  };

  ${data.isEdit ? `if (isLoading) {
    return (
      <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
        <div className="flex justify-center items-center min-h-[200px]">
          <${data.loadingComponent || 'div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"'} />
        </div>
      </${data.layoutComponent || 'div'}>
    );
  }

  if (error || !item) {
    return (
      <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
        <div className="text-red-500">
          {error ? \`Error: \${error.message}\` : '${data.resourceName || data.name} not found'}
        </div>
      </${data.layoutComponent || 'div'}>
    );
  }` : ''}

  return (
    <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4 max-w-2xl mx-auto'}">
      <h1 className="text-2xl font-bold mb-6">${data.isEdit ? 'Edit' : 'Create'} ${data.resourceName || data.name}</h1>

      <${data.formComponent || (data.resourceName || data.name) + 'Form'}
        onSubmit={handleSubmit}
        ${data.isEdit ? 'defaultValues={item}' : ''}
        isLoading={isPending}
      />
    </${data.layoutComponent || 'div'}>
  );
}
`.trim());

    // Dashboard page template
    this.registerTemplate('dashboard', (data) => `
${this.generatePageImports(data)}
${(data.widgets || []).map(w => w.import).filter(Boolean).join('\n')}

${this.generatePageTypes(data)}

/**
 * ${data.description || data.name + ' Dashboard'}
 */
export default function ${data.name}Page() {
  return (
    <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
      <h1 className="text-2xl font-bold mb-6">${data.title || data.name}</h1>

      <div className="${data.gridClassName || 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'}">
        ${this.generateDashboardWidgets(data)}
      </div>

      ${data.additionalSections || ''}
    </${data.layoutComponent || 'div'}>
  );
}
`.trim());

    // Auth page template
    this.registerTemplate('auth', (data) => `
${this.generatePageImports(data)}
${data.useForm ? `import { useForm } from 'react-hook-form';` : ''}
${data.useZod ? `import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';` : ''}

${this.generatePageTypes(data)}

${data.useZod ? this.generateAuthSchema(data) : ''}

/**
 * ${data.description || data.name + ' Page'}
 */
export default function ${data.name}Page() {
  ${this.framework !== FRAMEWORK.NEXTJS ? 'const navigate = useNavigate();' : `const router = useRouter();`}
  const [error, setError] = useState${this.useTypeScript ? '<string | null>' : ''}(null);
  const [isLoading, setIsLoading] = useState(false);

  ${data.useForm ? this.generateAuthFormSetup(data) : ''}

  const handleSubmit = async (${data.useForm ? 'data' : 'e'}${this.useTypeScript ? (data.useForm ? `: ${data.name}FormData` : ': React.FormEvent') : ''}) => {
    ${!data.useForm ? 'e.preventDefault();' : ''}
    setError(null);
    setIsLoading(true);

    try {
      ${data.submitHandler || '// Handle authentication'}

      ${this.framework !== FRAMEWORK.NEXTJS
        ? `navigate('${data.successRedirect || '/'}');`
        : `router.push('${data.successRedirect || '/'}');`}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="${data.containerClassName || 'min-h-screen flex items-center justify-center bg-gray-50'}">
      <div className="${data.cardClassName || 'max-w-md w-full p-6 bg-white rounded-lg shadow-md'}">
        <h1 className="text-2xl font-bold text-center mb-6">${data.title || data.name}</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={${data.useForm ? 'handleFormSubmit(handleSubmit)' : 'handleSubmit'}} className="space-y-4">
          ${this.generateAuthFields(data)}

          <button
            type="submit"
            disabled={isLoading}
            className="${data.submitClassName || 'w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'}"
          >
            {isLoading ? '${data.loadingText || 'Loading...'}' : '${data.submitText || 'Submit'}'}
          </button>
        </form>

        ${data.additionalContent || ''}
      </div>
    </div>
  );
}
`.trim());
  }

  /**
   * Generate page imports
   */
  generatePageImports(data) {
    const imports = ["import React from 'react';"];

    if (data.useState) {
      imports[0] = "import React, { useState } from 'react';";
    }

    if (this.framework === FRAMEWORK.NEXTJS) {
      if (data.useRouter) {
        imports.push("import { useRouter } from 'next/navigation';");
      }
      if (data.useSeo) {
        imports.push("import Head from 'next/head';");
      }
    }

    if (data.imports) {
      imports.push(...data.imports);
    }

    return imports.join('\n');
  }

  /**
   * Generate page types
   */
  generatePageTypes(data) {
    if (!this.useTypeScript || !data.props) return '';

    const propTypes = data.props.map(p =>
      `  ${p.name}${p.required ? '' : '?'}: ${p.type || 'any'};`
    ).join('\n');

    return `interface ${data.name}PageProps {
${propTypes}
}`;
  }

  /**
   * Generate page component
   */
  generatePageComponent(data) {
    const props = data.props ? `{ ${data.props.map(p => p.name).join(', ')} }` : '';
    const propsType = this.useTypeScript && data.props ? `: ${data.name}PageProps` : '';

    return `export default function ${data.name}Page(${props}${propsType}) {
  return (
    <${data.layoutComponent || 'div'} className="${data.layoutClassName || 'p-4'}">
      ${data.seo ? this.generateSeoHead(data) : ''}
      <h1 className="text-2xl font-bold mb-4">${data.title || data.name}</h1>
      ${data.content || '{/* Page content */}'}
    </${data.layoutComponent || 'div'}>
  );
}`;
  }

  /**
   * Generate SEO head
   */
  generateSeoHead(data) {
    if (this.framework !== FRAMEWORK.NEXTJS) return '';

    return `<Head>
        <title>${data.seo?.title || data.title || data.name}</title>
        ${data.seo?.description ? `<meta name="description" content="${data.seo.description}" />` : ''}
      </Head>`;
  }

  /**
   * Generate list state
   */
  generateListState(data) {
    const states = [];

    if (data.useSearch) {
      states.push(`const [search, setSearch] = useState('');`);
    }

    if (data.useFilters) {
      states.push(`const [filters, setFilters] = useState${this.useTypeScript ? '<Record<string, any>>' : ''}({});`);
    }

    if (!data.useInfinite && data.usePagination !== false) {
      states.push(`const [page, setPage] = useState(1);`);
    }

    return states.join('\n  ');
  }

  /**
   * Generate list handlers
   */
  generateListHandlers(data) {
    const handlers = [];

    if (data.useDelete) {
      handlers.push(`const handleDelete = async (id${this.useTypeScript ? ': string | number' : ''}) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id);
    }
  };`);
    }

    return handlers.join('\n\n  ');
  }

  /**
   * Generate list header
   */
  generateListHeader(data) {
    return `<div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">${data.title || this.toPlural(data.name)}</h1>
        ${data.createButton !== false ? `<a
          href="${data.createRoute || '/' + this.toKebabCase(data.name) + '/new'}"
          className="${data.createButtonClassName || 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'}"
        >
          ${data.createButtonText || 'Create New'}
        </a>` : ''}
      </div>

      ${data.useSearch ? `<div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>` : ''}`;
  }

  /**
   * Generate list content
   */
  generateListContent(data) {
    if (data.listComponent) {
      return `<${data.listComponent} items={items} onDelete={${data.useDelete ? 'handleDelete' : 'undefined'}} />`;
    }

    return `<div className="${data.listClassName || 'space-y-4'}">
        {items.length === 0 ? (
          <p className="text-gray-500">${data.emptyMessage || 'No items found'}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="${data.itemClassName || 'p-4 border rounded'}">
              ${data.itemContent || '{/* Item content */}'}
              ${data.useDelete ? `<button
                onClick={() => handleDelete(item.id)}
                disabled={isDeleting}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>` : ''}
            </div>
          ))
        )}
      </div>`;
  }

  /**
   * Generate infinite scroll button
   */
  generateInfiniteScrollButton(data) {
    return `{hasNextPage && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="${data.loadMoreClassName || 'px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50'}"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}`;
  }

  /**
   * Generate pagination
   */
  generatePagination(data) {
    if (data.usePagination === false) return '';

    return `{response?.pagination && response.pagination.pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {page} of {response.pagination.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(response.pagination!.pages, p + 1))}
            disabled={page === response.pagination.pages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}`;
  }

  /**
   * Generate detail header
   */
  generateDetailHeader(data) {
    return `<div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">${data.title || `${data.resourceName || data.name} Details`}</h1>
        ${data.editButton !== false ? `<a
          href={\`${data.editRoute || '/' + this.toKebabCase(data.resourceName || data.name)}/\${${data.paramName || 'id'}}/edit'}\`}
          className="${data.editButtonClassName || 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'}"
        >
          ${data.editButtonText || 'Edit'}
        </a>` : ''}
      </div>`;
  }

  /**
   * Generate detail content
   */
  generateDetailContent(data) {
    if (data.detailComponent) {
      return `<${data.detailComponent} item={item} />`;
    }

    return `<div className="${data.detailClassName || 'space-y-4'}">
        ${data.detailContent || '{/* Detail content */}'}
      </div>`;
  }

  /**
   * Generate detail handlers
   */
  generateDetailHandlers(data) {
    const handlers = [];

    if (data.useDelete) {
      handlers.push(`const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(${data.paramName || 'id'}!);
      ${this.framework !== FRAMEWORK.NEXTJS
        ? `navigate('${data.deleteRedirect || '/' + this.toKebabCase(data.resourceName || data.name)}');`
        : `router.push('${data.deleteRedirect || '/' + this.toKebabCase(data.resourceName || data.name)}');`}
    }
  };`);
    }

    return handlers.join('\n\n  ');
  }

  /**
   * Generate delete button
   */
  generateDeleteButton(data) {
    return `<div className="mt-6">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="${data.deleteButtonClassName || 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50'}"
        >
          {isDeleting ? 'Deleting...' : '${data.deleteButtonText || 'Delete'}'}
        </button>
      </div>`;
  }

  /**
   * Generate dashboard widgets
   */
  generateDashboardWidgets(data) {
    if (!data.widgets || data.widgets.length === 0) {
      return '{/* Dashboard widgets */}';
    }

    return data.widgets.map(widget => {
      if (widget.component) {
        return `<${widget.component} ${widget.props || ''} />`;
      }

      return `<div className="${widget.className || 'p-4 bg-white rounded-lg shadow'}">
          <h3 className="text-lg font-semibold">${widget.title || 'Widget'}</h3>
          ${widget.content || '{/* Widget content */}'}
        </div>`;
    }).join('\n        ');
  }

  /**
   * Generate auth schema
   */
  generateAuthSchema(data) {
    const fields = data.fields || [
      { name: 'email', type: 'email' },
      { name: 'password', type: 'password' }
    ];

    const schemaFields = fields.map(f => {
      if (f.type === 'email') {
        return `  ${f.name}: z.string().email('Invalid email'),`;
      }
      if (f.type === 'password') {
        return `  ${f.name}: z.string().min(${f.minLength || 8}, 'Password must be at least ${f.minLength || 8} characters'),`;
      }
      return `  ${f.name}: z.string()${f.required ? '' : '.optional()'},`;
    }).join('\n');

    return `const ${this.toCamelCase(data.name)}Schema = z.object({
${schemaFields}
});

type ${data.name}FormData = z.infer<typeof ${this.toCamelCase(data.name)}Schema>;`;
  }

  /**
   * Generate auth form setup
   */
  generateAuthFormSetup(data) {
    return `const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
  } = useForm${this.useTypeScript ? `<${data.name}FormData>` : ''}({
    ${data.useZod ? `resolver: zodResolver(${this.toCamelCase(data.name)}Schema),` : ''}
  });`;
  }

  /**
   * Generate auth fields
   */
  generateAuthFields(data) {
    const fields = data.fields || [
      { name: 'email', type: 'email', label: 'Email' },
      { name: 'password', type: 'password', label: 'Password' }
    ];

    return fields.map(f => {
      const registerProps = data.useForm ? `{...register('${f.name}')}` : `name="${f.name}"`;

      return `<div>
            <label className="block text-sm font-medium mb-1">${f.label || f.name}</label>
            <input
              type="${f.type || 'text'}"
              ${registerProps}
              className="${f.className || 'w-full p-2 border rounded'}"
              placeholder="${f.placeholder || ''}"
            />
            ${data.useForm ? `{errors.${f.name} && <p className="text-red-500 text-sm mt-1">{errors.${f.name}?.message}</p>}` : ''}
          </div>`;
    }).join('\n          ');
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
      const ext = this.useTypeScript ? '.tsx' : '.jsx';
      let fileName;
      let dir;

      if (this.framework === FRAMEWORK.NEXTJS) {
        fileName = `page${ext}`;
        dir = `app/${spec.route || this.toKebabCase(spec.name)}`;
      } else {
        fileName = `${spec.name}Page${ext}`;
        dir = 'src/pages';
      }

      const outputPath = spec.outputPath || `${dir}/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FRONTEND_PAGE_GENERATED, {
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

  /**
   * Convert to kebab-case
   */
  toKebabCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '-' : '') + p1.toLowerCase();
    });
  }

  /**
   * Convert to plural
   */
  toPlural(str) {
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) {
      return str + 'es';
    }
    return str + 's';
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
