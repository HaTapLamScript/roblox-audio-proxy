module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  // Instance f5.si được xác nhận là hỗ trợ local=true tốt nhất trong năm 2026
  const INVIDIOUS_INSTANCES = [
    'https://invidious.f5.si', 
    'https://yewtu.be', 
    'https://inv.nadeko.net'
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

    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        // local=true: Bắt buộc Invidious proxy stream qua server của nó để tránh lỗi 403 từ Google
        const apiUrl = `${instance}/api/v1/videos/${videoId}?local=true`;
        
        const response = await fetch(apiUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000) // Chờ tối đa 10 giây
        });

        if (!response.ok) continue;

        const data = await response.json();
        
        // Lấy các định dạng audio-only từ adaptiveFormats
        if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
          const audioFormats = data.adaptiveFormats
            .filter(f => f.type && f.type.includes('audio'))
            .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

          if (audioFormats.length > 0) {
            finalStreamUrl = audioFormats[0].url;
            console.log(`[API] Lấy link thành công từ: ${instance}`);
            break; // Dừng vòng lặp khi tìm thấy link
          }
        }
      } catch (err) {
        console.warn(`[API] Instance ${instance} lỗi:`, err.message);
      }
    }

    if (!finalStreamUrl) {
      return res.status(404).json({ error: 'Tất cả instance Invidious đều thất bại. Vui lòng thử lại sau.' });
    }

    return res.status(200).json({
      success: true,
      url: finalStreamUrl,
      ext: '.m4a' // Định dạng Invidious proxy thường trả về M4A (AAC)
    });

  } catch (error) {
    console.error('Lỗi API:', error);
    return res.status(500).json({ error: error.message });
  }
};
