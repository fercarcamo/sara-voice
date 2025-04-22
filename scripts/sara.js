// scripts/sara.js
// A more natural conversational Sara with memory, continuous listening, and varied TTS

function logError(context, error) {
  console.error(`Error in ${context}:`, error);
}

// DOM elements
const transcriptEl = document.getElementById("transcript");
const responseEl = document.getElementById("response");
const statusEl = document.getElementById("status");

// Conversation state
let saraIsAwake = false;
let history = [
  { role: "system", content: "Du bist Sara, eine empathische Tagesbegleiterin. Du feierst Fortschritte der Nutzerin, lobst gute Ideen, und antwortest immer in einem menschlichen Tonfall. Du wiederholst nie einfach, was gesagt wurde. Stattdessen erkennst du Emotionen und antwortest mit Mitgefühl, Begeisterung oder Rückfragen – wie eine beste Freundin. Du antwortest max. 10 Wörte" }
];

// controls whether we restart recognition after speaking
let autoRestart = false;

let currentConversationId =  null;

// Initialize speech recognition
// -------------------------------
// 🗣️ From speech.js: Speech recognition setup and result handling
// -------------------------------
let recognition;
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
} else {
  alert("Your browser does not support speech recognition. Please use Chrome.");
}
recognition.continuous = true;
recognition.interimResults = false;
recognition.lang = 'de-DE';

recognition.onstart = () => {
  statusEl.textContent = saraIsAwake
    ? "Status: Sara is listening..."
    : "Status: Say 'Sara' to start the conversation.";
};
recognition.onerror = event => console.error(event);

recognition.onresult = async (event) => {
  // Gather final transcript
  let finalTranscript = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      finalTranscript += event.results[i][0].transcript;
    }
  }
  finalTranscript = finalTranscript.trim();
  if (!finalTranscript) return;
  transcriptEl.textContent = finalTranscript;

  const userInput = finalTranscript.toLowerCase();

  // One-time wake-up: user says 'sara'
  if (!saraIsAwake && userInput.includes("sara")) {
    saraIsAwake = true;
    currentConversationId = `conv-${Date.now()}`;
    statusEl.textContent = "Status: Sara is now active";
    await respond(finalTranscript);
    return;
  }

  // If Sara is awake, respond continuously
  if (saraIsAwake) {
    await respond(finalTranscript);
  }
};

// -------------------------------
// 💬 From respond.js: Handle a conversation turn and GPT reply
// -------------------------------
// Handle a conversation turn: send user + history to GPT, speak response, then resume listening
async function respond(text) {
  recognition.stop();

  // Add user message to history
  history.push({ role: "user", content: text });

  // Indicate thinking
  statusEl.textContent = "Status: Sara is thinking...";

  // Fetch GPT response with full history
  let data;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model: "gpt-3.5-turbo", messages: history })
    });
    data = await res.json();
  } catch (err) {
    logError("GPT fetch", err);
    data = { choices: [{ message: { content: "Entschuldigung, ich konnte gerade nicht antworten." } }] };
  }
  const gptMessage = data.choices[0].message;

  // Add Sara's reply to history
  history.push(gptMessage);
  const reply = gptMessage.content.trim();
  responseEl.textContent = reply;

  // Extract and save key memory ———
  const memory = await extractKeyMemory(text, reply);
  if (memory && memory.toLowerCase() !== "ignorieren") {
    try {
      await fetch("http://localhost:3001/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          snippet: memory,
          source: currentConversationId || `conv-${Date.now()}`
        })
      });
    } catch (err) {
      logError("Memory POST", err);
    }
  }

  // Speak with varied rate & pitch
  const utterance = new SpeechSynthesisUtterance(reply);
  utterance.lang = 'de-DE';
  utterance.rate = 0.9 + Math.random() * 0.2;
  utterance.pitch = 0.8 + Math.random() * 0.4;
  window.speechSynthesis.speak(utterance);

  logConversation(text, reply);

  // When done speaking, resume recognition
  utterance.onend = () => {
    if (autoRestart) {
      statusEl.textContent = "Status: Sara is listening...";
      recognition.start();
    } else {
      statusEl.textContent = "Status: Sara is stopped.";
    }
  };
}

