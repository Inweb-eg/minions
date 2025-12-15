/**
 * React Component Template
 *
 * Variables:
 *   {{componentName}} - Component name
 *   {{componentType}} - functional | memo | forwardRef
 *   {{#props}} {{name}}: {{type}} {{/props}} - Component props
 *   {{#hooks}} {{.}} {{/hooks}} - Hooks to use
 *   {{cssFramework}} - tailwind | styled-components | css-modules
 *
 * This template can be customized by editing it directly.
 */

import React{{#hasMemo}}, { memo }{{/hasMemo}}{{#hasForwardRef}}, { forwardRef }{{/hasForwardRef}}{{#hasUseState}}, { useState }{{/hasUseState}}{{#hasUseEffect}}, { useEffect }{{/hasUseEffect}}{{#hasUseCallback}}, { useCallback }{{/hasUseCallback}}{{#hasUseMemo}}, { useMemo }{{/hasUseMemo}} from 'react';
{{#imports}}
import {{.}};
{{/imports}}
{{#cssModules}}
import styles from './{{componentName}}.module.css';
{{/cssModules}}

{{#hasInterface}}
interface {{componentName}}Props {
  {{#props}}
  /** {{description}} */
  {{name}}{{^required}}?{{/required}}: {{type}};
  {{/props}}
}
{{/hasInterface}}

{{#isFunctional}}
/**
 * {{componentName}} Component
 *
 * {{description}}
 */
export const {{componentName}}: React.FC<{{componentName}}Props> = ({
  {{#props}}
  {{name}}{{#hasDefault}} = {{default}}{{/hasDefault}},
  {{/props}}
}) => {
  {{#stateVars}}
  const [{{name}}, set{{Name}}] = useState<{{type}}>({{initial}});
  {{/stateVars}}

  {{#effects}}
  useEffect(() => {
    {{body}}
    {{#cleanup}}
    return () => {
      {{cleanup}}
    };
    {{/cleanup}}
  }, [{{deps}}]);
  {{/effects}}

  {{#callbacks}}
  const {{name}} = useCallback({{#params}}({{params}}){{/params}} => {
    {{body}}
  }, [{{deps}}]);
  {{/callbacks}}

  {{#memoVars}}
  const {{name}} = useMemo(() => {{body}}, [{{deps}}]);
  {{/memoVars}}

  return (
    <div{{#className}} className="{{className}}"{{/className}}{{#cssModules}} className={styles.container}{{/cssModules}} data-testid="{{testId}}">
      {/* TODO: Implement component content */}
    </div>
  );
};
{{/isFunctional}}

{{#isMemo}}
/**
 * {{componentName}} Memoized Component
 *
 * {{description}}
 */
export const {{componentName}} = memo<{{componentName}}Props>(({
  {{#props}}
  {{name}}{{#hasDefault}} = {{default}}{{/hasDefault}},
  {{/props}}
}) => {
  return (
    <div{{#className}} className="{{className}}"{{/className}} data-testid="{{testId}}">
      {/* TODO: Implement component content */}
    </div>
  );
});

{{componentName}}.displayName = '{{componentName}}';
{{/isMemo}}

{{#isForwardRef}}
/**
 * {{componentName}} ForwardRef Component
 *
 * {{description}}
 */
export const {{componentName}} = forwardRef<{{refType}}, {{componentName}}Props>(({
  {{#props}}
  {{name}}{{#hasDefault}} = {{default}}{{/hasDefault}},
  {{/props}}
}, ref) => {
  return (
    <div ref={ref}{{#className}} className="{{className}}"{{/className}} data-testid="{{testId}}">
      {/* TODO: Implement component content */}
    </div>
  );
});

{{componentName}}.displayName = '{{componentName}}';
{{/isForwardRef}}

export default {{componentName}};
