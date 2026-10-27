export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const TORNADO_KEY = process.env.TORNADO_API_KEY;
  if (!TORNADO_KEY) return res.status(500).json({ error: 'Thiếu TORNADO_API_KEY' });

  const TORNADO_BASE = 'https://api.tornadoapi.io';

  try {
    const createRes = await fetch(`${TORNADO_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': TORNADO_KEY },
      body: JSON.stringify({ 
        url: url, 
        audio_only: true, 
        format: 'mp3', // Giữ nguyên như lúc chạy được
        audio_bitrate: '320k' 
      })
    });

    if (!createRes.ok) {
        const err = await createRes.text();
        return res.status(createRes.status).json({ error: 'Lỗi tạo job', detail: err });
    }
    
    const { job_id } = await createRes.json();
    if (!job_id) return res.status(500).json({ error: 'Không có job_id' });

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`${TORNADO_BASE}/jobs/${job_id}`, {
        headers: { 'x-api-key': TORNADO_KEY }
      });
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      
      if (statusData.status === 'Completed' && statusData.s3_url) {
        // Lấy đuôi file thực tế (thường là .m4a)
        let ext = '.m4a';
        try {
          const u = new URL(statusData.s3_url);
          const idx = u.pathname.lastIndexOf('.');
          if (idx !== -1) ext = u.pathname.substring(idx);
        } catch {}

        return res.status(200).json({
          success: true,
          url: statusData.s3_url,
          ext: ext, 
          source: 'TORNADO'
        });
      }
      if (['Failed', 'Warning', 'Cancelled'].includes(statusData.status)) {
        return res.status(500).json({ error: `Tornado lỗi: ${statusData.status}` });
      }
    }
    return res.status(504).json({ error: 'Quá thời gian xử lý' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối', detail: error.message });
  }
}
