# Minions Gru Evolution Plan: Client Interface System

## Version: 5.0
## Target: Gru Agent + Dr. Nefario Agent + Docker Setup

---

## Feature 1: Gru Agent Core

### Description
Client Interface Agent named Gru (the mastermind) that provides a simple HTML dashboard for discussing projects with clients. Gru collects requirements through AI-powered conversation, presents options, and after approval hands off to Silas and Lucy for execution.

### File Location
`agents/gru-agent/index.js`

### Agent States
- IDLE - Waiting for client connection
- INITIALIZING - Starting up the agent
- LISTENING - Web server running and waiting for requests
- CONVERSING - Active conversation with client
- COLLECTING - Collecting project requirements
- SCANNING - Scanning existing project structure
- PLANNING - Working with Dr. Nefario to create plan
- CONFIRMING - Waiting for client approval
- EXECUTING - Handed off to Silas and Lucy
- PAUSED - Execution paused by user
- ERROR - An error occurred
- SHUTDOWN - Agent is shutting down

### Agent Events
- gru:start - Start the web server
- gru:started - Web server is running
- gru:client:connected - Client connected to interface
- gru:conversation:started - Conversation began
- gru:conversation:message - Message exchanged
- gru:project:new - New project flow started
- gru:project:existing - Existing project flow started
- gru:scan:complete - Project scan completed
- gru:plan:ready - Plan is ready for review
- gru:plan:approved - Client approved the plan
- gru:execution:started - Execution handed to Silas
- gru:execution:paused - Execution paused
- gru:execution:resumed - Execution resumed
- gru:execution:stopped - Execution stopped
- gru:status:update - Status update for UI
- gru:error - An error occurred

### Methods
- initialize - Initialize the agent with eventBus
- start - Start the web server
- stop - Stop the web server
- handleMessage - Process incoming chat message
- startNewProject - Begin new project flow
- startExistingProject - Begin existing project flow
- scanProject - Scan existing project with Silas
- requestPlan - Ask Dr. Nefario to create plan
- approvePlan - Client approves the plan
- startExecution - Hand off to Silas and Lucy
- pauseExecution - Pause current execution
- resumeExecution - Resume paused execution
- stopExecution - Stop execution entirely
- getStatus - Get current status for UI
- broadcastStatus - Send status update to all clients

### Implementation Tasks
- Task 1.1: Create GruAgent class extending EventEmitter
- Task 1.2: Implement initialize method with eventBus connection
- Task 1.3: Implement start method to launch web server
- Task 1.4: Implement handleMessage for conversation routing
- Task 1.5: Implement new project flow methods
- Task 1.6: Implement existing project flow methods
- Task 1.7: Implement execution control methods
- Task 1.8: Implement status broadcasting via WebSocket
- Task 1.9: Create singleton pattern with getGruAgent and resetGruAgent

---

## Feature 2: Web Server

### Description
Sub-component that serves the HTML dashboard and handles WebSocket connections for real-time communication with clients.

### File Location
`agents/gru-agent/WebServer.js`

### Methods
- start - Start Express server on port 2505 or 8005
- stop - Stop the server gracefully
- setupRoutes - Configure HTTP routes
- setupWebSocket - Configure WebSocket for real-time updates
- broadcast - Send message to all connected clients
- sendToClient - Send message to specific client

### Implementation Tasks
- Task 2.1: Create WebServer class extending EventEmitter
- Task 2.2: Implement Express server setup with static file serving
- Task 2.3: Implement WebSocket server for real-time communication
- Task 2.4: Implement broadcast and targeted messaging
- Task 2.5: Implement graceful shutdown

---

## Feature 3: Conversation Engine

### Description
Sub-component that manages AI-powered conversations with clients. Strictly scoped to project-related topics only. Redirects off-topic questions back to the project.

### File Location
`agents/gru-agent/ConversationEngine.js`

### Methods
- initialize - Set up conversation with system prompt
- chat - Send message and get AI response
- isOnTopic - Check if message is project-related
- redirectToTopic - Generate redirect message for off-topic
- summarize - Summarize conversation for plan generation
- getHistory - Get conversation history
- clear - Clear conversation history

### Implementation Tasks
- Task 3.1: Create ConversationEngine class
- Task 3.2: Implement scoped system prompt for project discussions only
- Task 3.3: Implement topic detection and redirection
- Task 3.4: Implement conversation history management
- Task 3.5: Implement conversation summarization for Dr. Nefario

---

