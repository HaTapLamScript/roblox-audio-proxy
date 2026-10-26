module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const API_KEY = process.env.TORNADO_API_KEY; 
  if (!API_KEY) {
    return res.status(500).json({ error: 'Lỗi Server: Chưa cấu hình TORNADO_API_KEY' });
  }

  const BASE_URL = 'https://api.tornadoapi.io';

  try {
    const createResponse = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: url,
        audio_only: true,
        format: 'mp3', // Ưu tiên mp3 nếu API hỗ trợ chuyển đổi
        audio_bitrate: '320k'
      })
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      return res.status(createResponse.status).json({ 
        error: `TornadoAPI (tạo job) lỗi mã ${createResponse.status}`, 
        detail: errText || 'Không có nội dung trả về' 
      });
    }

    const createData = await createResponse.json();
    const jobId = createData.job_id;

    if (!jobId) {
      return res.status(500).json({ error: 'TornadoAPI không trả về job_id', detail: createData });
    }

    const maxAttempts = 8;
    const delayMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const statusResponse = await fetch(`${BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: { 'x-api-key': API_KEY }
      });

      if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        return res.status(statusResponse.status).json({ 
          error: `TornadoAPI (kiểm tra job) lỗi mã ${statusResponse.status}`, 
          detail: errText 
        });
      }

      const statusData = await statusResponse.json();
      const jobStatus = statusData.status;

      if (jobStatus === 'Completed') {
        const downloadUrl = statusData.s3_url;
        if (!downloadUrl) {
          return res.status(500).json({ error: 'Job hoàn thành nhưng không có s3_url', detail: statusData });
        }

        // Tự động lấy đuôi file chính xác từ URL của Tornado (ví dụ: .m4a, .mp3, .webm)
        let ext = '.mp3';
        try {
          const urlObj = new URL(downloadUrl);
          const pathname = urlObj.pathname;
          if (pathname.lastIndexOf('.') !== -1) {
            ext = pathname.substring(pathname.lastIndexOf('.'));
          }
        } catch (e) {}

        return res.status(200).json({
          success: true,
          url: downloadUrl,
          ext: ext // Trả về đuôi thật (.m4a)
        });
      }

      if (jobStatus === 'Failed' || jobStatus === 'Warning' || jobStatus === 'Cancelled') {
        return res.status(500).json({ 
          error: `Job thất bại với trạng thái: ${jobStatus}`, 
          detail: statusData.error || 'Không có chi tiết lỗi' 
        });
      }
    }

    return res.status(504).json({ 
      error: 'TornadoAPI xử lý quá lâu. Vui lòng thử lại sau giây lát.',
      detail: `Job ID: ${jobId} vẫn đang xử lý.`
    });

  } catch (error) {
    console.error('Lỗi Server:', error);
    return res.status(500).json({ error: 'Lỗi kết nối đến TornadoAPI', detail: error.message });
  }
};
