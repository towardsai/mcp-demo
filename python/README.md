# MCP Trainer — Python version

The Python version of the MCP Trainer demo server, for a 30-minute MCP training.

MCP (Model Context Protocol) is an open protocol. It lets AI apps like Claude
connect to products in one standard way.

This version does the same job as the TypeScript version in `../typescript`.
It offers the same tools and prompt, with the same names and the same texts.

## What this server is

- A small program that runs on Cloudflare Python Workers. Cloudflare Workers
  is a service that runs code at a public HTTPS address.
- It is a demo. It holds ten quiz questions about MCP and nothing else.
- It is public. It needs no sign-in.
- It is temporary. Delete it after the training session.

## What it offers

| Kind   | Name              | What it does                                                        |
| ------ | ----------------- | ------------------------------------------------------------------- |
| Tool   | `get_server_info` | The server introduces itself in plain English.                      |
| Tool   | `get_quiz`        | Returns ten multiple-choice questions about MCP as JSON.            |
| Prompt | `build_quiz_game` | Tells the AI app to call `get_quiz` and build a playable quiz game. |

The server only moves data. It never sends a web page. The AI app builds the
game page itself.

## The files

| File             | What it is                                                     |
| ---------------- | -------------------------------------------------------------- |
| `src/entry.py`   | The whole server. Read this one. It is heavily commented.      |
| `wrangler.jsonc` | Deploy settings for Cloudflare. The Worker is `mcp-trainer-py`. |
| `pyproject.toml` | The Python packages the server needs.                          |
| `uv.lock`        | The exact package versions, written by uv.                     |
| `package.json`   | Pins Wrangler, Cloudflare's command line tool.                 |

The code follows Cloudflare's official Python example
[`mcp-server`](https://github.com/cloudflare/python-workers-examples/tree/main/mcp-server).
It uses the official MCP Python SDK, version 2.2.0. In that SDK the server
class is called `MCPServer`. Older versions of the SDK called it `FastMCP`.

## Deploy it

You need three things:

- A free Cloudflare account.
- Node.js 20 or newer. Wrangler runs on it.
- uv, a tool that installs Python and Python packages.
  Install it from https://docs.astral.sh/uv/getting-started/installation/
  You need uv version 0.12.3 or newer. Check with `uv --version`.

Then:

1. Install Wrangler:

   ```sh
   npm install
   ```

2. Deploy:

   ```sh
   uv run pywrangler deploy
   ```

   `pywrangler` is Cloudflare's Python wrapper around Wrangler. It first
   packs the Python packages for the Workers runtime, then deploys.
   The first time, it opens a browser window and asks you to sign in to
   Cloudflare.

3. Wrangler prints the public address. It looks like this:

   ```
   https://mcp-trainer-py.YOUR-SUBDOMAIN.workers.dev
   ```

4. Your MCP address is that address plus `/mcp`:

   ```
   https://mcp-trainer-py.YOUR-SUBDOMAIN.workers.dev/mcp
   ```

To check that it is alive, open the address without `/mcp` in a browser.
You should see a short welcome text.

Optional: run it on your own machine first with `uv run pywrangler dev`.
The local address is `http://localhost:8787/mcp`.

## Add it to Claude as a custom connector

1. Open Claude and go to **Settings**, then **Connectors**.
2. Choose **Add custom connector**.
3. Give it a name, for example `MCP Trainer (Python)`, and paste your address
   ending in `/mcp`.
4. Save. Leave any sign-in fields empty. This server needs no sign-in.
5. In a new chat, check that the connector is turned on.
6. Ask Claude: **"Use MCP Trainer to build the MCP quiz game."**

Menu names can differ a little between Claude versions.

## Try it by hand

This request asks the server what it offers. It uses the current MCP
specification, dated 2026-07-28. Replace the address with yours.

```sh
curl -X POST https://mcp-trainer-py.YOUR-SUBDOMAIN.workers.dev/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/list' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}'
```

## How it differs from the TypeScript version

| Topic | TypeScript version | Python version |
| ----- | ------------------ | -------------- |
| Language and runtime | TypeScript on the standard JavaScript Workers runtime. | Python on Cloudflare Python Workers. Python runs through Pyodide, which is Python compiled to WebAssembly. |
| MCP library | Cloudflare's `agents` package with `McpAgent`, plus the MCP TypeScript SDK 1.30.0. | The official MCP Python SDK 2.2.0, with `MCPServer`. |
| MCP version spoken | Older revisions, up to 2025-11-25. Each connection starts with a handshake and keeps a session. | The current revision, 2026-07-28. No handshake, no session. Each request stands alone. Older clients that still send the handshake also work. |
| Cold start | Near zero. A cold start is the delay when a Worker starts after being idle. | About one second, because the Python runtime and packages must load first. Cloudflare reduces this with snapshots, but it is still slower than JavaScript. |
| Extra storage | Uses one Durable Object, a small piece of compute and storage that McpAgent needs. | None. Stateless, so nothing to store. |
| `/sse` address | Yes, for older clients. | **No.** The old HTTP plus SSE transport is deprecated, and Cloudflare's Python pattern does not serve it. Use `/mcp`. |
| Deploy command | `npx wrangler deploy` | `uv run pywrangler deploy` |

For a live demo in front of a room, the cold start rarely matters. The first
request after an idle period takes about a second longer. Every request after
that is fast.

## Addresses

| Address | What it is                                                             |
| ------- | ---------------------------------------------------------------------- |
| `/mcp`  | Streamable HTTP. The current way to reach a remote MCP server.         |
| `/`     | A short welcome text for people who open the address in a browser.     |

## Safety note

- This server is **public**. Anyone who knows the address can call it.
- It has **no sign-in**.
- It holds **nothing private**. It only returns fixed quiz questions.
- It stores nothing about the people who call it.
- **Never add real data to this server.**
- **Delete it after the session:**

  ```sh
  uv run pywrangler delete
  ```

  (`npx wrangler delete` does the same.) Then remove the connector from
  Claude, because the address no longer works.

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
