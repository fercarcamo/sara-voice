// scripts/thresholds.js
// Threshold values for Sara’s awake-mode filters
const MAX_WORDS = 35;
const MIN_WPS   = 0.5;
const MAX_WPS   = 4.0;

/**
 * Decide whether a transcript falls within human parameters.
 * @param {string} finalTranscript - The recognized text.
 * @param {number} lastWakeTime - Timestamp when Sara was last awakened (performance.now()).
 * @returns {boolean} True if the transcript is within normal human speech thresholds.
 */
function isValidSpeech(finalTranscript, lastWakeTime) {
  const duration = (performance.now() - lastWakeTime) / 1000;
  const words = finalTranscript.trim().split(/\s+/).filter(w => w);
  const wordCount = words.length;
  const wps = wordCount / duration;
  return (
    wordCount <= MAX_WORDS &&
    wps >= MIN_WPS &&
    wps <= MAX_WPS
  );
}
