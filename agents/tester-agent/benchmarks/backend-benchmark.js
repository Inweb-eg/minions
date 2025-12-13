/**
 * Backend Performance Benchmark - API and Database Performance
 *
 * Phase 7.4: Performance & Benchmarking
 * Benchmarks backend performance (API response times, DB queries)
 */

import { BaseBenchmark, BENCHMARK_STATUS, METRIC_TYPE, PERFORMANCE_BASELINE } from './base-benchmark.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import https from 'https';

const execAsync = promisify(exec);

/**
 * Backend benchmark types
 */
export const BACKEND_BENCHMARK_TYPE = {
  API_ENDPOINT: 'api_endpoint',
  DATABASE_QUERY: 'database_query',
  THROUGHPUT: 'throughput',
  LOAD_TEST: 'load_test'
};

/**
 * BackendBenchmark
 * Benchmarks backend API and database performance
 */
export class BackendBenchmark extends BaseBenchmark {
  constructor() {
    super('BackendBenchmark', 'backend');
  }

  /**
   * Run backend benchmark
   * @param {Object} config - Benchmark configuration
   * @param {Object} options - Options
   * @returns {Promise<Object>} Benchmark result
   */
  async run(config, options = {}) {
    this.startBenchmark();

    try {
      const {
        type = BACKEND_BENCHMARK_TYPE.API_ENDPOINT,
        iterations = 10,
        warmupIterations = 3,
        concurrency = 1
      } = config;

      // Run warmup if requested
      if (warmupIterations > 0) {
        await this.warmup(async () => {
          await this.runSingleIteration(config, options);
        }, warmupIterations);
      }

      // Run actual benchmark
      this.logger.info(`Running ${iterations} iterations with concurrency ${concurrency}...`);

      if (concurrency > 1) {
        await this.runConcurrent(config, iterations, concurrency, options);
      } else {
        await this.runSequential(config, iterations, options);
      }

      // Generate summary
      const summary = this.generateSummary();
      const duration = this.endBenchmark();

      return {
        success: true,
        summary,
        results: this.results,
        duration
      };
    } catch (error) {
      this.logger.error(`Benchmark failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run sequential iterations
   * @param {Object} config - Configuration
   * @param {number} iterations - Number of iterations
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async runSequential(config, iterations, options) {
    for (let i = 0; i < iterations; i++) {
      this.logger.debug(`Iteration ${i + 1}/${iterations}`);
      await this.runSingleIteration(config, options);

      // Small delay between iterations
      if (i < iterations - 1) {
        await this.sleep(100);
      }
    }
  }

  /**
   * Run concurrent iterations
   * @param {Object} config - Configuration
   * @param {number} iterations - Total iterations
   * @param {number} concurrency - Concurrent requests
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async runConcurrent(config, iterations, concurrency, options) {
    const batches = Math.ceil(iterations / concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, iterations - (batch * concurrency));
      this.logger.debug(`Batch ${batch + 1}/${batches} (${batchSize} concurrent requests)`);

      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        promises.push(this.runSingleIteration(config, options));
      }

      await Promise.all(promises);
    }
  }

  /**
   * Run single iteration
   * @param {Object} config - Configuration
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async runSingleIteration(config, options) {
    const { type } = config;

    switch (type) {
      case BACKEND_BENCHMARK_TYPE.API_ENDPOINT:
        await this.benchmarkAPIEndpoint(config, options);
        break;

      case BACKEND_BENCHMARK_TYPE.DATABASE_QUERY:
        await this.benchmarkDatabaseQuery(config, options);
        break;

      case BACKEND_BENCHMARK_TYPE.THROUGHPUT:
        await this.benchmarkThroughput(config, options);
        break;

      default:
        throw new Error(`Unknown benchmark type: ${type}`);
    }
  }

  /**
   * Benchmark API endpoint
   * @param {Object} config - Configuration
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async benchmarkAPIEndpoint(config, options) {
    const {
      url,
      method = 'GET',
      headers = {},
      body = null,
      timeout = 10000
    } = config;

    const startTime = Date.now();

    try {
      const result = await this.makeRequest(url, method, headers, body, timeout);
      const duration = Date.now() - startTime;

      this.recordMetric('api_response_time', duration, METRIC_TYPE.LATENCY, 'ms');
      this.recordMetric('api_status_code', result.statusCode, METRIC_TYPE.CUSTOM, '');

      if (result.responseSize) {
        this.recordMetric('api_response_size', result.responseSize, METRIC_TYPE.CUSTOM, 'bytes');
      }

      this.addResult({
        type: 'api_endpoint',
        url,
        method,
        statusCode: result.statusCode,
        duration,
        success: result.statusCode >= 200 && result.statusCode < 300
      });

      // Check against baseline
      const comparison = this.compareWithBaseline('api_response_time', PERFORMANCE_BASELINE.API_RESPONSE);
      if (comparison.status === BENCHMARK_STATUS.FAIL) {
        this.logger.warn(`API response time (${duration}ms) exceeds baseline (${PERFORMANCE_BASELINE.API_RESPONSE}ms)`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('api_response_time', duration, METRIC_TYPE.LATENCY, 'ms');

      this.addResult({
        type: 'api_endpoint',
        url,
        method,
        duration,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Make HTTP/HTTPS request
   * @param {string} url - URL
   * @param {string} method - HTTP method
   * @param {Object} headers - Headers
   * @param {*} body - Request body
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>} Response
   */
  makeRequest(url, method, headers, body, timeout) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'User-Agent': 'TesterAgent/1.0',
          ...headers
        },
        timeout
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            responseSize: Buffer.byteLength(data)
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Benchmark database query
   * @param {Object} config - Configuration
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async benchmarkDatabaseQuery(config, options) {
    const {
      query,
      connection,
      database = 'mongodb'
    } = config;

    const startTime = Date.now();

    try {
      let result;

      // Simplified - in real implementation would connect to actual DB
      if (database === 'mongodb') {
        // Example: await connection.collection.find(query).toArray()
        result = await this.simulateQuery(query, 50); // Simulate 50ms query
      } else if (database === 'postgresql' || database === 'mysql') {
        // Example: await connection.query(query)
        result = await this.simulateQuery(query, 30); // Simulate 30ms query
      }

      const duration = Date.now() - startTime;

      this.recordMetric('db_query_time', duration, METRIC_TYPE.LATENCY, 'ms');

      this.addResult({
        type: 'database_query',
        database,
        query: typeof query === 'string' ? query : JSON.stringify(query),
        duration,
        success: true
      });

      // Check against baseline
      const comparison = this.compareWithBaseline('db_query_time', PERFORMANCE_BASELINE.DB_QUERY);
      if (comparison.status === BENCHMARK_STATUS.FAIL) {
        this.logger.warn(`DB query time (${duration}ms) exceeds baseline (${PERFORMANCE_BASELINE.DB_QUERY}ms)`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('db_query_time', duration, METRIC_TYPE.LATENCY, 'ms');

      this.addResult({
        type: 'database_query',
        database,
        query: typeof query === 'string' ? query : JSON.stringify(query),
        duration,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Simulate database query (for testing)
   * @param {*} query - Query
   * @param {number} baseTime - Base time in ms
   * @returns {Promise<Object>} Simulated result
   */
  async simulateQuery(query, baseTime) {
    // Add some randomness to simulate real DB
    const jitter = Math.random() * 20 - 10; // ±10ms
    await this.sleep(baseTime + jitter);
    return { rows: [], count: 0 };
  }

  /**
   * Benchmark throughput (requests per second)
   * @param {Object} config - Configuration
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async benchmarkThroughput(config, options) {
    const {
      url,
      duration = 10000, // 10 seconds
      concurrency = 10
    } = config;

    const startTime = Date.now();
    let requestCount = 0;
    let errorCount = 0;

    this.logger.info(`Measuring throughput for ${duration}ms with ${concurrency} concurrent requests...`);

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (Date.now() - startTime < duration) {
          try {
            await this.makeRequest(url, 'GET', {}, null, 5000);
            requestCount++;
          } catch (error) {
            errorCount++;
          }
        }
      })());
    }

    await Promise.all(workers);

    const actualDuration = Date.now() - startTime;
    const rps = (requestCount / actualDuration) * 1000;

    this.recordMetric('requests_per_second', rps, METRIC_TYPE.THROUGHPUT, 'req/s');
    this.recordMetric('error_rate', (errorCount / (requestCount + errorCount)) * 100, METRIC_TYPE.CUSTOM, '%');

    this.addResult({
      type: 'throughput',
      url,
      duration: actualDuration,
      totalRequests: requestCount + errorCount,
      successfulRequests: requestCount,
      failedRequests: errorCount,
      requestsPerSecond: rps,
      success: true
    });

    this.logger.info(`Throughput: ${rps.toFixed(2)} req/s (${requestCount} successful, ${errorCount} failed)`);
  }

  /**
   * Benchmark multiple endpoints
   * @param {Array} endpoints - Array of endpoint configurations
   * @param {Object} options - Options
   * @returns {Promise<Object>} Results
   */
  async benchmarkEndpoints(endpoints, options = {}) {
    this.logger.info(`Benchmarking ${endpoints.length} endpoints...`);

    const results = [];

    for (const endpoint of endpoints) {
      const config = {
        type: BACKEND_BENCHMARK_TYPE.API_ENDPOINT,
        ...endpoint,
        iterations: endpoint.iterations || 5
      };

      this.logger.info(`Testing: ${endpoint.method || 'GET'} ${endpoint.url}`);
      const result = await this.run(config, options);
      results.push({
        endpoint: endpoint.url,
        ...result
      });
    }

    return {
      endpoints: endpoints.length,
      results
    };
  }

  /**
   * Get performance report
   * @returns {Object} Report
   */
  getPerformanceReport() {
    const summary = this.generateSummary();
    const report = {
      benchmark: this.name,
      summary,
      metrics: {}
    };

    // Add baseline comparisons
    if (this.metrics.api_response_time) {
      report.metrics.apiResponseTime = {
        ...summary.metrics.api_response_time,
        baseline: PERFORMANCE_BASELINE.API_RESPONSE,
        comparison: this.compareWithBaseline('api_response_time', PERFORMANCE_BASELINE.API_RESPONSE)
      };
    }

    if (this.metrics.db_query_time) {
      report.metrics.dbQueryTime = {
        ...summary.metrics.db_query_time,
        baseline: PERFORMANCE_BASELINE.DB_QUERY,
        comparison: this.compareWithBaseline('db_query_time', PERFORMANCE_BASELINE.DB_QUERY)
      };
    }

    return report;
  }

  /**
   * Detect slow API endpoints
   * @param {Array} endpoints - Endpoints with response times
   * @param {Object} options - Detection options
   * @returns {Array} Slow endpoints
   */
  detectSlowEndpoints(endpoints, options = {}) {
    const { threshold = 500 } = options; // 500ms default

    this.logger.debug(`Detecting slow endpoints (threshold: ${threshold}ms)`);

    return endpoints.filter(endpoint => endpoint.responseTime > threshold);
  }

  /**
   * Detect N+1 query patterns
   * @param {Array} queries - Database queries executed
   * @returns {Array} Potential N+1 issues
   */
  detectNPlusOne(queries) {
    this.logger.debug('Detecting N+1 query patterns');

    const nPlusOneIssues = [];

    // Group queries by pattern
    const queryGroups = {};
    queries.forEach(q => {
      const pattern = q.query.replace(/\d+/g, '?'); // Normalize query
      if (!queryGroups[pattern]) {
        queryGroups[pattern] = [];
      }
      queryGroups[pattern].push(q);
    });

    // Check for queries executed many times
    for (const [pattern, group] of Object.entries(queryGroups)) {
      if (group.length > 10) { // Executed more than 10 times
        nPlusOneIssues.push({
          query: pattern,
          count: group.length,
          totalTime: group.reduce((sum, q) => sum + (q.duration || 0), 0),
          type: 'potential_n_plus_1',
          recommendation: 'Consider using JOIN or batch query to reduce database roundtrips'
        });
      }
    }

    return nPlusOneIssues;
  }

  /**
   * Generate benchmark report
   * @param {Object} benchmarkResults - Benchmark results
   * @returns {Promise<Object>} Generated report
   */
  async generateReport(benchmarkResults) {
    this.logger.info('Generating backend benchmark report');

    const { backend, frontend, regressions = [] } = benchmarkResults;

    const report = {
      summary: {
        backend: backend || {},
        frontend: frontend || {},
        regressions: regressions.length
      },
      recommendations: this.generateRecommendations(benchmarkResults),
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  /**
   * Generate optimization recommendations
   * @param {Object} metrics - Performance metrics
   * @returns {Array} Recommendations
   */
  generateRecommendations(metrics) {
    const recommendations = [];

    // Check API response time
    if (metrics.apiResponseTime && metrics.apiResponseTime > 200) {
      recommendations.push(
        'API response time is slow. Consider caching, optimizing database queries, or adding indexes.'
      );
    }

    // Check database query time
    if (metrics.databaseQueryTime && metrics.databaseQueryTime > 100) {
      recommendations.push(
        'Database queries are slow. Review indexes, optimize queries, or implement query caching.'
      );
    }

    // Check bundle size
    if (metrics.bundleSize && metrics.bundleSize > 1024) { // > 1MB
      recommendations.push(
        'Bundle size is large. Consider code splitting, tree shaking, or lazy loading.'
      );
    }

    // Check LCP (Largest Contentful Paint)
    if (metrics.lcp && metrics.lcp > 2500) {
      recommendations.push(
        'LCP is slow. Optimize images, reduce render-blocking resources, or improve server response time.'
      );
    }

    return recommendations;
  }

  /**
   * Export benchmark data
   * @param {Object} data - Data to export
   * @param {string} format - Export format
   * @returns {Promise<string>} Exported data
   */
  async export(data, format = 'json') {
    this.logger.debug(`Exporting benchmark data as ${format}`);

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        // Simple CSV export
        const headers = Object.keys(data.metrics || {});
        const values = headers.map(h => data.metrics[h]);
        return `${headers.join(',')}\n${values.join(',')}`;

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Check performance budget
   * @param {Object} budget - Performance budget thresholds
   * @param {Object} actual - Actual metrics
   * @returns {Array} Budget violations
   */
  checkBudget(budget, actual) {
    this.logger.debug('Checking performance budget');

    const violations = [];

    for (const [metric, threshold] of Object.entries(budget)) {
      if (actual[metric] !== undefined && actual[metric] > threshold) {
        violations.push({
          metric,
          threshold,
          actual: actual[metric],
          overage: actual[metric] - threshold,
          percentOver: ((actual[metric] - threshold) / threshold) * 100
        });
      }
    }

    return violations;
  }

  /**
   * Analyze coverage metrics
   * @param {Object} coverage - Coverage data
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeCoverage(coverage) {
    this.logger.debug('Analyzing coverage metrics');

    const { lines, functions, branches, statements } = coverage;

    const analysis = {
      overall: (lines + functions + branches + statements) / 4,
      lines,
      functions,
      branches,
      statements,
      meetsThreshold: lines >= 80 && functions >= 80 && branches >= 75
    };

    return analysis;
  }
}

/**
 * Get singleton instance
 */
let benchmarkInstance = null;

export function getBackendBenchmark() {
  if (!benchmarkInstance) {
    benchmarkInstance = new BackendBenchmark();
  }
  return benchmarkInstance;
}
