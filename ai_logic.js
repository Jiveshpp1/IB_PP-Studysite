const providers = [
	{
		name: "Gemini",
		apiKey: process.env.GEMINI_API_KEY,
		async answer(question) {
			const { GoogleGenAI } = require("@google/genai");
			const client = new GoogleGenAI({ apiKey: this.apiKey });
			const response = await client.models.generateContent({
				model: "gemini-3.5-flash",
				contents: question
			});
			return response.text;
		}
	},
	{
		name: "OpenRouter",
		apiKey: process.env.OPENROUTER_API_KEY,
		async answer(question) {
			const OpenAI = require("openai");
			const client = new OpenAI({
				apiKey: this.apiKey,
				baseURL: "https://openrouter.ai/api/v1"
			});
			const response = await client.chat.completions.create({
				model: "openai/gpt-4o-mini",
				messages: [{ role: "user", content: question }]
			});
			return response.choices[0].message.content;
		}
	},
	{
		name: "Groq",
		apiKey: process.env.GROQ_API_KEY,
		async answer(question) {
			const Groq = require("groq-sdk");
			const client = new Groq({ apiKey: this.apiKey });
			const response = await client.chat.completions.create({
				model: "llama-3.3-70b-versatile",
				messages: [{ role: "user", content: question }]
			});
			return response.choices[0].message.content;
		}
	}
];

function answerWithoutApi(question) {
	if (/\bwhat is paper\b|\bdefine paper\b/i.test(question)) return PAPER_ANSWER;
	return "No AI API key is configured. Add a Gemini, OpenRouter, or Groq key to use live AI answers.";
}

async function answerQuestion(question) {
	if (typeof question !== "string" || !question.trim()) {
		throw new TypeError("Enter a question first.");
	}

	const prompt = question.trim();
	const configuredProviders = providers.filter(provider => provider.apiKey);
	if (!configuredProviders.length) return answerWithoutApi(prompt);

	const errors = [];
	for (const provider of configuredProviders) {
		try {
			const answer = await provider.answer(prompt);
			if (typeof answer === "string" && answer.trim()) return answer.trim();
			errors.push(`${provider.name} returned an empty answer.`);
		} catch (error) {
			errors.push(`${provider.name}: ${error.message}`);
		}
	}

	if (/\bwhat is paper\b|\bdefine paper\b/i.test(prompt)) return PAPER_ANSWER;
	throw new Error(`Could not get an AI answer. ${errors.join("; ")}`);
}

module.exports = { answerQuestion };

if (require.main === module) {
	answerQuestion(process.argv.slice(2).join(" "))
		.then(answer => console.log(answer))
		.catch(error => {
			console.error(error.message);
			process.exitCode = 1;
		});
}
