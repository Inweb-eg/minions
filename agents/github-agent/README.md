# GitHub-Agent

Complete GitHub automation system with PR, review, merge, and release capabilities.

## Overview

GitHub-Agent is a comprehensive solution for automating GitHub workflows. It provides intelligent branch management, automated code reviews, merge automation, issue management, and release creation with analytics.

## Architecture

The GitHub-Agent is organized into four main modules:

### 1. Branches & PR Management (Phase 9.1)
Complete branch and pull request lifecycle management.

**Components:**
- `BranchManager` - Creates, manages, and synchronizes branches
- `PRManager` - Creates and manages pull requests with smart features

**Features:**
- Automatic branch creation with naming conventions
- Conflict detection and auto-resolution
- Smart PR title/body generation from commits
- Intelligent reviewer selection
- Label and assignee management
- Draft/ready state handling

### 2. Code Review Engine (Phase 9.2)
Automated code analysis and review posting.

**Components:**
- `CodeAnalyzer` - Analyzes JavaScript, TypeScript, Dart, and React code
- `ReviewCommenter` - Posts review comments to GitHub
- `ReviewDecision` - Makes approval/rejection decisions

**Analysis Rules (10 categories):**
- Console statements detection
- TODO/FIXME comments
- Debugging code (debugger, .only(), print())
- Large files (> 500 lines)
- Code complexity (nesting levels)
- Security issues (eval, innerHTML, hardcoded secrets)
- Best practices (var vs let/const, == vs ===)
- Naming conventions
- Error handling
- Type usage (TypeScript)

**Decision Criteria:**
- Code quality (30% weight)
- Test coverage (20% weight)
- PR size (10% weight)
- Merge conflicts (15% weight)
- CI status (15% weight)
- Security (10% weight)

### 3. Merge & Issue Management (Phase 9.3)
Intelligent merge automation and issue creation.

**Components:**
- `MergeManager` - Handles PR merging with condition checking
- `IssueManager` - Creates and manages issues

**Merge Features:**
- Merge condition checking (approvals, CI, conflicts)
- Auto-merge with configurable rules
- Multiple merge methods (merge, squash, rebase)
- Merge status tracking

**Issue Features:**
- Auto-create issues from test failures
- Smart assignee selection
- Label management
- Issue templates
- PR-to-issue linking

### 4. Release & Analytics (Phase 9.4)
Release automation and team performance analytics.

**Components:**
- `ReleaseManager` - Creates releases with changelog generation
- `Analytics` - Tracks PR health, velocity, and bottlenecks

**Release Features:**
- Automatic changelog generation from commits
- Categorized changes (breaking, features, fixes, improvements)
- Version calculation (major, minor, patch)
- Release drafts and pre-releases

**Analytics Metrics:**
- PR health score (0-100)
- Average time to merge
- Merge rate
- Velocity tracking
- Top contributors
- Bottleneck detection (review, CI, merge, stale PRs)

## Usage

### Basic Setup

```javascript
import { initialize, shutdown } from './github-agent/index.js';

// Initialize all components
const agent = await initialize({
  auth: process.env.GITHUB_TOKEN,
  owner: 'tuktuk',
  repo: 'backend',
  workingDir: process.cwd()
});

// Use components
const { branches, reviews, merges, releases } = agent;

// Shutdown when done
await shutdown(agent);
```

### Branch Management

```javascript
import { getBranchManager } from './github-agent/branches/index.js';

const branchManager = getBranchManager();
await branchManager.initialize({
  auth: process.env.GITHUB_TOKEN,
  owner: 'tuktuk',
  repo: 'backend',
  workingDir: process.cwd()
});

// Create feature branch
const result = await branchManager.createBranch({
  type: 'feature',
  name: 'feature/add-authentication',
  push: true,
  checkout: true
});

// Check for conflicts
const conflicts = await branchManager.checkConflicts({
  branchName: 'feature/add-authentication',
  targetBranch: 'main'
});

if (conflicts.data.hasConflicts) {
  // Auto-resolve simple conflicts
  await branchManager.resolveConflicts({
    branchName: 'feature/add-authentication',
    strategy: 'ours'
  });
}
```

### Pull Request Management

```javascript
import { getPRManager } from './github-agent/branches/index.js';

const prManager = getPRManager();
await prManager.initialize({ /* config */ });

// Create PR with auto-generated content
const pr = await prManager.createPR({
  head: 'feature/add-authentication',
  base: 'main',
  title: 'Add User Authentication',
  autoGenerate: true,  // Auto-generate title/body from commits
  assignReviewers: true,
  labels: ['enhancement', 'backend']
});

console.log(`PR created: ${pr.data.url}`);
```

### Code Review

