"use client";

import type { LocalAudioTrack } from "livekit-client";

export type VoiceEffectPreset = "normal" | "cartoon" | "robot" | "high" | "low";

export const voiceEffectLabels: Record<VoiceEffectPreset, string> = {
  normal: "Обычный",
  cartoon: "Мультяшный",
  robot: "Робот",
  high: "Высокий",
  low: "Низкий",
};

type AudioEffectProcessor = Parameters<LocalAudioTrack["setProcessor"]>[0];

function createDistortionCurve(amount: number) {
  const samples = 44_100;
  const curve = new Float32Array(samples);
  const drive = Math.max(amount, 0.1);

  for (let index = 0; index < samples; index += 1) {
    const value = (index * 2) / samples - 1;
    curve[index] = ((3 + drive) * value * 20 * (Math.PI / 180)) /
      (Math.PI + drive * Math.abs(value));
  }

  return curve;
}

function disconnectNode(node: AudioNode | null) {
  try {
    node?.disconnect();
  } catch {
    // Ignore disconnect errors from partially-initialized graphs.
  }
}

export function createVoiceEffectProcessor(
  effect: Exclude<VoiceEffectPreset, "normal">,
): AudioEffectProcessor {
  let nodes: AudioNode[] = [];
  let oscillator: OscillatorNode | null = null;
  let oscillatorGain: GainNode | null = null;
  let processedTrack: MediaStreamTrack | undefined;

  async function configure(
    options: Parameters<Exclude<AudioEffectProcessor["init"], undefined>>[0],
  ) {
    const context = options.audioContext;
    const sourceStream = new MediaStream([options.track]);
    const source = context.createMediaStreamSource(sourceStream);
    const destination = context.createMediaStreamDestination();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.18;

    nodes = [source, compressor, destination];

    if (effect === "robot") {
      const tremolo = context.createGain();
      tremolo.gain.value = 0.72;

      oscillator = context.createOscillator();
      oscillator.frequency.value = 42;
      oscillatorGain = context.createGain();
      oscillatorGain.gain.value = 0.28;

      const bandpass = context.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 1320;
      bandpass.Q.value = 1.3;

      const distortion = context.createWaveShaper();
      distortion.curve = createDistortionCurve(36);
      distortion.oversample = "4x";

      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(tremolo.gain);
      source.connect(tremolo);
      tremolo.connect(bandpass);
      bandpass.connect(distortion);
      distortion.connect(compressor);
      compressor.connect(destination);
      oscillator.start();

      nodes.push(tremolo, bandpass, distortion, oscillatorGain);
    } else {
      const firstFilter = context.createBiquadFilter();
      const secondFilter = context.createBiquadFilter();
      const gain = context.createGain();

      if (effect === "cartoon") {
        firstFilter.type = "highpass";
        firstFilter.frequency.value = 260;
        secondFilter.type = "peaking";
        secondFilter.frequency.value = 2200;
        secondFilter.Q.value = 1.4;
        secondFilter.gain.value = 9;
        gain.gain.value = 1.12;
      } else if (effect === "high") {
        firstFilter.type = "highpass";
        firstFilter.frequency.value = 220;
        secondFilter.type = "highshelf";
        secondFilter.frequency.value = 3100;
        secondFilter.gain.value = 7;
        gain.gain.value = 1.08;
      } else {
        firstFilter.type = "lowpass";
        firstFilter.frequency.value = 1650;
        secondFilter.type = "lowshelf";
        secondFilter.frequency.value = 210;
        secondFilter.gain.value = 11;
        gain.gain.value = 1.18;
      }

      source.connect(firstFilter);
      firstFilter.connect(secondFilter);
      secondFilter.connect(gain);
      gain.connect(compressor);
      compressor.connect(destination);

      nodes.push(firstFilter, secondFilter, gain);
    }

    processedTrack = destination.stream.getAudioTracks()[0];
    processor.processedTrack = processedTrack;
  }

  async function destroy() {
    if (oscillator) {
      try {
        oscillator.stop();
      } catch {
        // Ignore stop errors when the oscillator was never started.
      }
    }

    for (const node of nodes) {
      disconnectNode(node);
    }

    processedTrack?.stop();
    processedTrack = undefined;
    processor.processedTrack = undefined;
    oscillator = null;
    oscillatorGain = null;
    nodes = [];
  }

  const processor: AudioEffectProcessor = {
    name: `lobby:${effect}`,
    init: async (options) => {
      await destroy();
      await configure(options);
    },
    restart: async (options) => {
      await destroy();
      await configure(options);
    },
    destroy,
  };

  return processor;
}
