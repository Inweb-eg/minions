/**
 * ApiGenerator - API Integration Code Generation Skill
 *
 * Generates API integration:
 * - React Query hooks
 * - API service classes
 * - Type-safe endpoints
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * API client types
 */
export const API_CLIENT = {
  REACT_QUERY: 'reactQuery',
  SWR: 'swr',
  AXIOS: 'axios',
  FETCH: 'fetch'
};

/**
 * HTTP methods
 */
export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
};

/**
 * ApiGenerator Skill
 */
export class ApiGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ApiGenerator', {
      language: LANGUAGE.TYPESCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript ?? true;
    this.defaultClient = options.apiClient || API_CLIENT.REACT_QUERY;
    this.registerTemplates();
  }

  registerTemplates() {
    // React Query hooks template
    this.registerTemplate('reactQuery', (data) => `
import { useQuery, useMutation, useQueryClient${data.useInfiniteQuery ? ', useInfiniteQuery' : ''} } from '@tanstack/react-query';
import { ${this.toCamelCase(data.name)}Api } from '${data.apiServicePath || '../services/' + this.toKebabCase(data.name) + '.api'}';
${data.imports || ''}

${this.generateQueryTypes(data)}

/**
 * Query keys for ${data.name}
 */
export const ${this.toCamelCase(data.name)}Keys = {
  all: ['${this.toCamelCase(data.name)}'] as const,
  lists: () => [...${this.toCamelCase(data.name)}Keys.all, 'list'] as const,
  list: (filters${this.useTypeScript ? ': Record<string, any>' : ''}) => [...${this.toCamelCase(data.name)}Keys.lists(), filters] as const,
  details: () => [...${this.toCamelCase(data.name)}Keys.all, 'detail'] as const,
  detail: (id${this.useTypeScript ? ': string | number' : ''}) => [...${this.toCamelCase(data.name)}Keys.details(), id] as const,
};

${this.generateReactQueryHooks(data)}

export default {
  ${this.generateReactQueryExports(data)}
};
`.trim());

    // SWR hooks template
    this.registerTemplate('swr', (data) => `
import useSWR, { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
${data.useInfinite ? "import useSWRInfinite from 'swr/infinite';" : ''}
import { ${this.toCamelCase(data.name)}Api } from '${data.apiServicePath || '../services/' + this.toKebabCase(data.name) + '.api'}';
${data.imports || ''}

${this.generateSWRTypes(data)}

${this.generateSWRHooks(data)}

export default {
  ${this.generateSWRExports(data)}
};
`.trim());

    // Axios API service template
    this.registerTemplate('axios', (data) => `
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
${data.imports || ''}

${this.generateApiServiceTypes(data)}

/**
 * ${data.name} API Service
 */
class ${data.name}Api {
  private client: AxiosInstance;
  private basePath = '${data.basePath || '/' + this.toKebabCase(data.name)}';

  constructor(baseURL${this.useTypeScript ? ': string' : ''} = '${data.baseUrl || process.env.NEXT_PUBLIC_API_URL || '/api'}') {
    this.client = axios.create({
      baseURL,
      timeout: ${data.timeout || 30000},
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        ${data.authToken ? `const token = ${data.getToken || "localStorage.getItem('token')"};
        if (token) {
          config.headers.Authorization = \`Bearer \${token}\`;
        }` : ''}
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        ${data.handleUnauthorized ? `if (error.response?.status === 401) {
          // Handle unauthorized
          ${data.onUnauthorized || "window.location.href = '/login';"}
        }` : ''}
        return Promise.reject(error.response?.data || error);
      }
    );
  }

${this.generateAxiosMethods(data)}
}

export const ${this.toCamelCase(data.name)}Api = new ${data.name}Api();
export default ${data.name}Api;
`.trim());

    // Fetch API service template
    this.registerTemplate('fetch', (data) => `
${data.imports || ''}

${this.generateApiServiceTypes(data)}

/**
 * ${data.name} API Service
 */
class ${data.name}Api {
  private baseUrl = '${data.baseUrl || process.env.NEXT_PUBLIC_API_URL || '/api'}';
  private basePath = '${data.basePath || '/' + this.toKebabCase(data.name)}';

