/**
 * Minions - Architect-Agent Tests
 * ================================
 */

const { ArchitectAgent, AgentState, ArchitectEvents } = require('./index');
const BlueprintGenerator = require('./blueprint-generator');
const ApiContractManager = require('./api-contract-manager');
const TechSelector = require('./tech-selector');
const DriftDetector = require('./drift-detector');

// Test Configuration
const testConfig = {
  projectRoot: '/tmp/test-project',
  architectureDir: 'architecture',
  contractsDir: 'contracts',
  decisionsDir: 'decisions'
};

// Sample Requirements
const sampleRequirements = {
  projectName: 'Minions Ride-Sharing',
  description: 'A ride-sharing platform with user and driver apps',
  features: {
    backend: [
      'User authentication',
      'Ride booking',
      'Real-time tracking',
      'Payment processing'
    ],
    admin: [
      'User management',
      'Driver management',
      'Analytics dashboard'
    ],
    users: [
      'Book rides',
      'Track driver',
      'Payment'
    ],
    drivers: [
      'Accept rides',
      'Navigation',
      'Earnings'
    ]
  },
  scalability: 'moderate',
  teamSize: 'small'
};

// ==================== Unit Tests ====================

async function testArchitectAgent() {
  console.log('\n🧪 Testing Architect-Agent...\n');
  
  const agent = new ArchitectAgent(testConfig);
  
  // Test initialization
  console.log('1. Testing initialization...');
  try {
    await agent.initialize();
    console.log('   ✅ Agent initialized successfully');
    console.log(`   State: ${agent.state}`);
  } catch (error) {
    console.log(`   ❌ Initialization failed: ${error.message}`);
  }
  
  // Test blueprint generation
  console.log('\n2. Testing blueprint generation...');
  try {
    const result = await agent.generateBlueprint(sampleRequirements);
    console.log('   ✅ Blueprint generated successfully');
    console.log(`   Blueprint ID: ${result.blueprint.id}`);
    console.log(`   Tech Stack: ${result.techStack.backend.framework}`);
    console.log(`   Contracts: ${result.contracts.length}`);
  } catch (error) {
    console.log(`   ❌ Blueprint generation failed: ${error.message}`);
  }
  
  // Test code validation
  console.log('\n3. Testing code validation...');
  const testCode = `
    const express = require('express');
    const mongoose = require('mongoose');
    
    router.get('/users', async (req, res) => {
      const users = await mongoose.model('User').find();
      res.json(users);
    });
  `;
  
  try {
    const result = await agent.validateCode({
      filePath: '/backend/src/controllers/user.controller.js',
      content: testCode,
      agent: 'Backend-Agent',
      changeType: 'create'
    });
    console.log('   ✅ Code validation completed');
    console.log(`   Passed: ${result.passed}`);
    console.log(`   Violations: ${result.violations.length}`);
    if (result.violations.length > 0) {
      console.log('   Violations found:');
      result.violations.forEach(v => console.log(`     - ${v.message}`));
    }
  } catch (error) {
    console.log(`   ❌ Code validation failed: ${error.message}`);
  }
  
  // Test metrics
  console.log('\n4. Testing metrics...');
  const metrics = agent.getMetrics();
  console.log('   Agent Metrics:');
  console.log(`   - Blueprints Generated: ${metrics.blueprintsGenerated}`);
  console.log(`   - Contracts Defined: ${metrics.contractsDefined}`);
  console.log(`   - Violations Detected: ${metrics.violationsDetected}`);
  console.log(`   - Decisions Logged: ${metrics.decisionsLogged}`);
  
  return agent;
}

