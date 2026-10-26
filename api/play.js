module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, json } = req.query;
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

    const { getStreamUrlViaInnertube } = await import('yt-innertube');
    const streamUrl = await getStreamUrlViaInnertube(videoId, 'audio');

    if (!streamUrl) {
      return res.status(404).json({ error: 'Không lấy được stream URL' });
    }

    if (json === 'true') {
      return res.status(200).json({ success: true, url: streamUrl });
    }

    return res.redirect(302, streamUrl);
  } catch (error) {
    console.error('Lỗi yt-innertube:', error);
    return res.status(500).json({ error: error.message });
  }
};
