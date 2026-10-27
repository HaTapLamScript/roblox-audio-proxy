const Youtube = require('dew-downloader').youtube;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  try {
    // Gọi thư viện để tải MP3 (nó tự xử lý key và quality)
    const result = await Youtube.download(url, "mp3");

    // Kiểm tra kết quả trả về từ thư viện
    if (result && result.status && result.result && result.result.download) {
      return res.status(200).json({ 
        success: true, 
        url: result.result.download, 
        ext: '.mp3', 
        source: 'DEW-SAVETUBE' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Thư viện không trả về link tải', 
        detail: result 
      });
    }

  } catch (error) {
    console.error('Lỗi khi tải từ SaveTube qua thư viện:', error);
    return res.status(500).json({ error: 'Lỗi kết nối đến SaveTube', detail: error.message });
  }
}