  private async request${this.useTypeScript ? '<T>' : ''}(
    endpoint${this.useTypeScript ? ': string' : ''},
    options${this.useTypeScript ? ': RequestInit = {}' : ' = {}'}
  )${this.useTypeScript ? ': Promise<T>' : ''} {
    const url = \`\${this.baseUrl}\${endpoint}\`;

    const headers${this.useTypeScript ? ': HeadersInit' : ''} = {
      'Content-Type': 'application/json',
      ${data.authToken ? `...${data.getToken || "localStorage.getItem('token')"} && {
        Authorization: \`Bearer \${${data.getToken || "localStorage.getItem('token')"}}\`,
      },` : ''}
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      ${data.handleUnauthorized ? `if (response.status === 401) {
        ${data.onUnauthorized || "window.location.href = '/login';"}
      }` : ''}
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

${this.generateFetchMethods(data)}
}

export const ${this.toCamelCase(data.name)}Api = new ${data.name}Api();
export default ${data.name}Api;
`.trim());
  }

  /**
   * Generate query types
   */
  generateQueryTypes(data) {
    if (!this.useTypeScript) return '';

    const responseType = data.responseType || `${data.name}`;
    const listResponseType = data.listResponseType || `${data.name}[]`;

    return `// Types
export interface ${data.name} {
  ${(data.fields || [{ name: 'id', type: 'string' }]).map(f => `${f.name}: ${f.type || 'any'};`).join('\n  ')}
}

export interface ${data.name}ListParams {
  page?: number;
  limit?: number;
  sort?: string;
  ${(data.filterParams || []).map(p => `${p.name}?: ${p.type || 'string'};`).join('\n  ')}
}

export interface ${data.name}ListResponse {
  data: ${listResponseType};
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ${data.name}CreateInput {
  ${(data.createFields || data.fields || []).filter(f => f.name !== 'id').map(f => `${f.name}${f.required ? '' : '?'}: ${f.type || 'any'};`).join('\n  ')}
}

export interface ${data.name}UpdateInput {
  ${(data.updateFields || data.fields || []).filter(f => f.name !== 'id').map(f => `${f.name}?: ${f.type || 'any'};`).join('\n  ')}
}`;
  }

  /**
   * Generate React Query hooks
   */
  generateReactQueryHooks(data) {
    const hooks = [];

    // List query
    hooks.push(`/**
 * Fetch ${data.name} list
 */
export function use${data.name}List(params${this.useTypeScript ? `?: ${data.name}ListParams` : ''} = {}) {
  return useQuery({
    queryKey: ${this.toCamelCase(data.name)}Keys.list(params),
    queryFn: () => ${this.toCamelCase(data.name)}Api.getAll(params),
    ${data.staleTime ? `staleTime: ${data.staleTime},` : ''}
    ${data.listOptions || ''}
  });
}`);

    // Detail query
    hooks.push(`/**
 * Fetch ${data.name} by ID
 */
export function use${data.name}(id${this.useTypeScript ? ': string | number | undefined' : ''}, options${this.useTypeScript ? '?: { enabled?: boolean }' : ''} = {}) {
  return useQuery({
    queryKey: ${this.toCamelCase(data.name)}Keys.detail(id!),
    queryFn: () => ${this.toCamelCase(data.name)}Api.getById(id!),
    enabled: !!id && (options.enabled !== false),
    ${data.detailOptions || ''}
  });
}`);

    // Create mutation
    hooks.push(`/**
 * Create ${data.name}
 */
export function use${data.name}Create() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data${this.useTypeScript ? `: ${data.name}CreateInput` : ''}) => ${this.toCamelCase(data.name)}Api.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${this.toCamelCase(data.name)}Keys.lists() });
    },
    ${data.createOptions || ''}
  });
}`);

    // Update mutation
    hooks.push(`/**
 * Update ${data.name}
 */
export function use${data.name}Update() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }${this.useTypeScript ? `: { id: string | number; data: ${data.name}UpdateInput }` : ''}) =>
      ${this.toCamelCase(data.name)}Api.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ${this.toCamelCase(data.name)}Keys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ${this.toCamelCase(data.name)}Keys.lists() });
    },
    ${data.updateOptions || ''}
  });
}`);

    // Delete mutation
    hooks.push(`/**
 * Delete ${data.name}
 */
export function use${data.name}Delete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id${this.useTypeScript ? ': string | number' : ''}) => ${this.toCamelCase(data.name)}Api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${this.toCamelCase(data.name)}Keys.lists() });
    },
    ${data.deleteOptions || ''}
  });
}`);

    // Infinite query
    if (data.useInfiniteQuery) {
      hooks.push(`/**
 * Fetch ${data.name} list with infinite scroll
 */
