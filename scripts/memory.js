// scripts/memory.js

import { logError } from './logging.js';


const apiKey = OPENAI_API_KEY; // works because it's global

// Summarize a full conversation into long-term memory snippets
export async function summarizeConversation(conversationId, logs) {
  if (!conversationId || logs.length === 0) return [];

  const prompt = `
Du bist eine Gedächtnis-Hilfe für eine empathische Konversations-KI namens Sara.
Die folgenden Nachrichten stammen von der Nutzerin, die mit Sara spricht.
Wenn im Text „Sara“ oder „Sarah“ erwähnt wird, bezieht sich das auf die KI, nicht auf die Nutzerin.
Extrahiere aus den Aussagen der Nutzerin persönliche, langfristig relevante Informationen.

Antwortformat:
- Kategorie: (z. B. Ziel, Gefühl, Entscheidung…)
- Inhalt: (konkrete Erinnerung)

Wenn nichts wichtig ist: „IGNORIEREN“.
  `.trim();

  const formatted = logs
    .filter(log => log.role === "user")
    .map(log => log.content.replace(/\b(Sara|Sarah)\b/gi, "[AI]"))
    .join("\n\n");

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: formatted }
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages
      })
    });

    const result = await res.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    console.log("🔍 GPT raw response:", content);
    if (!content || content.toLowerCase().includes("ignorieren")) return [];

    const lines = content.split("\n").map(l => l.trim());
    const memories = [];

    for (let i = 0; i < lines.length; i++) {
      // Robustly match "Kategorie:" and "Inhalt:", regardless of bullet, case, or extra spaces
      const catMatch = lines[i].match(/Kategorie:\s*(.+)/i);
      const contentMatch = lines[i + 1]?.match(/Inhalt:\s*(.+)/i);

      if (catMatch && contentMatch) {
        const category = catMatch[1]?.trim();
        const content = contentMatch[1]?.trim();

        if (category && content) {
          console.log("✅ Parsed memory:", { category, content });
          memories.push({
            timestamp: new Date().toISOString(),
            category,
            content,
            source: conversationId,
            language: "de"
          });
          i++;
        }
      } else {
        console.log("⚠️ No match for line(s):", lines[i], lines[i + 1]);
      }
    }

    return memories;
  } catch (err) {
    logError("summarizeConversation", err);
    return [];
  }
}
