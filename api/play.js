// api/play.js
module.exports = async (req, res) => {
  // Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  try {
    // Trích xuất videoId từ URL (hỗ trợ cả link youtube.com và youtu.be)
    let videoId;
    try {
      const parsed = new URL(url);
      videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
    } catch {
      return res.status(400).json({ error: 'URL không hợp lệ' });
    }

    if (!videoId) return res.status(400).json({ error: 'Không tìm thấy videoId' });

    // Dynamic import vì yt-innertube là ES Module (không dùng require được)
    const { getStreamUrlViaInnertube } = await import('yt-innertube');

    // Lấy stream URL audio chất lượng cao nhất
    const streamUrl = await getStreamUrlViaInnertube(videoId, 'audio');

    if (!streamUrl) {
      return res.status(404).json({ error: 'Không lấy được stream URL từ Innertube' });
    }

    // Redirect 302 về link audio thật (Google CDN)
    return res.redirect(302, streamUrl);

  } catch (error) {
    console.error('Lỗi yt-innertube:', error);
    return res.status(500).json({ error: error.message });
  }
};
