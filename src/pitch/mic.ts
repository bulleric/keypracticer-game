/**
 * Web microphone input: getUserMedia + Web Audio. Calls `onChunk` with mono
 * float samples. (Phones use mic.native.ts.)
 */
import { getAudioContext, resumeAudio } from '../audio/context';
import { now } from '../audio/clock';

export type ChunkHandler = (samples: Float32Array, endTime: number, sampleRate: number) => void;

export interface MicHandle {
  sampleRate: number;
  stop(): Promise<void>;
}

export class MicError extends Error {
  constructor(
    public code: 'denied' | 'unavailable' | 'insecure',
    message: string,
  ) {
    super(message);
  }
}

export async function openMic(onChunk: ChunkHandler): Promise<MicHandle> {
  const md = (globalThis as any).navigator?.mediaDevices;
  if (!md?.getUserMedia) {
    const insecure = typeof location !== 'undefined' && location.protocol === 'http:' && location.hostname !== 'localhost';
    throw insecure
      ? new MicError('insecure', 'The microphone needs an https:// address.')
      : new MicError('unavailable', 'This browser has no microphone access.');
  }
  await resumeAudio();
  let stream: MediaStream;
  try {
    stream = await md.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e: any) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError')
      throw new MicError('denied', 'Microphone permission was denied.');
    throw new MicError('unavailable', e?.message ?? 'No microphone found.');
  }
  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const bufferSize = 1024;
  // ScriptProcessorNode is deprecated but works in every browser without
  // loading a worklet module, and 1024-sample chunks are plenty here.
  const proc = ctx.createScriptProcessor(bufferSize, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    onChunk(new Float32Array(data), now() - (ctx.baseLatency || 0), ctx.sampleRate);
  };
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);
  return {
    sampleRate: ctx.sampleRate,
    async stop() {
      proc.onaudioprocess = null;
      try {
        source.disconnect();
        proc.disconnect();
        mute.disconnect();
      } catch {}
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
