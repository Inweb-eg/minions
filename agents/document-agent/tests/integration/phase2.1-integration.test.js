import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAPIParser } from '../../parsers/docs-parser/api-parser.js';
import { getArchitectureParser } from '../../parsers/docs-parser/architecture-parser.js';
import { getFeatureParser } from '../../parsers/docs-parser/feature-parser.js';
import { getFlutterParser } from '../../parsers/docs-parser/flutter-parser.js';
import { getReactParser } from '../../parsers/docs-parser/react-parser.js';
import { getBackendDigest } from '../../digest-generators/backend-digest.js';
import { getUserDigest } from '../../digest-generators/user-digest.js';
import { getDriverDigest } from '../../digest-generators/driver-digest.js';
import { getAdminDigest } from '../../digest-generators/admin-digest.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 2.1 MODE 1 Integration Tests', () => {
  let apiParser;
  let architectureParser;
  let featureParser;
  let flutterParser;
  let reactParser;
  let backendDigest;
  let userDigest;
  let driverDigest;
  let adminDigest;
  let cache;

  const testFixturesDir = path.join(__dirname, '..', 'fixtures');
  const testOpenAPIFile = path.join(testFixturesDir, 'test-api.yaml');
  const testAPIMarkdown = path.join(testFixturesDir, 'test-api.md');
  const testArchitectureFile = path.join(testFixturesDir, 'test-architecture.md');
  const testFeaturesFile = path.join(testFixturesDir, 'test-features.md');
  const testFlutterFile = path.join(testFixturesDir, 'test-flutter.md');
  const testReactFile = path.join(testFixturesDir, 'test-react.md');

  beforeAll(async () => {
    // Initialize all parsers
    apiParser = getAPIParser();
    await apiParser.initialize();

    architectureParser = getArchitectureParser();
    await architectureParser.initialize();

    featureParser = getFeatureParser();
    await featureParser.initialize();

    flutterParser = getFlutterParser();
    await flutterParser.initialize();

    reactParser = getReactParser();
    await reactParser.initialize();

    // Initialize digest generators
    backendDigest = getBackendDigest();
    userDigest = getUserDigest();
    driverDigest = getDriverDigest();
    adminDigest = getAdminDigest();

    // Get cache
    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterAll(async () => {
    await cache.clearAll();
  });

  describe('End-to-End Pipeline: Backend', () => {
    test('should parse API docs and generate backend digest', async () => {
      const startTime = Date.now();

      // Parse API documentation
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      expect(apiResult.endpoints.length).toBeGreaterThan(0);

      // Parse architecture documentation
      const archResult = await architectureParser.parse(testArchitectureFile);
      expect(archResult.components.length).toBeGreaterThan(0);

      // Parse feature documentation
      const featureResult = await featureParser.parse(testFeaturesFile);
      expect(featureResult.userStories.length).toBeGreaterThan(0);

      // Generate backend digest
      const digest = backendDigest.generate({
        api: apiResult,
        architecture: archResult,
        features: featureResult
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify digest structure
      expect(digest.platform).toBe('backend');
      expect(digest.framework).toBe('express');
      expect(digest.routes.length).toBeGreaterThan(0);
      expect(digest.controllers.length).toBeGreaterThan(0);
      expect(digest.models.length).toBeGreaterThan(0);
      expect(digest.dependencies).toContain('express');
      expect(digest.dependencies).toContain('mongoose');

      // Verify controllers have methods
      expect(digest.controllers[0].methods).toBeDefined();
      expect(digest.controllers[0].methods.length).toBeGreaterThan(0);

      // Performance check
      expect(duration).toBeLessThan(5000); // Should complete in <5 seconds

      console.log(`Backend pipeline completed in ${duration}ms`);
    });

    test('should handle multiple API files', async () => {
      // Parse multiple API files
      const openAPIResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      const markdownResult = await apiParser.parseMarkdown(testAPIMarkdown);

      expect(openAPIResult.endpoints.length).toBeGreaterThan(0);
      expect(markdownResult.endpoints.length).toBeGreaterThan(0);

      // Generate digest from OpenAPI result
      const digest = backendDigest.generate({ api: openAPIResult });

      expect(digest.routes.length).toBeGreaterThan(0);
      expect(digest.controllers.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Pipeline: User App', () => {
    test('should parse Flutter and API docs and generate user app digest', async () => {
      const startTime = Date.now();

      // Parse Flutter documentation
      const flutterResult = await flutterParser.parse(testFlutterFile);
      expect(flutterResult.screens.length).toBeGreaterThan(0);

      // Parse API documentation
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      expect(apiResult.endpoints.length).toBeGreaterThan(0);

      // Parse feature documentation
      const featureResult = await featureParser.parse(testFeaturesFile);
      expect(featureResult.userStories.length).toBeGreaterThan(0);

      // Generate user app digest
      const digest = userDigest.generate({
        flutter: flutterResult,
        api: apiResult,
        features: featureResult
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify digest structure
      expect(digest.platform).toBe('flutter');
      expect(digest.app).toBe('user');
      expect(digest.screens.length).toBeGreaterThan(0);
      expect(digest.widgets.length).toBeGreaterThan(0);
      expect(digest.models.length).toBeGreaterThan(0);
      expect(digest.services.length).toBeGreaterThan(0);
      expect(digest.packages).toContain('http');

      // Verify implementation guidance
      expect(digest.screens[0].implementation).toBeDefined();
      expect(digest.screens[0].implementation.widgetTree).toBeDefined();
      expect(digest.screens[0].implementation.example).toBeDefined();

      // Performance check
      expect(duration).toBeLessThan(5000);

      console.log(`User app pipeline completed in ${duration}ms`);
    });

    test('should generate API services from parsed endpoints', async () => {
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      const digest = userDigest.generate({ api: apiResult });

      // Verify API services were generated
      const apiServices = digest.services.filter(s => s.type === 'api');
      expect(apiServices.length).toBeGreaterThan(0);

      // Verify service methods
      const service = apiServices[0];
      expect(service.methods.length).toBeGreaterThan(0);
      expect(service.methods[0].httpMethod).toBeDefined();
      expect(service.methods[0].endpoint).toBeDefined();
    });
  });

  describe('End-to-End Pipeline: Driver App', () => {
    test('should parse Flutter and API docs and generate driver app digest', async () => {
      const startTime = Date.now();

      // Parse Flutter documentation
      const flutterResult = await flutterParser.parse(testFlutterFile);
      expect(flutterResult.screens.length).toBeGreaterThan(0);

      // Parse API documentation
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      expect(apiResult.endpoints.length).toBeGreaterThan(0);

      // Parse feature documentation
      const featureResult = await featureParser.parse(testFeaturesFile);
      expect(featureResult.userStories.length).toBeGreaterThan(0);

      // Generate driver app digest
      const digest = driverDigest.generate({
        flutter: flutterResult,
        api: apiResult,
        features: featureResult
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify digest structure
      expect(digest.platform).toBe('flutter');
      expect(digest.app).toBe('driver');
      expect(digest.screens.length).toBeGreaterThan(0);
      expect(digest.widgets.length).toBeGreaterThan(0);
      expect(digest.models.length).toBeGreaterThan(0);
      expect(digest.services.length).toBeGreaterThan(0);

      // Verify driver-specific features
      expect(digest.permissions).toContain('location');
      expect(digest.permissions).toContain('location_always');
      expect(digest.packages).toContain('google_maps_flutter');
      expect(digest.packages).toContain('socket_io_client');
      expect(digest.realtimeFeatures).toBeDefined();
      expect(digest.realtimeFeatures.rideRequests).toBeDefined();

      // Performance check
      expect(duration).toBeLessThan(5000);

      console.log(`Driver app pipeline completed in ${duration}ms`);
    });

    test('should add driver-specific requirements automatically', async () => {
      const digest = driverDigest.generate({});

      // Verify automatic additions
      expect(digest.permissions).toContain('location');
      expect(digest.permissions).toContain('location_always');
      expect(digest.packages).toContain('google_maps_flutter');
      expect(digest.packages).toContain('geolocator');
      expect(digest.packages).toContain('socket_io_client');
      expect(digest.realtimeFeatures.implementation).toBeDefined();
    });
  });

  describe('End-to-End Pipeline: Admin Dashboard', () => {
    test('should parse React and API docs and generate admin dashboard digest', async () => {
      const startTime = Date.now();

      // Parse React documentation
      const reactResult = await reactParser.parse(testReactFile);
      expect(reactResult.pages.length).toBeGreaterThan(0);

      // Parse API documentation
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      expect(apiResult.endpoints.length).toBeGreaterThan(0);

      // Parse feature documentation
      const featureResult = await featureParser.parse(testFeaturesFile);
      expect(featureResult.requirements.length).toBeGreaterThan(0);

      // Generate admin dashboard digest
      const digest = adminDigest.generate({
        react: reactResult,
        api: apiResult,
        features: featureResult
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify digest structure
      expect(digest.platform).toBe('react');
      expect(digest.app).toBe('admin');
      expect(digest.pages.length).toBeGreaterThan(0);
      expect(digest.components.length).toBeGreaterThan(0);
      expect(digest.services.length).toBeGreaterThan(0);

      // Verify admin-specific features
      expect(digest.dependencies).toContain('react');
      expect(digest.dependencies).toContain('react-router-dom');
      expect(digest.dependencies).toContain('axios');
      expect(digest.dependencies).toContain('recharts');
      expect(digest.devDependencies).toContain('vite');

      // Verify implementation guidance
      expect(digest.pages[0].implementation).toBeDefined();
      expect(digest.pages[0].implementation.structure).toBeDefined();
      expect(digest.pages[0].implementation.example).toBeDefined();

      // Performance check
      expect(duration).toBeLessThan(5000);

      console.log(`Admin dashboard pipeline completed in ${duration}ms`);
    });

    test('should add admin-specific best practices', async () => {
      const digest = adminDigest.generate({});

      // Verify automatic best practices
      expect(digest.bestPractices.some(p => p.category === 'security')).toBe(true);
      expect(digest.bestPractices.some(p => p.category === 'ux')).toBe(true);
      expect(digest.bestPractices.some(p => p.category === 'performance')).toBe(true);
    });
  });

  describe('Cache Performance', () => {
    test('should support caching functionality', async () => {
      await cache.clearAll();

      // First parse - should work
      const result1 = await apiParser.parseOpenAPI(testOpenAPIFile);
      expect(result1).toBeDefined();
      expect(result1.endpoints.length).toBeGreaterThan(0);

      // Second parse - should also work (may hit cache)
      const result2 = await apiParser.parseOpenAPI(testOpenAPIFile);
      expect(result2).toBeDefined();
      expect(result2.endpoints.length).toBeGreaterThan(0);

      // Results should be consistent
      expect(result2.endpoints.length).toBe(result1.endpoints.length);

      const stats = cache.getStats();
      console.log(`Cache stats - Hits: ${stats.hits || 0}, Misses: ${stats.misses || 0}`);
    });

    test('should support repeated parsing', async () => {
      // Parse multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await apiParser.parseOpenAPI(testOpenAPIFile);
        results.push(result);
      }

      // All results should be consistent
      results.forEach(result => {
        expect(result.endpoints.length).toBe(results[0].endpoints.length);
      });

      console.log(`Parsed file 3 times, results consistent`);
    });
  });

  describe('Multi-File Processing', () => {
    test('should process multiple files efficiently', async () => {
      const startTime = Date.now();

      // Parse all test files
      const results = await Promise.all([
        apiParser.parseOpenAPI(testOpenAPIFile),
        architectureParser.parse(testArchitectureFile),
        featureParser.parse(testFeaturesFile),
        flutterParser.parse(testFlutterFile),
        reactParser.parse(testReactFile)
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all results
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // <10 seconds for all files

      console.log(`Processed 5 files in ${duration}ms (${(duration/5).toFixed(0)}ms avg per file)`);
    });

    test('should generate all digests from complete documentation', async () => {
      const startTime = Date.now();

      // Parse all documentation
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);
      const archResult = await architectureParser.parse(testArchitectureFile);
      const featureResult = await featureParser.parse(testFeaturesFile);
      const flutterResult = await flutterParser.parse(testFlutterFile);
      const reactResult = await reactParser.parse(testReactFile);

      // Generate all digests
      const digests = {
        backend: backendDigest.generate({
          api: apiResult,
          architecture: archResult,
          features: featureResult
        }),
        user: userDigest.generate({
          flutter: flutterResult,
          api: apiResult,
          features: featureResult
        }),
        driver: driverDigest.generate({
          flutter: flutterResult,
          api: apiResult,
          features: featureResult
        }),
        admin: adminDigest.generate({
          react: reactResult,
          api: apiResult,
          features: featureResult
        })
      };

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all digests
      expect(digests.backend.platform).toBe('backend');
      expect(digests.user.platform).toBe('flutter');
      expect(digests.user.app).toBe('user');
      expect(digests.driver.platform).toBe('flutter');
      expect(digests.driver.app).toBe('driver');
      expect(digests.admin.platform).toBe('react');
      expect(digests.admin.app).toBe('admin');

      // Should complete in target time
      expect(duration).toBeLessThan(30000); // <30 seconds for complete documentation

      console.log(`Generated all 4 digests in ${duration}ms`);
      console.log(`- Backend: ${digests.backend.routes.length} routes, ${digests.backend.controllers.length} controllers`);
      console.log(`- User: ${digests.user.screens.length} screens, ${digests.user.widgets.length} widgets`);
      console.log(`- Driver: ${digests.driver.screens.length} screens, ${digests.driver.services.length} services`);
      console.log(`- Admin: ${digests.admin.pages.length} pages, ${digests.admin.components.length} components`);
    });
  });

  describe('Cross-Platform Consistency', () => {
    test('should generate consistent models across platforms', async () => {
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);

      const backendResult = backendDigest.generate({ api: apiResult });
      const userResult = userDigest.generate({ api: apiResult });
      const driverResult = driverDigest.generate({ api: apiResult });

      // All should have models from API
      expect(backendResult.models.length).toBeGreaterThan(0);
      expect(userResult.models.length).toBeGreaterThan(0);
      expect(driverResult.models.length).toBeGreaterThan(0);

      // Model names should be consistent
      const backendModelNames = backendResult.models.map(m => m.name);
      const userModelNames = userResult.models.map(m => m.name);

      userModelNames.forEach(name => {
        expect(backendModelNames).toContain(name);
      });
    });

    test('should generate consistent API services across platforms', async () => {
      const apiResult = await apiParser.parseOpenAPI(testOpenAPIFile);

      const backendResult = backendDigest.generate({ api: apiResult });
      const userResult = userDigest.generate({ api: apiResult });
      const adminResult = adminDigest.generate({ api: apiResult });

      // All should have services
      expect(backendResult.routes.length).toBeGreaterThan(0);
      expect(userResult.services.length).toBeGreaterThan(0);
      expect(adminResult.services.length).toBeGreaterThan(0);

      // Route/service counts should be similar
      const backendEndpointCount = backendResult.routes.reduce(
        (sum, r) => sum + r.endpoints.length, 0
      );
      const userServiceMethodCount = userResult.services.reduce(
        (sum, s) => sum + (s.methods?.length || 0), 0
      );

      expect(Math.abs(backendEndpointCount - userServiceMethodCount)).toBeLessThan(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing files gracefully', async () => {
      const nonExistentFile = path.join(testFixturesDir, 'non-existent.md');

      await expect(async () => {
        await featureParser.parse(nonExistentFile);
      }).rejects.toThrow();
    });

    test('should handle empty/invalid input gracefully', async () => {
      const backendResult = backendDigest.generate({});
      const userResult = userDigest.generate({});
      const driverResult = driverDigest.generate({});
      const adminResult = adminDigest.generate({});

      // Should return valid structure even with empty input
      expect(backendResult.platform).toBe('backend');
      expect(backendResult.routes).toEqual([]);
      expect(userResult.platform).toBe('flutter');
      expect(userResult.screens).toEqual([]);
      expect(driverResult.platform).toBe('flutter');
      expect(driverResult.screens).toEqual([]);
      expect(adminResult.platform).toBe('react');
      expect(adminResult.pages).toEqual([]);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet Phase 2.1 performance targets', async () => {
      const benchmarks = [];

      // Benchmark: API parsing
      let start = Date.now();
      await apiParser.parseOpenAPI(testOpenAPIFile);
      benchmarks.push({ name: 'API parsing', duration: Date.now() - start });

      // Benchmark: Architecture parsing
      start = Date.now();
      await architectureParser.parse(testArchitectureFile);
      benchmarks.push({ name: 'Architecture parsing', duration: Date.now() - start });

      // Benchmark: Feature parsing
      start = Date.now();
      await featureParser.parse(testFeaturesFile);
      benchmarks.push({ name: 'Feature parsing', duration: Date.now() - start });

      // Benchmark: Flutter parsing
      start = Date.now();
      await flutterParser.parse(testFlutterFile);
      benchmarks.push({ name: 'Flutter parsing', duration: Date.now() - start });

      // Benchmark: React parsing
      start = Date.now();
      await reactParser.parse(testReactFile);
      benchmarks.push({ name: 'React parsing', duration: Date.now() - start });

      // All should be under 1 second as per Phase 2.1 requirements
      benchmarks.forEach(b => {
        expect(b.duration).toBeLessThan(1000);
        console.log(`${b.name}: ${b.duration}ms`);
      });

      const avgDuration = benchmarks.reduce((sum, b) => sum + b.duration, 0) / benchmarks.length;
      console.log(`Average parsing time: ${avgDuration.toFixed(0)}ms`);
    });
  });
});
