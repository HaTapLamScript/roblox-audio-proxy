// api/play.js
const axios = require('axios');

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  // Hàm thử Cobalt API (ưu tiên)
  async function fetchCobalt() {
    const payload = {
      url: url,
      format: 'mp3',
      quality: 'high'
    };
    const response = await axios.post('https://api.cobalt.tools/api/json', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    });
    const data = response.data;
    if (data && data.url) {
      return {
        success: true,
        title: data.filename?.replace(/\.[^.]+$/, '') || 'Unknown',
        url: data.url,
        duration: '0:00' // Cobalt không trả duration
      };
    }
    throw new Error('Cobalt trả về thiếu link');
  }

  // Hàm thử Vevioz (dùng GET, có thể vẫn hoạt động với một số video)
  async function fetchVeviozGet() {
    const response = await axios.get(`https://api.vevioz.com/api/button/mp3/?url=${encodeURIComponent(url)}`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = response.data;
    if (data?.success && data?.data?.url) {
      return {
        success: true,
        title: data.data.title || 'Unknown',
        url: data.data.url,
        duration: data.data.duration || '0:00'
      };
    }
    throw new Error('Vevioz GET không hợp lệ');
  }

  // Thử lần lượt
  let result = null;
  let lastError = null;

  for (const fn of [fetchCobalt, fetchVeviozGet]) {
    try {
      result = await fn();
      if (result) break;
    } catch (e) {
      lastError = e;
      console.warn('API thất bại:', e.message);
    }
  }

  if (result) {
    return res.json(result);
  } else {
    return res.status(500).json({
      error: 'Không thể lấy link từ bất kỳ API nào',
      detail: lastError ? lastError.message : 'Unknown'
    });
  }
}; 
