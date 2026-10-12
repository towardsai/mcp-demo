# Updating and redeploying the server

This file is the short operations guide. Read it when you want to change
something, for example the quiz questions, and ship the change.

Two facts to keep in mind:

- The live server is the **TypeScript** one, deployed on Cloudflare Workers at
  `https://mcp-trainer.mcptrainer.workers.dev/mcp`.
- GitHub stores the code. Cloudflare runs it. Pushing to GitHub changes
  nothing on Cloudflare. You must deploy to make a change live.

## Change the quiz questions

1. Edit the questions. They live near the top of `typescript/src/index.ts`,
   in the list called `QUIZ_QUESTIONS`. Each question is one `makeQuestion(...)`
   call with the question, the options, the correct answer, and a one-sentence
   explanation. The correct answer must match one option word for word.

2. Deploy from the `typescript` folder:

   ```sh
   cd typescript
   npm install          # first time on a new machine only
   npx wrangler deploy
   ```

   The first deploy on a new machine opens a browser to sign in to Cloudflare.
   The address stays the same after every deploy. Nobody has to reconnect.

3. Check it worked:

   - Open `https://mcp-trainer.mcptrainer.workers.dev/` in a browser.
     You should see the welcome text.
   - In Claude, ask for the quiz and check that your new question shows up.

4. Push the same change to GitHub, so the code people read matches the
   server that runs:

   ```sh
   git add -A
   git commit -m "Update quiz questions"
   git push
   ```

## Change the game instructions

The instructions for building the game exist in two places. If you change
one, change the other, or they drift apart:

- `typescript/src/index.ts`, the text called `BUILD_QUIZ_GAME_INSTRUCTIONS`
  (the server's prompt). Shipping this change needs a deploy, step 2 above.
- `plugins/mcp-trainer/skills/build-quiz-game/SKILL.md` (the plugin's skill).
  Shipping this change only needs a git push. Claude Code users get it when
  they update the plugin.

## The Python version

The Python server in `python/` is the same server in another language. It is
not the live one. If you want to deploy it too, it becomes a separate worker
named `mcp-trainer-py` with its own address:

```sh
cd python
npm install
uv run pywrangler deploy    # needs uv 0.12.3 or newer
```

## Delete the live server

Do this after the training. The address stops working for everyone.

```sh
cd typescript
npx wrangler delete
```

Then remove the connector from Claude, and update the repo README so it no
longer promises a live address.