```javascript
import { performCodeReview } from './github-agent/reviews/index.js';

// Perform complete code review
const review = await performCodeReview({
  prNumber: 123,
  postComments: true,
  autoDecision: true,
  requireTests: true,
  requireCIPass: true,
  maxPRSize: 500
});

console.log(`Found ${review.analysis.issues.length} issues`);
console.log(`Decision: ${review.decision.event}`);
console.log(`Approved: ${review.decision.approved}`);
```

### Individual Code Analysis

```javascript
import { getCodeAnalyzer } from './github-agent/reviews/index.js';

const analyzer = getCodeAnalyzer();
await analyzer.initialize({ /* config */ });

const analysis = await analyzer.review({
  prNumber: 123,
  enabledRules: ['CA001', 'CA003', 'CA006'] // Specific rules only
});

analysis.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.message}`);
  console.log(`  File: ${issue.file}:${issue.line}`);
  if (issue.suggestion) {
    console.log(`  Suggestion: ${issue.suggestion}`);
  }
});
```

### Merge Management

```javascript
import { getMergeManager } from './github-agent/merges/index.js';

const mergeManager = getMergeManager();
await mergeManager.initialize({ /* config */ });

// Check merge conditions
const conditions = await mergeManager.checkMergeConditions({
  prNumber: 123
});

if (conditions.data.canMerge) {
  // Merge PR
  const result = await mergeManager.mergePR({
    prNumber: 123,
    method: 'squash'
  });
  console.log(`Merged: ${result.data.merged}`);
} else {
  console.log('Blockers:', conditions.data.blockers);
}

// Enable auto-merge
mergeManager.enableAutoMerge({
  requireReviews: 1,
  requireCIPass: true,
  mergeMethod: 'squash'
});
```

### Issue Management

```javascript
import { getIssueManager } from './github-agent/merges/index.js';

const issueManager = getIssueManager();
await issueManager.initialize({ /* config */ });

// Create issue from test failure
const issue = await issueManager.createIssueFromTestFailure({
  testName: 'User authentication flow',
  errorMessage: 'Expected 200, got 401',
  stackTrace: '...',
  file: 'tests/auth.test.js',
  line: 45,
  prNumber: 123
});

console.log(`Issue created: #${issue.data.number}`);

// Link issue to PR
await issueManager.linkIssueToPR(issue.data.number, 123);

// Close issue when fixed
await issueManager.closeWithPR(issue.data.number, 124);
```

### Release Management

```javascript
import { getReleaseManager } from './github-agent/releases/index.js';

const releaseManager = getReleaseManager();
await releaseManager.initialize({ /* config */ });

// Create release with auto-generated changelog
const release = await releaseManager.createNextRelease({
  releaseType: 'minor',  // v1.0.0 -> v1.1.0
  generateChangelog: true
});

console.log(`Release created: ${release.data.url}`);

// Manual changelog generation
const changelog = await releaseManager.generateChangelog(
  'v1.0.0',
  'v1.1.0'
);
console.log(changelog);
```

### Analytics

```javascript
import { getAnalytics } from './github-agent/releases/index.js';

const analytics = getAnalytics();
await analytics.initialize({ /* config */ });

// Analyze PR health
const health = await analytics.analyzePRHealth({
  period: 'month'
});

console.log(`Health Score: ${health.data.healthScore}/100`);
console.log(`Merge Rate: ${health.data.mergeRate}%`);
console.log(`Average Time to Merge: ${health.data.averageTimeToMerge}h`);
console.log(`Stale PRs: ${health.data.stalePRs.length}`);

// Track velocity
const velocity = await analytics.trackVelocity({
  period: 'month'
});

console.log(`PRs Merged: ${velocity.data.mergedPRs}`);
console.log(`Average PRs/Week: ${velocity.data.averagePRsPerWeek}`);
console.log('Top Contributors:', velocity.data.topContributors);

// Detect bottlenecks
const bottlenecks = await analytics.detectBottlenecks({
  period: 'month'
});

bottlenecks.data.bottlenecks.forEach(bottleneck => {
  console.log(`[${bottleneck.severity}] ${bottleneck.type}: ${bottleneck.message}`);
  if (bottleneck.recommendation) {
    console.log(`  → ${bottleneck.recommendation}`);
  }
});
```

### Complete PR Workflow

```javascript
import { initialize, completePRWorkflow } from './github-agent/index.js';

const agent = await initialize({ /* config */ });

// Complete workflow: branch → PR → review → merge
const workflow = await completePRWorkflow({
  branchName: 'feature/new-feature',
  prTitle: 'Add New Feature',
  autoReview: true,
  autoMerge: true,
  components: agent
});

