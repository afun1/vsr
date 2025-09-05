const { Vimeo } = require('@vimeo/vimeo');
const { IncomingForm } = require('formidable');
const fs = require('fs');

exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[TEST] Starting Vimeo-only upload test');

    // Check environment variables
    if (!process.env.VIMEO_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Vimeo configuration missing' });
    }

    // Parse form data
    const form = new IncomingForm({
      maxFileSize: 500 * 1024 * 1024, // 500MB limit
    });

    const [fields, files] = await form.parse(req);
    
    const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;
    if (!videoFile) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    console.log('[TEST] Video file details:', {
      name: videoFile.originalFilename,
      size: videoFile.size,
      type: videoFile.mimetype
    });

    // Initialize Vimeo client
    const vimeo = new Vimeo(
      process.env.VIMEO_CLIENT_ID,
      process.env.VIMEO_CLIENT_SECRET, 
      process.env.VIMEO_ACCESS_TOKEN
    );

    // Simple upload test
    const videoTitle = `Test Upload - ${new Date().toISOString()}`;
    
    console.log('[TEST] Starting Vimeo upload...');
    
    const uploadResult = await new Promise((resolve, reject) => {
      vimeo.upload(
        videoFile.filepath,
        {
          name: videoTitle,
          description: 'Test upload from Vercel serverless function',
          privacy: { view: 'unlisted' }
        },
        (uri) => {
          console.log('[TEST] Upload completed:', uri);
          resolve(uri);
        },
        (bytesUploaded, bytesTotal) => {
          const percent = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          console.log(`[TEST] Progress: ${percent}%`);
        },
        (error) => {
          console.error('[TEST] Upload error:', error);
          reject(error);
        }
      );
    });

    // Clean up
    if (fs.existsSync(videoFile.filepath)) {
      fs.unlinkSync(videoFile.filepath);
    }

    // Return success (NO Supabase operations)
    return res.status(200).json({
      success: true,
      message: 'Vimeo upload completed successfully',
      vimeoUri: uploadResult,
      title: videoTitle
    });

  } catch (error) {
    console.error('[TEST] Error:', error);
    return res.status(500).json({ 
      error: 'Upload test failed', 
      details: error.message 
    });
  }
};
