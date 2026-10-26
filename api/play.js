module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  // Lấy API Key từ biến môi trường Vercel
  const API_KEY = process.env.TORNADO_API_KEY; 
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'Lỗi Server: Chưa cấu hình TORNADO_API_KEY trên Vercel' });
  }

  try {
    // Gọi API bên thứ 3 (Bạn có thể thay đổi URL và Body theo tài liệu của TornadoAPI / VidKraken)
    const response = await fetch('https://api.tornadoapi.io/v1/download', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}` 
      },
      body: JSON.stringify({
        url: url,
        format: 'mp3'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Lỗi từ API: ${errText}` });
    }

    const data = await response.json();

    // Trả link tải về cho Roblox (Kiểm tra xem API trả về trường nào: data.url, data.download_url, hay data.link)
    if (data.download_url || data.url) {
      return res.status(200).json({ 
        success: true, 
        url: data.download_url || data.url,
        ext: '.mp3' 
      });
    }

    return res.status(500).json({ error: 'API không trả về link hợp lệ' });

  } catch (error) {
    console.error('Lỗi Server:', error);
    return res.status(500).json({ error: 'Lỗi kết nối đến máy chủ API' });
  }
};
