# MCP Trainer demo server

This repo holds a small demo server for a 30-minute training about MCP.

MCP (Model Context Protocol) is an open protocol. It lets AI apps like Claude
connect to products in one standard way. A product builds one MCP server, and
every compatible AI app can use it.

In the training, attendees add this server to their own Claude. Then they ask
Claude to build a quiz game about MCP. Claude gets the questions from the
server and builds the game page itself.

## What the server offers

- Tool `get_server_info`: the server introduces itself.
- Tool `get_quiz`: ten quiz questions about MCP, with answers and short
  explanations.
- Prompt `build_quiz_game`: instructions that tell Claude to build a playable
  quiz game from those questions.

A tool is an operation the AI can call. A prompt is a ready-made instruction
the user can trigger.

## Two versions, same server

Both versions offer the same tools and prompt, with the same names and the
same texts. Pick the language you want to read.

| Folder | Language | Pick it if |
| ------ | -------- | ---------- |
| [`typescript/`](typescript/) | TypeScript | You want the fastest start-up and the most common Cloudflare setup. This is the version used live in the training. |
| [`python/`](python/) | Python | You know Python better, or you want to see the current MCP specification (2026-07-28) with no startup handshake. Its first request after an idle period is about one second slower. |

Each folder has its own README with the exact deploy steps.

## Install as a plugin (Claude Code)

This repo is also a plugin marketplace. In Claude Code, type these two
commands:

```
/plugin marketplace add towardsai/mcp-demo
/plugin install mcp-trainer@mcp-demo
```

The plugin carries one skill, `build-quiz-game`, plus a pointer to the
deployed server. The repo itself runs nothing: the server must stay deployed
on Cloudflare, and the plugin's `.mcp.json` holds its address.

On plain claude.ai there are no plugins. Add the server's `/mcp` address as a
custom connector instead. You then get the tools and the prompt, but not the
skill.

## Where it runs

Both versions run on Cloudflare Workers. Cloudflare Workers is a service that
runs code at a public HTTPS address. The free tier is enough for this demo.

## Safety

This server is public and has no sign-in. That is safe only because it holds
nothing private: just fixed quiz questions. Never put real data in it.
Delete your copy after you are done. Each README shows how.

Both READMEs also explain the five rules a real MCP server must follow, and
which ones this demo skips on purpose.
