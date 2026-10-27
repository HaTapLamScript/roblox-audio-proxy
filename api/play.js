export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://ytshortdown.com',
    'Referer': 'https://ytshortdown.com/'
  };

  try {
    // Bước 1: Xin một CDN ngẫu nhiên từ SaveTube
    let cdnUrl = 'https://cdn401.savetube.vip'; 
    try {
      const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', { headers: commonHeaders });
      const cdnData = await cdnRes.json();
      if (cdnData && cdnData.cdn) {
        // FIX LỖI: Tự động thêm https:// nếu API trả về thiếu
        cdnUrl = cdnData.cdn.startsWith('http') ? cdnData.cdn : `https://${cdnData.cdn}`;
      }
    } catch (e) {
      console.log('Lỗi lấy CDN, dùng mặc định...');
    }

    // Đảm bảo không bị dư dấu / ở cuối
    if (cdnUrl.endsWith('/')) cdnUrl = cdnUrl.slice(0, -1);

    // Bước 2: Gửi yêu cầu tải nhạc đến CDN
    const downloadRes = await fetch(`${cdnUrl}/download`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        format: 'mp3' // Thêm format cho chắc chắn
      })
    });

    const downloadData = await downloadRes.json();

    // Bước 3: Kiểm tra kết quả trả về
    if (downloadData && (downloadData.download_url || downloadData.url || downloadData.link)) {
      const mp3Link = downloadData.download_url || downloadData.url || downloadData.link;
      return res.status(200).json({ 
        success: true, 
        url: mp3Link, 
        ext: '.mp3', 
        source: 'SAVETUBE' 
      });
    } else {
      // Nếu API không trả về link, in ra chi tiết để debug
      return res.status(500).json({ 
        error: 'API không trả về link hợp lệ', 
        detail: downloadData,
        cdn_used: cdnUrl
      });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Lỗi kết nối đến SaveTube', detail: error.message });
  }
}
