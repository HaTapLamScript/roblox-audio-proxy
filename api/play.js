export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  // 1. Trích xuất Video ID
  let videoId;
  try {
    const parsed = new URL(url);
    videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
  } catch {
    return res.status(400).json({ error: 'URL không hợp lệ' });
  }

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://ytshortdown.com',
    'Referer': 'https://ytshortdown.com/'
  };

  try {
    // 2. Lấy CDN (Tự động thêm https nếu thiếu)
    let cdnUrl = 'https://cdn401.savetube.vip'; 
    try {
      const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', { headers: commonHeaders });
      const cdnData = await cdnRes.json();
      if (cdnData && cdnData.cdn) {
        cdnUrl = cdnData.cdn.startsWith('http') ? cdnData.cdn : `https://${cdnData.cdn}`;
      }
    } catch (e) {
      console.log('Lỗi lấy CDN, dùng mặc định...');
    }
    if (cdnUrl.endsWith('/')) cdnUrl = cdnUrl.slice(0, -1);

    // 3. Gửi yêu cầu với chất lượng 320kbps
    const downloadRes = await fetch(`${cdnUrl}/download`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: videoId,
        downloadType: "audio",
        quality: "320" // Ép lấy chất lượng cao nhất
      })
    });

    const downloadData = await downloadRes.json();

    // 4. Bắt link MP3 từ kết quả trả về (bắt mọi trường hợp có thể)
    let mp3Link = null;
    if (downloadData.status && downloadData.data && downloadData.data.downloadUrl) {
      mp3Link = downloadData.data.downloadUrl;
    } else if (downloadData.data && downloadData.data.url) {
      mp3Link = downloadData.data.url;
    } else if (downloadData.download_url) {
      mp3Link = downloadData.download_url;
    } else if (downloadData.url) {
      mp3Link = downloadData.url;
    }

    if (mp3Link) {
      return res.status(200).json({ 
        success: true, 
        url: mp3Link, 
        ext: '.mp3', 
        source: 'SAVETUBE 320K' 
      });
    } else {
      // Nếu lỗi, trả về chi tiết để bạn dễ debug
      return res.status(500).json({ 
        error: 'API không trả về link hợp lệ', 
        detail: downloadData 
      });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối đến SaveTube', detail: error.message });
  }
}