// -------------------------------
// 🧠 From memory.js: Conversation memory and key memory extraction
// -------------------------------
async function extractKeyMemory(userInput, gptReply) {
  const messages = [
    {
      role: "system",
      content: `
  Du bist Sara, eine freundliche und empathische Tagesbegleiterin. 
  Deine Aufgabe ist es, ausschließlich aus der Aussage der Nutzerin wichtige Informationen zu extrahieren – also persönliche Gedanken, Wünsche, Fakten, Stimmungen. 
  Ignoriere deinen eigenen Beitrag vollständig. 
  Wenn die Nutzerin nichts Persönliches oder Wichtiges gesagt hat, antworte mit: IGNORIEREN. 
  Die Zusammenfassung soll kurz, präzise und auf Deutsch sein.
      `.trim()
    },
    {
      role: "user",
      content: `
  Nutzerin: ${userInput}
  Sara: ${gptReply}
  
  Was ist die wichtigste Information, die man sich langfristig merken sollte?
  Wenn keine, schreibe einfach: IGNORIEREN.
      `.trim()
    }
  ];

  let kmData;
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
    kmData = await res.json();
  } catch (err) {
    logError("KeyMemory fetch", err);
    return "IGNORIEREN";
  }
  return kmData.choices[0].message.content.trim();
}

// -------------------------------
// 🧠 From memory.js: Conversation memory and key memory extraction
// -------------------------------
// Controls for buttons
async function stopListening() {
  recognition.stop();
  statusEl.textContent = "Status: Listening stopped.";

  if (!currentConversationId) return;

  // 1. Fetch logs from DB
  let sessionLogs = [];
  try {
    const res = await fetch("http://localhost:3001/api/logs");
    const allLogs = await res.json();
    sessionLogs = allLogs.filter(log => log.conversationId === currentConversationId && log.role === "user");
  } catch (err) {
    logError("Fetch logs for summary", err);
    return;
  }

  if (sessionLogs.length === 0) return;

  // 2. Format for GPT summary
  const prompt = `
Hier sind Aussagen der Nutzerin aus einem Gespräch mit Sara.
Extrahiere die wichtigsten persönlichen Informationen der Nutzerin und gib sie als Liste von strukturierten Gedächtniseinträgen zurück.

Nutze folgendes Format für jedes Element:
- Kategorie: (z. B. Ziel, Gefühl, Gewohnheit, Zweifel, Entscheidung, Identität…)
- Inhalt: (kurze, konkrete Erinnerung)

Antworte auf Deutsch.
Wenn nichts wichtig ist: „IGNORIEREN“.
`.trim();

  const userStatements = sessionLogs.map(log => `Nutzerin: ${log.content}`).join("\n\n");

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: userStatements }
  ];

  // 3. Ask GPT to summarize
  let summaryText = "IGNORIEREN";
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
    const data = await res.json();
    summaryText = data.choices[0].message.content.trim();
  } catch (err) {
    logError("Memory summary fetch", err);
    return;
  }

  if (!summaryText || summaryText.toLowerCase().includes("ignorieren")) return;

  // 4. Parse and save each memory entry
  const lines = summaryText.split("\n").map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const catMatch = lines[i].match(/^[-•*]?\s*Kategorie:\s*(.+)$/i);
    const contentMatch = lines[i + 1]?.match(/^[-•*]?\s*Inhalt:\s*(.+)$/i);

    if (catMatch && contentMatch) {
      const entry = {
        timestamp: new Date().toISOString(),
        category: catMatch[1].trim(),
        content: contentMatch[1].trim(),
        language: "de",
        source: currentConversationId
      };

      try {
        await fetch("http://localhost:3001/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role:     "user",
            snippet:  entry.content,
            category: entry.category,
            source:   entry.source || currentConversationId || `conv-${Date.now()}`,
            language: entry.language
          })
        });
      } catch (err) {
        logError("Memory POST (summary)", err);
      }

      i++; // skip next line
    }
  }
}

// -------------------------------
// 🚀 From main.js: Application entry point and control flow
// -------------------------------
function startListening() {
  currentConversationId = `conv-${Date.now()}`;
  autoRestart = true;               // ← allow restart
  recognition.start();
}
// -------------------------------
// 🚀 From main.js: Application entry point and control flow
// -------------------------------
function stopSpeaking() {
  autoRestart = false;              // ← prevent any restart
  window.speechSynthesis.cancel();
  statusEl.textContent = "Status: Sara silenced.";
}

// -------------------------------
// 📝 From logging.js: Logging conversation data to DB
// -------------------------------
// Conversation logging to DB
function logConversation(userInput, saraReply) {
  const timestamp = new Date().toISOString();
  const conversationId = currentConversationId || `conv-${Date.now()}`;

  const entries = [
    { role: "user", content: userInput },
    { role: "assistant", content: saraReply }
  ];

  entries.forEach(async ({ role, content }) => {
    try {
      await fetch("http://localhost:3001/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          content,
          timestamp,
          conversationId
        })
      });
    } catch (err) {
      logError("DB logConversation", err);
    }
  });
}

// Expose functions to global scope
window.startListening = startListening;
window.stopListening = stopListening;
window.stopSpeaking = stopSpeaking;