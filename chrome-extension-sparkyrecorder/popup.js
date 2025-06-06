let mediaRecorder;
let mixedStream;
let recordedChunks = [];

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');

startBtn.onclick = async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusDiv.textContent = 'Requesting audio...';
  try {
    // Capture tab audio
    const tabStream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: false }, stream => {
        if (chrome.runtime.lastError || !stream) reject(chrome.runtime.lastError);
        else resolve(stream);
      });
    });
    // Capture mic audio
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Mix streams
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    [tabStream, micStream].forEach(s => {
      s.getAudioTracks().forEach(track => {
        const src = ctx.createMediaStreamSource(new MediaStream([track]));
        src.connect(dest);
      });
    });
    mixedStream = dest.stream;
    // Record
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mixedStream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sparky-recording.webm';
      a.click();
      URL.revokeObjectURL(url);
      statusDiv.textContent = 'Recording saved!';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    };
    mediaRecorder.start();
    statusDiv.textContent = 'Recording...';
  } catch (err) {
    statusDiv.textContent = 'Error: ' + err;
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mixedStream.getTracks().forEach(t => t.stop());
  }
  stopBtn.disabled = true;
};
