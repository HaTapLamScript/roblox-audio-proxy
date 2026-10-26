module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  try {
    let videoId;
    try {
      const parsed = new URL(url);
      videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
    } catch {
      return res.status(400).json({ error: 'URL không hợp lệ' });
    }

    if (!videoId) return res.status(400).json({ error: 'Không tìm thấy videoId' });

    let data = null;

    // 1. Thử dùng client WEB (thường không khóa IP)
    try {
      const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20240424.01.00' } },
          videoId: videoId,
          contentCheckOk: true,
          racyCheckOk: true
        })
      });
      data = await response.json();
    } catch (e) {}

    // 2. Nếu WEB thất bại, fallback sang ANDROID_VR (và xóa IP)
    if (!data || !data.streamingData || !data.streamingData.adaptiveFormats) {
      const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID_VR',
              clientVersion: '1.60.19',
              deviceMake: 'Oculus',
              deviceModel: 'Quest 3',
              androidSdkVersion: 32,
              userAgent: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; GB) gzip'
            }
          },
          videoId: videoId,
          contentCheckOk: true,
          racyCheckOk: true
        })
      });
      data = await response.json();
    }

    if (!data || !data.streamingData || !data.streamingData.adaptiveFormats) {
      return res.status(404).json({ error: 'Không lấy được dữ liệu stream' });
    }

    const formats = data.streamingData.adaptiveFormats;
    const audioFormats = formats.filter(f => f.mimeType.includes('audio'));
    
    // Ưu tiên itag 140 (M4A) vì nhẹ và tương thích tốt
    let bestAudio = audioFormats.find(f => f.itag === 140);
    if (!bestAudio) bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    if (!bestAudio || !bestAudio.url) {
       return res.status(404).json({ error: 'Không tìm thấy link audio' });
    }

    // Cực kỳ quan trọng: Xóa tham số ip và ipbits để Roblox có thể tải từ IP của nó
    let streamUrl = bestAudio.url.replace(/&ip=[^&]+/g, '').replace(/&ipbits=[^&]+/g, '');

    return res.status(200).json({ success: true, url: streamUrl, mime: bestAudio.mimeType });
  } catch (error) {
    console.error('Lỗi API:', error);
    return res.status(500).json({ error: error.message });
  }
};
