// main.js
// Entry point for Sara's web prototype — integrates speech, GPT responses, memory, and logging

import {
  initSpeechRecognition,
  startListening,
  stopListening,
  stopSpeaking
} from "./scripts/think_and_respond.js";

const transcriptEl = document.getElementById("transcript");
const responseEl = document.getElementById("response");
const statusEl = document.getElementById("status");

initSpeechRecognition();

window.startListening = startListening;

window.stopListening = stopListening;

window.stopSpeaking = stopSpeaking;