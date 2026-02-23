import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const { prompt, readBooks, tbrBooks } = await request.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const readList =
    readBooks?.length > 0
      ? `Books I've read: ${readBooks.slice(0, 20).map((b: { title: string; author: string }) => `"${b.title}" by ${b.author}`).join(", ")}`
      : "";

  const tbrList =
    tbrBooks?.length > 0
      ? `Books on my to-read list: ${tbrBooks.slice(0, 10).map((b: { title: string; author: string }) => `"${b.title}" by ${b.author}`).join(", ")}`
      : "";

  const systemPrompt = `You are a knowledgeable book recommendation assistant. You give thoughtful, personalised book recommendations based on a reader's taste and requests.

${readList}
${tbrList}

When recommending books, always respond with a JSON array of exactly 6 books in this format:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "description": "2-3 sentence description of the book",
    "reason": "1 sentence explaining why this matches their request or taste"
  }
]

Only respond with the JSON array, no other text.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system: systemPrompt,
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const books = JSON.parse(cleaned);
    return NextResponse.json({ books });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Recommend error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