export function use${data.name}Infinite(params${this.useTypeScript ? `?: Omit<${data.name}ListParams, 'page'>` : ''} = {}) {
  return useInfiniteQuery({
    queryKey: [...${this.toCamelCase(data.name)}Keys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 1 }) => ${this.toCamelCase(data.name)}Api.getAll({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination && lastPage.pagination.page < lastPage.pagination.pages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
  });
}`);
    }

    return hooks.join('\n\n');
  }

  /**
   * Generate React Query exports
   */
  generateReactQueryExports(data) {
    const exports = [
      `use${data.name}List`,
      `use${data.name}`,
      `use${data.name}Create`,
      `use${data.name}Update`,
      `use${data.name}Delete`,
      `${this.toCamelCase(data.name)}Keys`
    ];

    if (data.useInfiniteQuery) {
      exports.push(`use${data.name}Infinite`);
    }

    return exports.join(',\n  ');
  }

  /**
   * Generate SWR types
   */
  generateSWRTypes(data) {
    return this.generateQueryTypes(data);
  }

  /**
   * Generate SWR hooks
   */
  generateSWRHooks(data) {
    const hooks = [];

    // List hook
    hooks.push(`/**
 * Fetch ${data.name} list
 */
export function use${data.name}List(params${this.useTypeScript ? `?: ${data.name}ListParams` : ''} = {}) {
  const key = params ? ['${this.toCamelCase(data.name)}-list', params] : '${this.toCamelCase(data.name)}-list';

  return useSWR(key, () => ${this.toCamelCase(data.name)}Api.getAll(params));
}`);

    // Detail hook
    hooks.push(`/**
 * Fetch ${data.name} by ID
 */
export function use${data.name}(id${this.useTypeScript ? '?: string | number' : ''}) {
  return useSWR(
    id ? ['${this.toCamelCase(data.name)}', id] : null,
    () => ${this.toCamelCase(data.name)}Api.getById(id!)
  );
}`);

    // Create mutation
    hooks.push(`/**
 * Create ${data.name} mutation
 */
export function use${data.name}Create() {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    '${this.toCamelCase(data.name)}-create',
    (_, { arg }${this.useTypeScript ? `: { arg: ${data.name}CreateInput }` : ''}) => ${this.toCamelCase(data.name)}Api.create(arg),
    {
      onSuccess: () => {
        mutate((key) => Array.isArray(key) && key[0] === '${this.toCamelCase(data.name)}-list');
      },
    }
  );
}`);

    // Update mutation
    hooks.push(`/**
 * Update ${data.name} mutation
 */
export function use${data.name}Update() {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    '${this.toCamelCase(data.name)}-update',
    (_, { arg }${this.useTypeScript ? `: { arg: { id: string | number; data: ${data.name}UpdateInput } }` : ''}) =>
      ${this.toCamelCase(data.name)}Api.update(arg.id, arg.data),
    {
      onSuccess: (_, { arg }) => {
        mutate(['${this.toCamelCase(data.name)}', arg.id]);
        mutate((key) => Array.isArray(key) && key[0] === '${this.toCamelCase(data.name)}-list');
      },
    }
  );
}`);

    // Delete mutation
    hooks.push(`/**
 * Delete ${data.name} mutation
 */
