export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const TORNADO_KEY = process.env.TORNADO_API_KEY;
  if (!TORNADO_KEY) {
    return res.status(500).json({ error: 'Thiếu TORNADO_API_KEY trên Vercel' });
  }

  const TORNADO_BASE = 'https://api.tornadoapi.io';

  try {
    // Gọi Tornado tạo Job (Ép định dạng MP3 chuẩn)
    const createRes = await fetch(`${TORNADO_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': TORNADO_KEY },
      body: JSON.stringify({ 
        url: url, 
        audio_only: true, 
        audio_format: "mp3" // <--- ĐÂY LÀ CHÌA KHÓA ÉP RA MP3
      })
    });

    if (!createRes.ok) return res.status(createRes.status).json({ error: 'Tornado tạo job lỗi' });
    const { job_id } = await createRes.json();
    if (!job_id) return res.status(500).json({ error: 'Tornado không trả job_id' });

    // Chờ Tornado xử lý
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`${TORNADO_BASE}/jobs/${job_id}`, {
        headers: { 'x-api-key': TORNADO_KEY }
      });
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      
      if (statusData.status === 'Completed' && statusData.s3_url) {
        // Kiểm tra xem link trả về có phải đuôi .mp3 không
        const isMp3 = statusData.s3_url.includes('.mp3');
        
        return res.status(200).json({
          success: true,
          url: statusData.s3_url,
          ext: isMp3 ? '.mp3' : '.m4a', // Tự động nhận diện đuôi
          source: 'TORNADO'
        });
      }
      if (['Failed', 'Warning', 'Cancelled'].includes(statusData.status)) {
        return res.status(500).json({ error: `Tornado lỗi: ${statusData.status}` });
      }
    }
    return res.status(504).json({ error: 'Tornado quá thời gian xử lý' });
    
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối Tornado', detail: error.message });
  }
}
