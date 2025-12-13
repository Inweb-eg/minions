# Docker-Agent

Comprehensive Docker management system with build, validation, optimization, and monitoring capabilities.

## Overview

Docker-Agent is a complete solution for managing Docker containers and images throughout their lifecycle. It provides automated change detection, intelligent building, comprehensive validation, optimization recommendations, and real-time monitoring.

## Architecture

The Docker-Agent is organized into five main modules:

### 1. Detectors (Phase 8.1)
Change detection system that monitors project files and triggers rebuilds when necessary.

**Components:**
- `DependencyChangeDetector` - Monitors package.json, package-lock.json, and other dependency files
- `FileChangeDetector` - Tracks source code, configuration, and static asset changes
- `ConfigChangeDetector` - Watches Dockerfile, docker-compose.yml, and related configurations

**Features:**
- File hashing for change detection
- Severity categorization (CRITICAL, HIGH, MEDIUM, LOW)
- Change history tracking
- Automatic rebuild requirement detection

### 2. Builders (Phase 8.2)
Docker image building system with support for multi-stage builds and optimization.

**Components:**
- `BackendBuilder` - Builds backend service images
- `AdminBuilder` - Builds admin dashboard images
- `BaseBuilder` - Abstract base class with common build functionality

**Features:**
- Multi-stage build support
- Build caching strategies
- Tag management
- Registry push capabilities
- Build history and statistics
- Context validation

**Build Targets:**
- Development
- Production
- Test/Preview

### 3. Validators (Phase 8.3)
Comprehensive validation system for Docker configurations and builds.

**Components:**
- `DockerfileValidator` - Validates Dockerfile syntax and best practices
- `ComposeValidator` - Validates docker-compose.yml files
- `BuildValidator` - Validates build results and image quality
- `HealthValidator` - Validates health check configurations

**Validation Rules:**
- Dockerfile: 9 rule categories (base image, version pinning, user, etc.)
- Compose: 10 rule categories (services, networks, volumes, etc.)
- Build: Size, layer count, and build time thresholds
- Health: Configuration and runtime health checks

### 4. Optimizers & Security (Phase 8.4)
Image optimization and security scanning system.

**Components:**
- `LayerAnalyzer` - Analyzes and optimizes Docker image layers
- `SizeOptimizer` - Provides recommendations for reducing image size
- `VulnerabilityScanner` - Scans for security vulnerabilities

**Optimization Strategies:**
- Base image optimization (Alpine variants)
- Multi-stage build recommendations
- Cache cleanup
- Dependency optimization
- Layer consolidation

**Security Features:**
- Base image vulnerability scanning
- Configuration security checks
- Hardcoded secrets detection
- Running as root detection

### 5. Monitors & Integration (Phase 8.5)
Real-time monitoring system for container health and resources.

**Components:**
- `HealthMonitor` - Monitors container health status
- `ResourceMonitor` - Tracks CPU, memory, and network usage

**Monitoring Features:**
- Auto-discovery of running containers
- Configurable check intervals
- Alert generation with severity levels
- Metric collection and history
- Event-driven architecture

## Usage

### Basic Usage

```javascript
import { initialize, shutdown } from './docker-agent/index.js';

// Initialize all components
const agent = await initialize({
  enableDetectors: true,
  enableBuilders: true,
  enableValidators: true,
  enableOptimizers: true,
  enableMonitors: true,
  monitorOptions: {
    autoStart: true,
    autoDiscover: true,
    healthInterval: 30000,
    resourceInterval: 10000
  }
});

// Use components
const { detectors, builders, validators, optimizers, monitors } = agent;

// Shutdown when done
await shutdown(agent);
```

### Change Detection

```javascript
import { getDependencyChangeDetector } from './docker-agent/detectors/index.js';

const detector = getDependencyChangeDetector();

const changes = await detector.detect({
  projectPath: '/path/to/project',
  compareWithPrevious: true
});

if (detector.requiresRebuild(changes)) {
  console.log('Rebuild required due to dependency changes');
}
```

### Building Images

```javascript
import { getBackendBuilder } from './docker-agent/builders/index.js';

const builder = getBackendBuilder();

// Build production image
const result = await builder.buildProduction({
  context: 'backend',
  tag: 'tuktuk/backend:v1.0.0',
  optimize: true
});

if (result.success) {
  console.log(`Build completed: ${result.imageId}`);
  console.log(`Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
}
```

### Validation

```javascript
import { validateDockerSetup } from './docker-agent/validators/index.js';

