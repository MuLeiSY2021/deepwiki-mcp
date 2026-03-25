# deepwiki-mcp

A Claude Code plugin that connects [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open) to Claude Code, giving you RAG-powered repository knowledge directly in your coding workflow.

## What it does

- **MCP Server** — exposes 3 tools (`ask_repo`, `get_wiki_cache`, `list_projects`) that query deepwiki-open's API
- **Agent** — a `deepwiki` agent that auto-resolves repository URLs (from `git remote`, GitHub search, or direct input) so you never have to paste full URLs

## Prerequisites

- [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open) running locally (default: `http://localhost:8001`)
- [Claude Code](https://claude.ai/code) installed
- Node.js 18+

## Installation

### As a Claude Code plugin

```bash
# Add marketplace (if hosted on GitHub)
/plugin marketplace add your-username/deepwiki-mcp

# Install the plugin
/plugin install deepwiki-mcp
```

### Manual / Local development

```bash
git clone https://github.com/MuLeiSY2021/deepwiki-mcp.git
cd deepwiki-mcp/servers
npm install

# In Claude Code:
claude plugin install --scope user --source /path/to/deepwiki-mcp
```

## Configuration

Set the `DEEPWIKI_HOST` environment variable to point to your deepwiki-open instance:

```bash
export DEEPWIKI_HOST=http://localhost:8001
```

Default: `http://localhost:8001`

## Usage

### Automatic (via Agent)

The plugin includes a `deepwiki` agent that handles URL resolution automatically:

```
# In a git repo — auto-detects the remote URL
> Ask deepwiki about the architecture of this project

# By project name — searches GitHub automatically
> Ask deepwiki how fastapi handles dependency injection

# With explicit URL
> Ask deepwiki about https://github.com/user/repo routing system
```

### Direct MCP tools

You can also use the MCP tools directly:

- `ask_repo(repo_url, question)` — ask a question about any repository
- `get_wiki_cache(owner, repo)` — get cached wiki pages
- `list_projects()` — see all indexed repositories

## How it works

```
User question
    → Agent resolves repo URL (git remote / GitHub search)
    → MCP Server calls deepwiki-open REST API
    → deepwiki-open runs RAG (embed → vector search → LLM)
    → Answer returned to Claude Code
```

## License

MIT
