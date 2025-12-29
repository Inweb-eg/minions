# Minions Projects

This folder contains all projects connected to Minions for autonomous completion.

## Structure

Each project gets its own subfolder:

```
projects/
├── .registry.json          # Master registry of all connected projects
├── README.md               # This file
└── {project-name}/         # Per-project folder
    ├── project.json        # Project configuration & metadata
    ├── state.json          # Current completion state
    ├── gaps.json           # Detected gaps/missing features
    ├── decisions.json      # Decision log
    ├── progress/           # Progress history by date
    ├── generated/          # Code staged before commit
    └── reports/            # Analysis reports
```

## Commands

```bash
# Connect a project
node minions.js project connect /path/to/project --name=myproject

# List projects
node minions.js project list

# Start autonomous completion
node minions.js complete myproject --target=100%
```
