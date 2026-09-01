// api/play.js
const axios = require('axios');
const ytdl = require('ytdl-core');

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // ----- HÀM THỬ API VEVIOZ (GET) -----
  async function tryVeviozGet() {
    const veviozUrl = `https://api.vevioz.com/api/button/mp3/?url=${encodeURIComponent(url)}`;
    const response = await axios.get(veviozUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://vevioz.com/'
      }
    });
    return response.data;
  }

  // ----- HÀM THỬ API VEVIOZ (POST) -----
  async function tryVeviozPost() {
    const params = new URLSearchParams();
    params.append('url', url);
    params.append('type', 'mp3');
    const response = await axios.post('https://api.vevioz.com/api/button/mp3/', params, {
      timeout: 8000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vevioz.com/'
      }
    });
    return response.data;
  }

  // ----- HÀM THỬ YTDL-CORE (trực tiếp từ YouTube) -----
  async function tryYtdl() {
    if (!ytdl.validateURL(url)) throw new Error('Invalid YouTube URL');
    const info = await ytdl.getInfo(url, { requestOptions: { timeout: 9000 } });
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!audioFormat) throw new Error('No audio format found');
    return {
      success: true,
      title: info.videoDetails.title,
      url: audioFormat.url,
      duration: info.videoDetails.lengthSeconds
    };
  }

  // ----- THỰC HIỆN LẦN LƯỢT CÁC PHƯƠNG ÁN -----
  try {
    let result = null;
    let lastError = null;

    // 1. Thử GET Vevioz
    try {
      const data = await tryVeviozGet();
      if (data && data.success && data.data && data.data.url) {
        result = {
          success: true,
          url: data.data.url,
          title: data.data.title || 'Unknown',
          duration: data.data.duration || '0:00'
        };
      } else {
        throw new Error('Vevioz GET returned invalid data');
      }
    } catch (e) {
      lastError = e;
      console.log('Vevioz GET failed:', e.message);
      // 2. Thử POST Vevioz
      try {
        const data = await tryVeviozPost();
        if (data && data.success && data.data && data.data.url) {
          result = {
            success: true,
            url: data.data.url,
            title: data.data.title || 'Unknown',
            duration: data.data.duration || '0:00'
          };
        } else {
          throw new Error('Vevioz POST returned invalid data');
        }
      } catch (e2) {
        lastError = e2;
        console.log('Vevioz POST failed:', e2.message);
        // 3. Thử ytdl-core (có thể timeout nếu bài dài)
        try {
          result = await tryYtdl();
        } catch (e3) {
          lastError = e3;
          console.log('ytdl-core failed:', e3.message);
        }
      }
    }

    if (result) {
      return res.json(result);
    } else {
      return res.status(500).json({
        error: 'Tất cả các phương án lấy link đều thất bại',
        detail: lastError ? lastError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Lỗi chung:', error);
    return res.status(500).json({ error: 'Không thể lấy link MP3', message: error.message });
  }
};
