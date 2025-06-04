// AssemblyAI transcription test script
// Usage: node assemblyai_transcribe.js <PUBLIC_VIDEO_URL>
// Requires: npm install assemblyai axios

const axios = require('axios');

// Set your AssemblyAI API key here (get it from https://www.assemblyai.com/app/account)
const ASSEMBLYAI_API_KEY = '48eeee6a618b4f55bd4570783bb70e41';

const videoUrl = process.argv[2];
if (!videoUrl) {
  console.error('Usage: node assemblyai_transcribe.js <PUBLIC_VIDEO_URL>');
  process.exit(1);
}

async function transcribe(url) {
  // 1. Submit transcription job
  const transcriptRes = await axios.post(
    'https://api.assemblyai.com/v2/transcript',
    { audio_url: url },
    { headers: { authorization: ASSEMBLYAI_API_KEY } }
  );
  const transcriptId = transcriptRes.data.id;
  console.log('Transcription job started. ID:', transcriptId);

  // 2. Poll for completion
  let status = transcriptRes.data.status;
  let transcriptText = '';
  while (status !== 'completed' && status !== 'error') {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { authorization: ASSEMBLYAI_API_KEY } }
    );
    status = pollRes.data.status;
    console.log('Status:', status);
    if (status === 'completed') {
      transcriptText = pollRes.data.text;
      break;
    }
    if (status === 'error') {
      console.error('Transcription failed:', pollRes.data.error);
      process.exit(1);
    }
  }
  console.log('\n--- TRANSCRIPT ---\n');
  console.log(transcriptText);
}

transcribe(videoUrl).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