export function use${data.name}Delete() {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    '${this.toCamelCase(data.name)}-delete',
    (_, { arg }${this.useTypeScript ? `: { arg: string | number }` : ''}) => ${this.toCamelCase(data.name)}Api.delete(arg),
    {
      onSuccess: () => {
        mutate((key) => Array.isArray(key) && key[0] === '${this.toCamelCase(data.name)}-list');
      },
    }
  );
}`);

    return hooks.join('\n\n');
  }

  /**
   * Generate SWR exports
   */
  generateSWRExports(data) {
    return [
      `use${data.name}List`,
      `use${data.name}`,
      `use${data.name}Create`,
      `use${data.name}Update`,
      `use${data.name}Delete`
    ].join(',\n  ');
  }

  /**
   * Generate API service types
   */
  generateApiServiceTypes(data) {
    return this.generateQueryTypes(data);
  }

  /**
   * Generate Axios methods
   */
  generateAxiosMethods(data) {
    return `  /**
   * Get all ${this.toPlural(data.name).toLowerCase()}
   */
  async getAll(params${this.useTypeScript ? `?: ${data.name}ListParams` : ''})${this.useTypeScript ? `: Promise<${data.name}ListResponse>` : ''} {
    return this.client.get(this.basePath, { params });
  }

  /**
   * Get ${data.name.toLowerCase()} by ID
   */
  async getById(id${this.useTypeScript ? ': string | number' : ''})${this.useTypeScript ? `: Promise<${data.name}>` : ''} {
    return this.client.get(\`\${this.basePath}/\${id}\`);
  }

  /**
   * Create ${data.name.toLowerCase()}
   */
  async create(data${this.useTypeScript ? `: ${data.name}CreateInput` : ''})${this.useTypeScript ? `: Promise<${data.name}>` : ''} {
    return this.client.post(this.basePath, data);
  }

  /**
   * Update ${data.name.toLowerCase()}
   */
  async update(id${this.useTypeScript ? ': string | number' : ''}, data${this.useTypeScript ? `: ${data.name}UpdateInput` : ''})${this.useTypeScript ? `: Promise<${data.name}>` : ''} {
    return this.client.${data.updateMethod || 'put'}(\`\${this.basePath}/\${id}\`, data);
  }

  /**
   * Delete ${data.name.toLowerCase()}
   */
  async delete(id${this.useTypeScript ? ': string | number' : ''})${this.useTypeScript ? ': Promise<void>' : ''} {
    return this.client.delete(\`\${this.basePath}/\${id}\`);
  }

${(data.customEndpoints || []).map(e => this.generateCustomAxiosMethod(e)).join('\n\n')}`;
  }

  /**
   * Generate custom Axios method
   */
  generateCustomAxiosMethod(endpoint) {
    const method = endpoint.method?.toLowerCase() || 'get';
    const params = endpoint.params || '';
    const returnType = this.useTypeScript && endpoint.returnType ? `: Promise<${endpoint.returnType}>` : '';

    return `  /**
   * ${endpoint.description || endpoint.name}
   */
  async ${endpoint.name}(${params})${returnType} {
    ${endpoint.body || `return this.client.${method}(\`\${this.basePath}${endpoint.path || ''}\`);`}
  }`;
  }

  /**
   * Generate Fetch methods
   */
  generateFetchMethods(data) {
    return `  /**
   * Get all ${this.toPlural(data.name).toLowerCase()}
   */
  async getAll(params${this.useTypeScript ? `?: ${data.name}ListParams` : ''})${this.useTypeScript ? `: Promise<${data.name}ListResponse>` : ''} {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(\`\${this.basePath}\${query}\`);
  }

  /**
   * Get ${data.name.toLowerCase()} by ID
   */
  async getById(id${this.useTypeScript ? ': string | number' : ''})${this.useTypeScript ? `: Promise<${data.name}>` : ''} {
    return this.request(\`\${this.basePath}/\${id}\`);
  }

  /**
   * Create ${data.name.toLowerCase()}
   */
  async create(data${this.useTypeScript ? `: ${data.name}CreateInput` : ''})${this.useTypeScript ? `: Promise<${data.name}>` : ''} {
    return this.request(this.basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update ${data.name.toLowerCase()}
   */
  async update(id${this.useTypeScript ? ': string | number' : ''}, data${this.useTypeScript ? `: ${data.name}UpdateInput` : ''})${this.useTypeScript ? `: Promise<${data.name}>` : ''} {
    return this.request(\`\${this.basePath}/\${id}\`, {
      method: '${data.updateMethod || 'PUT'}',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete ${data.name.toLowerCase()}
   */
  async delete(id${this.useTypeScript ? ': string | number' : ''})${this.useTypeScript ? ': Promise<void>' : ''} {
    return this.request(\`\${this.basePath}/\${id}\`, {
      method: 'DELETE',
    });
  }`;
  }

  /**
   * Generate API
   * @param {Object} spec - API specification
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
          type: { type: 'string', enum: Object.values(API_CLIENT) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || this.defaultClient;

      // Build output path
      const ext = this.useTypeScript ? '.ts' : '.js';
      let fileName;
      let dir;

      if (templateName === API_CLIENT.REACT_QUERY || templateName === API_CLIENT.SWR) {
        fileName = `use${spec.name}${ext}`;
        dir = 'src/hooks/api';
      } else {
        fileName = `${this.toKebabCase(spec.name)}.api${ext}`;
        dir = 'src/services';
      }

      const outputPath = spec.outputPath || `${dir}/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FRONTEND_API_GENERATED, {
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

export function getApiGenerator(options = {}) {
  if (!instance) {
    instance = new ApiGenerator(options);
  }
  return instance;
}

export default ApiGenerator;
