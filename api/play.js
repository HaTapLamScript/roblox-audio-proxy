// api/play.js
const axios = require('axios');

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Gọi sang API Vevioz - dịch vụ lấy link MP3 từ YouTube
    const veviozUrl = `https://api.vevioz.com/api/button/mp3/?url=${encodeURIComponent(url)}`;
    const response = await axios.get(veviozUrl, {
      timeout: 8000,  // 8 giây là an toàn
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Dữ liệu trả về từ Vevioz có dạng:
    // { success: true, data: { url: 'link_direct', title: '...', duration: '...' } }
    const data = response.data;
    if (data.success && data.data && data.data.url) {
      return res.json({
        success: true,
        url: data.data.url,      // link tải trực tiếp
        title: data.data.title,
        duration: data.data.duration
      });
    } else {
      return res.status(500).json({ 
        error: 'API bên thứ ba không trả về link hợp lệ',
        detail: data 
      });
    }
  } catch (error) {
    console.error('Lỗi proxy Vevioz:', error.message);
    return res.status(500).json({ 
      error: 'Không thể lấy link MP3',
      message: error.message 
    });
  }
}; 
