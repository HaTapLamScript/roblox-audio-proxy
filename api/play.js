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

  // ===== LỚP 1: SAVETUBE API (Dùng Key bí mật) =====
  try {
    const cdnUrl = 'https://cdn401.savetube.vip';
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Origin': 'https://ytshortdown.com',
      'Referer': 'https://ytshortdown.com/',
      'Content-Type': 'application/json'
    };

    const downloadRes = await fetch(`${cdnUrl}/download`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({
        id: videoId,
        downloadType: "audio",
        quality: "320",
        key: "Y2mate" // Đây là key giải mã
      }),
      signal: AbortSignal.timeout(8000)
    });
    
    const downloadData = await downloadRes.json();

    if (downloadData.status && downloadData.data && (downloadData.data.downloadUrl || downloadData.data.url)) {
      const link = downloadData.data.downloadUrl || downloadData.data.url;
      return res.status(200).json({ success: true, url: link, ext: '.mp3', source: 'SAVETUBE' });
    }
  } catch (e) {
    console.log('[SAVETUBE] Thất bại, chuyển sang Y2mate...');
  }

  // ===== LỚP 2: Y2MATE API (Dự phòng) =====
  try {
    const searchParams = new URLSearchParams();
    searchParams.append('q', videoId);
    searchParams.append('vt', 'mp3');

    const searchRes = await fetch('https://yt1s.com/api/ajaxSearch/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: searchParams.toString(),
      signal: AbortSignal.timeout(8000)
    });

    const searchData = await searchRes.json();

    if (searchData.status === 'ok' && searchData.links && searchData.links.mp3) {
       const quality = Object.keys(searchData.links.mp3)[0];
       const k = searchData.links.mp3[quality].k;
       if (k) {
           const convertParams = new URLSearchParams();
           convertParams.append('vid', videoId);
           convertParams.append('k', k);

           const convertRes = await fetch('https://yt1s.com/api/ajaxConvert/convert', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
             },
             body: convertParams.toString(),
             signal: AbortSignal.timeout(8000)
           });

           const convertData = await convertRes.json();
           if (convertData.status === 'ok' && convertData.dlink) {
             return res.status(200).json({ success: true, url: convertData.dlink, ext: '.mp3', source: 'Y2MATE' });
           }
       }
    }
  } catch (e) {
    console.log('[Y2MATE] Cũng thất bại luôn...');
  }

  // Nếu cả 2 đều chết
  return res.status(500).json({ error: 'Tất cả API đều thất bại. Vui lòng thử lại sau.' });
}
