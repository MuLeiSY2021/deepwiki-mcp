# deepwiki-mcp

A Claude Code plugin that connects [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open) to Claude Code, giving you RAG-powered repository knowledge directly in your coding workflow.

## What it does

- **MCP Server** — exposes 4 tools that query deepwiki-open's wiki pages and source code vector index
- **Agent** — a `deepwiki` agent that auto-resolves repository URLs (from `git remote`, GitHub search, or direct input) so you never have to paste full URLs

### Tools

| Tool | What it searches | Purpose |
|------|-----------------|---------|
| `list_projects` | — | List all indexed repositories |
| `get_wiki_structure` | Wiki table of contents | Discover available documentation pages |
| `get_wiki_page` | Wiki page content | Read AI-generated documentation for a specific topic |
| `search_repo` | **Repository source code** | Semantic vector search over the actual codebase (requires [PR #496](https://github.com/AsyncFuncAI/deepwiki-open/pull/496)) |

## Prerequisites

- [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open) running locally (default API port: `8001`, web UI: `3000`)
- [Claude Code](https://claude.ai/code) installed
- Node.js 18+

> **Note:** `search_repo` requires the `/api/retrieve` endpoint proposed in [PR #496](https://github.com/AsyncFuncAI/deepwiki-open/pull/496). Until merged, only wiki-based tools are available out of the box.

## Installation

### As a Claude Code plugin

```bash
# Add marketplace
/plugin marketplace add MuLeiSY2021/deepwiki-mcp

# Install the plugin
/plugin install deepwiki-mcp
```

### Manual / Local development

```bash
git clone https://github.com/MuLeiSY2021/deepwiki-mcp.git
cd deepwiki-mcp/servers
npm install
```

## Configuration

Set the `DEEPWIKI_HOST` environment variable to point to your deepwiki-open API:

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

```
# Browse wiki documentation
> get_wiki_structure(owner="AsyncFuncAI", repo="deepwiki-open")
> get_wiki_page(owner="AsyncFuncAI", repo="deepwiki-open", page_id="page-system-architecture")

# Search source code (true RAG)
> search_repo(repo_url="https://github.com/user/repo", query="authentication middleware", top_k=5)

# List indexed repos
> list_projects()
```

## How it works

```
User question
    → Agent resolves repo URL (git remote / GitHub search)
    → MCP Server queries deepwiki-open
        ├── Wiki tools: read pre-generated documentation pages
        └── search_repo: vector similarity search over source code chunks
    → Claude Code uses the retrieved context to answer
```

The key difference from a plain LLM call: Claude Code does its own reasoning over the retrieved wiki pages and code chunks, rather than delegating to deepwiki-open's built-in LLM.

## License

MIT