const result = await validateDockerSetup({
  dockerfilePath: 'Dockerfile',
  composePath: 'docker-compose.yml',
  buildResult: buildResult,
  containerId: 'abc123'
});

if (!result.valid) {
  console.log(`Found ${result.summary.errors} errors`);
  console.log(`Found ${result.summary.warnings} warnings`);
}
```

### Optimization

```javascript
import { optimizeImage } from './docker-agent/optimizers/index.js';

const result = await optimizeImage({
  tag: 'tuktuk/backend:latest',
  level: 'moderate'
});

console.log(`${result.recommendations.length} optimization recommendations`);
result.recommendations.forEach(rec => {
  console.log(`- [${rec.impact}] ${rec.description}`);
});
```

### Monitoring

```javascript
import { startAllMonitors, getMonitoringDashboard } from './docker-agent/monitors/index.js';

// Start monitoring
await startAllMonitors({
  autoDiscover: true,
  healthInterval: 30000,
  resourceInterval: 10000,
  thresholds: {
    cpu: 80,
    memory: 85
  }
});

// Get dashboard data
const dashboard = getMonitoringDashboard();
console.log('Health Summary:', dashboard.health);
console.log('Resource Summary:', dashboard.resources);
console.log('Recent Alerts:', dashboard.alerts);
```

## Configuration

### Thresholds

Customize validation and monitoring thresholds:

```javascript
// Build validator thresholds
buildValidator.setThresholds({
  maxSize: 600 * 1024 * 1024,  // 600 MB
  maxLayers: 40,
  maxBuildTime: 12 * 60 * 1000  // 12 minutes
});

// Resource monitor thresholds
resourceMonitor.setThresholds({
  cpu: 75,          // 75% CPU
  memory: 80        // 80% memory
});
```

### Monitoring Intervals

```javascript
healthMonitor.setInterval(60000);      // 60 seconds
resourceMonitor.setInterval(15000);    // 15 seconds
```

## Events

All monitors emit events that you can listen to:

```javascript
import { setupMonitorHandlers } from './docker-agent/monitors/index.js';

setupMonitorHandlers({
  onHealthAlert: (alert) => {
    console.log(`Health Alert: ${alert.message}`);
  },
  onResourceAlert: (alert) => {
    console.log(`Resource Alert: ${alert.message}`);
  },
  onHealthMetric: (metric) => {
    // Handle health metrics
  },
  onResourceMetric: (metric) => {
    // Handle resource metrics
  }
});
```

## Module Statistics

Get statistics from any module:

```javascript
// Build statistics
const buildStats = backendBuilder.getStatistics();
console.log(`Success rate: ${buildStats.successRate}%`);
console.log(`Average build time: ${buildStats.avgDuration}ms`);

// Validation statistics
const validationStats = dockerfileValidator.getStatistics();
console.log(`Pass rate: ${validationStats.passRate}%`);

// Alert statistics
const alertStats = healthMonitor.getAlertStatistics();
console.log(`Critical alerts: ${alertStats.critical}`);
```

## Dependencies

- `dockerode` - Docker Engine API client
- `yaml` - YAML parser for docker-compose files
- `tar` - Tarball creation for build contexts

## Integration with Manager-Agent

The Docker-Agent is designed to integrate with the Manager-Agent for orchestrated build and deployment workflows:

1. Manager-Agent detects changes using Docker-Agent detectors
2. Triggers builds through Docker-Agent builders
3. Validates results with Docker-Agent validators
4. Optimizes images using Docker-Agent optimizers
5. Monitors running containers with Docker-Agent monitors

## Best Practices

1. **Change Detection**: Enable file watchers to automatically detect changes
2. **Building**: Use multi-stage builds for production images
3. **Validation**: Validate both Dockerfile and build results
4. **Optimization**: Run optimization analysis after each build
5. **Monitoring**: Set appropriate thresholds for your application
6. **Security**: Regularly scan images for vulnerabilities

## Troubleshooting

### Build Failures
- Check Dockerfile syntax with DockerfileValidator
- Validate build context with builder.validateContext()
- Review build logs in buildResult.logs

### High Resource Usage
- Check ResourceMonitor alerts for specific containers
- Analyze resource trends with getMetrics()
- Optimize images with SizeOptimizer

### Health Check Issues
- Validate health check configuration with HealthValidator
- Monitor health status changes with HealthMonitor
- Check container logs for health check failures

## License

Internal use only - Tuktuk project

## Version

1.0.0 - Phase 8 Complete
