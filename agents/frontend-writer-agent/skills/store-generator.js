/**
 * StoreGenerator - State Management Code Generation Skill
 *
 * Generates state management:
 * - React Context (default)
 * - Zustand stores
 * - Redux slices
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * State management types
 */
export const STORE_TYPE = {
  CONTEXT: 'context',
  ZUSTAND: 'zustand',
  REDUX: 'redux'
};

/**
 * StoreGenerator Skill
 */
export class StoreGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('StoreGenerator', {
      language: LANGUAGE.TYPESCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript ?? true;
    this.defaultStoreType = options.storeType || STORE_TYPE.CONTEXT;
    this.registerTemplates();
  }

  registerTemplates() {
    // React Context template
    this.registerTemplate('context', (data) => `
import React, { createContext, useContext, useReducer, useCallback${data.useMemo ? ', useMemo' : ''} } from 'react';

${this.generateContextTypes(data)}

${this.generateInitialState(data)}

${this.generateReducer(data)}

const ${data.name}Context = createContext${this.useTypeScript ? `<${data.name}ContextValue | undefined>` : ''}(undefined);

/**
 * ${data.name} Provider
 */
export const ${data.name}Provider${this.useTypeScript ? `: React.FC<{ children: React.ReactNode }>` : ''} = ({ children }) => {
  const [state, dispatch] = useReducer(${this.toCamelCase(data.name)}Reducer, initialState);

  ${this.generateContextActions(data)}

  const value${this.useTypeScript ? `: ${data.name}ContextValue` : ''} = ${data.useMemo ? 'useMemo(() => ({' : '{'}
    ...state,
    ${this.generateContextValueActions(data)}
  }${data.useMemo ? `), [state${data.actionDeps ? ', ' + data.actionDeps.join(', ') : ''}])` : ''};

  return (
    <${data.name}Context.Provider value={value}>
      {children}
    </${data.name}Context.Provider>
  );
};

/**
 * use${data.name} hook
 */
export function use${data.name}()${this.useTypeScript ? `: ${data.name}ContextValue` : ''} {
  const context = useContext(${data.name}Context);

  if (context === undefined) {
    throw new Error('use${data.name} must be used within a ${data.name}Provider');
  }

  return context;
}

export default ${data.name}Provider;
`.trim());

    // Zustand store template
    this.registerTemplate('zustand', (data) => `
import { create } from 'zustand';
${data.persist ? "import { persist } from 'zustand/middleware';" : ''}
${data.devtools ? "import { devtools } from 'zustand/middleware';" : ''}
${data.immer ? "import { immer } from 'zustand/middleware/immer';" : ''}

${this.generateZustandTypes(data)}

${this.generateZustandStore(data)}

export default use${data.name}Store;
`.trim());

    // Redux slice template
    this.registerTemplate('redux', (data) => `
import { createSlice${data.asyncThunks ? ', createAsyncThunk' : ''}, PayloadAction } from '@reduxjs/toolkit';

${this.generateReduxTypes(data)}

${this.generateReduxInitialState(data)}

${data.asyncThunks ? this.generateAsyncThunks(data) : ''}

const ${this.toCamelCase(data.name)}Slice = createSlice({
  name: '${this.toCamelCase(data.name)}',
  initialState,
  reducers: {
${this.generateReduxReducers(data)}
  },
  ${data.asyncThunks ? `extraReducers: (builder) => {
${this.generateExtraReducers(data)}
  },` : ''}
});

export const {
  ${this.generateReduxActionExports(data)}
} = ${this.toCamelCase(data.name)}Slice.actions;

${data.asyncThunks ? `export { ${data.asyncThunks.map(t => t.name).join(', ')} };` : ''}

// Selectors
${this.generateSelectors(data)}

export default ${this.toCamelCase(data.name)}Slice.reducer;
`.trim());

    // Context with Provider pattern (simpler)
    this.registerTemplate('simpleContext', (data) => `
import React, { createContext, useContext, useState, useCallback } from 'react';

${this.generateSimpleContextTypes(data)}

const ${data.name}Context = createContext${this.useTypeScript ? `<${data.name}ContextValue | undefined>` : ''}(undefined);

/**
 * ${data.name} Provider
 */
export const ${data.name}Provider${this.useTypeScript ? `: React.FC<{ children: React.ReactNode }>` : ''} = ({ children }) => {
${this.generateSimpleState(data)}

${this.generateSimpleActions(data)}

  const value${this.useTypeScript ? `: ${data.name}ContextValue` : ''} = {
${this.generateSimpleValueProps(data)}
  };

  return (
    <${data.name}Context.Provider value={value}>
      {children}
    </${data.name}Context.Provider>
  );
};

/**
 * use${data.name} hook
 */
export function use${data.name}()${this.useTypeScript ? `: ${data.name}ContextValue` : ''} {
  const context = useContext(${data.name}Context);

  if (context === undefined) {
    throw new Error('use${data.name} must be used within a ${data.name}Provider');
  }

  return context;
}

export default ${data.name}Provider;
`.trim());
  }

  /**
   * Generate Context types
   */
  generateContextTypes(data) {
    if (!this.useTypeScript) return '';

    const stateProps = (data.state || []).map(s =>
      `  ${s.name}: ${s.type || 'any'};`
    ).join('\n');

    const actionTypes = (data.actions || []).map(a =>
      `  ${a.name}: ${a.type || '() => void'};`
    ).join('\n');

    return `// State type
export interface ${data.name}State {
${stateProps || '  // Add state properties'}
}

// Action types
type ${data.name}Action =
${(data.reducerActions || []).map(a =>
  `  | { type: '${a.type}'; payload${a.payloadOptional ? '?' : ''}: ${a.payloadType || 'any'} }`
).join('\n') || "  | { type: 'INIT' }"};

// Context value type
export interface ${data.name}ContextValue extends ${data.name}State {
${actionTypes || '  // Add action methods'}
}`;
  }

  /**
   * Generate initial state
   */
  generateInitialState(data) {
    const stateObj = (data.state || []).reduce((acc, s) => {
      acc[s.name] = s.initial !== undefined ? s.initial : null;
      return acc;
    }, {});

    return `const initialState${this.useTypeScript ? `: ${data.name}State` : ''} = ${JSON.stringify(stateObj, null, 2)};`;
  }

  /**
   * Generate reducer
   */
  generateReducer(data) {
    const cases = (data.reducerActions || []).map(a => {
      return `    case '${a.type}':
      return { ...state, ${a.stateUpdate || '...'} };`;
    }).join('\n');

    return `function ${this.toCamelCase(data.name)}Reducer(
  state${this.useTypeScript ? `: ${data.name}State` : ''},
  action${this.useTypeScript ? `: ${data.name}Action` : ''}
)${this.useTypeScript ? `: ${data.name}State` : ''} {
  switch (action.type) {
${cases || "    case 'INIT':\n      return state;"}
    default:
      return state;
  }
}`;
  }

  /**
   * Generate context actions
   */
  generateContextActions(data) {
    return (data.actions || []).map(action => {
      const params = action.params || '';
      return `const ${action.name} = useCallback((${params}) => {
    ${action.body || `dispatch({ type: '${action.dispatchType || action.name.toUpperCase()}', payload: ${action.payload || '{}'} });`}
  }, [${action.deps?.join(', ') || ''}]);`;
    }).join('\n\n  ');
  }

  /**
   * Generate context value actions
   */
  generateContextValueActions(data) {
    return (data.actions || []).map(a => a.name).join(',\n    ');
  }

  /**
   * Generate simple context types
   */
  generateSimpleContextTypes(data) {
    if (!this.useTypeScript) return '';

    const stateProps = (data.state || []).map(s =>
      `  ${s.name}: ${s.type || 'any'};`
    ).join('\n');

    const setterProps = (data.state || []).map(s =>
      `  set${this.capitalize(s.name)}: React.Dispatch<React.SetStateAction<${s.type || 'any'}>>;`
    ).join('\n');

    const actionTypes = (data.actions || []).map(a =>
      `  ${a.name}: ${a.type || '() => void'};`
    ).join('\n');

    return `export interface ${data.name}ContextValue {
${stateProps}
${setterProps}
${actionTypes}
}`;
  }

  /**
   * Generate simple state declarations
   */
  generateSimpleState(data) {
    return (data.state || []).map(s => {
      const type = this.useTypeScript && s.type ? `<${s.type}>` : '';
      const initial = s.initial !== undefined ? JSON.stringify(s.initial) : 'null';
      return `  const [${s.name}, set${this.capitalize(s.name)}] = useState${type}(${initial});`;
    }).join('\n');
  }

  /**
   * Generate simple actions
   */
  generateSimpleActions(data) {
    return (data.actions || []).map(action => {
      const params = action.params || '';
      return `  const ${action.name} = useCallback((${params}) => {
    ${action.body || '// Action implementation'}
  }, [${action.deps?.join(', ') || ''}]);`;
    }).join('\n\n');
  }

  /**
   * Generate simple value props
   */
  generateSimpleValueProps(data) {
    const stateProps = (data.state || []).map(s =>
      `    ${s.name},\n    set${this.capitalize(s.name)},`
    ).join('\n');

    const actionProps = (data.actions || []).map(a =>
      `    ${a.name},`
    ).join('\n');

    return `${stateProps}\n${actionProps}`;
  }

  /**
   * Generate Zustand types
   */
  generateZustandTypes(data) {
    if (!this.useTypeScript) return '';

    const stateProps = (data.state || []).map(s =>
      `  ${s.name}: ${s.type || 'any'};`
    ).join('\n');

    const actionTypes = (data.actions || []).map(a =>
      `  ${a.name}: ${a.type || '() => void'};`
    ).join('\n');

    return `interface ${data.name}State {
${stateProps}
}

interface ${data.name}Actions {
${actionTypes}
}

type ${data.name}Store = ${data.name}State & ${data.name}Actions;`;
  }

  /**
   * Generate Zustand store
   */
  generateZustandStore(data) {
    const middlewares = [];
    if (data.devtools) middlewares.push('devtools');
    if (data.persist) middlewares.push('persist');
    if (data.immer) middlewares.push('immer');

    const stateInit = (data.state || []).map(s => {
      const initial = s.initial !== undefined ? JSON.stringify(s.initial) : 'null';
      return `  ${s.name}: ${initial},`;
    }).join('\n');

    const actions = (data.actions || []).map(a => {
      return `  ${a.name}: (${a.params || ''}) => {
    ${a.zustandBody || `set((state) => ({ ${a.stateUpdate || '...'} }))`}
  },`;
    }).join('\n');

    let storeBody = `(set, get) => ({
${stateInit}
${actions}
})`;

    // Wrap with middlewares
    if (data.persist) {
      storeBody = `persist(
    ${storeBody},
    {
      name: '${data.persistKey || this.toCamelCase(data.name) + '-storage'}',
      ${data.persistPartialize ? `partialize: (state) => ({ ${data.persistPartialize.join(', ')} }),` : ''}
    }
  )`;
    }

    if (data.devtools) {
      storeBody = `devtools(${storeBody}, { name: '${data.name}Store' })`;
    }

    if (data.immer) {
      storeBody = `immer(${storeBody})`;
    }

    return `export const use${data.name}Store = create${this.useTypeScript ? `<${data.name}Store>` : ''}()(
  ${storeBody}
);`;
  }

  /**
   * Generate Redux types
   */
  generateReduxTypes(data) {
    if (!this.useTypeScript) return '';

    const stateProps = (data.state || []).map(s =>
      `  ${s.name}: ${s.type || 'any'};`
    ).join('\n');

    return `export interface ${data.name}State {
${stateProps}
}`;
  }

  /**
   * Generate Redux initial state
   */
  generateReduxInitialState(data) {
    const stateObj = (data.state || []).reduce((acc, s) => {
      acc[s.name] = s.initial !== undefined ? s.initial : null;
      return acc;
    }, {});

    return `const initialState${this.useTypeScript ? `: ${data.name}State` : ''} = ${JSON.stringify(stateObj, null, 2)};`;
  }

  /**
   * Generate Redux reducers
   */
  generateReduxReducers(data) {
    return (data.reducers || []).map(r => {
      const payloadType = this.useTypeScript && r.payloadType
        ? `action: PayloadAction<${r.payloadType}>`
        : 'action';

      return `    ${r.name}: (state, ${payloadType}) => {
      ${r.body || '// Reducer logic'}
    },`;
    }).join('\n');
  }

  /**
   * Generate async thunks
   */
  generateAsyncThunks(data) {
    return (data.asyncThunks || []).map(thunk => {
      const returnType = this.useTypeScript && thunk.returnType
        ? `<${thunk.returnType}>`
        : '';
      const argType = this.useTypeScript && thunk.argType
        ? `, ${thunk.argType}`
        : '';

      return `export const ${thunk.name} = createAsyncThunk${returnType}${argType}(
  '${this.toCamelCase(data.name)}/${thunk.name}',
  async (${thunk.arg || 'arg'}, { rejectWithValue }) => {
    try {
      ${thunk.body || '// Async logic here\n      return {};'}
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);`;
    }).join('\n\n');
  }

  /**
   * Generate extra reducers for async thunks
   */
  generateExtraReducers(data) {
    return (data.asyncThunks || []).map(thunk => {
      return `    builder
      .addCase(${thunk.name}.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(${thunk.name}.fulfilled, (state, action) => {
        state.loading = false;
        ${thunk.fulfilledUpdate || '// Update state with action.payload'}
      })
      .addCase(${thunk.name}.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });`;
    }).join('\n');
  }

  /**
   * Generate Redux action exports
   */
  generateReduxActionExports(data) {
    return (data.reducers || []).map(r => r.name).join(',\n  ');
  }

  /**
   * Generate selectors
   */
  generateSelectors(data) {
    const rootSelector = this.useTypeScript
      ? `export const select${data.name} = (state: { ${this.toCamelCase(data.name)}: ${data.name}State }) => state.${this.toCamelCase(data.name)};`
      : `export const select${data.name} = (state) => state.${this.toCamelCase(data.name)};`;

    const fieldSelectors = (data.state || []).map(s => {
      if (this.useTypeScript) {
        return `export const select${this.capitalize(s.name)} = (state: { ${this.toCamelCase(data.name)}: ${data.name}State }) => state.${this.toCamelCase(data.name)}.${s.name};`;
      }
      return `export const select${this.capitalize(s.name)} = (state) => state.${this.toCamelCase(data.name)}.${s.name};`;
    }).join('\n');

    return `${rootSelector}\n${fieldSelectors}`;
  }

  /**
   * Generate a store
   * @param {Object} spec - Store specification
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
          type: { type: 'string', enum: Object.values(STORE_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      let templateName = spec.type || this.defaultStoreType;
      if (templateName === STORE_TYPE.CONTEXT && spec.simple) {
        templateName = 'simpleContext';
      }

      // Build output path
      const ext = this.useTypeScript ? '.tsx' : '.jsx';
      let fileName;
      let dir;

      switch (templateName) {
        case 'redux':
          fileName = `${this.toCamelCase(spec.name)}Slice${ext.replace('x', '')}`;
          dir = 'src/store/slices';
          break;
        case 'zustand':
          fileName = `use${spec.name}Store${ext.replace('x', '')}`;
          dir = 'src/store';
          break;
        default:
          fileName = `${spec.name}Context${ext}`;
          dir = 'src/contexts';
      }

      const outputPath = spec.outputPath || `${dir}/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FRONTEND_STORE_GENERATED, {
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
   * Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton getter
let instance = null;

export function getStoreGenerator(options = {}) {
  if (!instance) {
    instance = new StoreGenerator(options);
  }
  return instance;
}

export default StoreGenerator;