## Feature 4: Ollama Adapter

### Description
Sub-component that interfaces with Ollama for local AI responses. Falls back to Gemini if Ollama is not available and API key is provided.

### File Location
`agents/gru-agent/OllamaAdapter.js`

### Methods
- initialize - Check Ollama availability and model
- isAvailable - Check if Ollama is running
- chat - Send message to Ollama and get response
- setModel - Set the model to use
- pullModel - Pull a model if not available
- fallbackToGemini - Switch to Gemini API

### Implementation Tasks
- Task 4.1: Create OllamaAdapter class
- Task 4.2: Implement Ollama HTTP API integration
- Task 4.3: Implement availability checking
- Task 4.4: Implement model management
- Task 4.5: Implement Gemini fallback with API key support

---

## Feature 5: Project Intake

### Description
Sub-component that handles the two project intake flows - new projects and existing projects. For existing projects uses auto-detection with confirmation.

### File Location
`agents/gru-agent/ProjectIntake.js`

### Methods
- startNewProject - Begin new project intake
- startExistingProject - Begin existing project intake
- collectProjectInfo - Collect basic project information
- detectProjectStructure - Auto-detect project structure using Silas scanner
- confirmStructure - Present detected structure for confirmation
- collectMissingPaths - Ask for any missing paths
- generateProjectConfig - Create project configuration

### Implementation Tasks
- Task 5.1: Create ProjectIntake class
- Task 5.2: Implement new project flow with name and description collection
- Task 5.3: Implement existing project flow with path collection
- Task 5.4: Implement auto-detection using ProjectScanner
- Task 5.5: Implement confirmation and correction flow

---

## Feature 6: Status Tracker

### Description
Sub-component that tracks execution status and broadcasts updates to the UI in real-time.

### File Location
`agents/gru-agent/StatusTracker.js`

### Methods
- start - Start tracking execution
- update - Update current status
- getStatus - Get current status
- getHistory - Get status history
- onSilasEvent - Handle Silas events
- onLucyEvent - Handle Lucy events
- broadcast - Broadcast status to UI

### Implementation Tasks
- Task 6.1: Create StatusTracker class extending EventEmitter
- Task 6.2: Implement status tracking with timestamps
- Task 6.3: Implement Silas and Lucy event handling
- Task 6.4: Implement status history for progress display
- Task 6.5: Implement broadcast mechanism

---

## Feature 7: HTML Dashboard

### Description
Simple HTML CSS and JavaScript dashboard for client interaction. Clean minimal design with chat interface project setup wizard and execution status display.

### File Location
`agents/gru-agent/public/index.html`

### Components
- Chat interface for conversation with Gru
- Project type selector for new vs existing
- Path input for existing projects
- Detected structure display with confirmation
- Feature checklist for new projects
- Plan preview panel
- Approve and Start button
- Execution status panel with progress
- Pause Stop and Resume buttons
- Status log display

### Implementation Tasks
- Task 7.1: Create HTML structure with all panels
- Task 7.2: Create CSS styles for clean minimal design
- Task 7.3: Implement JavaScript WebSocket connection
- Task 7.4: Implement chat interface logic
- Task 7.5: Implement project wizard flow
- Task 7.6: Implement status display with live updates
- Task 7.7: Implement control buttons

---

## Feature 8: Dr. Nefario Agent Core

### Description
User Planning Assistant Agent named Dr. Nefario (the scientist inventor) that converts Gru conversations into structured Minions-format plans. Validates plans follow Minions patterns and architecture.

### File Location
`agents/nefario-agent/index.js`

### Agent States
- IDLE - Waiting for planning requests
- INITIALIZING - Starting up
- ANALYZING - Analyzing conversation summary
- EXTRACTING - Extracting features from requirements
- GENERATING - Generating plan structure
- VALIDATING - Validating plan follows Minions patterns
- COMPLETE - Plan is ready
- ERROR - An error occurred
- SHUTDOWN - Shutting down

### Agent Events
- nefario:plan:requested - Plan generation requested
- nefario:analyzing - Analyzing requirements
- nefario:features:extracted - Features extracted from conversation
- nefario:plan:generated - Plan structure generated
- nefario:plan:validated - Plan validated successfully
- nefario:plan:ready - Plan is ready to use
- nefario:error - An error occurred

### Methods
- initialize - Initialize the agent
- generatePlan - Generate plan from conversation summary
- extractFeatures - Extract features from requirements
- structurePlan - Create Minions-format plan structure
- validatePlan - Validate plan follows patterns
- savePlan - Save plan to file
- getPlan - Get current plan

