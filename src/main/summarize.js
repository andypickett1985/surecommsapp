const https = require('https');

const ASSEMBLYAI_API_KEY = '0e9b2b8eca8b4a0d86c9153d46d034eb';

function callLemur(inputText, prompt, maxSize = 1000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      final_model: 'anthropic/claude-3-7-sonnet-20250219',
      input_text: inputText,
      prompt: prompt,
      max_output_size: maxSize,
    });

    const req = https.request({
      hostname: 'api.assemblyai.com',
      path: '/lemur/v3/generate/task',
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('[LEMUR] Response status:', res.statusCode, 'keys:', Object.keys(json));
          if (json.response) {
            resolve(json.response);
          } else if (json.error) {
            console.error('[LEMUR] API error:', json.error);
            reject(new Error(json.error));
          } else {
            console.log('[LEMUR] Unexpected response:', data.substring(0, 200));
            reject(new Error('Unexpected response from AI'));
          }
        } catch (e) {
          console.error('[LEMUR] Parse error:', e.message, data.substring(0, 200));
          reject(new Error('Invalid AI response'));
        }
      });
    });
    req.on('error', (e) => {
      console.error('[LEMUR] Request error:', e.message);
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

function summarizeTranscript(transcript) {
  return callLemur(
    transcript,
    'Provide a concise summary of this call transcript in 2-3 short paragraphs. Include the main topics discussed and any key outcomes.'
  );
}

function generateActionItems(transcript) {
  return callLemur(
    transcript,
    'Extract a numbered list of action items from this call transcript. If there are no clear action items, say "No specific action items identified." Be concise.'
  );
}

function generateSubject(transcript) {
  return callLemur(
    transcript,
    'Generate a short subject line (maximum 10 words) that describes what this call was about. Return ONLY the subject line, nothing else.'
  );
}

module.exports = { summarizeTranscript, generateActionItems, generateSubject };
