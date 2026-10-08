"""
MCP Trainer (Python version) - a tiny public MCP demo server.

WHAT THIS FILE IS
-----------------
This is the whole server. It runs on Cloudflare Python Workers.
Cloudflare Workers is a service that runs code at a public HTTPS address.
Python Workers run Python inside the browser-style engine that Workers use,
with the help of Pyodide (Python compiled to WebAssembly).

An MCP server is a described list of capabilities that an AI app can
discover and call. This server describes three capabilities:

  1. Tool   "get_server_info"  -> the server introduces itself.
  2. Tool   "get_quiz"         -> ten quiz questions about MCP.
  3. Prompt "build_quiz_game"  -> instructions for building a quiz game.

These are the same three capabilities, with the same names and the same
texts, as the TypeScript version in ../typescript/src/index.ts.

Notice what is NOT in this file: no web page, no game, no design.
The server only moves data. The AI app (for example Claude) builds the
game page itself. That is the same layering as the Salesforce example
in the training, at toy scale.

SAFETY NOTE
-----------
This server has NO sign-in. Anyone who knows the address can call it.
That is fine here because it only returns harmless public quiz data.
Never copy this pattern for a server that touches real data.
See README.md for the five security rules a real server must follow.

A NOTE ON PROTOCOL VERSIONS
---------------------------
This version uses the official MCP Python SDK, version 2.2.0, in
"stateless" mode. It speaks the current MCP specification, dated
2026-07-28: there is no startup handshake, and each request stands on
its own. The server does not remember anything between requests.

HOW TO READ THIS FILE
---------------------
  Part 1: the quiz data (plain data, nothing clever).
  Part 2: the MCP server (the three capabilities).
  Part 3: the HTTP entry point (which address goes where).

This file follows Cloudflare's official example "mcp-server" in
https://github.com/cloudflare/python-workers-examples
"""

import json
from urllib.parse import urlparse

# "workers" is Cloudflare's Python library. It is built into the Workers
# runtime, so it is not in the dependency list.
#   - WorkerEntrypoint: the class Cloudflare calls for every request.
#   - Response: an HTTP response.
#   - asgi: a bridge that lets a standard Python web app (an "ASGI" app)
#     answer requests inside a Worker. ASGI is the common plug between
#     Python web servers and Python web apps.
from workers import Response, WorkerEntrypoint, asgi

# ---------------------------------------------------------------------------
# PART 1 - THE QUIZ DATA
# ---------------------------------------------------------------------------
# In a real product, this part would be a call to the product's own API.
# Here it is a fixed list, so the server holds nothing private.


def make_question(id, question, options, correct_answer, explanation):
    """
    Build one quiz question as a plain dictionary.

    We pass the correct answer as text and this helper finds its position.
    This way the position and the text can never disagree.

    The keys are the same as in the TypeScript version:
      id              a short number so the questions keep a stable order
      question        the question shown to the player
      options         three or four possible answers
      correct_index   the position of the correct answer (counting starts at 0)
      correct_answer  the correct answer as text
      explanation     one sentence that explains why the answer is correct
    """
    if correct_answer not in options:
        # This only happens if someone edits the quiz and makes a typo.
        raise ValueError(f"Question {id}: the correct answer is not in the options.")
    return {
        "id": id,
        "question": question,
        "options": options,
        "correct_index": options.index(correct_answer),
        "correct_answer": correct_answer,
        "explanation": explanation,
    }


