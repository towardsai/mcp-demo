/**
 * MCP Trainer — a tiny public MCP demo server.
 *
 * WHAT THIS FILE IS
 * -----------------
 * This is the whole server. It runs on Cloudflare Workers, a service that
 * runs code at a public HTTPS address.
 *
 * An MCP server is a described list of capabilities that an AI app can
 * discover and call. This server describes three capabilities:
 *
 *   1. Tool   "get_server_info"  -> the server introduces itself.
 *   2. Tool   "get_quiz"         -> ten quiz questions about MCP.
 *   3. Prompt "build_quiz_game"  -> instructions for building a quiz game.
 *
 * Notice what is NOT in this file: no web page, no game, no design.
 * The server only moves data. The AI app (for example Claude) builds the
 * game page itself. That is the same layering as the Salesforce example
 * in the training, at toy scale.
 *
 * SAFETY NOTE
 * -----------
 * This server has NO sign-in. Anyone who knows the address can call it.
 * That is fine here because it only returns harmless public quiz data.
 * Never copy this pattern for a server that touches real data.
 * See README.md for the five security rules a real server must follow.
 *
 * A NOTE ON PROTOCOL VERSIONS
 * ---------------------------
 * The training describes the current MCP specification, dated 2026-07-28.
 * In that revision requests are stateless and there is no startup handshake.
 * The McpAgent class used here (agents 0.27.0 with MCP SDK 1.30.0) speaks
 * the earlier revisions, up to 2025-11-25. Those still start with a
 * handshake and keep a session. AI apps pick a version both sides
 * understand, so the demo works either way. The tools, the prompt, and
 * discovery look the same in both revisions.
 *
 * HOW TO READ THIS FILE
 * ---------------------
 *   Part 1: the quiz data (plain data, nothing clever).
 *   Part 2: the MCP server (the three capabilities).
 *   Part 3: the HTTP entry point (which address goes where).
 */

// "McpAgent" comes from Cloudflare's "agents" package. It connects an MCP
// server to Cloudflare Workers, so we do not write any network code ourselves.
import { McpAgent } from "agents/mcp";

// "McpServer" comes from the official MCP SDK. It is the object we register
// our tools and prompts on. It also answers discovery requests for us.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ---------------------------------------------------------------------------
// PART 1 — THE QUIZ DATA
// ---------------------------------------------------------------------------
// In a real product, this part would be a call to the product's own API.
// Here it is a fixed list, so the server holds nothing private.

/** The shape of one quiz question. */
interface QuizQuestion {
	/** A short number so the questions keep a stable order. */
	id: number;
	/** The question shown to the player. */
	question: string;
	/** Three or four possible answers. */
	options: string[];
	/** The position of the correct answer in "options". Counting starts at 0. */
	correct_index: number;
	/** The correct answer as text, so nobody has to count positions. */
	correct_answer: string;
	/** One sentence that explains why the answer is correct. */
	explanation: string;
}

/**
 * A small helper that builds one question.
 * We pass the correct answer as text and the helper finds its position.
 * This way the position and the text can never disagree.
 */
function makeQuestion(
	id: number,
	question: string,
	options: string[],
	correctAnswer: string,
	explanation: string,
): QuizQuestion {
	const correctIndex = options.indexOf(correctAnswer);
	if (correctIndex === -1) {
		// This only happens if someone edits the quiz and makes a typo.
		throw new Error(`Question ${id}: the correct answer is not in the options.`);
	}
	return {
		id,
		question,
		options,
		correct_index: correctIndex,
		correct_answer: correctAnswer,
		explanation,
	};
}

