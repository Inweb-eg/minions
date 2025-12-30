# Gru Agent Usage Guide

Complete guide for setting up and using Gru Agent - the conversational web interface for the Minions framework.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker (Recommended)](#quick-start-with-docker-recommended)
- [Ollama Setup (Manual)](#ollama-setup-manual)
  - [Installing Ollama](#installing-ollama)
  - [Pulling Models](#pulling-models)
  - [Running Ollama](#running-ollama)
- [Gemini API (Alternative)](#gemini-api-alternative)
- [Starting Gru Agent](#starting-gru-agent)
  - [Using Docker (Recommended)](#using-docker-recommended)
  - [Using Node.js](#using-nodejs)
- [Using the Web Interface](#using-the-web-interface)
  - [Chat Screen](#chat-screen)
  - [Project Screen](#project-screen)
  - [Plan Screen](#plan-screen)
  - [Execution Screen](#execution-screen)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Overview

Gru Agent is the main coordinator agent that provides a conversational web interface for users to interact with the Minions framework. Named after the character from Despicable Me, Gru coordinates all the other agents (his "minions") to complete software development tasks.

**Key Features:**
- Conversational AI interface powered by Ollama or Gemini
- General chat support (not limited to project topics)
- Conversation history with persistence and CRUD operations
- Project scanning and framework detection
- Docker project discovery from mounted volumes
- Interactive plan creation and approval
- Real-time execution monitoring with progress tracking
- Gap detection and autonomous completion
- Learning system monitoring dashboard (`/evolve`)

---

## Prerequisites

Before using Gru Agent, ensure you have:

- **Docker** and **Docker Compose** (recommended) OR
- **Node.js 18+** with **npm** or **yarn**
- **Ollama** (if not using Docker) or **Gemini API key**
- **Git** for version control

---

## Quick Start with Docker (Recommended)

The easiest way to get started is with Docker, which runs Ollama and Minions in separate containers:

```bash
# Clone the repository
git clone https://github.com/your-org/minions.git
cd minions/docker

# Start the two-container setup (Ollama + Minions)
docker compose up -d

# Pull the deepseek-coder model (optimized for code generation)
docker exec minions-ollama ollama pull deepseek-coder:6.7b

# Restart Minions to connect with the model
docker restart minions

# Access the web interface
open http://localhost:2505
```

**Two-Container Architecture:**

```
┌─────────────────────┐     ┌─────────────────────┐
│   minions-ollama    │     │      minions        │
│  (Ollama + Models)  │◄────│   (Web Interface)   │
│   Port: 11434       │     │    Port: 2505       │
│   Volume: models    │     │   Volume: data      │
└─────────────────────┘     └─────────────────────┘
```

**Benefits:**
- Models persist in Docker volume (survives rebuilds)
- Rebuild Minions without re-downloading models
- Separate scaling and resource management

**Rebuild Minions Only (models preserved):**
```bash
docker compose down minions
docker compose build --no-cache minions
docker compose up -d minions
```

**GPU Support (NVIDIA):**
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

---

## Ollama Setup (Manual)

[Ollama](https://ollama.com) is a local LLM runtime that enables AI capabilities without external API calls. This is the recommended setup for privacy and cost-free usage.

### Installing Ollama

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.com/download/mac
```

**Windows:**
```powershell
# Download the installer from https://ollama.com/download/windows
# Or use WSL2 with the Linux installation
```

### Pulling Models

After installing Ollama, pull a language model. We recommend `deepseek-coder:6.7b` for code-focused tasks:

```bash
# Pull the recommended model for code generation (default)
ollama pull deepseek-coder:6.7b

# Or pull a general-purpose model
ollama pull llama3.2

# For smaller systems (less RAM required)
ollama pull llama3.2:1b

# For more capable reasoning (requires more RAM)
ollama pull llama3.1:8b
```

**Model Recommendations:**

| Model | Size | RAM Required | Best For |
|-------|------|-------------|----------|
| `deepseek-coder:6.7b` | 3.8GB | 8GB | Code generation (default) |
| `llama3.2:1b` | 1.3GB | 2GB | Quick responses, limited context |
| `llama3.2` | 2.0GB | 4GB | General conversation |
| `llama3.1:8b` | 4.7GB | 8GB | Complex reasoning |
| `codellama` | 3.8GB | 8GB | Code generation (alternative) |

### Running Ollama

Start the Ollama server:

```bash
# Start Ollama service
ollama serve

# The server runs on http://localhost:11434 by default
```

Verify Ollama is running:

```bash
# Test the API
curl http://localhost:11434/api/tags

# Or run a quick test
ollama run llama3.2 "Hello, how are you?"
```

**Running Ollama in Background:**

```bash
# Linux/macOS - run as background service
nohup ollama serve > /dev/null 2>&1 &

# Or use systemd (Linux)
sudo systemctl enable ollama
sudo systemctl start ollama

# macOS - Ollama app runs automatically when launched
```

---

## Gemini API (Alternative)

If you don't want to run Ollama locally, you can use Google's Gemini API as a fallback:

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/)

2. Set the environment variable:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

3. Or create a `.env` file in the project root:
```bash
GEMINI_API_KEY=your-api-key-here
```

**Note:** Gru will automatically fall back to Gemini if Ollama is not available.

---

## Starting Gru Agent

### Using Docker (Recommended)

Docker provides a two-container setup where Ollama runs separately from Minions, allowing you to rebuild the application without re-downloading AI models.

1. **Start the containers:**
```bash
cd minions/docker
docker compose up -d
```

2. **Pull the AI model (first time only):**
```bash
docker exec minions-ollama ollama pull deepseek-coder:6.7b
docker restart minions
```

3. **Access the interface:**
```
http://localhost:2505
```

**Useful Docker Commands:**
```bash
# View logs
docker compose logs -f

# View Minions logs only
docker logs minions -f

# Check container status
docker ps

# Stop all containers
docker compose down

# Rebuild Minions (models preserved)
docker compose down minions && docker compose build --no-cache minions && docker compose up -d minions

# List available models
docker exec minions-ollama ollama list
```

### Using Node.js

For development or if you prefer running without Docker:

1. **Install dependencies:**
```bash
cd minions
npm run install:all
```

2. **Start Ollama separately:**
```bash
ollama serve
# In another terminal:
ollama pull deepseek-coder:6.7b
```

3. **Start Gru Agent:**
```bash
# From the minions root directory
node index.js --gru

# Or with custom port
node index.js --gru --port 3000

# Or with environment variables
OLLAMA_HOST=http://localhost:11434 OLLAMA_MODEL=deepseek-coder:6.7b node index.js --gru
```

4. **Open the web interface:**
```
http://localhost:2505
```

---

## Using the Web Interface

### Chat Screen

The chat screen is where you have conversations with Gru about your project.

**Starting a conversation:**
1. Type your message in the input field
2. Press Enter or click Send
3. Wait for Gru's response (powered by Ollama or Gemini)

**Example conversations:**
```
You: "I want to build a REST API for user management"
Gru: "Great! I can help with that. Let me know the path to your project
      or we can start fresh..."

You: "The project is at /home/user/my-api"
Gru: "Perfect! Click on 'Enter a Project' to let me scan and analyze it."
```

**Tips:**
- Be specific about what you want to build
- Mention any technologies you prefer
- Describe features in detail

### Project Screen

After clicking "Enter a Project", you'll see the project intake form:

1. **Enter the project path:**
   - Full path to your project directory
   - Example: `/home/user/my-project` or `C:\Users\user\my-project`

2. **Add a description (optional):**
   - What you want to accomplish
   - Any specific requirements

3. **Click "Scan Project":**
   - Gru will analyze the project structure
   - Detect framework (Express, React, Flutter, etc.)
   - Identify existing components
   - Map dependencies

**Scan Results:**
```
Framework: Express.js
Language: JavaScript
Components:
  - routes/
  - models/
  - controllers/
Dependencies: mongoose, express, jsonwebtoken
```

### Plan Screen

After scanning, Gru creates an execution plan:

**Plan Structure:**
- **Goals**: What will be accomplished
- **Steps**: Ordered list of tasks
- **Gaps**: Missing features/tests/docs detected
- **Estimated Progress**: Completion percentage

**Actions:**
- **Approve Plan**: Accept and start execution
- **Edit Plan**: Request changes (returns to chat)

**Example Plan:**
```
Plan: User Authentication Implementation

Goals:
1. Add JWT-based authentication
2. Create user registration endpoint
3. Add login/logout functionality

Steps:
1. Create User model with password hashing
2. Add auth middleware
3. Implement registration route
4. Implement login route
5. Add tests for auth flow

Gaps Detected:
- No test coverage for existing routes
- Missing API documentation
```

### Execution Screen

Once you approve the plan, execution begins:

**Phases:**
1. **ANALYZING** - Detecting gaps and requirements
2. **PLANNING** - Prioritizing tasks
3. **BUILDING** - Generating/modifying code
4. **TESTING** - Running tests
5. **FIXING** - Auto-fixing failures
6. **VERIFYING** - Confirming changes

**Progress Display:**
- Progress bar showing completion percentage
- Current phase indicator
- List of resolved gaps
- Real-time status updates

**Controls:**
- **Pause**: Pause execution (can resume later)
- **Stop**: Stop execution entirely

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINIONS_PORT` | Web server port | `2505` |
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` (Node.js) or `http://ollama:11434` (Docker) |
| `OLLAMA_MODEL` | Model to use | `deepseek-coder:6.7b` |
| `GEMINI_API_KEY` | Gemini API key (fallback) | - |
| `PROJECTS_PATH` | Mount path for projects | `./projects` |
| `NODE_ENV` | Environment mode | `production` |

### Docker Environment File

Create `.env` in the `docker/` directory:

```bash
# Port configuration
MINIONS_PORT=2505
OLLAMA_PORT=11434

# AI Model (default: deepseek-coder:6.7b)
OLLAMA_MODEL=deepseek-coder:6.7b

# Gemini fallback (optional)
GEMINI_API_KEY=your-api-key-here

# Projects directory (mounted read-only)
PROJECTS_PATH=./projects

# Environment
NODE_ENV=production
```

### Configuration File

Create `config.json` in the gru-agent directory:

```json
{
  "port": 2505,
  "ollama": {
    "host": "http://localhost:11434",
    "model": "deepseek-coder:6.7b",
    "timeout": 60000
  },
  "gemini": {
    "model": "gemini-1.5-flash"
  },
  "completion": {
    "targetPercentage": 100,
    "maxIterations": 50
  },
  "logging": {
    "level": "info",
    "file": "logs/gru.log"
  }
}
```

---

## Troubleshooting

### Ollama Connection Issues

**Error:** "Cannot connect to Ollama"

**Solutions:**
1. Verify Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Check the Ollama host setting:
   ```bash
   export OLLAMA_HOST=http://localhost:11434
   ```

3. If using Docker, use `host.docker.internal`:
   ```bash
   docker run -e OLLAMA_HOST=http://host.docker.internal:11434 ...
   ```

4. Ensure firewall allows port 11434

### No AI Response

**Error:** "AI is not available"

**Solutions:**
1. Pull a model if none exists:
   ```bash
   ollama pull llama3.2
   ```

2. Set Gemini API key as fallback:
   ```bash
   export GEMINI_API_KEY=your-key-here
   ```

3. Check Ollama logs:
   ```bash
   journalctl -u ollama -f  # Linux with systemd
   ```

### Project Scan Fails

**Error:** "Failed to scan project"

**Solutions:**
1. Verify the project path exists and is readable
2. Check that node_modules is installed (for Node.js projects)
3. Ensure the path is absolute, not relative
4. Check file permissions

### WebSocket Connection Issues

**Error:** Connection drops or messages not received

**Solutions:**
1. Check that nothing else is using port 3000
2. Try a different browser
3. Disable browser extensions that might block WebSockets
4. Check browser console for errors

### Docker Issues

**Error:** Container fails to start or health check fails

**Solutions:**
1. Check Docker logs:
   ```bash
   docker logs minions
   docker logs minions-ollama
   ```

2. Ensure ports aren't in use:
   ```bash
   lsof -i :2505
   lsof -i :11434
   ```

3. Verify Ollama container is healthy:
   ```bash
   docker exec minions-ollama ollama list
   ```

4. Rebuild Minions container:
   ```bash
   docker compose down minions
   docker compose build --no-cache minions
   docker compose up -d minions
   ```

5. Full reset (models preserved):
   ```bash
   docker compose down
   docker compose up -d
   ```

**Error:** "localhost:2505 not reachable" from host

**Solution:** The WebServer binds to `0.0.0.0` inside the container. If you modified WebServer.js, ensure:
```javascript
host: config.host || '0.0.0.0'  // Required for Docker
```

### Memory Issues with Ollama

**Error:** Model too slow or crashes

**Solutions:**
1. Use a smaller model:
   ```bash
   ollama pull llama3.2:1b
   export OLLAMA_MODEL=llama3.2:1b
   ```

2. Increase system swap space

3. Close other memory-intensive applications

4. Consider using Gemini API for large projects

---

## Best Practices

1. **Start with clear goals** - Tell Gru exactly what you want to build
2. **Use smaller models for quick tasks** - llama3.2:1b for simple conversations
3. **Review plans carefully** - Don't just approve automatically
4. **Keep projects organized** - Clean project structure helps scanning
5. **Monitor execution** - Watch for issues during the build phase
6. **Pause for complex decisions** - Don't let automation make bad choices
7. **Back up before major changes** - Gru modifies files, be prepared

---

## Integration with Other Agents

Gru coordinates with other Minions agents:

- **Dr. Nefario** (NefarioAgent) - Executes Claude Code tasks
- **Silas** (ProjectManagerAgent) - Manages project connections
- **Lucy** (ProjectCompletionAgent) - Runs completion loops

All agents communicate via the EventBus, enabling seamless coordination.

---

## Next Steps

- Read the [Architecture Guide](./architecture.md) for deep technical details
- Check the [API Reference](./api-reference.md) for programmatic usage
- See [Creating Agents](./creating-agents.md) to extend functionality
