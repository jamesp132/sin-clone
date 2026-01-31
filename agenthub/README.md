# AgentHub

A self-hosted multi-agent AI system powered by Claude. Run your personal AI team 24/7 on your home server — chat with specialized agents, assign tasks, and watch them collaborate in real-time.

## Features

- **11 specialized AI agents** — Coordinator, Researcher, Writer, Editor, Coder, Code Reviewer, Analyst, Sysadmin, Creative, Planner, and Assistant
- **Real-time collaboration** — Agents delegate tasks to each other based on expertise
- **Task delegation** — Visual task tree showing how work flows between agents
- **Conversation history** — Full searchable history of all conversations
- **Long-term memory** — Agents can store and recall facts across sessions
- **Dark mode UI** — Clean, responsive dashboard built with React and Tailwind
- **Docker deployment** — Single container, runs anywhere (Unraid, TrueNAS, any Linux box)
- **WebSocket streaming** — Watch agent responses appear in real-time

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> && cd agenthub

# 2. Set your API key
cp .env.example .env
# Edit .env and add your Anthropic API key

# 3. Run with Docker
docker-compose up -d

# 4. Open the dashboard
# http://localhost:8080
```

## Manual Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies API and WebSocket requests to `localhost:8080`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `DATABASE_PATH` | `/data/agenthub.db` | SQLite database location |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Model for most agent tasks |
| `ADVANCED_MODEL` | `claude-opus-4-20250514` | Model for complex tasks |
| `MAX_TOKENS` | `4096` | Maximum response tokens |
| `WORKSPACE_PATH` | `/workspace` | Directory for file operations |

## Customizing Agent Personas

Each agent has a default persona that defines its behavior. You can customize any agent's persona through the Settings page in the UI, or by modifying the agent files in `backend/agents/`.

Example: To make the Writer agent more formal, edit `backend/agents/writer.py` and adjust the `persona` string.

## Unraid Installation

1. Copy the `agenthub` directory to your Unraid appdata share (e.g., `/mnt/user/appdata/agenthub/`)

2. In the Unraid Docker tab, add a new container:
   - **Repository**: Build from the Dockerfile, or use the docker-compose
   - **Port mapping**: `8080` → `8080`
   - **Path mapping**: `/mnt/user/appdata/agenthub/data` → `/data`
   - **Path mapping**: `/mnt/user/appdata/agenthub/workspace` → `/workspace`
   - **Variable**: `ANTHROPIC_API_KEY` = `your-api-key`

3. Start the container and access `http://your-server-ip:8080`

Alternatively, use Docker Compose:

```bash
cd /mnt/user/appdata/agenthub
cp .env.example .env
nano .env  # Add your API key
docker-compose up -d
```

## Troubleshooting

**Container won't start**
- Check that your API key is set: `docker exec agenthub env | grep ANTHROPIC`
- View logs: `docker logs agenthub`

**"Cannot connect to server" in the UI**
- Ensure port 8080 is not in use: `ss -tlnp | grep 8080`
- Check container health: `docker inspect agenthub | grep Health`

**Agents return errors**
- Verify your API key is valid at https://console.anthropic.com
- Check rate limits — the app handles rate limiting gracefully but may show delays

**Database issues**
- The SQLite database is stored at the configured `DATABASE_PATH`
- To reset: stop the container, delete the `.db` file, restart

**WebSocket disconnections**
- The UI automatically reconnects with exponential backoff
- If persistent, check for reverse proxy WebSocket configuration (nginx: `proxy_set_header Upgrade $http_upgrade;`)