# The ten questions. Each one matches a point from the training.
QUIZ_QUESTIONS = [
    # --- What MCP is ---
    make_question(
        1,
        "What is MCP (Model Context Protocol)?",
        [
            "A new AI model that is good at using tools",
            "An open protocol that connects AI apps to products in one standard way",
            "A database where AI apps store their chat history",
            "A private product that only works with one AI app",
        ],
        "An open protocol that connects AI apps to products in one standard way",
        "MCP is a standard plug: a product builds one MCP server, and every compatible AI app can use it.",
    ),
    # --- Host, client, server roles ---
    make_question(
        2,
        "A product company wants its product to work inside AI apps like Claude. Which part does it build?",
        [
            "The host",
            "The MCP client",
            "The MCP server",
            "The language model",
        ],
        "The MCP server",
        "The product ships the MCP server, while the host is the AI app and the MCP client is the part of the host that speaks the protocol.",
    ),
    # --- The three building blocks ---
    make_question(
        3,
        "Which three building blocks can an MCP server offer?",
        [
            "Tools, resources, and prompts",
            "Models, tokens, and chats",
            "Pages, buttons, and forms",
            "Hosts, clients, and plugins",
        ],
        "Tools, resources, and prompts",
        "Tools are operations the model can call, resources are content the app can read, and prompts are reusable instruction templates.",
    ),
    # --- Discovery ---
    make_question(
        4,
        "What happens during discovery?",
        [
            "The server sends a finished web page to the AI app",
            "The user types in every tool name by hand",
            "The model guesses which tools might exist",
            "The host asks the server what it offers, and the server answers with a described list",
        ],
        "The host asks the server what it offers, and the server answers with a described list",
        "Each entry in the list has a name, a description, and the expected arguments, and the descriptions are written for the model.",
    ),
    # --- What changed in the current specification ---
    make_question(
        5,
        "In the current MCP specification (2026-07-28), what happened to the mandatory startup handshake?",
        [
            "It is gone, and each request now carries its own protocol version",
            "It must now run twice before every tool call",
            "It moved from the client to the user",
            "Nothing changed, and every session still starts with it",
        ],
        "It is gone, and each request now carries its own protocol version",
        "Requests are now stateless, so the server does not need to remember a session between calls.",
    ),
    # --- Local servers (stdio) ---
    make_question(
        6,
        "How does a host talk to a local MCP server?",
        [
            "By email",
            "It starts the server as a process and uses standard input and output",
            "Through a public HTTPS address ending in /mcp",
            "Through a shared spreadsheet",
        ],
        "It starts the server as a process and uses standard input and output",
        "Local servers run on your own machine, which is good for tools that need your local files.",
    ),
    # --- Remote servers and the deprecated SSE transport ---
    make_question(
        7,
        "A tutorial tells you to connect to a remote server at an address ending in /sse. What does that tell you?",
        [
            "The tutorial uses the newest transport",
            "The server only works on weekends",
            "The tutorial follows the old HTTP plus SSE transport, which is deprecated",
            "The server needs no network connection",
        ],
        "The tutorial follows the old HTTP plus SSE transport, which is deprecated",
        "New remote servers should serve streamable HTTP at an address ending in /mcp.",
    ),
    # --- The Salesforce layering ---
    make_question(
        8,
        "In Salesforce in Claude, a seller gets a personal dashboard. Who builds that dashboard page?",
        [
            "The MCP server sends a finished web page",
            "Claude writes the page, using data the MCP server moved",
            "The seller writes the page by hand",
            "Slack builds it and sends it over",
        ],
        "Claude writes the page, using data the MCP server moved",
        "The server only moves data, a skill gives the guidance, Claude builds the page, and the artifact is where the page is shown.",
    ),
    # --- Security rule 2: check every token fully (audience check) ---
    make_question(
        9,
        "Your MCP server receives a valid token that was issued for a different service. What should it do?",
        [
            "Accept it, because the token is valid",
            "Forward it to another service to be safe",
            "Reject it, because the token is not meant for your server",
        ],
        "Reject it, because the token is not meant for your server",
        "A server must check that a token is valid, not expired, and meant for that server, and it must never forward a token it received.",
    ),
    # --- Security rule 3: check permissions on every call ---
    make_question(
        10,
        "You hide a dangerous tool from the model. Is the tool now safe?",
        [
            "Yes, because the model cannot see it",
            "Yes, as long as the tool has a long name",
            "No, because a caller can still send requests directly, so check permissions on every call",
        ],
        "No, because a caller can still send requests directly, so check permissions on every call",
        "Hiding a tool is not security, and an id the caller sends is input to verify, not proof of access.",
    ),
]

# ---------------------------------------------------------------------------
# PART 2 - THE MCP SERVER
# ---------------------------------------------------------------------------

# The text that get_server_info returns.
# Plain English, so the model can simply read it out to the user.
SERVER_INFO = "\n".join(
    [
        "Hello! I am MCP Trainer.",
        "I am a small demo MCP server made for a 30-minute training about MCP (Model Context Protocol).",
        "I am only a demo. I hold ten quiz questions about MCP and nothing else.",
        "I am public: I need no sign-in, and anyone with my address can call me. That is safe only because I hold nothing private.",
        "I am temporary: I will be deleted after the training session.",
        "What I offer: the tool get_server_info (this message), the tool get_quiz (the quiz questions), and the prompt build_quiz_game (instructions for building a playable quiz game).",
        'Try asking: "Build me the MCP quiz game."',
    ]
)

# The instructions that the build_quiz_game prompt returns.
#
# A prompt is a reusable instruction template. It does not DO anything by
# itself. It is text that the AI app hands to the model. The model then
# follows it: it calls get_quiz and builds the page.
BUILD_QUIZ_GAME_INSTRUCTIONS = """Build a playable quiz game about MCP (Model Context Protocol).

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
After the artifact, add two short sentences: say that the questions came from the MCP Trainer server, and that you built the game page yourself."""


