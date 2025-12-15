/**
 * ComponentGenerator - React Component Code Generation Skill
 *
 * Generates React components:
 * - Functional components
 * - TypeScript interfaces
 * - Prop types
 * - Styled components
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Component types
 */
export const COMPONENT_TYPE = {
  FUNCTIONAL: 'functional',
  MEMO: 'memo',
  FORWARD_REF: 'forwardRef',
  CONTEXT_CONSUMER: 'contextConsumer'
};

/**
 * CSS framework types
 */
export const CSS_FRAMEWORK = {
  TAILWIND: 'tailwind',
  STYLED_COMPONENTS: 'styled-components',
  CSS_MODULES: 'css-modules',
  PLAIN_CSS: 'plain-css'
};

/**
 * ComponentGenerator Skill
 */
export class ComponentGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ComponentGenerator', {
      language: LANGUAGE.TYPESCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript ?? true;
    this.cssFramework = options.cssFramework || CSS_FRAMEWORK.TAILWIND;
    this.registerTemplates();
  }

  registerTemplates() {
    // Functional component template
    this.registerTemplate('functional', (data) => `
${this.generateImports(data)}

${this.generateTypeDefinitions(data)}

/**
 * ${data.description || data.name + ' component'}
 */
${data.export !== false ? 'export ' : ''}const ${data.name}${this.useTypeScript ? `: React.FC<${data.name}Props>` : ''} = (${this.generatePropsDestructure(data)}) => {
  ${this.generateState(data)}
  ${this.generateEffects(data)}
  ${this.generateHandlers(data)}

  return (
    ${this.generateJSX(data)}
  );
};

${data.displayName ? `${data.name}.displayName = '${data.displayName || data.name}';` : ''}

${data.export !== false && !data.namedExport ? `export default ${data.name};` : ''}
`.trim());

    // Memo component template
    this.registerTemplate('memo', (data) => `
${this.generateImports(data)}

${this.generateTypeDefinitions(data)}

/**
 * ${data.description || data.name + ' component (memoized)'}
 */
const ${data.name}Component${this.useTypeScript ? `: React.FC<${data.name}Props>` : ''} = (${this.generatePropsDestructure(data)}) => {
  ${this.generateState(data)}
  ${this.generateEffects(data)}
  ${this.generateHandlers(data)}

  return (
    ${this.generateJSX(data)}
  );
};

export const ${data.name} = React.memo(${data.name}Component${data.areEqual ? `, ${data.areEqual}` : ''});

${data.name}.displayName = '${data.displayName || data.name}';

export default ${data.name};
`.trim());

    // ForwardRef component template
    this.registerTemplate('forwardRef', (data) => `
${this.generateImports(data)}

${this.generateTypeDefinitions(data)}

${this.useTypeScript ? `export interface ${data.name}Ref {
  ${data.refMethods ? data.refMethods.map(m => `${m.name}: ${m.type || '() => void'};`).join('\n  ') : '// Add ref methods here'}
}` : ''}

/**
 * ${data.description || data.name + ' component (with ref)'}
 */
export const ${data.name} = React.forwardRef<${data.refType || data.name + 'Ref'}, ${data.name}Props>(
  (${this.generatePropsDestructure(data)}, ref) => {
    ${this.generateState(data)}
    ${this.generateEffects(data)}
    ${this.generateHandlers(data)}

    ${data.useImperativeHandle ? `React.useImperativeHandle(ref, () => ({
      ${data.refMethods ? data.refMethods.map(m => `${m.name}: ${m.implementation || '() => {}'}`).join(',\n      ') : '// Add ref method implementations'}
    }));` : ''}

    return (
      ${this.generateJSX(data)}
    );
  }
);

${data.name}.displayName = '${data.displayName || data.name}';

export default ${data.name};
`.trim());

    // Context consumer component template
    this.registerTemplate('contextConsumer', (data) => `
${this.generateImports(data)}

${this.generateTypeDefinitions(data)}

/**
 * ${data.description || data.name + ' component (with context)'}
 */
export const ${data.name}${this.useTypeScript ? `: React.FC<${data.name}Props>` : ''} = (${this.generatePropsDestructure(data)}) => {
  ${data.contexts ? data.contexts.map(ctx => `const ${ctx.variable || ctx.name.charAt(0).toLowerCase() + ctx.name.slice(1)} = use${ctx.name}();`).join('\n  ') : ''}
  ${this.generateState(data)}
  ${this.generateEffects(data)}
  ${this.generateHandlers(data)}

  return (
    ${this.generateJSX(data)}
  );
};

${data.name}.displayName = '${data.displayName || data.name}';

export default ${data.name};
`.trim());

    // Styled component template (for styled-components)
    this.registerTemplate('styled', (data) => `
import styled from 'styled-components';
${this.generateImports(data)}

${this.generateTypeDefinitions(data)}

${this.generateStyledComponents(data)}

/**
 * ${data.description || data.name + ' component'}
 */
export const ${data.name}${this.useTypeScript ? `: React.FC<${data.name}Props>` : ''} = (${this.generatePropsDestructure(data)}) => {
  ${this.generateState(data)}
  ${this.generateEffects(data)}
  ${this.generateHandlers(data)}

  return (
    ${this.generateStyledJSX(data)}
  );
};

export default ${data.name};
`.trim());
  }

  /**
   * Generate imports
   */
  generateImports(data) {
    const imports = ["import React from 'react';"];

    // React hooks
    const hooks = [];
    if (data.state && data.state.length > 0) hooks.push('useState');
    if (data.effects && data.effects.length > 0) hooks.push('useEffect');
    if (data.callbacks && data.callbacks.length > 0) hooks.push('useCallback');
    if (data.memos && data.memos.length > 0) hooks.push('useMemo');
    if (data.refs && data.refs.length > 0) hooks.push('useRef');
    if (data.useImperativeHandle) hooks.push('useImperativeHandle');

    if (hooks.length > 0) {
      imports[0] = `import React, { ${hooks.join(', ')} } from 'react';`;
    }

    // Context imports
    if (data.contexts) {
      data.contexts.forEach(ctx => {
        imports.push(`import { use${ctx.name} } from '${ctx.path || '../contexts/' + ctx.name}';`);
      });
    }

    // CSS imports based on framework
    if (this.cssFramework === CSS_FRAMEWORK.CSS_MODULES && data.styles !== false) {
      imports.push(`import styles from './${data.name}.module.css';`);
    } else if (this.cssFramework === CSS_FRAMEWORK.PLAIN_CSS && data.styles !== false) {
      imports.push(`import './${data.name}.css';`);
    }

    // Custom imports
    if (data.imports) {
      imports.push(...data.imports);
    }

    return imports.join('\n');
  }

  /**
   * Generate TypeScript type definitions
   */
  generateTypeDefinitions(data) {
    if (!this.useTypeScript) return '';

    const props = data.props || [];
    if (props.length === 0 && !data.children) {
      return `export interface ${data.name}Props {}`;
    }

    const propDefs = props.map(prop => {
      const optional = prop.required ? '' : '?';
      const type = prop.type || 'any';
      const comment = prop.description ? `  /** ${prop.description} */\n` : '';
      return `${comment}  ${prop.name}${optional}: ${type};`;
    }).join('\n');

    const childrenProp = data.children
      ? `  children${data.childrenRequired ? '' : '?'}: React.ReactNode;`
      : '';

    return `export interface ${data.name}Props {
${propDefs}
${childrenProp}
}`;
  }

  /**
   * Generate props destructure
   */
  generatePropsDestructure(data) {
    const props = data.props || [];
    const propNames = props.map(p => {
      if (p.default !== undefined) {
        return `${p.name} = ${JSON.stringify(p.default)}`;
      }
      return p.name;
    });

    if (data.children) {
      propNames.push('children');
    }

    if (propNames.length === 0) {
      return this.useTypeScript ? `props: ${data.name}Props` : 'props';
    }

    return `{ ${propNames.join(', ')} }`;
  }

  /**
   * Generate state declarations
   */
  generateState(data) {
    if (!data.state || data.state.length === 0) return '';

    return data.state.map(s => {
      const type = this.useTypeScript && s.type ? `<${s.type}>` : '';
      const initial = s.initial !== undefined ? JSON.stringify(s.initial) : 'null';
      return `const [${s.name}, set${this.capitalize(s.name)}] = useState${type}(${initial});`;
    }).join('\n  ');
  }

  /**
   * Generate effects
   */
  generateEffects(data) {
    if (!data.effects || data.effects.length === 0) return '';

    return data.effects.map(effect => {
      const deps = effect.deps ? `[${effect.deps.join(', ')}]` : '[]';
      const cleanup = effect.cleanup ? `\n    return () => {\n      ${effect.cleanup}\n    };` : '';
      return `useEffect(() => {
    ${effect.body || '// Effect logic here'}${cleanup}
  }, ${deps});`;
    }).join('\n\n  ');
  }

  /**
   * Generate handlers
   */
  generateHandlers(data) {
    if (!data.handlers || data.handlers.length === 0) return '';

    return data.handlers.map(handler => {
      const params = handler.params || [];
      const paramStr = this.useTypeScript
        ? params.map(p => `${p.name}: ${p.type || 'any'}`).join(', ')
        : params.map(p => p.name).join(', ');

      const returnType = this.useTypeScript && handler.returnType
        ? `: ${handler.returnType}`
        : '';

      if (handler.useCallback) {
        const deps = handler.deps ? `[${handler.deps.join(', ')}]` : '[]';
        return `const ${handler.name} = useCallback((${paramStr})${returnType} => {
    ${handler.body || '// Handler logic here'}
  }, ${deps});`;
      }

      return `const ${handler.name} = (${paramStr})${returnType} => {
    ${handler.body || '// Handler logic here'}
  };`;
    }).join('\n\n  ');
  }

  /**
   * Generate JSX
   */
  generateJSX(data) {
    if (data.jsx) return data.jsx;

    const className = this.generateClassName(data);

    return `<div${className}>
      ${data.children ? '{children}' : `{/* ${data.name} content */}`}
    </div>`;
  }

  /**
   * Generate className based on CSS framework
   */
  generateClassName(data) {
    if (data.className === false) return '';

    switch (this.cssFramework) {
      case CSS_FRAMEWORK.TAILWIND:
        return ` className="${data.className || 'flex flex-col'}"`;
      case CSS_FRAMEWORK.CSS_MODULES:
        return ` className={styles.${data.containerClass || 'container'}}`;
      case CSS_FRAMEWORK.PLAIN_CSS:
        return ` className="${data.containerClass || this.toKebabCase(data.name)}"`;
      default:
        return data.className ? ` className="${data.className}"` : '';
    }
  }

  /**
   * Generate styled components definitions
   */
  generateStyledComponents(data) {
    if (!data.styledComponents || data.styledComponents.length === 0) {
      return `const Container = styled.div\`
  // Add styles here
\`;`;
    }

    return data.styledComponents.map(sc => {
      const base = sc.extends ? `styled(${sc.extends})` : `styled.${sc.element || 'div'}`;
      return `const ${sc.name} = ${base}\`
  ${sc.styles || '// Add styles here'}
\`;`;
    }).join('\n\n');
  }

  /**
   * Generate styled JSX
   */
  generateStyledJSX(data) {
    if (data.jsx) return data.jsx;

    return `<Container>
      ${data.children ? '{children}' : `{/* ${data.name} content */}`}
    </Container>`;
  }

  /**
   * Generate a component
   * @param {Object} spec - Component specification
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
          type: { type: 'string', enum: Object.values(COMPONENT_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || COMPONENT_TYPE.FUNCTIONAL;

      // Build output path
      const ext = this.useTypeScript ? '.tsx' : '.jsx';
      const fileName = spec.name + ext;
      const outputPath = spec.outputPath || `src/components/${spec.name}/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FRONTEND_COMPONENT_GENERATED, {
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

  /**
   * Convert to kebab-case
   */
  toKebabCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '-' : '') + p1.toLowerCase();
    });
  }
}

// Singleton getter
let instance = null;

export function getComponentGenerator(options = {}) {
  if (!instance) {
    instance = new ComponentGenerator(options);
  }
  return instance;
}

export default ComponentGenerator;
