export type IncomingAlertKind = "message" | "notification";

const MESSAGE_TYPES = new Set([
  "dm_message",
  "support_reply",
  "support_member_reply",
  "support_new",
]);

/** Keep message traffic acoustically separate from the general notification bell. */
export function incomingAlertKind(type: string | null | undefined): IncomingAlertKind {
  return MESSAGE_TYPES.has(type ?? "") ? "message" : "notification";
}

let audioContext: AudioContext | null = null;
let soundsPrimed = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

/**
 * Browsers only allow audio after the artist has interacted with the page.
 * Prime the shared context on the first pointer or keyboard gesture so a
 * later realtime event can make its quiet chime, even while the tab is idle.
 */
export function primeIncomingAlertSounds(): () => void {
  if (typeof window === "undefined" || soundsPrimed) return () => {};
  soundsPrimed = true;

  const prime = () => {
    const context = getAudioContext();
    if (context?.state === "suspended") void context.resume().catch(() => {});
    window.removeEventListener("pointerdown", prime);
    window.removeEventListener("keydown", prime);
  };

  window.addEventListener("pointerdown", prime, { passive: true });
  window.addEventListener("keydown", prime);

  return () => {
    window.removeEventListener("pointerdown", prime);
    window.removeEventListener("keydown", prime);
    soundsPrimed = false;
  };
}

type Tone = { delay: number; frequency: number; duration: number; volume: number };

const MESSAGE_CHIME: Tone[] = [
  { delay: 0, frequency: 659.25, duration: 0.16, volume: 0.032 },
  { delay: 0.09, frequency: 880, duration: 0.24, volume: 0.026 },
];

const NOTIFICATION_CHIME: Tone[] = [
  { delay: 0, frequency: 523.25, duration: 0.18, volume: 0.026 },
  { delay: 0.12, frequency: 698.46, duration: 0.2, volume: 0.02 },
];

function scheduleChime(context: AudioContext, kind: IncomingAlertKind): void {
  const start = context.currentTime + 0.01;
  const tones = kind === "message" ? MESSAGE_CHIME : NOTIFICATION_CHIME;

  for (const tone of tones) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = start + tone.delay;
    const toneEnd = toneStart + tone.duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(tone.volume, toneStart + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneEnd + 0.02);
  }
}

/** Plays a restrained two-note chime. Failure is intentionally silent. */
export function playIncomingAlert(kind: IncomingAlertKind): void {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "running") {
    scheduleChime(context, kind);
    return;
  }

  void context.resume().then(() => scheduleChime(context, kind)).catch(() => {});
}
