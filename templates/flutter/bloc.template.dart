/// Flutter Bloc Template
///
/// Variables:
///   {{blocName}} - Bloc class name
///   {{blocType}} - bloc | cubit
///   {{#events}} {{name}} {{/events}} - Event classes
///   {{#states}} {{name}} {{/states}} - State classes
///   {{#dependencies}} {{type}} {{name}} {{/dependencies}} - Dependencies
///
/// This template can be customized by editing it directly.

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
{{#imports}}
import '{{.}}';
{{/imports}}

part '{{blocFileName}}_event.dart';
part '{{blocFileName}}_state.dart';

{{#isBloc}}
/// {{blocName}} Bloc
///
/// Manages {{description}}.
class {{blocName}} extends Bloc<{{blocName}}Event, {{blocName}}State> {
  {{#dependencies}}
  final {{type}} {{name}};
  {{/dependencies}}

  {{blocName}}({{#dependencies}}
    this.{{name}},
  {{/dependencies}}) : super(const {{blocName}}Initial()) {
    {{#events}}
    on<{{name}}>({{#handlerName}}_on{{name}}{{/handlerName}});
    {{/events}}
  }

  {{#events}}
  Future<void> _on{{name}}(
    {{name}} event,
    Emitter<{{blocName}}State> emit,
  ) async {
    try {
      emit(const {{blocName}}Loading());
      // TODO: Implement {{name}} logic
      emit(const {{blocName}}Loaded());
    } catch (e) {
      emit({{blocName}}Error(e.toString()));
    }
  }

  {{/events}}
}
{{/isBloc}}

{{#isCubit}}
/// {{blocName}} Cubit
///
/// Manages {{description}}.
class {{blocName}} extends Cubit<{{blocName}}State> {
  {{#dependencies}}
  final {{type}} {{name}};
  {{/dependencies}}

  {{blocName}}({{#dependencies}}
    this.{{name}},
  {{/dependencies}}) : super(const {{blocName}}Initial());

  {{#methods}}
  Future<void> {{name}}({{#params}}{{type}} {{name}}{{^last}}, {{/last}}{{/params}}) async {
    try {
      emit(const {{blocName}}Loading());
      // TODO: Implement {{name}} logic
      emit(const {{blocName}}Loaded());
    } catch (e) {
      emit({{blocName}}Error(e.toString()));
    }
  }

  {{/methods}}
}
{{/isCubit}}
