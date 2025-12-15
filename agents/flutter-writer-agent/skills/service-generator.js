/**
 * ServiceGenerator - Flutter API Service Code Generation Skill
 *
 * Generates Flutter API services:
 * - Dio-based HTTP clients
 * - Repository pattern
 * - Error handling
 * - Request/response interceptors
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT, createSkillGetter } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * HTTP methods
 */
export const HTTP_METHOD = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete'
};

/**
 * ServiceGenerator Skill
 */
export class ServiceGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ServiceGenerator', {
      language: LANGUAGE.DART,
      ...options
    });

    this.baseUrl = options.baseUrl || '';
    this.registerTemplates();
  }

  registerTemplates() {
    // API Service template
    this.registerTemplate('service', (data) => `
import 'package:dio/dio.dart';
${data.imports || ''}

/// ${data.description || data.name + ' API service'}
class ${data.name} {
  final Dio _dio;
  static const String _basePath = '${data.basePath || ''}';

  ${data.name}(this._dio);

${this.generateMethods(data.endpoints)}
}
`.trim());

    // Repository template
    this.registerTemplate('repository', (data) => `
import 'package:dio/dio.dart';
${data.imports || ''}

/// ${data.description || data.name + ' repository'}
abstract class ${data.name}Repository {
${this.generateAbstractMethods(data.endpoints)}
}

/// ${data.name} repository implementation
class ${data.name}RepositoryImpl implements ${data.name}Repository {
  final Dio _dio;
  static const String _basePath = '${data.basePath || ''}';

  ${data.name}RepositoryImpl(this._dio);

${this.generateMethods(data.endpoints, true)}
}
`.trim());

    // Dio client setup template
    this.registerTemplate('dioClient', (data) => `
import 'package:dio/dio.dart';

/// Dio HTTP client configuration
class DioClient {
  static Dio? _instance;

  static Dio get instance {
    _instance ??= _createDio();
    return _instance!;
  }

  static Dio _createDio() {
    final dio = Dio(BaseOptions(
      baseUrl: '${data.baseUrl || 'http://localhost:3000'}',
      connectTimeout: const Duration(seconds: ${data.connectTimeout || 30}),
      receiveTimeout: const Duration(seconds: ${data.receiveTimeout || 30}),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ${data.headers ? Object.entries(data.headers).map(([k, v]) => `'${k}': '${v}',`).join('\n        ') : ''}
      },
    ));

    dio.interceptors.addAll([
      LogInterceptor(
        requestBody: true,
        responseBody: true,
      ),
      _ErrorInterceptor(),
      ${data.authInterceptor ? '_AuthInterceptor(),' : ''}
    ]);

    return dio;
  }

  static void reset() {
    _instance = null;
  }
}

/// Error interceptor
class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Handle common errors
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        throw TimeoutException(err.message ?? 'Connection timeout');
      case DioExceptionType.badResponse:
        _handleBadResponse(err);
        break;
      default:
        break;
    }
    handler.next(err);
  }

  void _handleBadResponse(DioException err) {
    final statusCode = err.response?.statusCode;
    final data = err.response?.data;

    switch (statusCode) {
      case 400:
        throw BadRequestException(data?['message'] ?? 'Bad request');
      case 401:
        throw UnauthorizedException(data?['message'] ?? 'Unauthorized');
      case 403:
        throw ForbiddenException(data?['message'] ?? 'Forbidden');
      case 404:
        throw NotFoundException(data?['message'] ?? 'Not found');
      case 500:
        throw ServerException(data?['message'] ?? 'Server error');
    }
  }
}
${data.authInterceptor ? `
/// Auth interceptor
class _AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Add auth token to request
    // final token = AuthService.token;
    // if (token != null) {
    //   options.headers['Authorization'] = 'Bearer \$token';
    // }
    handler.next(options);
  }
}
` : ''}
/// Custom exceptions
class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class TimeoutException extends ApiException {
  TimeoutException(super.message);
}

class BadRequestException extends ApiException {
  BadRequestException(super.message);
}

class UnauthorizedException extends ApiException {
  UnauthorizedException(super.message);
}

class ForbiddenException extends ApiException {
  ForbiddenException(super.message);
}

class NotFoundException extends ApiException {
  NotFoundException(super.message);
}

class ServerException extends ApiException {
  ServerException(super.message);
}
`.trim());
  }

  /**
   * Generate service methods
   */
  generateMethods(endpoints = [], isOverride = false) {
    return endpoints.map(ep => {
      const override = isOverride ? '  @override\n' : '';
      const returnType = ep.returnType || 'dynamic';
      const params = this.generateParams(ep.params);
      const body = this.generateMethodBody(ep);

      return `${override}  Future<${returnType}> ${ep.name}(${params}) async {
${body}
  }`;
    }).join('\n\n');
  }

  /**
   * Generate abstract methods for repository interface
   */
  generateAbstractMethods(endpoints = []) {
    return endpoints.map(ep => {
      const returnType = ep.returnType || 'dynamic';
      const params = this.generateParams(ep.params);
      return `  Future<${returnType}> ${ep.name}(${params});`;
    }).join('\n');
  }

  /**
   * Generate method parameters
   */
  generateParams(params = []) {
    if (!params || params.length === 0) return '';
    return params.map(p => {
      const nullable = p.nullable ? '?' : '';
      const required = !p.nullable && !p.default ? 'required ' : '';
      return `${required}${p.type}${nullable} ${p.name}`;
    }).join(', ');
  }

  /**
   * Generate method body
   */
  generateMethodBody(endpoint) {
    const method = endpoint.method || HTTP_METHOD.GET;
    const path = endpoint.path || '/';
    const hasBody = [HTTP_METHOD.POST, HTTP_METHOD.PUT, HTTP_METHOD.PATCH].includes(method);
    const bodyParam = endpoint.params?.find(p => p.isBody);

    let body = `    final response = await _dio.${method}(
      '\$_basePath${path}',`;

    if (hasBody && bodyParam) {
      body += `\n      data: ${bodyParam.name}.toJson(),`;
    }

    if (endpoint.queryParams) {
      body += `\n      queryParameters: {
        ${endpoint.queryParams.map(q => `'${q}': ${q},`).join('\n        ')}
      },`;
    }

    body += `
    );

    return ${this.generateResponseParsing(endpoint)};`;

    return body;
  }

  /**
   * Generate response parsing code
   */
  generateResponseParsing(endpoint) {
    const returnType = endpoint.returnType || 'dynamic';

    if (returnType === 'void') {
      return 'null';
    }

    if (returnType.startsWith('List<')) {
      const itemType = returnType.slice(5, -1);
      return `(response.data as List).map((e) => ${itemType}.fromJson(e)).toList()`;
    }

    if (returnType !== 'dynamic' && returnType !== 'Map<String, dynamic>') {
      return `${returnType}.fromJson(response.data)`;
    }

    return 'response.data';
  }

  /**
   * Generate a service
   * @param {Object} spec - Service specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      // Validate spec
      const validation = this.validateSpec(spec, {
        required: ['name'],
        properties: {
          name: { type: 'string', pattern: '^[A-Z][a-zA-Z0-9]*$' }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || 'service';

      // Build output path
      const fileName = this.toSnakeCase(spec.name) + '_service.dart';
      const outputPath = spec.outputPath || `lib/services/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.FLUTTER_SERVICE_GENERATED, {
          name: spec.name,
          endpoints: spec.endpoints?.length || 0,
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
   * Generate Dio client
   * @param {Object} spec - Client specification
   * @returns {Promise<Object>} Generation result
   */
  async generateDioClient(spec = {}) {
    this.startRun();

    try {
      const outputPath = spec.outputPath || 'lib/core/network/dio_client.dart';

      const result = await this.generateAndWrite(spec, 'dioClient', outputPath, {
        overwrite: spec.overwrite || false
      });

      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert PascalCase to snake_case
   */
  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '_' : '') + p1.toLowerCase();
    });
  }
}

// Singleton getter
let instance = null;

export function getServiceGenerator(options = {}) {
  if (!instance) {
    instance = new ServiceGenerator(options);
  }
  return instance;
}

export default ServiceGenerator;
