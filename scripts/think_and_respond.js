// scripts/ai-agent.js
// 🧏‍♀️🧠 Sara’s ears, voice, and brain in one file.
// Listens, thinks (via GPT), speaks, logs, and remembers.

import { logConversation } from './logging.js';
import { summarizeConversation } from './memory.js';

let currentConversationId = `conv-${Date.now()}`;
let recognition;
let manuallyStopped = false;

let recognitionIsActive = false;
let speakingNow = false;

let saraIsAwake = false;
const history = [
    {
        role: "system",
        content: `
  Du bist Sara, eine empathische Tagesbegleiterin. Du feierst Fortschritte der Nutzerin, lobst gute Ideen und antwortest immer in einem menschlichen Tonfall. 
  Du wiederholst nie einfach, was gesagt wurde. Stattdessen erkennst du Emotionen und reagierst mit Mitgefühl, Begeisterung oder Rückfragen – wie eine beste Freundin. 
  Antworten bitte auf Deutsch. Maximal 10 Wörter pro Antwort. Keine Emojis.
      `.trim()
    }
];

const transcriptEl = document.getElementById("transcript");
const statusEl = document.getElementById("status");

const OPENAI_API_KEY = window.OPENAI_API_KEY || "your-default-key-here";

// UI update helper
function updateUI({ status, response }) {
    if (status) statusEl.textContent = status;
    if (response) transcriptEl.textContent = response;
}

// Start a new conversation and begin listening
export function startListening() {
    manuallyStopped = false;
    currentConversationId = `conv-${Date.now()}`;
    if (recognition) recognition.start();
}

// Stop listening and update status
export function stopListening() {
    manuallyStopped = true;

    if (recognition) recognition.stop();
    updateUI({ status: "Status: Listening stopped." });
}

// Immediately stop speech output
export function stopSpeaking() {
    window.speechSynthesis.cancel();
}

// Initialize browser speech recognition and set up event handlers
export function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Your browser does not support speech recognition. Please use Chrome.");
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'de-DE';

    recognition.onstart = () => {
        recognitionIsActive = true;
        updateUI({
            status: saraIsAwake
                ? "Status: Sara is listening..."
                : "Status: Say 'Sara' to start the conversation."
        });
    };

    recognition.onend = () => {
        recognitionIsActive = false;
    };

    recognition.onerror = (event) => console.error(event);

    recognition.onresult = async (event) => {
        // 🛑 Block input while Sara is still speaking
        if (speakingNow) {
            console.log("🟡 Ignored input during Sara's speech");
            return;
        }

        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim();
                const confidence = event.results[i][0].confidence;

                if (confidence > 0.6 && transcript.length > 3) {
                    finalTranscript += transcript + " ";
                } else {
                    console.log("🟡 Ignored low-confidence input:", transcript, `(confidence: ${confidence})`);
                }
            }
        }

        finalTranscript = finalTranscript.trim();
        if (!finalTranscript) return;

        transcriptEl.textContent = finalTranscript;
        const userInput = finalTranscript.toLowerCase();

        if (!saraIsAwake && userInput.includes("sara")) {
            saraIsAwake = true;
            updateUI({ status: "Status: Sara is now active" });
            await respondToUser(finalTranscript);
            return;
        }

        if (saraIsAwake) {
            await respondToUser(finalTranscript);
        }
    };
}

// Speak a given text out loud
function speak(text) {
    speakingNow = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9 + Math.random() * 0.2;
    utterance.pitch = 0.8 + Math.random() * 0.4;

    recognition.stop();

    utterance.onend = () => {
        speakingNow = false;
        setTimeout(() => {
            if (!manuallyStopped && recognition && !recognitionIsActive) {
                try {
                    recognition.start();
                    statusEl.textContent = "Status: Sara is listening...";
                } catch (err) {
                    console.warn("🎙️ Failed to restart recognition:", err.message);
                }
            }
        }, 1000);
    };

    window.speechSynthesis.speak(utterance);
}

// Handle GPT response logic and memory
async function respondToUser(text) {
    history.push({ role: "user", content: text });
    updateUI({ status: "Status: Sara is thinking..." });

    let reply = "Entschuldigung, ich konnte gerade nicht antworten.";

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: history
            })
        });

        const data = await res.json();
        reply = data.choices[0].message.content.trim();
        history.push({ role: "assistant", content: reply });
    } catch (err) {
        console.error("Error in GPT fetch:", err);
    }

    updateUI({ response: reply });
    speak(reply);
    logConversation(text, reply, currentConversationId);

    const userLogs = history.filter(entry => entry.role === "user");
    const memories = await summarizeConversation(currentConversationId, userLogs);
    for (const memory of memories) {
        const payload = {
            role: "user",
            snippet: memory.content,
            category: memory.category,
            source: memory.source,
            timestamp: memory.timestamp,
            language: memory.language
        };

        console.log("Saving memory:", payload);

        try {
            await fetch("http://localhost:3001/api/memory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error("Error saving memory:", err);
        }
    }
}