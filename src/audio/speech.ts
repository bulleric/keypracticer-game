import * as Speech from 'expo-speech';

let enabled = true;

export function setVoiceEnabled(v: boolean) {
  enabled = v;
}

/** Say a prompt out loud. Cuts off anything still being said. */
export function say(text: string, rate = 1.05) {
  if (!enabled) return;
  try {
    Speech.stop();
    Speech.speak(text, { rate, language: 'en-US' });
  } catch {
    // No voice on this device: the prompt is on screen anyway.
  }
}

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {}
}
