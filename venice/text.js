const VENICE_CHAT_URL = "https://api.venice.ai/api/v1/chat/completions";
const SMOKE_MODE = process.env.VENICE_SMOKE_TEST === "1";

const RATING_GUIDANCE = {
  G:    "Family-friendly. No nudity, no violence, no drugs, no suggestive content.",
  PG:   "Mild themes acceptable. No nudity, very mild peril at most, nothing sexual.",
  PG13: "Suggestive content and stylized action allowed. No explicit nudity or graphic gore.",
  R:    "Adult content allowed: nudity, mature themes, gore, strong sexuality. Be vivid and uninhibited where it serves the image.",
};

const buildSystemPrompt = (rating) => {
  const guidance = RATING_GUIDANCE[rating] || RATING_GUIDANCE.R;
  return [
    "You are a prompt engineer for AI image generation models.",
    "Given a comma-separated list of keywords and a content rating, write ONE vivid English prompt for a single image.",
    "Be specific about subject, composition, lighting, lens, mood, and texture. Prefer concrete nouns and adjectives over abstractions.",
    "Output the prompt as a single paragraph of plain text. No markdown, no quotation marks, no preamble, no trailing notes.",
    `Content rating: ${rating}. ${guidance}`,
  ].join(" ");
};

const mockGeneratedPrompt = (keywords, rating) =>
  `[mock ${rating}] cinematic image inspired by: ${keywords}`;

export const generatePromptFromKeywords = async ({ keywords, rating = "R", model = "zai-org-glm-4.6", debug = false }) => {
  if (!keywords || !keywords.trim()) {
    throw new Error("generatePromptFromKeywords: keywords are required");
  }

  if (SMOKE_MODE) return mockGeneratedPrompt(keywords.trim(), rating);

  if (!process.env.VENICE_API_TOKEN) {
    throw new Error("VENICE_API_TOKEN is not set; required for --keywords prompt expansion.");
  }

  const body = {
    model,
    temperature: 0.85,
    messages: [
      { role: "system", content: buildSystemPrompt(rating) },
      { role: "user", content: `Keywords: ${keywords.trim()}` },
    ],
  };

  if (debug) {
    console.log("Text-model URL:", VENICE_CHAT_URL);
    console.log("Text-model body:", JSON.stringify(body, null, 2));
  }

  const response = await fetch(VENICE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VENICE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Venice chat API ${response.status}: ${text}`);
  }

  const data = await response.json();
  const generated = data?.choices?.[0]?.message?.content?.trim();
  if (!generated) {
    throw new Error(`Venice chat API returned no content: ${JSON.stringify(data)}`);
  }

  return generated;
};

export const VALID_RATINGS = Object.keys(RATING_GUIDANCE);
