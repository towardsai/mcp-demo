# MCP Trainer — demo server

A tiny MCP server for a 30-minute MCP training.

MCP (Model Context Protocol) is an open protocol. It lets AI apps like Claude
connect to products in one standard way.

## What this server is

- A small program that runs on Cloudflare Workers. Cloudflare Workers is a
  service that runs code at a public HTTPS address.
- It is a demo. It holds ten quiz questions about MCP and nothing else.
- It is public. It needs no sign-in.
- It is temporary. Delete it after the training session.

A live copy runs at `https://mcp-trainer.mcptrainer.workers.dev/mcp` for the
training. It is temporary and will be deleted after the training. To keep
using the server, deploy your own copy with the steps below.

There is also a Python version of this server in `../python`.

## What it offers

| Kind   | Name              | What it does                                                        |
| ------ | ----------------- | ------------------------------------------------------------------- |
| Tool   | `get_server_info` | The server introduces itself in plain English.                      |
| Tool   | `get_quiz`        | Returns ten multiple-choice questions about MCP as JSON.            |
| Prompt | `build_quiz_game` | Tells the AI app to call `get_quiz` and build a playable quiz game. |

The server only moves data. It never sends a web page. The AI app builds the
game page itself. This is the same pattern as Salesforce in Claude, at toy scale.

## The files

| File             | What it is                                                |
| ---------------- | --------------------------------------------------------- |
| `src/index.ts`   | The whole server. Read this one. It is heavily commented. |
| `wrangler.jsonc` | Deploy settings for Cloudflare.                           |
| `package.json`   | The packages the server needs.                            |
| `tsconfig.json`  | TypeScript settings.                                      |

## Deploy it

You need Node.js 20 or newer and a free Cloudflare account.

1. Install the packages:

   ```sh
   npm install
   ```

2. Deploy:

   ```sh
   npx wrangler deploy
   ```

   The first time, Wrangler opens a browser window and asks you to sign in to
   Cloudflare. Wrangler is Cloudflare's command line tool.

3. Wrangler prints the public address. It looks like this:

   ```
   https://mcp-trainer.YOUR-SUBDOMAIN.workers.dev
   ```

4. Your MCP address is that address plus `/mcp`:

   ```
   https://mcp-trainer.YOUR-SUBDOMAIN.workers.dev/mcp
   ```

To check that it is alive, open the address without `/mcp` in a browser.
You should see a short welcome text.

Optional: run it on your own machine first with `npx wrangler dev`.
The local address is `http://localhost:8787/mcp`.

## Add it to Claude as a custom connector

1. Open Claude and go to **Settings**, then **Connectors**.
2. Choose **Add custom connector**.
3. Give it the name `MCP Trainer` and paste your address ending in `/mcp`.
4. Save. Leave any sign-in fields empty. This server needs no sign-in.
5. In a new chat, check that the connector is turned on.
6. Ask Claude: **"Use MCP Trainer to build the MCP quiz game."**

Claude discovers the server, reads the tool list, calls `get_quiz`, and builds
the game as an artifact. An artifact is a small web page that Claude builds and
shows inside the chat.

Notes:

- Menu names can differ a little between Claude versions.
- Some company workspaces block custom connectors. Test with an account like
  the ones your attendees have. If it is blocked, run the demo from the
  presenter's screen.
- Some AI apps show prompts in a menu. If yours does, you can pick
  `build_quiz_game` there instead of typing the request.

## Addresses

| Address | What it is                                                                            |
| ------- | ------------------------------------------------------------------------------------- |
| `/mcp`  | Streamable HTTP. This is the current way to reach a remote MCP server. Use this one.  |
| `/sse`  | The old HTTP plus SSE transport. It is deprecated. It is here only for older clients. |
| `/`     | A short welcome text for people who open the address in a browser.                    |

## Safety note

- This server is **public**. Anyone who knows the address can call it.
- It has **no sign-in**.
- It holds **nothing private**. It only returns fixed quiz questions.
- It stores nothing about the people who call it.
- **Never add real data to this server.**
- **Delete it after the session:**

  ```sh
  npx wrangler delete
  ```

  Then remove the connector from Claude, because the address no longer works.

## How this maps to the five security rules

The training gives five rules for deploying a real MCP server safely.
This demo skips most of them on purpose. That is acceptable only because the
data is harmless and public, there are no accounts, and the server cannot
change anything.

| Rule | What a real server must do | What this demo does | Why that is acceptable here |
| ---- | -------------------------- | ------------------- | --------------------------- |
| 1. Serve HTTPS and use real sign-in | Use HTTPS. Use OAuth for real data. OAuth is the standard way apps get permission to act for a user. | HTTPS: **followed** (Cloudflare provides it). Sign-in: **skipped**. | There are no users and no private data to protect. |
| 2. Check every token fully | Check that each token is valid, not expired, and meant for this server. Never forward a received token. | **Skipped.** The server receives no tokens and forwards nothing. | With no sign-in there are no tokens to check. |
| 3. Check permissions on every call | Verify that this caller may touch this record, on every call. | **Skipped.** Every caller gets the same answer. | All data is the same public quiz for everyone. |
| 4. Limit what the server can reach | Use narrow credentials. Put bounds on inputs. Be careful with addresses a user supplies. | **Followed, by design.** | The server has no credentials, calls no other system, fetches no addresses, and its tools take no arguments. |
| 5. Log who did what | Record the user, the operation, the target, and the outcome. | **Mostly skipped.** Cloudflare keeps basic request logs. There is no user to record. | Nothing can be written or changed, so there is nothing to audit. |

The moment a server touches real data, real accounts, or anything that can be
changed, rules 1, 2, 3, and 5 stop being optional.

## A note on protocol versions

The training describes the current MCP specification, dated 2026-07-28. In that
revision, requests are stateless and there is no startup handshake.

This server uses the `McpAgent` class from Cloudflare's `agents` package
(version 0.27.0, with MCP SDK 1.30.0). That class speaks the earlier revisions,
up to 2025-11-25. Those start with a handshake and keep a session.

This does not break the demo. AI apps pick a version both sides understand.
The tools, the prompt, and discovery look the same in both revisions. But if an
attendee inspects the network traffic, they will see the older handshake.

## Based on

Cloudflare's `remote-mcp-authless` template:
https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless
