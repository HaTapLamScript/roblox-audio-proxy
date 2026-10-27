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

  // === LỚP 1: LOADER.TO (VIDZON) - API chuyển đổi MP3 mạnh mẽ ===
  try {
    // 1. Gửi yêu cầu chuyển đổi
    const initRes = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000)
    });
    const initData = await initRes.json();
    
    if (initData.success && initData.id) {
      const jobId = initData.id;
      
      // 2. Chờ Loader.to xử lý (tối đa 8 giây)
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const progRes = await fetch(`https://loader.to/ajax/progress.php?id=${jobId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        const progData = await progRes.json();
        
        if (progData.success === 1 && progData.download_url) {
          return res.status(200).json({ success: true, url: progData.download_url, ext: '.mp3', source: 'LOADER_TO' });
        }
        if (progData.success === -1) {
          break; // Lỗi thì thoát vòng lặp
        }
      }
    }
  } catch (e) {
    console.log('[LOADER.TO] Thất bại, thử Vevioz...');
  }

  // === LỚP 2: VEVIOZ (Dự phòng) ===
  try {
    const vRes = await fetch(`https://api.vevioz.com/@api/json/mp3/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
    });
    if (vRes.ok) {
        const vData = await vRes.json();
        if (vData && vData.length > 0 && vData[0].url) {
            return res.status(200).json({ success: true, url: vData[0].url, ext: '.mp3', source: 'VEVIOZ' });
        }
    }
  } catch (e) {
    console.log('[VEVIOZ] Thất bại, thử Tornado...');
  }

  // === LỚP 3: TORNADO API (Dự phòng cuối cùng - Trả về M4A) ===
  const TORNADO_KEY = process.env.TORNADO_API_KEY;
  if (!TORNADO_KEY) {
    return res.status(500).json({ error: 'Các API MP3 thất bại và thiếu TORNADO_API_KEY' });
  }

  const TORNADO_BASE = 'https://api.tornadoapi.io';
  try {
    const createRes = await fetch(`${TORNADO_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': TORNADO_KEY },
      body: JSON.stringify({ url: url, audio_only: true, format: 'mp3' })
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
          ext: '.m4a', // Tornado trả về m4a
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
