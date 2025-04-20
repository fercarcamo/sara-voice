// scripts/sara.js

// DOM elements
const transcriptEl = document.getElementById("transcript");
const responseEl   = document.getElementById("response");
const statusEl     = document.getElementById("status");

// State variables
let saraIsAwake   = false;
let lastWakeTime  = null;

// Initialize speech recognition
let recognition;
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
} else {
  alert("Your browser does not support speech recognition. Please use Chrome.");
}
recognition.continuous     = true;
recognition.interimResults = true;
recognition.lang           = 'de-DE';

recognition.onstart = () => {
  statusEl.textContent = "Status: Sara is listening...";
};
recognition.onerror = event => console.error(event);

// Handle results with wake/sleep logic and threshold filtering
recognition.onresult = async (event) => {
  let finalTranscript = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      finalTranscript += transcript;
    }
  }
  finalTranscript = finalTranscript.trim();
  const userInput = finalTranscript.toLowerCase();
  transcriptEl.textContent = finalTranscript;

  // Ignore empty transcripts
  if (!finalTranscript) {
    console.log("Ignored: empty transcript");
    return;
  }

  // Wake word: "sara"
  if (userInput.includes("sara") && !saraIsAwake) {
    saraIsAwake = true;
    lastWakeTime = performance.now();
    statusEl.textContent = "Status: Sara is now active";
    // Temporarily pause recognition to avoid capturing TTS
    recognition.stop();
    const reply = await frageSara(finalTranscript);
    responseEl.textContent = reply;
    sprich(reply);
    // Reset wake time and resume listening
    lastWakeTime = performance.now();
    recognition.start();
    return;
  }

  // Sleep word: "danke sara"
  if (userInput.includes("danke sara") && saraIsAwake) {
    saraIsAwake = false;
    statusEl.textContent = "Status: Sara is sleeping";
    recognition.stop();
    const reply = "Gern geschehen!";
    responseEl.textContent = reply;
    sprich(reply);
    return;
  }

  // If Sara is awake, apply threshold filter
  if (saraIsAwake) {
    // Validate speech parameters (thresholds.js must define isValidSpeech)
    if (isValidSpeech(finalTranscript, lastWakeTime)) {
      recognition.stop();
      const reply = await frageSara(finalTranscript);
      responseEl.textContent = reply;
      sprich(reply);
      // reset timestamp for next utterance
      lastWakeTime = performance.now();
      recognition.start();
    } else {
      console.log(`Ignored transcript: "${finalTranscript}"`);
      statusEl.textContent = "Status: Input ignored (noise or out-of-range)";
    }
  }
};

// Controls
function startListening() {
  recognition.start();
}
function stopListening() {
  if (recognition) {
    recognition.stop();
    statusEl.textContent = "Status: Listening stopped";
  }
}
// Stop Sara speaking mid-utterance
function stopSpeaking() {
  window.speechSynthesis.cancel();
  statusEl.textContent = "Status: Sara silenced";
}

// GPT API call
async function frageSara(text) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: text }] })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

// Text-to-speech
function sprich(text) {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  synth.speak(u);
}

// Expose controls
window.startListening = startListening;
window.stopListening = stopListening;
