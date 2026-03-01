import classicUrl from '../assets/ringtones/classic.wav';
import modernUrl from '../assets/ringtones/modern.wav';
import gentleUrl from '../assets/ringtones/gentle.wav';
import digitalUrl from '../assets/ringtones/digital.wav';
import marimbaUrl from '../assets/ringtones/marimba.wav';

export const RINGTONES = [
  { id: 'classic', name: 'Classic', url: classicUrl },
  { id: 'modern', name: 'Modern', url: modernUrl },
  { id: 'gentle', name: 'Gentle', url: gentleUrl },
  { id: 'digital', name: 'Digital', url: digitalUrl },
  { id: 'marimba', name: 'Marimba', url: marimbaUrl },
  { id: 'silent', name: 'Silent (None)', url: null },
];

let audioEl = null;

export function getSelectedRingtone() {
  const id = localStorage.getItem('scv_ringtone') || 'modern';
  const custom = localStorage.getItem('scv_ringtone_custom');
  if (id === 'custom' && custom) {
    return { id: 'custom', name: 'Custom', url: custom };
  }
  return RINGTONES.find(r => r.id === id) || RINGTONES[1];
}

export async function playRingtone() {
  stopRingtone();
  const tone = getSelectedRingtone();
  if (!tone.url) return;

  audioEl = new Audio(tone.url);
  audioEl.loop = true;
  audioEl.volume = parseFloat(localStorage.getItem('scv_ringtone_volume') || '0.8');

  const speakerId = localStorage.getItem('scv_speaker');
  if (speakerId && speakerId !== 'default' && audioEl.setSinkId) {
    try { await audioEl.setSinkId(speakerId); } catch {}
  }

  try { await audioEl.play(); } catch {}
}

export function stopRingtone() {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.src = '';
    audioEl = null;
  }
}

export async function previewRingtone(url, speakerId) {
  stopRingtone();
  if (!url) return;

  audioEl = new Audio(url);
  audioEl.loop = false;
  audioEl.volume = parseFloat(localStorage.getItem('scv_ringtone_volume') || '0.8');

  if (speakerId && speakerId !== 'default' && audioEl.setSinkId) {
    try { await audioEl.setSinkId(speakerId); } catch {}
  }

  try { await audioEl.play(); } catch {}
}
