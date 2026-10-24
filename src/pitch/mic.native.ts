/**
 * iOS/Android microphone input through react-native-audio-api's
 * AudioRecorder. Needs a development build (not Expo Go).
 */
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
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
  let perm: string;
  try {
    perm = await AudioManager.requestRecordingPermissions();
  } catch (e: any) {
    throw new MicError('unavailable', 'Mic module missing. Use a development build, not Expo Go.');
  }
  if (perm !== 'Granted') throw new MicError('denied', 'Microphone permission was denied.');

  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'default',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
  });
  await AudioManager.setAudioSessionActivity(true);

  const recorder = new AudioRecorder();
  let sampleRate = 44100;
  const res = recorder.onAudioReady(
    { sampleRate: 44100, bufferLength: 1024, channelCount: 1 },
    (e) => {
      sampleRate = e.buffer.sampleRate;
      const data = e.buffer.getChannelData(0);
      onChunk(data.slice(0, e.numFrames), now(), sampleRate);
    },
  );
  if (res.status === 'error') throw new MicError('unavailable', res.message);
  const started = await recorder.start();
  if (started.status === 'error') throw new MicError('unavailable', started.message);
  return {
    get sampleRate() {
      return sampleRate;
    },
    async stop() {
      recorder.clearOnAudioReady();
      await recorder.stop();
    },
  };
}
