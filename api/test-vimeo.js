const { Vimeo } = require('@vimeo/vimeo');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const hasClientId = !!process.env.VIMEO_CLIENT_ID;
    const hasClientSecret = !!process.env.VIMEO_CLIENT_SECRET;
    const hasAccessToken = !!process.env.VIMEO_ACCESS_TOKEN;

    console.log('Vimeo credentials check:', {
      hasClientId,
      hasClientSecret,
      hasAccessToken,
      clientIdLength: process.env.VIMEO_CLIENT_ID?.length,
      accessTokenLength: process.env.VIMEO_ACCESS_TOKEN?.length
    });

    if (!hasClientId || !hasClientSecret || !hasAccessToken) {
      return res.status(500).json({
        error: 'Missing Vimeo credentials',
        debug: { hasClientId, hasClientSecret, hasAccessToken }
      });
    }

    // Test Vimeo client initialization
    const vimeo = new Vimeo(
      process.env.VIMEO_CLIENT_ID,
      process.env.VIMEO_CLIENT_SECRET,
      process.env.VIMEO_ACCESS_TOKEN
    );

    // Test a simple API call
    return new Promise((resolve) => {
      vimeo.request({
        method: 'GET',
        path: '/me'
      }, (error, body, status_code, headers) => {
        if (error) {
          console.error('Vimeo API test error:', error);
          resolve(res.status(500).json({
            error: 'Vimeo API test failed',
            details: error.message,
            statusCode: status_code
          }));
        } else {
          console.log('Vimeo API test success:', body);
          resolve(res.status(200).json({
            success: true,
            message: 'Vimeo credentials working',
            userInfo: {
              name: body.name,
              account: body.account
            }
          }));
        }
      });
    });

  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      error: 'Test failed',
      details: error.message
    });
  }
};
