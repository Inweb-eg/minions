/// Flutter Widget Template
///
/// Variables:
///   {{widgetName}} - Widget class name
///   {{widgetType}} - stateless | stateful | inherited
///   {{#props}} {{name}}: {{type}} {{/props}} - Widget properties
///   {{#hooks}} {{.}} {{/hooks}} - Hooks/mixins to include
///   {{#imports}} {{.}} {{/imports}} - Additional imports
///
/// This template can be customized by editing it directly.
/// Changes will be picked up automatically by the generator.

{{#imports}}
import '{{.}}';
{{/imports}}
import 'package:flutter/material.dart';

{{#isStateless}}
/// {{widgetName}} Widget
///
/// A stateless widget for {{description}}.
class {{widgetName}} extends StatelessWidget {
  {{#props}}
  /// {{description}}
  final {{type}} {{name}};
  {{/props}}

  const {{widgetName}}({
    super.key,
    {{#props}}
    {{#required}}required {{/required}}this.{{name}}{{#hasDefault}} = {{default}}{{/hasDefault}},
    {{/props}}
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      // TODO: Implement widget content
      child: const Placeholder(),
    );
  }
}
{{/isStateless}}

{{#isStateful}}
/// {{widgetName}} Widget
///
/// A stateful widget for {{description}}.
class {{widgetName}} extends StatefulWidget {
  {{#props}}
  /// {{description}}
  final {{type}} {{name}};
  {{/props}}

  const {{widgetName}}({
    super.key,
    {{#props}}
    {{#required}}required {{/required}}this.{{name}}{{#hasDefault}} = {{default}}{{/hasDefault}},
    {{/props}}
  });

  @override
  State<{{widgetName}}> createState() => _{{widgetName}}State();
}

class _{{widgetName}}State extends State<{{widgetName}}> {
  {{#stateVars}}
  {{type}} _{{name}}{{#hasInitial}} = {{initial}}{{/hasInitial}};
  {{/stateVars}}

  @override
  void initState() {
    super.initState();
    // TODO: Initialize state
  }

  @override
  void dispose() {
    // TODO: Cleanup resources
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      // TODO: Implement widget content
      child: const Placeholder(),
    );
  }
}
{{/isStateful}}

{{#isInherited}}
/// {{widgetName}} Inherited Widget
///
/// Provides {{description}} to descendant widgets.
class {{widgetName}} extends InheritedWidget {
  {{#props}}
  final {{type}} {{name}};
  {{/props}}

  const {{widgetName}}({
    super.key,
    {{#props}}
    required this.{{name}},
    {{/props}}
    required super.child,
  });

  static {{widgetName}}? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<{{widgetName}}>();
  }

  static {{widgetName}} of(BuildContext context) {
    final result = maybeOf(context);
    assert(result != null, 'No {{widgetName}} found in context');
    return result!;
  }

  @override
  bool updateShouldNotify({{widgetName}} oldWidget) {
    return {{#props}}{{name}} != oldWidget.{{name}}{{^last}} || {{/last}}{{/props}};
  }
}
{{/isInherited}}
