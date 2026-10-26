module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  // Danh sách instance Invidious (ưu tiên instance còn hoạt động tốt)
  const INVIDIOUS_INSTANCES = [
    'https://invidious.nerdvpn.de',   // Instance Đức, thường ổn định
    'https://yewtu.be',               // Instance Pháp, hay bị Cloudflare nhưng vẫn thử
    'https://invidious.f5.si'         // Instance dự phòng
  ];

  try {
    let videoId;
    try {
      const parsed = new URL(url);
      videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
    } catch {
      return res.status(400).json({ error: 'URL không hợp lệ' });
    }
    if (!videoId) return res.status(400).json({ error: 'Không tìm thấy videoId' });

    let finalStreamUrl = null;
    let usedInstance = null;

    // Lặp qua từng instance để tìm link audio
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        // Gọi API Invidious với local=true (để nó proxy stream)
        const apiUrl = `${instance}/api/v1/videos/${videoId}?local=true`;
        const response = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(8000) // Chờ tối đa 8 giây
        });

        if (!response.ok) continue; // Lỗi 403/502 thì thử instance tiếp theo

        const data = await response.json();
        
        // Invidious trả về mảng adaptiveFormats (audio-only)
        if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
          // Lọc các format audio (mimeType chứa 'audio') và sắp xếp theo bitrate
          const audioFormats = data.adaptiveFormats
            .filter(f => f.type && f.type.includes('audio'))
            .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

          if (audioFormats.length > 0) {
            // Vì local=true, URL trả về đã được Invidious proxy
            // Ta vẫn có thể thêm &local=true lần nữa để đảm bảo
            finalStreamUrl = audioFormats[0].url;
            usedInstance = instance;
            break; // Thành công thì dừng vòng lặp
          }
        }
      } catch (err) {
        // Lỗi timeout hoặc fetch, thử instance tiếp theo
        console.error(`Instance ${instance} failed:`, err.message);
      }
    }

    if (!finalStreamUrl) {
      return res.status(404).json({ error: 'Tất cả instance Invidious đều thất bại. Thử lại sau.' });
    }

    // Trả về link proxy kèm theo mime để script biết đuôi file
    return res.status(200).json({
      success: true,
      url: finalStreamUrl,
      instance: usedInstance
    });

  } catch (error) {
    console.error('Lỗi API:', error);
    return res.status(500).json({ error: error.message });
  }
};
