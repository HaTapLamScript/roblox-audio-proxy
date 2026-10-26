// Bộ nhớ đệm RAM của Vercel (Sẽ tồn tại chừng nào server Vercel còn "thức")
const cache = new Map();
const CACHE_TTL = 23 * 60 * 60 * 1000; // Lưu trong 23 tiếng (Link R2 sống 24h)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const TORNADO_KEY = process.env.TORNADO_API_KEY;
  if (!TORNADO_KEY) {
    return res.status(500).json({ error: 'Chưa cấu hình TORNADO_API_KEY' });
  }

  // Lấy VideoID làm chìa khóa cache
  let videoId;
  try {
    const parsed = new URL(url);
    videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
  } catch {
    return res.status(400).json({ error: 'URL không hợp lệ' });
  }

  // 1. KIỂM TRA CACHE TRƯỚC
  if (cache.has(videoId)) {
    const cachedData = cache.get(videoId);
    // Nếu link còn hạn (chưa quá 23 tiếng)
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`[CACHE HIT] Trả link từ bộ nhớ cho video: ${videoId}`);
      return res.status(200).json({
        success: true,
        url: cachedData.url,
        ext: cachedData.ext,
        source: 'CACHE'
      });
    } else {
      // Hết hạn thì xóa khỏi bộ nhớ
      cache.delete(videoId);
    }
  }

  // 2. NẾU CHƯA CÓ TRONG CACHE -> GỌI TORNADOAPI
  console.log(`[CACHE MISS] Gọi TornadoAPI cho video: ${videoId}`);
  const TORNADO_BASE = 'https://api.tornadoapi.io';

  try {
    const createRes = await fetch(`${TORNADO_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': TORNADO_KEY },
      body: JSON.stringify({ url: url, audio_only: true, format: 'mp3', audio_bitrate: '320k' })
    });

    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: `Tornado tạo job lỗi ${createRes.status}` });
    }

    const { job_id } = await createRes.json();
    if (!job_id) return res.status(500).json({ error: 'Tornado không trả job_id' });

    // Poll trạng thái Job
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`${TORNADO_BASE}/jobs/${job_id}`, {
        headers: { 'x-api-key': TORNADO_KEY }
      });
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      if (statusData.status === 'Completed' && statusData.s3_url) {
        let ext = '.mp3';
        try {
          const u = new URL(statusData.s3_url);
          const idx = u.pathname.lastIndexOf('.');
          if (idx !== -1) ext = u.pathname.substring(idx);
        } catch {}

        // 3. LƯU VÀO CACHE CHO LẦN SAU
        cache.set(videoId, {
          url: statusData.s3_url,
          ext: ext,
          timestamp: Date.now()
        });
        console.log(`[CACHE SAVE] Đã lưu link cho video: ${videoId}`);

        return res.status(200).json({
          success: true,
          url: statusData.s3_url,
          ext: ext,
          source: 'TORNADO'
        });
      }
      if (['Failed', 'Warning', 'Cancelled'].includes(statusData.status)) {
        return res.status(500).json({ error: `Tornado job ${statusData.status}`, detail: statusData.error });
      }
    }
    return res.status(504).json({ error: 'Tornado xử lý quá lâu, thử lại sau' });

  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối TornadoAPI', detail: error.message });
  }
}
