# Gru Agent Usage Guide

Complete guide for setting up and using Gru Agent - the conversational web interface for the Minions framework.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Ollama Setup](#ollama-setup)
  - [Installing Ollama](#installing-ollama)
  - [Pulling Models](#pulling-models)
  - [Running Ollama](#running-ollama)
- [Gemini API (Alternative)](#gemini-api-alternative)
- [Starting Gru Agent](#starting-gru-agent)
  - [Using Node.js](#using-nodejs)
  - [Using Docker](#using-docker)
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
- Project scanning and framework detection
- Interactive plan creation and approval
- Real-time execution monitoring with progress tracking
- Gap detection and autonomous completion

---

## Prerequisites

Before using Gru Agent, ensure you have:

- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **Ollama** (recommended) or **Gemini API key**
- **Git** for version control

---

## Ollama Setup

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

After installing Ollama, pull a language model. We recommend `llama3.2` for general use:

```bash
# Pull the default model (recommended)
ollama pull llama3.2

# Or pull a smaller model for faster responses
ollama pull llama3.2:1b

# For more capable responses (requires more RAM)
ollama pull llama3.1:8b

# For code-focused tasks
ollama pull codellama
```

**Model Recommendations:**

| Model | RAM Required | Best For |
|-------|-------------|----------|
| `llama3.2:1b` | 2GB | Quick responses, limited context |
| `llama3.2` | 4GB | General use (default) |
| `llama3.1:8b` | 8GB | Complex reasoning |
| `codellama` | 8GB | Code generation |
| `deepseek-coder` | 8GB | Advanced coding |

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

### Using Node.js

1. **Install dependencies:**
```bash
cd minions
npm run install:all
```

2. **Start Gru Agent:**
```bash
# From the minions root directory
node agents/gru-agent/start.js

# Or with environment variables
OLLAMA_HOST=http://localhost:11434 node agents/gru-agent/start.js
```

3. **Open the web interface:**
```
http://localhost:3000
```

### Using Docker

1. **Build the Docker image:**
```bash
cd minions/agents/gru-agent
docker build -t minions-gru .
```

2. **Run with Docker Compose (recommended):**
```bash
docker-compose up -d
```

3. **Or run manually:**
```bash
docker run -d \
  -p 3000:3000 \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  -e GEMINI_API_KEY=your-key-here \
  -v $(pwd)/projects:/app/projects \
  --name minions-gru \
  minions-gru
```

4. **Access the interface:**
```
http://localhost:3000
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
| `PORT` | Web server port | `3000` |
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model to use | `llama3.2` |
| `GEMINI_API_KEY` | Gemini API key (fallback) | - |
| `PROJECT_ROOT` | Base directory for projects | Current directory |
| `LOG_LEVEL` | Logging level | `info` |

### Configuration File

Create `config.json` in the gru-agent directory:

```json
{
  "port": 3000,
  "ollama": {
    "host": "http://localhost:11434",
    "model": "llama3.2",
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

**Error:** Container fails to start

**Solutions:**
1. Check Docker logs:
   ```bash
   docker logs minions-gru
   ```

2. Ensure ports aren't in use:
   ```bash
   lsof -i :3000
   ```

3. Rebuild the image:
   ```bash
   docker-compose build --no-cache
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
