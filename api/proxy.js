
export default async function handler(req, res) {
  // Cấu hình CORS cho phép mọi nguồn (hoặc bạn có thể giới hạn domain của bạn)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, access_token'
  );

  // Xử lý Preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { url, method = 'POST', headers = {}, body } = req.body || {};
    
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    console.log(`Proxying request to: ${url}`);

    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        // Đảm bảo không gửi host header của vercel sang zalo
        host: undefined, 
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
    
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
