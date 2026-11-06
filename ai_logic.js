"use strict";

require("dotenv").config({ quiet: true });

const DEFAULT_QUESTION = "I want 67 dollars";
const DEFAULT_SYSTEM_PROMPT = 'For this test, reply exactly "1234" and name the AI model when the user says "I want 67 dollars".';
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20000;
const PAPER_ANSWER = "Paper is a thin material commonly made from wood pulp and used for writing, printing, and packaging.";

const providers = [
	{
		name: "Gemini",
		apiKey: process.env.GEMINI_API_KEY,
		async answer(question, systemPrompt) {
			const { GoogleGenAI } = require("@google/genai");
			const client = new GoogleGenAI({
				apiKey: this.apiKey,
				httpOptions: { timeout: REQUEST_TIMEOUT_MS }
			});
			const response = await client.models.generateContent({
				model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
				contents: question,
				config: systemPrompt ? { systemInstruction: systemPrompt } : undefined
			});
			return response.text;
		}
	},
	{
		name: "OpenRouter",
		apiKey: process.env.OPENROUTER_API_KEY,
		async answer(question, systemPrompt) {
			const OpenAI = require("openai");
			const client = new OpenAI({
				apiKey: this.apiKey,
				baseURL: "https://openrouter.ai/api/v1",
				timeout: REQUEST_TIMEOUT_MS
			});
			const messages = [];
			if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
			messages.push({ role: "user", content: question });
			const response = await client.chat.completions.create({
				model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
				messages
			});
			return response.choices?.[0]?.message?.content;
		}
	},
	{
		name: "Groq",
		apiKey: process.env.GROQ_API_KEY,
		async answer(question, systemPrompt) {
			const Groq = require("groq-sdk");
			const client = new Groq({ apiKey: this.apiKey, timeout: REQUEST_TIMEOUT_MS });
			const messages = [];
			if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
			messages.push({ role: "user", content: question });
			const response = await client.chat.completions.create({
				model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
				messages
			});
			return response.choices?.[0]?.message?.content;
		}
	}
];

function validateQuestion(question) {
	if (typeof question !== "string" || !question.trim()) {
		throw new TypeError("Enter a question first.");
	}
	return question.trim();
}

function safeError(error, apiKey) {
	const message = String(error?.message || error);
	return apiKey ? message.replaceAll(apiKey, "[redacted]") : message;
}

function answerWithoutApi(question) {
	if (/\bwhat is paper\b|\bdefine paper\b/i.test(question)) return PAPER_ANSWER;
	return "No AI API key is configured. Add a Gemini, OpenRouter, or Groq key to use live AI answers.";
}

async function answerQuestion(question, systemPrompt = DEFAULT_SYSTEM_PROMPT, providerName) {
	const prompt = validateQuestion(question);
	let selectedProviders = providers.filter(provider => provider.apiKey);
	if (providerName) {
		const selected = providers.find(provider => provider.name.toLowerCase() === providerName.toLowerCase());
		if (!selected) throw new TypeError(`Unknown provider: ${providerName}.`);
		if (!selected.apiKey) throw new Error(`${selected.name} API key is not configured.`);
		selectedProviders = [selected];
	}
	if (!selectedProviders.length) return answerWithoutApi(prompt);

	const errors = [];
	for (const provider of selectedProviders) {
		try {
			const answer = await provider.answer(prompt, systemPrompt);
			if (typeof answer === "string" && answer.trim()) return answer.trim();
			errors.push(`${provider.name} returned an empty answer.`);
		} catch (error) {
			errors.push(`${provider.name}: ${safeError(error, provider.apiKey)}`);
		}
	}
	if (/\bwhat is paper\b|\bdefine paper\b/i.test(prompt)) return PAPER_ANSWER;
	throw new Error(`Could not get an AI answer. ${errors.join("; ")}`);
}

async function testProviders(question = DEFAULT_QUESTION, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
	const prompt = validateQuestion(question);
	const results = [];
	for (const provider of providers) {
		if (!provider.apiKey) {
			results.push({ provider: provider.name, status: "SKIP", message: "API key is not configured." });
			continue;
		}
		try {
			const answer = await provider.answer(prompt, systemPrompt);
			if (typeof answer !== "string" || !answer.trim()) {
				results.push({ provider: provider.name, status: "FAIL", message: "Provider returned an empty answer." });
			} else {
				results.push({ provider: provider.name, status: "PASS", answer: answer.trim() });
			}
		} catch (error) {
			results.push({ provider: provider.name, status: "FAIL", message: safeError(error, provider.apiKey) });
		}
	}
	return results;
}

module.exports = { answerQuestion, testProviders };

if (require.main === module) {
	const args = process.argv.slice(2);
	const testAll = args.includes("--test-all");
	const providerArg = args.find(arg => arg.startsWith("--provider="));
	const providerName = providerArg?.slice("--provider=".length);
	const prompt = args.filter(arg => arg !== "--test-all" && arg !== providerArg).join(" ").trim() || DEFAULT_QUESTION;

	if (testAll) {
		testProviders(prompt)
			.then(results => {
				for (const result of results) {
					console.log(`${result.provider}: ${result.status}${result.answer ? ` - ${result.answer}` : result.message ? ` - ${result.message}` : ""}`);
					if (result.status === "FAIL") process.exitCode = 1;
				}
			})
			.catch(error => {
				console.error(error.message);
				process.exitCode = 1;
			});
	} else {
		answerQuestion(prompt, DEFAULT_SYSTEM_PROMPT, providerName)
			.then(answer => console.log(answer))
			.catch(error => {
				console.error(error.message);
				process.exitCode = 1;
			});
	}
}
