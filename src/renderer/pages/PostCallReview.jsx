import React, { useState, useEffect } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';

export default function PostCallReview() {
  const { postCallTranscript } = useStore();
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [subject, setSubject] = useState('');
  const [aiLoading, setAiLoading] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    ipc.transcriptionStop().then(result => {
      if (result?.transcript) {
        setTranscript(result.transcript);
        setSeconds(result.turns?.length * 5 || 0);
      }
    }).catch(() => {});
    ipc.transcriptionGetTranscript().then(result => {
      if (result?.transcript) setTranscript(result.transcript);
    }).catch(() => {});
  }, []);

  function close() {
    setState({ postCallTranscript: null });
  }

  async function autoSummarize() {
    if (!transcript) return;
    setAiLoading('all');
    const [sumR, actR, subR] = await Promise.all([
      ipc.aiSummarize(transcript, 'summary'),
      ipc.aiSummarize(transcript, 'actions'),
      ipc.aiSummarize(transcript, 'subject'),
    ]);
    if (sumR?.result) setSummary(sumR.result);
    if (actR?.result) setActionItems(actR.result);
    if (subR?.result) setSubject(subR.result);
    setAiLoading('');
  }

  async function save() {
    try {
      await ipc.saveTranscription({
        call_number: postCallTranscript?.number || '',
        call_direction: postCallTranscript?.direction || 'out',
        call_duration: seconds,
        transcript,
        summary: [subject && `Subject: ${subject}`, summary, actionItems && `Action Items:\n${actionItems}`].filter(Boolean).join('\n\n'),
      });
      close();
    } catch {}
  }

  async function emailIt() {
    const emails = prompt('Email addresses (comma separated):');
    if (!emails) return;
    const list = emails.split(',').map(e => e.trim()).filter(Boolean);
    let id = savedId;
    if (!id) {
      const r = await ipc.saveTranscription({
        call_number: postCallTranscript?.number || '',
        call_direction: postCallTranscript?.direction || 'out',
        call_duration: seconds, transcript,
        summary: [subject && `Subject: ${subject}`, summary, actionItems && `Action Items:\n${actionItems}`].filter(Boolean).join('\n\n'),
      });
      id = r?.id;
      if (id) setSavedId(id);
    }
    if (id) await ipc.emailTranscription(id, list);
  }

  function copyAll() {
    const all = [subject && `Subject: ${subject}`, summary && `Summary:\n${summary}`, actionItems && `Action Items:\n${actionItems}`, `Transcript:\n${transcript}`].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(all);
  }

  if (!transcript) {
    return (
      <div className="absolute inset-0 z-45 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <p className="text-gray-500 mb-4">No transcription was recorded for this call.</p>
          <button onClick={close} className="btn btn-secondary px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-45 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Call Transcription Review</h2>
            <p className="text-sm text-gray-500">
              {postCallTranscript?.direction === 'in' ? 'Incoming' : 'Outgoing'} call
              {postCallTranscript?.number ? ` with ${postCallTranscript.name || postCallTranscript.number}` : ''}
            </p>
          </div>
          <button onClick={close} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* AI Actions */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">AI:</span>
          <button onClick={autoSummarize} disabled={!!aiLoading} className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 transition-colors">
            {aiLoading === 'all' ? 'Analyzing...' : 'Auto Summary'}
          </button>
          <button onClick={() => { setAiLoading('s'); ipc.aiSummarize(transcript,'summary').then(r=>{if(r?.result)setSummary(r.result);setAiLoading('');}); }} disabled={!!aiLoading} className="px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md disabled:opacity-50">
            Summary
          </button>
          <button onClick={() => { setAiLoading('a'); ipc.aiSummarize(transcript,'actions').then(r=>{if(r?.result)setActionItems(r.result);setAiLoading('');}); }} disabled={!!aiLoading} className="px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md disabled:opacity-50">
            Action Items
          </button>
          <button onClick={() => { setAiLoading('j'); ipc.aiSummarize(transcript,'subject').then(r=>{if(r?.result)setSubject(r.result);setAiLoading('');}); }} disabled={!!aiLoading} className="px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md disabled:opacity-50">
            Subject
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {subject && (
            <div className="px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-[10px] font-semibold text-purple-500 uppercase mb-1">Subject</div>
              <div className="text-sm font-medium text-purple-900">{subject}</div>
            </div>
          )}
          {summary && (
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-[10px] font-semibold text-blue-500 uppercase mb-1">Summary</div>
              <div className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{summary}</div>
            </div>
          )}
          {actionItems && (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-[10px] font-semibold text-green-600 uppercase mb-1">Action Items</div>
              <div className="text-sm text-green-900 whitespace-pre-wrap leading-relaxed">{actionItems}</div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Full Transcript</div>
            <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {transcript}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Discard & Close
          </button>
          <div className="flex gap-2">
            <button onClick={copyAll} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Copy All
            </button>
            <button onClick={emailIt} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Email
            </button>
            <button onClick={save} className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              {savedId ? 'Saved' : 'Save Transcript'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
