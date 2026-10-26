module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const API_KEY = process.env.TORNADO_API_KEY; 
  if (!API_KEY) {
    return res.status(500).json({ error: 'Lỗi Server: Chưa cấu hình TORNADO_API_KEY' });
  }

  try {
    // ⚠️ KIỂM TRA LẠI CÁC THÔNG SỐ DƯỚI ĐÂY THEO TÀI LIỆU CỦA TORNADO API ⚠️
    
    // 1. Endpoint: Có thể không phải /v1/download. Hãy xem Docs của họ.
    // 2. Header: Có thể là 'x-api-key': API_KEY thay vì 'Authorization': `Bearer ${API_KEY}`
    // 3. Body: Có thể họ không cần 'format', hoặc dùng key khác như 'audioFormat'.
    
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

    // Đọc text trước để xem lỗi thực sự là gì
    const responseText = await response.text();

    if (!response.ok) {
      // In chi tiết lỗi ra để bạn xem trong Vercel Logs
      console.error(`[TORNADO ERROR] Status: ${response.status} | Body: ${responseText}`);
      return res.status(response.status).json({ 
        error: `TornadoAPI báo lỗi (Mã ${response.status})`, 
        detail: responseText || "Không có nội dung trả về" 
      });
    }

    // Cố gắng parse JSON nếu thành công
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: 'API trả về dữ liệu không phải JSON', detail: responseText });
    }

    if (data.download_url || data.url) {
      return res.status(200).json({ 
        success: true, 
        url: data.download_url || data.url,
        ext: '.mp3' 
      });
    }

    return res.status(500).json({ error: 'API không trả về link hợp lệ', detail: data });

  } catch (error) {
    console.error('Lỗi Server:', error);
    return res.status(500).json({ error: 'Lỗi kết nối đến máy chủ API', detail: error.message });
  }
};
