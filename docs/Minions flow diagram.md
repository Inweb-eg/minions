comprehensive flow diagram of the Minions framework:

  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                                    MINIONS FRAMEWORK                                      │
  │                         Event-Driven Autonomous Agent Orchestration                       │
  └─────────────────────────────────────────────────────────────────────────────────────────┘

                                      ┌─────────────┐
                                      │   README    │
                                      │  (Project)  │
                                      └──────┬──────┘
                                             │
                                             ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                            PHASE 1: VISION AGENT (Product Owner)                         │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │   README.md ──▶ ReadmeParser ──▶ Requirements ──▶ FeatureDecomposer ──▶ Tasks           │
  │                      │                                     │                             │
  │                      ▼                                     ▼                             │
  │              ProductStateManager                  AcceptanceGenerator                    │
  │              (Track Progress)                     (Given/When/Then)                      │
  │                                                                                          │
  └──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                             │
                            REQUIREMENTS_READY event
                                             │
                                             ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                         PHASE 2: ARCHITECT AGENT (Technical Authority)                   │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │   Requirements ──▶ TechSelector ──▶ Tech Stack Decision                                 │
  │        │                                  │                                              │
  │        ▼                                  ▼                                              │
  │   BlueprintGenerator ──────────▶ System Blueprint ──▶ ApiContractManager                │
  │        │                              │                       │                          │
  │        │                              ▼                       ▼                          │
  │        │                      Architecture/              contracts/                      │
  │        │                     (Saved to disk)           (OpenAPI specs)                   │
  │        │                                                                                 │
  │        └────────────────▶ DriftDetector (monitors violations)                           │
  │                                                                                          │
  └──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                             │
                             BLUEPRINT_CREATED event
                                             │
                                             ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                          PHASE 3: PLANNER AGENT (Execution Engine)                       │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │   Tasks + Blueprint ──▶ ExecutionPlanner ──▶ Execution Plan                             │
  │                                │                    │                                    │
  │                                ▼                    ▼                                    │
  │                        AgentCoordinator ◀──── ProgressTracker                           │
  │                                │                    │                                    │
  │                                ▼                    ▼                                    │
  │                        IterationManager ────▶ Build→Test→Fix Cycle                      │
  │                                                                                          │
  └──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                             │
                              TASK_ASSIGNED events
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      │                      │                      │
                      ▼                      ▼                      ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              CODE WRITER AGENTS                                          │
  ├──────────────────────┬──────────────────────┬───────────────────────────────────────────┤
  │                      │                      │                                            │
  │  ┌────────────────┐  │  ┌────────────────┐  │  ┌────────────────┐                       │
  │  │ FlutterWriter  │  │  │ BackendWriter  │  │  │ FrontendWriter │                       │
  │  ├────────────────┤  │  ├────────────────┤  │  ├────────────────┤                       │
  │  │ • Widgets      │  │  │ • Routes       │  │  │ • Components   │                       │
  │  │ • Models       │  │  │ • Models       │  │  │ • Hooks        │                       │
  │  │ • Blocs        │  │  │ • Services     │  │  │ • Stores       │                       │
  │  │ • Services     │  │  │ • Middleware   │  │  │ • Forms        │                       │
  │  │ • Pages        │  │  │ • Validators   │  │  │ • API hooks    │                       │
  │  │ • L10n         │  │  │ • Controllers  │  │  │ • Pages        │                       │
  │  └────────────────┘  │  └────────────────┘  │  └────────────────┘                       │
  │          │           │          │           │          │                                 │
  │          ▼           │          ▼           │          ▼                                 │
  │     lib/*.dart       │     src/*.js         │     src/*.tsx                             │
  │                      │                      │                                            │
  └──────────────────────┴──────────────────────┴───────────────────────────────────────────┘
                                             │
                             CODE_GENERATED events
                                             │
                                             ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              SPECIALIZED AGENTS                                          │
  ├──────────────────────┬──────────────────────┬───────────────────────────────────────────┤
  │                      │                      │                                            │
  │  ┌────────────────┐  │  ┌────────────────┐  │  ┌────────────────┐  ┌────────────────┐  │
  │  │  TesterAgent   │  │  │  DockerAgent   │  │  │  GithubAgent   │  │ DocumentAgent  │  │
  │  ├────────────────┤  │  ├────────────────┤  │  ├────────────────┤  ├────────────────┤  │
  │  │ • Run tests    │  │  │ • Build images │  │  │ • Create PRs   │  │ • Sync docs    │  │
  │  │ • Coverage     │  │  │ • Validate     │  │  │ • Code review  │  │ • Changelog    │  │
  │  │ • Mutations    │  │  │ • Optimize     │  │  │ • Merge        │  │ • API specs    │  │
  │  │ • Benchmarks   │  │  │ • Monitor      │  │  │ • Releases     │  │ • Versioning   │  │
  │  └────────────────┘  │  └────────────────┘  │  └────────────────┘  └────────────────┘  │
  │          │           │                      │                                            │
  │          │           │  ┌────────────────┐  │                                            │
  │          │           │  │CodebaseAnalyzer│  │                                            │
  │          │           │  ├────────────────┤  │                                            │
  │          │           │  │ • Security     │  │                                            │
  │          │           │  │ • Performance  │  │                                            │
  │          │           │  │ • Tech debt    │  │                                            │
  │          │           │  │ • Dependencies │  │                                            │
  │          │           │  └────────────────┘  │                                            │
  │          │           │                      │                                            │
  └──────────┼───────────┴──────────────────────┴───────────────────────────────────────────┘
             │
             │ TESTS_FAILED event
             ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                           AUTONOMOUS FIX LOOP                                            │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │   TESTS_FAILED ──▶ AutonomousLoopManager                                                │
  │                           │                                                              │
  │           ┌───────────────┼───────────────┐                                             │
  │           ▼               ▼               ▼                                             │
  │     ┌──────────┐   ┌──────────────┐  ┌──────────────┐                                  │
  │     │ Tier 1:  │   │   Tier 2:    │  │   Tier 3:    │                                  │
  │     │ AutoFixer│──▶│Platform Agent│──▶│  Escalate   │                                  │
  │     │(Patterns)│   │ (Domain)     │  │  (Human)    │                                  │
  │     └──────────┘   └──────────────┘  └──────────────┘                                  │
  │           │               │                                                              │
  │           └───────────────┼───────────────┐                                             │
  │                           ▼               │                                             │
  │                    Re-run Tests ──────────┘                                             │
  │                           │        (iterate up to maxIterations)                        │
  │                           ▼                                                              │
  │                    TESTS_PASSED ──▶ Complete                                            │
  │                                                                                          │
  └─────────────────────────────────────────────────────────────────────────────────────────┘


  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                         ORCHESTRATION & MANAGEMENT LAYER                                 │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
  │  │                              Orchestrator                                        │   │
  │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │   │
  │  │  │ DependencyGraph  │  │    AgentPool     │  │     ChangeDetector          │  │   │
  │  │  │                  │  │                  │  │                              │  │   │
  │  │  │ • Topological    │  │ • Rate limiting  │  │ • Git monitoring             │  │   │
  │  │  │   sort           │  │ • Cooldowns      │  │ • File change detection      │  │   │
  │  │  │ • Parallel       │  │ • Retry logic    │  │ • Selective re-execution     │  │   │
  │  │  │   groups         │  │ • State tracking │  │                              │  │   │
  │  │  └──────────────────┘  └──────────────────┘  └──────────────────────────────┘  │   │
  │  └─────────────────────────────────────────────────────────────────────────────────┘   │
  │                                                                                          │
  │  Agent A ────┐                                                                          │
  │  Agent B ────┼──▶ Orchestrator ──▶ Build Execution Order ──▶ Execute in Parallel        │
  │  Agent C ────┘         │                                            │                   │
  │                        ▼                                            ▼                   │
  │              Respect Dependencies                          Concurrency Control          │
  │              (Level 0 → 1 → 2...)                          (maxConcurrency: 5)          │
  │                                                                                          │
  └─────────────────────────────────────────────────────────────────────────────────────────┘


  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              FOUNDATION LAYER                                            │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
  │  │                              EventBus (80+ event types)                          │   │
  │  │                                                                                   │   │
  │  │    publish() ──▶ [Event Queue] ──▶ notify subscribers ──▶ history (1000 max)    │   │
  │  │                                                                                   │   │
  │  │    Events: AGENT_*, TESTS_*, CODE_*, FIX_*, HEALTH_*, METRICS_*, ERROR_*        │   │
  │  └─────────────────────────────────────────────────────────────────────────────────┘   │
  │                                           │                                             │
  │              ┌────────────────────────────┼────────────────────────────┐               │
  │              ▼                            ▼                            ▼               │
  │  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐             │
  │  │  MetricsCollector │      │   HealthMonitor  │      │  AlertingSystem  │             │
  │  ├──────────────────┤      ├──────────────────┤      ├──────────────────┤             │
  │  │ • Execution times│      │ • Health scores  │      │ • P1/P2/P3 alerts│             │
  │  │ • Success rates  │      │ • Custom checks  │      │ • Thresholds     │             │
  │  │ • Error rates    │      │ • 60s interval   │      │ • Handlers       │             │
  │  │ • 30s snapshots  │      │                  │      │ • Notifications  │             │
  │  └──────────────────┘      └──────────────────┘      └──────────────────┘             │
  │                                                                                          │
  │  ┌──────────────────┐                                                                   │
  │  │  RollbackManager  │ ◀── Checkpoint before risky operations                          │
  │  ├──────────────────┤                                                                   │
  │  │ • Git state save │ ──▶ Rollback on failure                                          │
  │  │ • File backups   │                                                                   │
  │  │ • Stash changes  │                                                                   │
  │  └──────────────────┘                                                                   │
  │                                                                                          │
  └─────────────────────────────────────────────────────────────────────────────────────────┘


  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                         PHASE 0: FOUNDATION ENHANCEMENTS                                 │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
  │  │   MemoryStore    │  │  DecisionLogger  │  │ EnhancedEventBus │  │  StateMachine  │ │
  │  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤  ├────────────────┤ │
  │  │ SQLite backend   │  │ Track decisions  │  │ Priority queuing │  │ IDLE           │ │
  │  │ Key-value store  │  │ Outcomes         │  │ Request/Response │  │   ↓            │ │
  │  │ TTL support      │  │ Query history    │  │ Broadcast        │  │ PLANNING       │ │
  │  │ Namespaces       │  │ Learning         │  │ Persistence      │  │   ↓            │ │
  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │ EXECUTING      │ │
  │          │                      │                     │            │   ↓            │ │
  │          └──────────────────────┼─────────────────────┘            │ COMPLETED      │ │
  │                                 ▼                                   └────────────────┘ │
  │                        Persistent Storage                                               │
  │                     (./data/minions-memory.db)                                         │
  │                                                                                          │
  └─────────────────────────────────────────────────────────────────────────────────────────┘


  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                                    SKILLS LAYER                                          │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
  │  │  AutoFixer  │ │CodeReviewer │ │ Security    │ │    Test     │ │ Dependency  │       │
  │  │             │ │             │ │  Scanner    │ │  Generator  │ │  Analyzer   │       │
  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
  │         │               │               │               │               │               │
  │         └───────────────┴───────────────┴───────────────┴───────────────┘               │
  │                                         │                                                │
  │                              Extend BaseSkill                                           │
  │                    (onInitialize, execute, startRun, completeRun)                       │
  │                                                                                          │
  └─────────────────────────────────────────────────────────────────────────────────────────┘


  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                               COMPLETE DATA FLOW                                         │
  ├─────────────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                          │
  │   README.md                                                                              │
  │       │                                                                                  │
  │       ▼                                                                                  │
  │   Vision Agent ──▶ Requirements + Tasks                                                 │
  │       │                                                                                  │
  │       ▼                                                                                  │
  │   Architect Agent ──▶ Blueprint + Contracts                                             │
  │       │                                                                                  │
  │       ▼                                                                                  │
  │   Planner Agent ──▶ Execution Plan                                                      │
  │       │                                                                                  │
  │       ├──▶ Writer Agents ──▶ Generated Code                                             │
  │       │                           │                                                      │
  │       │                           ▼                                                      │
  │       ├──▶ Tester Agent ──▶ Test Results                                                │
  │       │         │                                                                        │
  │       │         ├── PASS ──▶ Docker Agent ──▶ Build & Deploy                            │
  │       │         │                   │                                                    │
  │       │         │                   ▼                                                    │
  │       │         │           Github Agent ──▶ PR & Release                               │
  │       │         │                                                                        │
  │       │         └── FAIL ──▶ AutoFixer ──▶ Fix & Retry                                  │
  │       │                                                                                  │
  │       └──▶ Document Agent ──▶ Updated Docs                                              │
  │                                                                                          │
  │   All Steps: EventBus ◀──▶ Metrics ◀──▶ Health ◀──▶ Alerts                             │
  │                                                                                          │
  └─────────────────────────────────────────────────────────────────────────────────────────┘

  This diagram shows:

  1. Phase 1-3 Strategic Flow: README → Vision → Architect → Planner
  2. Code Generation: Three writer agents (Flutter, Backend, Frontend)
  3. Specialized Agents: Testing, Docker, GitHub, Codebase Analysis, Documentation
  4. Autonomous Fix Loop: Tiered approach (AutoFixer → Platform Agent → Escalate)
  5. Orchestration: Dependency graph, agent pool, concurrency control
  6. Foundation: EventBus (80+ events), Metrics, Health, Alerting, Rollback
  7. Phase 0 Enhancements: MemoryStore, DecisionLogger, EnhancedEventBus, StateMachine
  8. Skills Layer: Reusable capabilities extending BaseSkill
