const WebSocket = require('ws');
const EventEmitter = require('events');

const ASSEMBLYAI_API_KEY = '0e9b2b8eca8b4a0d86c9153d46d034eb';
const ASSEMBLYAI_WS_URL = 'wss://streaming.assemblyai.com/v3/ws';

class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.active = false;
    this.fullTranscript = '';
    this.turns = [];
    this.audioBuffer = Buffer.alloc(0);
    this.callerName = 'Other';
    this.userName = 'You';
    this.lastSpeakerLabel = null;

    this.localEnergy = 0;
    this.remoteEnergy = 0;
    this.activeSpeaker = 'remote';
  }

  start(sampleRate = 16000, callerName = 'Other', userName = 'You') {
    if (this.active) return;
    this.active = true;
    this.fullTranscript = '';
    this.turns = [];
    this.audioBuffer = Buffer.alloc(0);
    this.callerName = callerName || 'Other';
    this.userName = userName || 'You';
    this.lastSpeakerLabel = null;
    this.localEnergy = 0;
    this.remoteEnergy = 0;
    this.activeSpeaker = 'remote';

    const url = `${ASSEMBLYAI_WS_URL}?sample_rate=${sampleRate}`;

    this.ws = new WebSocket(url, {
      headers: { 'Authorization': ASSEMBLYAI_API_KEY },
    });

    this.ws.on('open', () => {
      console.log('[ASSEMBLYAI] WebSocket connected');
      this.emit('status', { status: 'connected', message: 'Transcription started' });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'Begin') {
          this.emit('status', { status: 'listening', sessionId: msg.id });
        }
        else if (msg.type === 'Turn') {
          const text = msg.transcript || '';
          const isFinal = msg.end_of_turn || false;

          if (isFinal && text.trim()) {
            const speaker = this.activeSpeaker === 'local' ? this.userName : this.callerName;
            const showLabel = speaker !== this.lastSpeakerLabel;
            this.lastSpeakerLabel = speaker;

            const line = showLabel ? `[${speaker}]: ${text.trim()}` : `  ${text.trim()}`;
            this.turns.push(line);
            this.fullTranscript = this.turns.join('\n');
          }

          const currentSpeaker = this.activeSpeaker === 'local' ? this.userName : this.callerName;
          this.emit('transcript', {
            text,
            speaker: currentSpeaker,
            isFinal,
            fullTranscript: this.fullTranscript,
            turnCount: this.turns.length,
          });
        }
        else if (msg.type === 'Termination') {
          this.emit('status', { status: 'ended', duration: msg.audio_duration_seconds });
        }
      } catch {}
    });

    this.ws.on('error', (err) => {
      console.error('[ASSEMBLYAI] Error:', err.message);
      this.emit('status', { status: 'error', message: err.message });
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[ASSEMBLYAI] WebSocket closed: code=${code}, reason=${reason?.toString() || 'none'}`);
      this.active = false;
      this.emit('status', { status: 'disconnected' });
    });
  }

  sendAudio(pcmBuffer, speaker) {
    if (!this.active) return;

    // Calculate audio energy to detect who is speaking
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    let energy = 0;
    for (let i = 0; i < samples.length; i++) energy += Math.abs(samples[i]);
    energy = energy / samples.length;

    if (speaker === 'local') {
      this.localEnergy = energy;
    } else {
      this.remoteEnergy = energy;
    }

    // Whoever has more energy is the active speaker (with a threshold to avoid noise)
    const threshold = 200;
    if (this.localEnergy > threshold && this.localEnergy > this.remoteEnergy * 1.5) {
      this.activeSpeaker = 'local';
    } else if (this.remoteEnergy > threshold && this.remoteEnergy > this.localEnergy * 1.5) {
      this.activeSpeaker = 'remote';
    }

    // Only send remote audio to AssemblyAI (cleaner - avoid echo)
    // Actually send both but let energy detection handle speaker ID
    if (!this.audioBuffer) this.audioBuffer = Buffer.alloc(0);
    this.audioBuffer = Buffer.concat([this.audioBuffer, pcmBuffer]);

    const minChunkSize = 3200;
    if (this.audioBuffer.length >= minChunkSize && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.audioBuffer);
      this.audioBuffer = Buffer.alloc(0);
    }
  }

  stop() {
    if (!this.active) return { transcript: this.fullTranscript, turns: this.turns };
    this.active = false;

    if (this.ws?.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ type: 'Terminate' })); } catch {}
      setTimeout(() => { if (this.ws) { this.ws.close(); this.ws = null; } }, 2000);
    }

    return { transcript: this.fullTranscript, turns: this.turns };
  }

  getTranscript() {
    return { transcript: this.fullTranscript, turns: this.turns };
  }
}

module.exports = { TranscriptionService };
