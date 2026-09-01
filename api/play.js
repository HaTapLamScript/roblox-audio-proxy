// api/play.js
const axios = require('axios');

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Gọi Vevioz API bằng POST
    const formData = new URLSearchParams();
    formData.append('url', url);
    formData.append('type', 'mp3');

    const response = await axios.post(
      'https://api.vevioz.com/api/button/mp3/',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      }
    );

    const data = response.data;
    
    // Kiểm tra kết quả
    if (data && data.success && data.data && data.data.url) {
      return res.json({
        success: true,
        title: data.data.title || 'Unknown',
        url: data.data.url,
        duration: data.data.duration || '0:00',
        thumbnail: data.data.thumbnail || ''
      });
    } else {
      // Nếu API trả về thành công nhưng thiếu link
      return res.status(500).json({
        error: 'Vevioz không trả về link tải',
        detail: data
      });
    }
  } catch (error) {
    console.error('Lỗi Vevioz:', error.message);
    return res.status(500).json({
      error: 'Không thể lấy link MP3',
      detail: error.message,
      hint: 'Kiểm tra URL YouTube có hợp lệ không'
    });
  }
};