### Implementation Tasks
- Task 8.1: Create NefarioAgent class extending EventEmitter
- Task 8.2: Implement initialize method
- Task 8.3: Implement generatePlan orchestration method
- Task 8.4: Implement feature extraction with AI assistance
- Task 8.5: Implement plan structuring in Minions format
- Task 8.6: Implement plan validation
- Task 8.7: Implement plan persistence
- Task 8.8: Create singleton pattern

---

## Feature 9: Plan Generator

### Description
Sub-component that generates structured plans in Minions evolution format from extracted features and requirements.

### File Location
`agents/nefario-agent/PlanGenerator.js`

### Methods
- generate - Generate complete plan from features
- createFeatureSection - Create feature section in plan format
- createTaskList - Create task list for feature
- createAgentDefinition - Create agent definition if needed
- createSubComponentDefinition - Create sub-component definition
- formatAsMarkdown - Format plan as markdown

### Implementation Tasks
- Task 9.1: Create PlanGenerator class
- Task 9.2: Implement plan structure generation
- Task 9.3: Implement feature section formatting
- Task 9.4: Implement task breakdown logic
- Task 9.5: Implement markdown output generation

---

## Feature 10: Plan Validator

### Description
Sub-component that validates generated plans follow Minions architecture patterns and conventions.

### File Location
`agents/nefario-agent/PlanValidator.js`

### Methods
- validate - Full plan validation
- checkStructure - Validate plan structure
- checkNamingConventions - Check names follow patterns
- checkStateDefinitions - Validate state definitions
- checkEventDefinitions - Validate event definitions
- checkMethodSignatures - Validate method definitions
- getErrors - Get validation errors
- getWarnings - Get validation warnings

### Implementation Tasks
- Task 10.1: Create PlanValidator class
- Task 10.2: Implement structure validation
- Task 10.3: Implement naming convention checks
- Task 10.4: Implement state and event validation
- Task 10.5: Implement error and warning collection

---

## Feature 11: Feature Extractor

### Description
Sub-component that uses AI to extract structured features from conversation summary.

### File Location
`agents/nefario-agent/FeatureExtractor.js`

### Methods
- extract - Extract features from conversation
- parseRequirements - Parse requirements into structured format
- identifyComponents - Identify required components
- prioritizeFeatures - Assign priority to features
- groupByCategory - Group features by category

### Implementation Tasks
- Task 11.1: Create FeatureExtractor class
- Task 11.2: Implement AI-powered feature extraction
- Task 11.3: Implement component identification
- Task 11.4: Implement prioritization logic
- Task 11.5: Implement categorization

---

## Feature 12: Docker Setup

### Description
Docker configuration for running Minions with integrated Ollama for fully self-contained AI-powered project management.

### File Location
`docker/Dockerfile`

### Components
- Dockerfile with Node.js and Ollama
- docker-compose.yml for easy startup
- Setup script for model download
- Environment configuration

### Implementation Tasks
- Task 12.1: Create Dockerfile with multi-stage build
- Task 12.2: Create docker-compose.yml with Ollama service
- Task 12.3: Create entrypoint script for initialization
- Task 12.4: Create setup script for model pulling
- Task 12.5: Create environment configuration template

---

## Feature 13: Event Types Update

### Description
Add new event types for Gru and Dr. Nefario agents to the event bus.

### File Location
`foundation/event-bus/eventTypes.js`

### Implementation Tasks
- Task 13.1: Add Gru agent event types
- Task 13.2: Add Dr. Nefario agent event types

---

## Feature 14: Index Exports Update

### Description
Update the main index.js to export the new agents and their components.

### File Location
`index.js`

### Implementation Tasks
- Task 14.1: Add Gru agent imports and exports
- Task 14.2: Add Dr. Nefario agent imports and exports
- Task 14.3: Update initializeMinions to optionally enable these agents

---

## Success Criteria

- All features implemented
- All tests passing
- Coverage greater than 85 percent
- Web server starts on port 2505 or 8005
- AI conversation works with Ollama
- Topic scoping prevents off-topic chat
- New project flow creates folder and plan
- Existing project flow auto-detects structure
- Plan generation follows Minions format
- Plan validation catches errors
- Approval triggers Silas and Lucy execution
- Status updates broadcast to UI in real-time
- Pause stop resume controls work
- Docker container runs self-contained

---

## End of Evolution Plan