def build_app():
    """
    Create the MCP server and wrap it in a small web app.

    We import the MCP library inside this function, like Cloudflare's
    official example does. The import is the slow part of starting a
    Python Worker, so it happens once, when the Worker starts.
    """
    # "MCPServer" comes from the official MCP Python SDK.
    # (In older versions of the SDK this class was called "FastMCP".)
    # It is the object we register our tools and prompts on.
    # It also answers discovery requests for us.
    from mcp.server import MCPServer
    from mcp.types import ToolAnnotations

    # The name and version that the AI app sees when it connects.
    server = MCPServer(name="MCP Trainer", version="1.0.0")

    # -----------------------------------------------------------------------
    # TOOL 1: get_server_info
    # -----------------------------------------------------------------------
    # A tool is an operation the model can call.
    # The "description" is written FOR THE MODEL. It tells the model when
    # to use the tool. Good descriptions matter as much as good code.
    #
    # "@server.tool(...)" is a decorator: it registers the function below
    # as a tool. The function name becomes the tool name.
    @server.tool(
        title="Get server info",
        description=(
            "Returns a short plain-English description of this server: its name (MCP Trainer), "
            "what it is, and what it offers. Call this first when the user asks what this server "
            "is or what it can do. Takes no arguments."
        ),
        # "annotations" are hints for the AI app. This tool only reads.
        annotations=ToolAnnotations(read_only_hint=True),
        # Return plain text, not a structured object. Same as the TypeScript version.
        structured_output=False,
    )
    def get_server_info() -> str:
        return SERVER_INFO

    # -----------------------------------------------------------------------
    # TOOL 2: get_quiz
    # -----------------------------------------------------------------------
    # This tool returns DATA, not a page. The model decides what to do
    # with the data. With the prompt below, it builds a game.
    @server.tool(
        title="Get the MCP quiz",
        description=(
            "Returns ten multiple-choice quiz questions about MCP (Model Context Protocol) as JSON. "
            "Each question has: question, options, correct_index, correct_answer, and a one-sentence "
            "explanation. Call this when the user wants an MCP quiz or a quiz game. A good way to "
            "present the result is a playable quiz game built as a single HTML page artifact. "
            "Takes no arguments."
        ),
        annotations=ToolAnnotations(read_only_hint=True),
        structured_output=False,
    )
    def get_quiz() -> str:
        quiz = {
            "title": "MCP Quiz",
            "source": "MCP Trainer demo server",
            "question_count": len(QUIZ_QUESTIONS),
            # A small hint for the model, in case the user did not use the prompt.
            "tip": "To turn this into a playable game, follow the build_quiz_game prompt from this server.",
            "questions": QUIZ_QUESTIONS,
        }
        # We send the JSON as text. The model reads it directly.
        return json.dumps(quiz, indent=2, ensure_ascii=False)

    # -----------------------------------------------------------------------
    # PROMPT: build_quiz_game
    # -----------------------------------------------------------------------
    # A prompt is a reusable instruction template that the user can trigger.
    # When the function returns a plain string, the SDK turns it into one
    # message from the user. The AI app places it in the chat as if the
    # user had typed it.
    @server.prompt(
        title="Build the MCP quiz game",
        description="Builds a playable MCP quiz game as an artifact, using the questions from get_quiz.",
    )
    def build_quiz_game() -> str:
        return BUILD_QUIZ_GAME_INSTRUCTIONS

    # Wrap the MCP server in a web app that speaks streamable HTTP at /mcp.
    # "stateless_http=True" means: no sessions. Each request stands alone.
    # That matches the current MCP specification (2026-07-28).
    return server.streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,
    )


# ---------------------------------------------------------------------------
# PART 3 - THE HTTP ENTRY POINT
# ---------------------------------------------------------------------------

# A short text for people who open the address in a browser.
# The same text as the TypeScript version.
WELCOME_TEXT = "\n".join(
    [
        "MCP Trainer - a small public MCP demo server.",
        "",
        "This is not a web page for people. It is a server for AI apps.",
        "To use it, add this address as a custom connector in your AI app:",
        "",
        "  (this address)/mcp",
        "",
        "It needs no sign-in and holds nothing private. It is temporary.",
    ]
)


class Default(WorkerEntrypoint):
    """
    Cloudflare calls this class for every request that reaches the Worker.
    The name "Default" tells Cloudflare this is the main entry point.
    """

    def __init__(self, ctx, env):
        super().__init__(ctx, env)
        # Build the MCP web app once, when the Worker starts.
        self.app = build_app()

    async def fetch(self, request):
        # Look at the path of the address and send the request to the right place.
        path = urlparse(request.url).path

        # The current way to reach a remote MCP server: streamable HTTP at /mcp.
        # This is the address attendees paste into Claude.
        if path == "/mcp":
            return await asgi.fetch(self.app, request, self.env)

        # There is no /sse address in this version. The old HTTP plus SSE
        # transport is deprecated, and this Python setup has no simple way
        # to serve it. See README.md.

        # A friendly message for people who open the address in a browser.
        if path == "/":
            return Response(
                WELCOME_TEXT,
                headers={"content-type": "text/plain; charset=utf-8"},
            )

        # Everything else does not exist.
        return Response("Not found", status=404)
