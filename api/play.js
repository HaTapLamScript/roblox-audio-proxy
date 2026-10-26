export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  let videoId;
  try {
    const parsed = new URL(url);
    videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
  } catch {
    return res.status(400).json({ error: 'URL không hợp lệ' });
  }

  // ===== LỚP 1: VEVIOZ (Lấy link MP3 chuẩn) =====
  try {
    const vRes = await fetch(`https://api.vevioz.com/api/button/mp3/${videoId}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (vRes.ok) {
      const text = await vRes.text();
      // Tìm link tải trong mã HTML trả về
      const match = text.match(/href="(https:\/\/[^"]+\.mp3[^"]*)"/) || text.match(/(https:\/\/[^"]+\.mp3)/);
      if (match && match[1]) {
        return res.status(200).json({ success: true, url: match[1], ext: '.mp3', source: 'VEVIOZ' });
      }
    }
  } catch (e) {
    console.log('[Vevioz] Thất bại, chuyển sang Tornado...');
  }

  // ===== LỚP 2: TORNADO API (Dự phòng) =====
  const TORNADO_KEY = process.env.TORNADO_API_KEY;
  if (!TORNADO_KEY) {
    return res.status(500).json({ error: 'Thiếu TORNADO_API_KEY và Vevioz thất bại' });
  }

  const TORNADO_BASE = 'https://api.tornadoapi.io';
  try {
    const createRes = await fetch(`${TORNADO_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': TORNADO_KEY },
      body: JSON.stringify({ 
        url: url, 
        audio_only: true, 
        format: 'mp3',
        audio_codec: 'mp3', // Yêu cầu chuyển đổi sang MP3
        audio_bitrate: '320k' 
      })
    });

    if (!createRes.ok) return res.status(createRes.status).json({ error: 'Tornado tạo job lỗi' });
    const { job_id } = await createRes.json();
    if (!job_id) return res.status(500).json({ error: 'Tornado không trả job_id' });

    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`${TORNADO_BASE}/jobs/${job_id}`, {
        headers: { 'x-api-key': TORNADO_KEY }
      });
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      if (statusData.status === 'Completed' && statusData.s3_url) {
        return res.status(200).json({
          success: true,
          url: statusData.s3_url,
          ext: '.mp3', // Ép đuôi mp3 (Roblox đọc được)
          source: 'TORNADO'
        });
      }
      if (['Failed', 'Warning', 'Cancelled'].includes(statusData.status)) {
        return res.status(500).json({ error: `Tornado lỗi: ${statusData.status}` });
      }
    }
    return res.status(504).json({ error: 'Tornado quá thời gian' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối Tornado', detail: error.message });
  }
}
