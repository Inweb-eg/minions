# Minions Self-Evolution Plan: Project Management System

## Version: 4.0
## Target: Project Manager Agent + Project Completion Agent

---

## Feature 1: Projects Folder Structure

### Description
Create a projects folder in Minions root to organize all connected external projects.

### File Location
`projects/`

### Implementation Tasks
- Task 1.1: Create projects folder with .gitkeep
- Task 1.2: Create .registry.json schema and initial file
- Task 1.3: Create README.md for projects documentation

---

## Feature 2: Project Manager Agent Core (Silas)

### Description
A new agent named Silas (after Silas Ramsbottom - the Resource Allocator) that manages connections between Minions and external projects following VisionAgent and PlannerAgent patterns.

### File Location
`agents/project-manager-agent/index.js`

### Agent States
- IDLE - Agent is waiting for commands
- INITIALIZING - Agent is starting up
- CONNECTING - Connecting to a new project
- SCANNING - Scanning project structure
- SYNCING - Syncing project state
- ERROR - An error occurred
- SHUTDOWN - Agent is shutting down

### Agent Events
- project:connect - Request to connect a project
- project:connected - Project successfully connected
- project:disconnect - Request to disconnect a project
- project:disconnected - Project successfully disconnected
- project:scan - Request to scan project
- project:scanned - Project scan complete
- project:sync - Request to sync project
- project:synced - Project sync complete
- project:error - An error occurred

### Methods
- initialize - Initialize the agent with optional eventBus
- connect - Connect to a new external project
- disconnect - Disconnect from a project
- scan - Scan project structure and detect frameworks
- list - List all connected projects
- getStatus - Get current agent status
- getProject - Get project by name
- syncProject - Sync project state

### Implementation Tasks
- Task 2.1: Create ProjectManagerAgent class extending EventEmitter
- Task 2.2: Implement initialize method with eventBus connection
- Task 2.3: Implement connect method for new projects
- Task 2.4: Implement disconnect method
- Task 2.5: Implement scan method for project analysis
- Task 2.6: Implement list method to show all projects
- Task 2.7: Implement getStatus method
- Task 2.8: Implement state persistence with saveState and loadExistingState
- Task 2.9: Create singleton pattern with getProjectManager and resetProjectManager

---

## Feature 3: Project Registry

### Description
Sub-component that manages the master registry of all connected projects with persistence.

### File Location
`agents/project-manager-agent/ProjectRegistry.js`

### Methods
- addProject - Add project to registry
- removeProject - Remove project from registry
- getProject - Get project by name
- getAllProjects - List all projects
- updateProject - Update project data
- save - Persist registry to disk
- load - Load registry from disk

### Implementation Tasks
- Task 3.1: Create ProjectRegistry class
- Task 3.2: Implement CRUD operations for projects
- Task 3.3: Implement persistence with registry.json

---

## Feature 4: Project Scanner

### Description
Sub-component that scans external project structure and detects frameworks languages and architecture.

### File Location
`agents/project-manager-agent/ProjectScanner.js`

### Methods
- scan - Full project scan
- detectComponents - Find project components like backend frontend mobile
- detectFramework - Identify framework used Express Next Flutter etc
- detectLanguage - Identify programming language
- generateConfig - Generate project.json configuration

### Implementation Tasks
- Task 4.1: Create ProjectScanner class
- Task 4.2: Implement package.json parser for Node projects
- Task 4.3: Implement pubspec.yaml parser for Flutter projects
- Task 4.4: Implement monorepo detection
- Task 4.5: Implement framework detection patterns
- Task 4.6: Implement project.json generation

---

## Feature 5: Project Initializer

### Description
Sub-component that creates and sets up project workspace folders in the projects directory.

### File Location
`agents/project-manager-agent/ProjectInitializer.js`

### Methods
- initialize - Create project workspace with all required folders
- createFolders - Create folder structure for a project
- createProjectJson - Create project.json configuration file
- createStateJson - Initialize state.json for tracking
- cleanup - Remove project workspace

### Implementation Tasks
- Task 5.1: Create ProjectInitializer class
- Task 5.2: Implement folder creation with proper structure
- Task 5.3: Implement project.json template generation
- Task 5.4: Implement state.json initialization

---

## Feature 6: Project Completion Agent Core (Lucy)

### Description
Agent named Lucy (after Lucy Wilde - the Self-Improvement Engine) that runs autonomous completion loops until a project reaches 100 percent completion with analyze build test fix cycles.

### File Location
`agents/project-completion-agent/index.js`

