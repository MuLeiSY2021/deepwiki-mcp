#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEEPWIKI_HOST =
  process.env.DEEPWIKI_HOST || "http://localhost:3000";

const server = new McpServer({
  name: "deepwiki",
  version: "0.1.0",
});

// --- Tool: list_projects ---
server.tool(
  "list_projects",
  "List all indexed projects in deepwiki-open.",
  {},
  async () => {
    try {
      const res = await fetch(`${DEEPWIKI_HOST}/api/processed_projects`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const projects = await res.json();
      if (!projects || projects.length === 0) {
        return { content: [{ type: "text", text: "No indexed projects found." }] };
      }
      const lines = projects.map(
        (p) => `- ${p.name || p.repo || JSON.stringify(p)}`
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error listing projects: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: get_wiki_cache ---
server.tool(
  "get_wiki_cache",
  "Get cached wiki pages for a repository. Returns the wiki structure and page contents.",
  {
    owner: z.string().describe("Repository owner (e.g. 'AsyncFuncAI')"),
    repo: z.string().describe("Repository name (e.g. 'deepwiki-open')"),
    repo_type: z
      .enum(["github", "gitlab", "bitbucket"])
      .default("github")
      .describe("Repository hosting platform"),
    language: z
      .string()
      .default("en")
      .describe("Language code (en, zh, ja, etc.)"),
  },
  async ({ owner, repo, repo_type, language }) => {
    try {
      const params = new URLSearchParams({ owner, repo, repo_type, language });
      const res = await fetch(
        `${DEEPWIKI_HOST}/api/wiki_cache?${params}`,
        { signal: AbortSignal.timeout(30_000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data) {
        return {
          content: [{
            type: "text",
            text: `No wiki cache found for ${owner}/${repo}. The repo may need to be indexed first via the deepwiki-open web UI.`,
          }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error fetching wiki cache: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: ask_repo ---
server.tool(
  "ask_repo",
  "Ask a question about a code repository using deepwiki-open's RAG pipeline.",
  {
    repo_url: z
      .string()
      .describe("Full repository URL (e.g. 'https://github.com/user/repo')"),
    question: z.string().describe("The question to ask about the repository"),
    provider: z
      .string()
      .optional()
      .describe("LLM provider (optional, e.g. 'google', 'openai', 'openrouter')"),
    model: z
      .string()
      .optional()
      .describe("Model name (optional, uses deepwiki-open default if empty)"),
  },
  async ({ repo_url, question, provider, model }) => {
    const body = {
      repo_url,
      messages: [{ role: "user", content: question }],
    };
    if (provider) body.provider = provider;
    if (model) body.model = model;

    try {
      const res = await fetch(`${DEEPWIKI_HOST}/chat/completions/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Parse SSE stream
      const text = await res.text();
      const chunks = [];
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          if (payload.trim() === "[DONE]") break;
          chunks.push(payload);
        } else if (line && !line.startsWith(":")) {
          chunks.push(line);
        }
      }

      const answer = chunks.join("");
      if (!answer) {
        return {
          content: [{
            type: "text",
            text: "No response received from deepwiki-open. The repo may need to be indexed first.",
          }],
        };
      }
      return { content: [{ type: "text", text: answer }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error querying deepwiki-open: ${e.message}` }], isError: true };
    }
  }
);

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
