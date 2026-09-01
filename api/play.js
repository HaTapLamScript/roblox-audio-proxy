// api/play.js
const ytdl = require('ytdl-core');

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Validate URL
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Lấy thông tin video
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        timeout: 8000, // 8 giây để lấy thông tin
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    });

    // Chọn audio format tốt nhất (chỉ lấy audio)
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    if (!audioFormat) {
      return res.status(500).json({ error: 'No audio format found' });
    }

    // Trả về link tải trực tiếp
    res.json({
      success: true,
      title: info.videoDetails.title,
      url: audioFormat.url,   // Đây là link .m4a hoặc .webm (vẫn phát được)
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails?.[0]?.url || ''
    });
  } catch (error) {
    console.error('Lỗi ytdl:', error.message);
    res.status(500).json({
      error: 'Không thể lấy link',
      detail: error.message
    });
  }
}; 
