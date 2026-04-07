"use client";

export type ToneSpec = {
  frequency: number;
  duration: number;
  gap?: number;
  gain?: number;
  type?: OscillatorType;
};

export interface ToneSequencePlayback {
  stop: () => void;
  totalDurationMs: number;
}

export function getAudioContextCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

export function playToneSequence(
  audioContext: AudioContext,
  sequence: ToneSpec[],
  options?: {
    defaultGain?: number;
  },
): ToneSequencePlayback {
  const startAt = audioContext.currentTime + 0.02;
  const defaultGain = options?.defaultGain ?? 0.03;
  let cursor = startAt;
  const nodes: Array<{ oscillator: OscillatorNode; gain: GainNode }> = [];
  let cleanupTimer = 0;
  let stopped = false;

  for (const tone of sequence) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const peakGain = tone.gain ?? defaultGain;
    const fadeInAt = cursor + 0.01;
    const endAt = cursor + tone.duration;

    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(peakGain, fadeInAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(cursor);
    oscillator.stop(endAt + 0.03);

    nodes.push({ oscillator, gain });
    cursor = endAt + (tone.gap ?? 0.08);
  }

  const totalDurationMs = Math.max(0, (cursor - startAt) * 1000 + 120);

  cleanupTimer = window.setTimeout(() => {
    if (!stopped) {
      for (const node of nodes) {
        node.oscillator.disconnect();
        node.gain.disconnect();
      }

      stopped = true;
    }
  }, totalDurationMs);

  return {
    totalDurationMs,
    stop: () => {
      if (stopped) {
        return;
      }

      stopped = true;
      window.clearTimeout(cleanupTimer);

      for (const node of nodes) {
        try {
          node.gain.gain.cancelScheduledValues(audioContext.currentTime);
          node.gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
          node.oscillator.stop();
        } catch {
          // Ignore already stopped nodes.
        }

        node.oscillator.disconnect();
        node.gain.disconnect();
      }
    },
  };
}
