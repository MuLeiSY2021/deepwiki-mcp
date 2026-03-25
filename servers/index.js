#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEEPWIKI_HOST =
  process.env.DEEPWIKI_HOST || "http://localhost:8001";

const server = new McpServer({
  name: "deepwiki",
  version: "0.2.0",
});

// In-memory cache to avoid re-fetching full wiki for each page request
const wikiCache = new Map();

async function fetchWikiData(owner, repo, repo_type, language) {
  const key = `${repo_type}:${owner}/${repo}:${language}`;
  if (wikiCache.has(key)) return wikiCache.get(key);

  const params = new URLSearchParams({ owner, repo, repo_type, language });
  const res = await fetch(`${DEEPWIKI_HOST}/api/wiki_cache?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data) wikiCache.set(key, data);
  return data;
}

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

// --- Tool: get_wiki_structure ---
server.tool(
  "get_wiki_structure",
  "Get the wiki table of contents for a repository. Returns page IDs, titles, and importance levels. Use this first to discover available pages, then fetch specific pages with get_wiki_page.",
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
      const data = await fetchWikiData(owner, repo, repo_type, language);
      if (!data) {
        return {
          content: [{
            type: "text",
            text: `No wiki found for ${owner}/${repo}. Index it first via the deepwiki-open web UI.`,
          }],
        };
      }

      const structure = data.wiki_structure || data;
      const title = structure.title || `${owner}/${repo}`;
      const description = structure.description || "";
      const pages = structure.pages || [];

      const toc = pages.map((p) => {
        const importance = p.importance ? ` [${p.importance}]` : "";
        return `- **${p.title}** (id: \`${p.id}\`)${importance}`;
      });

      const output = [
        `# ${title}`,
        "",
        description,
        "",
        `## Pages (${pages.length})`,
        "",
        ...toc,
      ].join("\n");

      return { content: [{ type: "text", text: output }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error fetching wiki structure: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: get_wiki_page ---
server.tool(
  "get_wiki_page",
  "Get the full content of a specific wiki page by its ID. Use get_wiki_structure first to find available page IDs.",
  {
    owner: z.string().describe("Repository owner (e.g. 'AsyncFuncAI')"),
    repo: z.string().describe("Repository name (e.g. 'deepwiki-open')"),
    page_id: z.string().describe("Page ID from get_wiki_structure (e.g. 'page-system-architecture')"),
    repo_type: z
      .enum(["github", "gitlab", "bitbucket"])
      .default("github")
      .describe("Repository hosting platform"),
    language: z
      .string()
      .default("en")
      .describe("Language code (en, zh, ja, etc.)"),
  },
  async ({ owner, repo, page_id, repo_type, language }) => {
    try {
      const data = await fetchWikiData(owner, repo, repo_type, language);
      if (!data) {
        return {
          content: [{
            type: "text",
            text: `No wiki found for ${owner}/${repo}. Index it first via the deepwiki-open web UI.`,
          }],
        };
      }

      const structure = data.wiki_structure || data;
      const pages = structure.pages || [];
      const page = pages.find((p) => p.id === page_id);

      if (!page) {
        const available = pages.map((p) => p.id).join(", ");
        return {
          content: [{
            type: "text",
            text: `Page "${page_id}" not found. Available pages: ${available}`,
          }],
        };
      }

      const filePaths = page.filePaths || [];
      const related = page.relatedPages || [];

      const output = [
        `# ${page.title}`,
        "",
        filePaths.length ? `**Files:** ${filePaths.join(", ")}` : "",
        related.length ? `**Related pages:** ${related.join(", ")}` : "",
        "",
        page.content || "(No content generated for this page)",
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text", text: output }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error fetching wiki page: ${e.message}` }], isError: true };
    }
  }
);

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