/** The ten questions. Each one matches a point from the training. */
const QUIZ_QUESTIONS: QuizQuestion[] = [
	// --- What MCP is ---
	makeQuestion(
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

	// --- Host, client, server roles ---
	makeQuestion(
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

	// --- The three building blocks ---
	makeQuestion(
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

	// --- Discovery ---
	makeQuestion(
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

	// --- What changed in the current specification ---
	makeQuestion(
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

	// --- Local servers (stdio) ---
	makeQuestion(
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

	// --- Remote servers and the deprecated SSE transport ---
	makeQuestion(
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

	// --- The Salesforce layering ---
	makeQuestion(
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

	// --- Security rule 2: check every token fully (audience check) ---
	makeQuestion(
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

	// --- Security rule 3: check permissions on every call ---
	makeQuestion(
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
];

// ---------------------------------------------------------------------------
// PART 2 — THE MCP SERVER
// ---------------------------------------------------------------------------

/**
 * The text that get_server_info returns.
 * Plain English, so the model can simply read it out to the user.
 */
const SERVER_INFO = [
	"Hello! I am MCP Trainer.",
	"I am a small demo MCP server made for a 30-minute training about MCP (Model Context Protocol).",
	"I am only a demo. I hold ten quiz questions about MCP and nothing else.",
	"I am public: I need no sign-in, and anyone with my address can call me. That is safe only because I hold nothing private.",
	"I am temporary: I will be deleted after the training session.",
	"What I offer: the tool get_server_info (this message), the tool get_quiz (the quiz questions), and the prompt build_quiz_game (instructions for building a playable quiz game).",
	"Try asking: \"Build me the MCP quiz game.\"",
].join("\n");

/**
 * The instructions that the build_quiz_game prompt returns.
 *
 * A prompt is a reusable instruction template. It does not DO anything by
 * itself. It is text that the AI app hands to the model. The model then
 * follows it: it calls get_quiz and builds the page.
 */
const BUILD_QUIZ_GAME_INSTRUCTIONS = `Build a playable quiz game about MCP (Model Context Protocol).

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
After the artifact, add two short sentences: say that the questions came from the MCP Trainer server, and that you built the game page yourself.`;

/**
 * The server class.
 *
 * "McpAgent" does the plumbing. We only fill in two things:
 *   - "server": the name and version of our MCP server.
 *   - "init()": where we register what the server offers.
 *
 * The class is exported because Cloudflare needs to find it by name.
 * The same name, "McpTrainer", appears in wrangler.jsonc.
 */
export class McpTrainer extends McpAgent<Env> {
	// The name and version that the AI app sees when it connects.
	server = new McpServer({
		name: "MCP Trainer",
		version: "1.0.0",
	});

	/**
	 * init() runs when the server starts.
	 * Everything registered here shows up in discovery: when an AI app asks
	 * "what do you offer?", the SDK answers with this list for us.
	 */
	async init() {
		// -------------------------------------------------------------------
		// TOOL 1: get_server_info
		// -------------------------------------------------------------------
		// A tool is an operation the model can call.
		// The "description" is written FOR THE MODEL. It tells the model when
		// to use the tool. Good descriptions matter as much as good code.
		this.server.registerTool(
			"get_server_info",
			{
				title: "Get server info",
				description:
					"Returns a short plain-English description of this server: its name (MCP Trainer), what it is, and what it offers. Call this first when the user asks what this server is or what it can do. Takes no arguments.",
				// "annotations" are hints for the AI app. This tool only reads.
				annotations: { readOnlyHint: true },
			},
			async () => {
				// Every tool returns a list of content pieces. Here: one piece of text.
				return {
					content: [{ type: "text", text: SERVER_INFO }],
				};
			},
		);

		// -------------------------------------------------------------------
		// TOOL 2: get_quiz
		// -------------------------------------------------------------------
		// This tool returns DATA, not a page. The model decides what to do
		// with the data. With the prompt below, it builds a game.
		this.server.registerTool(
			"get_quiz",
			{
				title: "Get the MCP quiz",
				description:
					"Returns ten multiple-choice quiz questions about MCP (Model Context Protocol) as JSON. Each question has: question, options, correct_index, correct_answer, and a one-sentence explanation. Call this when the user wants an MCP quiz or a quiz game. A good way to present the result is a playable quiz game built as a single HTML page artifact. Takes no arguments.",
				annotations: { readOnlyHint: true },
			},
			async () => {
				const quiz = {
					title: "MCP Quiz",
					source: "MCP Trainer demo server",
					question_count: QUIZ_QUESTIONS.length,
					// A small hint for the model, in case the user did not use the prompt.
					tip: "To turn this into a playable game, follow the build_quiz_game prompt from this server.",
					questions: QUIZ_QUESTIONS,
				};

				// We send the JSON as text. The model reads it directly.
				return {
					content: [{ type: "text", text: JSON.stringify(quiz, null, 2) }],
				};
			},
		);

		// -------------------------------------------------------------------
		// PROMPT: build_quiz_game
		// -------------------------------------------------------------------
		// A prompt is a reusable instruction template that the user can trigger.
		// It returns one or more messages. The AI app places them in the chat
		// as if the user had typed them.
		this.server.registerPrompt(
			"build_quiz_game",
			{
				title: "Build the MCP quiz game",
				description:
					"Builds a playable MCP quiz game as an artifact, using the questions from get_quiz.",
			},
			async () => {
				return {
					messages: [
						{
							role: "user",
							content: { type: "text", text: BUILD_QUIZ_GAME_INSTRUCTIONS },
						},
					],
				};
			},
		);
	}
}

// ---------------------------------------------------------------------------
// PART 3 — THE HTTP ENTRY POINT
// ---------------------------------------------------------------------------
// Cloudflare calls "fetch" for every request that reaches the Worker.
// We look at the path of the address and send the request to the right place.

/** A short text for people who open the address in a browser. */
const WELCOME_TEXT = [
	"MCP Trainer - a small public MCP demo server.",
	"",
	"This is not a web page for people. It is a server for AI apps.",
	"To use it, add this address as a custom connector in your AI app:",
	"",
	"  (this address)/mcp",
	"",
	"It needs no sign-in and holds nothing private. It is temporary.",
].join("\n");

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// The current way to reach a remote MCP server: streamable HTTP at /mcp.
		// This is the address attendees paste into Claude.
		if (url.pathname === "/mcp") {
			return McpTrainer.serve("/mcp").fetch(request, env, ctx);
		}

		// The OLD way: the HTTP plus SSE transport. It is deprecated.
		// We keep it only so older clients can still connect.
		// New servers and new clients should use /mcp.
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return McpTrainer.serveSSE("/sse").fetch(request, env, ctx);
		}

		// A friendly message for people who open the address in a browser.
		if (url.pathname === "/") {
			return new Response(WELCOME_TEXT, {
				headers: { "content-type": "text/plain; charset=utf-8" },
			});
		}

		// Everything else does not exist.
		return new Response("Not found", { status: 404 });
	},
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/**
 * "Env" lists what Cloudflare hands to the Worker at run time.
 *
 * MCP_OBJECT is a Durable Object: a small piece of storage and compute that
 * Cloudflare runs for us. McpAgent uses it to run the MCP server.
 * It is declared in wrangler.jsonc. This server stores no data of its own.
 */
interface Env {
	MCP_OBJECT: DurableObjectNamespace;
}