### Agent States
- IDLE - Waiting for commands
- INITIALIZING - Starting up
- ANALYZING - Detecting gaps in the project
- PLANNING - Creating plan for gaps
- BUILDING - Generating code to fill gaps
- TESTING - Running tests
- FIXING - Auto-fixing issues
- VERIFYING - Checking completion percentage
- PAUSED - Execution paused by user
- COMPLETED - Project 100 percent complete
- ERROR - An error occurred
- SHUTDOWN - Shutting down

### Agent Events
- completion:start - Start autonomous completion
- completion:started - Completion loop started
- completion:pause - Pause completion
- completion:paused - Completion paused
- completion:resume - Resume completion
- completion:resumed - Completion resumed
- completion:stop - Stop completion
- completion:finished - Project completed
- completion:iteration:started - New iteration started
- completion:iteration:completed - Iteration finished
- completion:gap:detected - Gap found in project
- completion:gap:resolved - Gap fixed
- completion:progress:updated - Progress percentage changed
- completion:error - An error occurred

### Methods
- initialize - Initialize the agent
- startCompletion - Start autonomous completion for a project
- pauseCompletion - Pause the completion loop
- resumeCompletion - Resume the completion loop
- stopCompletion - Stop completion entirely
- getProgress - Get current progress percentage
- getGaps - Get list of detected gaps

### Implementation Tasks
- Task 6.1: Create ProjectCompletionAgent class extending EventEmitter
- Task 6.2: Implement initialize method
- Task 6.3: Implement startCompletion method
- Task 6.4: Implement pauseCompletion method
- Task 6.5: Implement resumeCompletion method
- Task 6.6: Implement stopCompletion method
- Task 6.7: Implement getProgress method
- Task 6.8: Implement state persistence
- Task 6.9: Create singleton pattern

---

## Feature 7: Gap Detector

### Description
Sub-component that analyzes projects to find missing features endpoints pages tests and documentation.

### File Location
`agents/project-completion-agent/GapDetector.js`

### Methods
- detect - Full gap detection for a project
- detectBackendGaps - Find missing backend endpoints
- detectFrontendGaps - Find missing frontend pages
- detectTestGaps - Find missing tests
- detectDocumentationGaps - Find missing documentation
- prioritize - Sort gaps by impact and importance
- save - Persist gaps to gaps.json

### Implementation Tasks
- Task 7.1: Create GapDetector class
- Task 7.2: Implement gap type definitions
- Task 7.3: Implement backend gap detection
- Task 7.4: Implement frontend gap detection
- Task 7.5: Implement test gap detection
- Task 7.6: Implement gap prioritization algorithm
- Task 7.7: Implement gaps.json persistence

---

## Feature 8: Completion Tracker

### Description
Sub-component that calculates and tracks completion percentage with history.

### File Location
`agents/project-completion-agent/CompletionTracker.js`

### Methods
- calculate - Calculate completion percentage for a project
- updateProgress - Update progress after gap is resolved
- getHistory - Get progress history for specified days
- save - Persist state to state.json

### Implementation Tasks
- Task 8.1: Create CompletionTracker class
- Task 8.2: Implement completion calculation algorithm
- Task 8.3: Implement progress history tracking
- Task 8.4: Implement state.json updates

---

## Feature 9: Continuous Loop

### Description
Sub-component that manages the autonomous analyze build test fix loop until completion.

### File Location
`agents/project-completion-agent/ContinuousLoop.js`

### Methods
- start - Start the continuous loop
- pause - Pause the loop
- resume - Resume the loop
- stop - Stop the loop
- runIteration - Run one iteration of the loop
- checkCompletion - Check if target completion reached

### Implementation Tasks
- Task 9.1: Create ContinuousLoop class
- Task 9.2: Implement loop state machine
- Task 9.3: Implement iteration runner
- Task 9.4: Implement pause resume mechanism
- Task 9.5: Implement completion check
- Task 9.6: Implement auto-commit integration

---

## Feature 10: Event Types Update

### Description
Add new event types for Project Manager and Project Completion agents to the event bus.

### File Location
`foundation/event-bus/eventTypes.js`

### Implementation Tasks
- Task 10.1: Add project manager event types
- Task 10.2: Add project completion event types

---

## Feature 11: Index Exports Update

### Description
Update the main index.js to export the new agents and their components.

### File Location
`index.js`

### Implementation Tasks
- Task 11.1: Add project manager agent imports and exports
- Task 11.2: Add project completion agent imports and exports
- Task 11.3: Update initializeMinions to optionally enable these agents

---

## Success Criteria

- All features implemented
- All tests passing
- Coverage greater than 85 percent
- Can connect to external project
- Can scan project structure
- Can detect gaps automatically
- Can run autonomous completion loop
- Can pause and resume completion
- Progress persisted across sessions

---

## End of Evolution Plan
