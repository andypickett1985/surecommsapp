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
    this.activeSpeaker = 'remote';
    this.localEnergy = 0;
    this.remoteEnergy = 0;
    this.energyDecay = 0.7;
    this.sendCount = 0;
    this.receiveCount = 0;
    this.sessionId = null;
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
    this.sendCount = 0;
    this.receiveCount = 0;
    this.sessionId = null;

    const url = `${ASSEMBLYAI_WS_URL}?sample_rate=${sampleRate}&encoding=pcm_s16le`;
    console.log('[ASSEMBLYAI] Connecting to:', url);
    console.log('[ASSEMBLYAI] API key present:', !!ASSEMBLYAI_API_KEY, 'length:', ASSEMBLYAI_API_KEY.length);

    try {
      this.ws = new WebSocket(url, {
        headers: { 'Authorization': ASSEMBLYAI_API_KEY },
      });
    } catch (err) {
      console.error('[ASSEMBLYAI] WebSocket constructor error:', err.message);
      this.active = false;
      this.emit('status', { status: 'error', message: 'Failed to create WebSocket: ' + err.message });
      return;
    }

    this.ws.on('open', () => {
      console.log('[ASSEMBLYAI] WebSocket OPEN, readyState:', this.ws?.readyState);
      this.emit('status', { status: 'connected', message: 'Transcription started' });
    });

    this.ws.on('message', (data) => {
      this.receiveCount++;
      const raw = data.toString();
      if (this.receiveCount <= 5) {
        console.log(`[ASSEMBLYAI] Raw message #${this.receiveCount}:`, raw.substring(0, 500));
      }
      try {
        const msg = JSON.parse(raw);

        if (msg.type === 'Begin') {
          this.sessionId = msg.id;
          console.log('[ASSEMBLYAI] Session begun:', msg.id, 'expires_at:', msg.expires_at);
          this.emit('status', { status: 'listening', sessionId: msg.id });
        }
        else if (msg.type === 'Turn') {
          const text = msg.transcript || '';
          const isFinal = msg.end_of_turn || false;

          if (this.receiveCount <= 10 || isFinal) {
            console.log(`[ASSEMBLYAI] Turn: final=${isFinal}, text="${text.substring(0, 80)}", speaker=${this.activeSpeaker}`);
          }

          if (isFinal && text.trim()) {
            const speaker = this.activeSpeaker === 'local' ? this.userName : this.callerName;
            const showLabel = speaker !== this.lastSpeakerLabel;
            this.lastSpeakerLabel = speaker;

            const line = showLabel ? `[${speaker}]: ${text.trim()}` : `  ${text.trim()}`;
            this.turns.push(line);
            this.fullTranscript = this.turns.join('\n');
            console.log('[ASSEMBLYAI] Final turn:', line);
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
          console.log('[ASSEMBLYAI] Session terminated, duration:', msg.audio_duration_seconds);
          this.emit('status', { status: 'ended', duration: msg.audio_duration_seconds });
        }
        else {
          console.log('[ASSEMBLYAI] Message type:', msg.type, JSON.stringify(msg).substring(0, 200));
        }
      } catch (e) {
        console.error('[ASSEMBLYAI] Parse error:', e.message, 'raw:', raw.substring(0, 200));
      }
    });

    this.ws.on('error', (err) => {
      console.error('[ASSEMBLYAI] WebSocket error:', err.message, err.code || '');
      this.emit('status', { status: 'error', message: err.message });
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[ASSEMBLYAI] WebSocket closed: code=${code}, reason=${reason?.toString() || 'none'}, sendCount=${this.sendCount}, receiveCount=${this.receiveCount}`);
      this.active = false;
      this.emit('status', { status: 'disconnected' });
    });

    this.ws.on('unexpected-response', (req, res) => {
      console.error(`[ASSEMBLYAI] Unexpected response: status=${res.statusCode}, headers=`, JSON.stringify(res.headers).substring(0, 300));
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.error('[ASSEMBLYAI] Response body:', body.substring(0, 500));
        this.emit('status', { status: 'error', message: `HTTP ${res.statusCode}: ${body.substring(0, 100)}` });
      });
    });
  }

  sendAudio(pcmBuffer, speaker) {
    if (!this.active || !pcmBuffer || pcmBuffer.length === 0) return;

    try {
      const aligned = Buffer.from(pcmBuffer);
      const samples = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.length / 2);
      let energy = 0;
      for (let i = 0; i < samples.length; i++) energy += Math.abs(samples[i]);
      energy = energy / samples.length;

      if (speaker === 'local') {
        this.localEnergy = this.localEnergy * this.energyDecay + energy * (1 - this.energyDecay);
      } else {
        this.remoteEnergy = this.remoteEnergy * this.energyDecay + energy * (1 - this.energyDecay);
      }

      const threshold = 500;
      if (this.localEnergy > threshold && this.localEnergy > this.remoteEnergy * 1.3) {
        this.activeSpeaker = 'local';
      } else if (this.remoteEnergy > threshold && this.remoteEnergy > this.localEnergy * 1.3) {
        this.activeSpeaker = 'remote';
      }
    } catch (e) {
      if (this.sendCount < 5) console.error('[ASSEMBLYAI] Energy calc error:', e.message);
    }

    this.audioBuffer = Buffer.concat([this.audioBuffer, pcmBuffer]);

    const minChunkSize = 6400;
    if (this.audioBuffer.length >= minChunkSize) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(this.audioBuffer);
          this.sendCount++;
          if (this.sendCount <= 5 || this.sendCount % 200 === 0) {
            console.log(`[ASSEMBLYAI] Sent chunk #${this.sendCount}, size=${this.audioBuffer.length}, speaker=${speaker}, wsState=${this.ws?.readyState}, localE=${Math.round(this.localEnergy)}, remoteE=${Math.round(this.remoteEnergy)}`);
          }
        } catch (err) {
          console.error(`[ASSEMBLYAI] ws.send() error on chunk #${this.sendCount}:`, err.message);
        }
        this.audioBuffer = Buffer.alloc(0);
      } else {
        if (this.sendCount < 5) {
          console.warn(`[ASSEMBLYAI] WebSocket not open, readyState=${this.ws?.readyState}, dropping ${this.audioBuffer.length} bytes`);
        }
        this.audioBuffer = Buffer.alloc(0);
      }
    }
  }

  stop() {
    if (!this.active) return { transcript: this.fullTranscript, turns: this.turns };
    this.active = false;
    console.log(`[ASSEMBLYAI] Stopping. Total chunks sent: ${this.sendCount}, messages received: ${this.receiveCount}, turns: ${this.turns.length}, sessionId: ${this.sessionId}`);

    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.audioBuffer.length > 0) {
        try { this.ws.send(this.audioBuffer); } catch {}
        this.audioBuffer = Buffer.alloc(0);
      }
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
