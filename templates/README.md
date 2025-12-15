# Minions Code Templates

This directory contains customizable templates for code generation. You can modify these templates to match your project's coding style and conventions.

## Directory Structure

```
templates/
├── flutter/           # Flutter/Dart templates
│   ├── widget.template.dart
│   ├── model.template.dart
│   ├── bloc.template.dart
│   └── ...
├── backend/           # Node.js/Express templates
│   ├── route.template.js
│   ├── model.template.js
│   ├── service.template.js
│   └── ...
├── frontend/          # React/TypeScript templates
│   ├── component.template.tsx
│   ├── hook.template.ts
│   ├── store.template.tsx
│   └── ...
└── README.md
```

## Template Syntax

Templates use Mustache-style syntax for variable interpolation:

### Simple Variables
```
{{variableName}}
```

### Conditionals
```
{{#isCondition}}
  This content appears if isCondition is truthy
{{/isCondition}}

{{^isCondition}}
  This content appears if isCondition is falsy
{{/isCondition}}
```

### Loops
```
{{#items}}
  Item: {{name}}, Type: {{type}}
{{/items}}
```

### Nested Properties
```
{{object.property}}
```

## Available Variables

### Flutter Templates

#### widget.template.dart
- `{{widgetName}}` - Widget class name
- `{{widgetType}}` - stateless | stateful | inherited
- `{{#props}}` - Widget properties
  - `{{name}}` - Property name
  - `{{type}}` - Property type
  - `{{required}}` - Is required
  - `{{default}}` - Default value
- `{{#imports}}` - Additional imports

#### bloc.template.dart
- `{{blocName}}` - Bloc class name
- `{{blocType}}` - bloc | cubit
- `{{#events}}` - Event classes
- `{{#states}}` - State classes
- `{{#dependencies}}` - Injected dependencies

### Backend Templates

#### route.template.js
- `{{routeName}}` - Route resource name
- `{{basePath}}` - Base URL path
- `{{controller}}` - Controller name
- `{{#middleware}}` - Applied middleware
- `{{#customEndpoints}}` - Custom endpoints

#### model.template.js
- `{{modelName}}` - Model class name
- `{{#fields}}` - Model fields
  - `{{name}}` - Field name
  - `{{type}}` - Field type
  - `{{required}}` - Is required
  - `{{unique}}` - Is unique
  - `{{default}}` - Default value
- `{{#indexes}}` - Database indexes
- `{{#methods}}` - Instance methods
- `{{#statics}}` - Static methods

### Frontend Templates

#### component.template.tsx
- `{{componentName}}` - Component name
- `{{componentType}}` - functional | memo | forwardRef
- `{{#props}}` - Component props
- `{{#hooks}}` - React hooks to use
- `{{cssFramework}}` - CSS framework
- `{{testId}}` - Test ID for testing

## Customization

### Modifying Templates

1. Locate the template file you want to modify
2. Edit the template using the Mustache syntax
3. Save the file

Changes are picked up automatically by the generators.

### Creating Custom Templates

1. Create a new `.template.*` file in the appropriate directory
2. Use the Mustache syntax for dynamic content
3. Register the template in the generator (if needed)

### Per-Project Templates

You can override templates on a per-project basis by creating a `templates/` directory in your project root with the same structure.

Example:
```
my-project/
├── templates/
│   └── frontend/
│       └── component.template.tsx  # Custom component template
└── minions.config.json
```

## Examples

### Custom Widget Template

```dart
// templates/flutter/widget.template.dart
import 'package:flutter/material.dart';

/// {{widgetName}}
///
/// Custom widget with company styling.
class {{widgetName}} extends StatelessWidget {
  {{#props}}
  final {{type}} {{name}};
  {{/props}}

  const {{widgetName}}({
    super.key,
    {{#props}}
    {{#required}}required {{/required}}this.{{name}},
    {{/props}}
  });

  @override
  Widget build(BuildContext context) {
    return MyCompanyBaseWidget(
      child: /* your content */,
    );
  }
}
```

### Custom API Hook Template

```typescript
// templates/frontend/hook.template.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * {{hookName}}
 *
 * Custom hook following company conventions.
 */
export const {{hookName}} = ({{#params}}{{name}}: {{type}}{{/params}}) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['{{queryKey}}', {{#keyParams}}{{name}}{{/keyParams}}],
    queryFn: async () => {
      // Custom fetch logic
    },
    staleTime: 5 * 60 * 1000, // Company standard: 5 minutes
  });
};
```

## Best Practices

1. **Keep templates focused** - Each template should generate one type of file
2. **Use meaningful variable names** - Make templates self-documenting
3. **Include comments** - Help future developers understand the template
4. **Test your templates** - Generate code and verify it compiles/runs
5. **Version control** - Track template changes in git
