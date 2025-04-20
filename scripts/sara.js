// scripts/sara.js
// A more natural conversational Sara with memory, continuous listening, and varied TTS

function logError(context, error) {
  console.error(`Error in ${context}:`, error);
}

// DOM elements
const transcriptEl = document.getElementById("transcript");
const responseEl   = document.getElementById("response");
const statusEl     = document.getElementById("status");

// Conversation state
let saraIsAwake = false;
let history = [
  { role: "system", content: "You are a friendly, empathetic companion named Sara." }
];

// Initialize speech recognition
let recognition;
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
} else {
  alert("Your browser does not support speech recognition. Please use Chrome.");
}
recognition.continuous     = true;
recognition.interimResults = false;
recognition.lang           = 'de-DE';

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
    statusEl.textContent = "Status: Sara is now active";
    await respond(finalTranscript);
    return;
  }

  // If Sara is awake, respond continuously
  if (saraIsAwake) {
    await respond(finalTranscript);
  }
};

// Handle a conversation turn: send user + history to GPT, speak response, then resume listening
async function respond(text) {
  recognition.stop();

  // Add user message to history
  history.push({ role: "user", content: text });

  // Indicate thinking
  statusEl.textContent = "Status: Sara is thinking...";

  // Random pre‑speech delay + filler
  await sleep(200 + Math.random() * 800);
  const fillers = ["Hmm...", "Mal schauen..", "Okay..."];
  const prefix = fillers[Math.floor(Math.random() * fillers.length)];

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
        body: JSON.stringify({ role: "user", snippet: memory })
      });
    } catch (err) {
      logError("Memory POST", err);
    }
  }

  // Speak with varied rate & pitch
  const utterance = new SpeechSynthesisUtterance(prefix + ' ' + reply);
  utterance.lang = 'de-DE';
  utterance.rate  = 0.9 + Math.random() * 0.2;
  utterance.pitch = 0.8 + Math.random() * 0.4;
  window.speechSynthesis.speak(utterance);

  // When done speaking, resume recognition
  utterance.onend = () => {
    statusEl.textContent = "Status: Sara is listening...";
    recognition.start();
  };
}

// Utility: pause for ms
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractKeyMemory(userInput, gptReply) {
  const messages = [
    { role: "system", content: "Du hilfst Sara, wichtige Informationen aus einem Gespräch herauszufiltern." },
    { role: "user", content: `
Hier ist ein Gesprächsteil:
Nutzer: ${userInput}
Sara: ${gptReply}

Was ist das wichtigste, das man sich langfristig merken sollte? Wenn nichts wichtig ist, antworte mit: IGNORIEREN.
Wenn etwas wichtig ist, fasse es als kurzen Merksatz zusammen.
    `.trim() }
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

// Controls for buttons
function startListening() {
  recognition.start();
}
function stopListening() {
  recognition.stop();
  statusEl.textContent = "Status: Listening stopped.";
}
function stopSpeaking() {
  window.speechSynthesis.cancel();
  statusEl.textContent = "Status: Sara silenced.";
}

// Expose functions to global scope
window.startListening  = startListening;
window.stopListening   = stopListening;
window.stopSpeaking    = stopSpeaking;