async function testBlueprintGenerator() {
  console.log('\n🧪 Testing Blueprint Generator...\n');
  
  const generator = new BlueprintGenerator(testConfig);
  
  // Test blueprint generation
  console.log('1. Testing blueprint generation...');
  const techStack = {
    backend: { framework: 'express', version: '^4.18.2' },
    database: { type: 'mongodb', orm: 'mongoose' },
    admin: { framework: 'react', version: '^18.2.0' },
    mobile: { framework: 'flutter', version: '^3.16.0' }
  };
  
  try {
    const blueprint = await generator.generate({
      requirements: sampleRequirements,
      techStack,
      existingBlueprint: null
    });
    
    console.log('   ✅ Blueprint generated');
    console.log(`   Pattern: ${blueprint.pattern.primary}`);
    console.log(`   Components: ${Object.keys(blueprint.components).length}`);
    console.log(`   Layers: ${Object.keys(blueprint.layers).length}`);
    console.log(`   Rules: ${blueprint.rules.length}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Test blueprint validation
  console.log('\n2. Testing code validation against blueprint...');
  const badCode = `
    const User = require('../models/user');
    exports.getUsers = async (req, res) => {
      const users = await User.find();
      res.json(users);
    };
  `;
  
  try {
    const mockBlueprint = { rules: [], layers: {}, boundaries: {} };
    const violations = await generator.validateAgainstBlueprint(
      '/backend/src/controllers/user.controller.js',
      badCode,
      mockBlueprint
    );
    console.log(`   ✅ Validation completed`);
    console.log(`   Violations found: ${violations.length}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
}

async function testApiContractManager() {
  console.log('\n🧪 Testing API Contract Manager...\n');
  
  const manager = new ApiContractManager(testConfig);
  
  // Test contract generation
  console.log('1. Testing contract generation...');
  const mockBlueprint = {
    boundaries: {
      contexts: [
        {
          name: 'User Management',
          owner: 'Backend-Agent',
          entities: ['User', 'Profile']
        }
      ]
    },
    security: {
      authentication: { method: 'JWT' }
    }
  };
  
  try {
    const contracts = await manager.generateContracts(mockBlueprint);
    console.log('   ✅ Contracts generated');
    console.log(`   Total contracts: ${contracts.length}`);
    contracts.forEach(c => {
      console.log(`   - ${c.name}: ${c.endpoints?.length || 0} endpoints`);
    });
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Test OpenAPI generation
  console.log('\n2. Testing OpenAPI spec generation...');
  try {
    const spec = manager.generateOpenApiSpec();
    console.log('   ✅ OpenAPI spec generated');
    console.log(`   Version: ${spec.openapi}`);
    console.log(`   Paths: ${Object.keys(spec.paths).length}`);
    console.log(`   Schemas: ${Object.keys(spec.components.schemas).length}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
}

async function testTechSelector() {
  console.log('\n🧪 Testing Tech Selector...\n');
  
  const selector = new TechSelector(testConfig);
  
  // Test stack selection
  console.log('1. Testing stack selection...');
  try {
    const stack = await selector.selectStack(sampleRequirements);
    console.log('   ✅ Stack selected');
    console.log(`   Backend: ${stack.backend.framework} (${stack.backend.version})`);
    console.log(`   Database: ${stack.database.type} with ${stack.database.orm}`);
    console.log(`   Admin: ${stack.admin.framework} + ${stack.admin.stateManagement}`);
    console.log(`   Mobile: ${stack.mobile.framework} + ${stack.mobile.stateManagement}`);
    console.log(`   Compatibility: ${stack.compatibility.verified ? 'Verified ✓' : 'Issues Found'}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Test package.json generation
  console.log('\n2. Testing package.json generation...');
  try {
    const stack = await selector.selectStack(sampleRequirements);
    const pkg = selector.generatePackageJson(stack, 'backend');
    console.log('   ✅ Package.json generated');
    console.log(`   Dependencies: ${Object.keys(pkg.dependencies).length}`);
    console.log(`   DevDependencies: ${Object.keys(pkg.devDependencies).length}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Test compatibility check
  console.log('\n3. Testing compatibility check...');
  console.log(`   express + mongodb: ${selector.areCompatible('express', 'mongodb') ? '✅ Compatible' : '❌ Incompatible'}`);
  console.log(`   react + redux-toolkit: ${selector.areCompatible('react', 'redux-toolkit') ? '✅ Compatible' : '❌ Incompatible'}`);
}

async function testDriftDetector() {
  console.log('\n🧪 Testing Drift Detector...\n');
  
  const detector = new DriftDetector(testConfig);
  
  // Test drift detection
  console.log('1. Testing drift detection...');
  
  const problematicCode = `
    const express = require('express');
    const mongoose = require('mongoose');
    const router = express.Router();
    
    // God object with many responsibilities
    class UserController {
      async getUsers() {}
      async createUser() {}
      async updateUser() {}
      async deleteUser() {}
      async getUserRides() {}
      async getUserPayments() {}
      async sendNotification() {}
      async generateReport() {}
      async exportData() {}
      async importData() {}
      async validateUser() {}
      async authenticateUser() {}
      async authorizeUser() {}
      async logActivity() {}
      async trackMetrics() {}
      async handleWebhook() {}
      async processPayment() {}
      async refundPayment() {}
      async cancelRide() {}
      async completeRide() {}
      async rateDriver() {}
    }
    
    // Hardcoded config
    const DB_URL = 'mongodb://localhost:27017/mydb';
    const API_KEY = 'sk-secret-key-12345';
    
    // Missing error handling
    async function fetchData() {
      const data = await someAsyncOperation();
      return data;
    }
    
    console.log('Debug info');
    
    module.exports = router;
  `;
  
  try {
    const result = await detector.checkDrift(
      '/backend/src/controllers/user.controller.js',
      problematicCode
    );
    
    console.log('   ✅ Drift detection completed');
    console.log(`   Drift Score: ${(result.driftScore * 100).toFixed(1)}%`);
    console.log(`   Issues Found: ${result.issues.length}`);
    console.log('   Issues by category:');
    console.log(`     - Anti-patterns: ${result.details.antiPatterns}`);
    console.log(`     - Layer violations: ${result.details.layerViolations}`);
    console.log(`     - Naming issues: ${result.details.namingIssues}`);
    console.log(`     - Structural issues: ${result.details.structuralIssues}`);
    
    if (result.issues.length > 0) {
      console.log('\n   Sample issues:');
      result.issues.slice(0, 5).forEach(issue => {
        console.log(`     [${issue.severity}] ${issue.name || issue.type}: ${issue.description}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Test clean code
  console.log('\n2. Testing with clean code...');
  const cleanCode = `
    const UserService = require('../services/user.service');
    
    class UserController {
      constructor(userService) {
        this.userService = userService;
      }
      
      async getUsers(req, res) {
        try {
          const users = await this.userService.findAll();
          res.json({ success: true, data: users });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    }
    
    module.exports = UserController;
  `;
  
  try {
    const result = await detector.checkDrift(
      '/backend/src/controllers/user.controller.js',
      cleanCode
    );
    
    console.log('   ✅ Drift detection completed');
    console.log(`   Drift Score: ${(result.driftScore * 100).toFixed(1)}%`);
    console.log(`   Issues Found: ${result.issues.length}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
}

// ==================== Integration Test ====================

async function integrationTest() {
  console.log('\n🔗 Running Integration Test...\n');
  
  const agent = new ArchitectAgent(testConfig);
  await agent.initialize();
  
  // Full workflow test
  console.log('1. Generating blueprint from requirements...');
  const { blueprint, techStack, contracts } = await agent.generateBlueprint(sampleRequirements);
  
  console.log('2. Validating sample code...');
  const codeValidation = await agent.validateCode({
    filePath: '/backend/src/controllers/ride.controller.js',
    content: `
      const RideService = require('../services/ride.service');
      
      exports.createRide = async (req, res) => {
        try {
          const ride = await RideService.create(req.body);
          res.status(201).json(ride);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
    `,
    agent: 'Backend-Agent',
    changeType: 'create'
  });
  
  console.log('3. Getting architecture review...');
  const review = await agent.reviewArchitecture('Backend-Agent');
  
  console.log('4. Getting final metrics...');
  const metrics = agent.getMetrics();
  
  console.log('\n📊 Integration Test Results:');
  console.log(`   Blueprint: ${blueprint.id}`);
  console.log(`   Contracts: ${contracts.length}`);
  console.log(`   Code Valid: ${codeValidation.passed}`);
  console.log(`   Review Findings: ${review.review.findings.length}`);
  console.log(`   Total Decisions: ${metrics.decisionsLogged}`);
  
  console.log('\n✅ Integration test completed successfully!');
}

// ==================== Run Tests ====================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     Minions - Architect-Agent Test Suite       ║');
  console.log('╚════════════════════════════════════════════════╝');
  
  try {
    await testArchitectAgent();
    await testBlueprintGenerator();
    await testApiContractManager();
    await testTechSelector();
    await testDriftDetector();
    await integrationTest();
    
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║          All Tests Completed Successfully       ║');
    console.log('╚════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Export for external use
module.exports = {
  testArchitectAgent,
  testBlueprintGenerator,
  testApiContractManager,
  testTechSelector,
  testDriftDetector,
  integrationTest,
  runAllTests
};

// Run if executed directly
if (require.main === module) {
  runAllTests();
}
