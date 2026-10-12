---
name: build-quiz-game
description: Build the playable MCP quiz game. Use when the user asks for the MCP quiz, the MCP quiz game, or to be quizzed on MCP (Model Context Protocol).
---

This skill is the plugin-shipped version of the MCP Trainer server's build_quiz_game prompt: the same instructions, delivered through a third door. The server offers them as a user-triggered prompt; this plugin ships them as a skill, so Claude loads them on its own when the request fits.

Build a playable quiz game about MCP (Model Context Protocol).

Step 1 - Get the questions.
Call the tool "get_quiz" from the MCP Trainer server. Use the questions exactly as returned. Do not invent, rewrite, or reorder the questions or the answers.

Step 2 - Build the game.
Build the game as a single HTML page artifact. Put all the HTML, CSS, and JavaScript in that one page. Put the quiz questions inside the page, so the game works without any network call.

The game must work like this:
- Start screen: show the title "MCP Quiz" and a "Start" button.
- Show one question at a time. Show which question this is, for example "Question 3 of 10".
- Show each answer option as a large button.
- Instant feedback: when the player picks an answer, show at once whether it was correct. Highlight the correct answer. Show the one-sentence explanation for that question.
- Lock the answer buttons after one pick, so a question can only be answered once.
- Show a "Next" button after the feedback.
- Running score: keep the current score visible at all times, for example "Score: 4".
- Final screen: show the final score, for example "8 out of 10". Show a fun rank based on the score. Example ranks: "Unplugged" for 0 to 3, "Getting Connected" for 4 to 6, "Tool Caller" for 7 to 8, "Protocol Pro" for 9, "MCP Master" for 10. Add a "Play again" button.

Design:
- Keep the design bold and readable. Use large text, strong contrast, and big tap targets.
- It must work on a phone and on a projector.
- Use clear colors for correct and wrong answers, and also show the words "Correct" or "Not quite", so color is not the only signal.
- Keep it to one screen per question. No scrolling inside a question if possible.

Step 3 - Say what happened.
After the artifact, add two short sentences: say that the questions came from the MCP Trainer server, and that you built the game page yourself.
