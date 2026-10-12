# MCP Trainer plugin

A demo plugin for a 30-minute training about MCP (Model Context Protocol).

It bundles two things:

- A connection to the public MCP Trainer server, which holds ten quiz
  questions about MCP and nothing else.
- One skill, `build-quiz-game`. It carries the same instructions as the
  server's `build_quiz_game` prompt. When you ask for the MCP quiz game,
  Claude loads the skill, calls the server's `get_quiz` tool, and builds a
  playable quiz game as a single page.

## Use it

Ask Claude: "Build me the MCP quiz game."

## Data

The plugin sends nothing private anywhere. It calls the public demo server at
`mcp-trainer.mcptrainer.workers.dev`, which needs no sign-in, returns fixed
quiz questions, and stores nothing about its callers. The server is temporary
and goes away after the training; after that, deploy your own copy from this
repo and change the address in `.mcp.json`.