console.log('Branch Created:', workflow.summary.branchCreated);
console.log('PR Created:', workflow.summary.prCreated);
console.log('Reviewed:', workflow.summary.reviewed);
console.log('Merged:', workflow.summary.merged);
```

## Configuration

### Environment Variables

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_OWNER=tuktuk
GITHUB_REPO=backend
```

### Auto-Merge Configuration

```javascript
mergeManager.enableAutoMerge({
  requireReviews: 2,          // Require 2 approvals
  requireCIPass: true,        // Require CI to pass
  allowConflicts: false,      // Don't merge if conflicts
  mergeMethod: 'squash'       // Use squash and merge
});
```

### Review Decision Weights

```javascript
reviewDecision.setCriteriaWeights({
  code_quality: 0.35,    // Increase code quality weight
  tests: 0.25,           // Increase test weight
  size: 0.05,            // Decrease size weight
  conflicts: 0.15,
  ci_status: 0.15,
  security: 0.05
});
```

## Integration with Manager-Agent

The GitHub-Agent is designed to integrate with the Manager-Agent for orchestrated workflows:

1. **Code changes detected** → Manager triggers PR creation
2. **PR created** → GitHub-Agent performs automated review
3. **Tests fail** → GitHub-Agent creates issues from failures
4. **All checks pass** → GitHub-Agent auto-merges
5. **Release time** → GitHub-Agent creates release with changelog
6. **Continuous monitoring** → GitHub-Agent tracks analytics

## API Reference

### Branch Manager
- `createBranch(options)` - Create new branch
- `deleteBranch(options)` - Delete branch
- `checkConflicts(options)` - Check for conflicts
- `resolveConflicts(options)` - Auto-resolve conflicts
- `listBranches(options)` - List all branches
- `syncBranch(branchName)` - Sync with remote

### PR Manager
- `createPR(options)` - Create pull request
- `updatePR(prNumber, updates)` - Update PR
- `closePR(prNumber)` - Close PR
- `listPRs(options)` - List PRs
- `addLabels(prNumber, labels)` - Add labels
- `assignReviewers(prNumber, branchName)` - Assign reviewers

### Code Analyzer
- `review(options)` - Analyze code
- 10 built-in analysis rules
- Customizable rule sets

### Review Commenter
- `review(options)` - Post review
- `postInlineComment(prNumber, issue)` - Post inline comment
- `postApproval(prNumber, message)` - Approve PR
- `requestChanges(prNumber, message)` - Request changes

### Review Decision
- `review(options)` - Make decision
- Configurable criteria weights
- Score-based approval (0-100)

### Merge Manager
- `checkMergeConditions(options)` - Check if can merge
- `mergePR(options)` - Merge PR
- `autoMerge(prNumber)` - Auto-merge if conditions met
- `enableAutoMerge(config)` - Configure auto-merge

### Issue Manager
- `createIssue(options)` - Create issue
- `createIssueFromTestFailure(options)` - Create from test failure
- `updateIssue(issueNumber, updates)` - Update issue
- `closeIssue(issueNumber, reason)` - Close issue
- `addComment(issueNumber, body)` - Add comment
- `listIssues(options)` - List issues

### Release Manager
- `createRelease(options)` - Create release
- `generateChangelog(fromTag, toTag)` - Generate changelog
- `createNextRelease(options)` - Create next version
- `listReleases(options)` - List releases
- `calculateNextVersion(current, type)` - Calculate version

### Analytics
- `analyzePRHealth(options)` - Analyze PR health
- `trackVelocity(options)` - Track velocity
- `detectBottlenecks(options)` - Detect bottlenecks

## Dependencies

- `@octokit/rest` - GitHub REST API client
- `@octokit/webhooks` - GitHub webhooks
- `simple-git` - Git operations
- `marked` - Markdown processing

## Best Practices

1. **Branch Naming**: Use type prefixes (feature/, bugfix/, hotfix/)
2. **PR Size**: Keep PRs under 500 lines for better reviews
3. **Auto-Merge**: Only enable for trusted teams with good CI
4. **Reviews**: Require at least 1 approval before merge
5. **Analytics**: Monitor health score and address bottlenecks
6. **Issues**: Link issues to PRs for better tracking

## Troubleshooting

### Authentication Errors
- Verify `GITHUB_TOKEN` has required permissions (repo, workflow)
- Token must have write access for PR/issue creation

### Merge Conflicts
- Use `checkConflicts()` before attempting merge
- Auto-resolution works for simple conflicts only
- Manual resolution needed for complex conflicts

### Review Failures
- Check that PR has files changed
- Verify code files are in supported languages
- Some rules may need configuration for your codebase

## License

Internal use only - Tuktuk project

## Version

1.0.0 - Phase 9 Complete
