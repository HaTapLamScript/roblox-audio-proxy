module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const API_KEY = process.env.TORNADO_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Lỗi Server: Chưa cấu hình TORNADO_API_KEY' });
  }

  // ⚠️ Endpoint chính xác của TornadoAPI
  const BASE_URL = 'https://api.tornadoapi.io';

  try {
    // Bước 1: Tạo job tải nhạc (audio only, định dạng mp3)
    const createResponse = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY  // Header chính xác theo tài liệu
      },
      body: JSON.stringify({
        url: url,
        audio_only: true,       // Yêu cầu chỉ lấy âm thanh
        format: 'mp3',          // Định dạng đầu ra
        audio_bitrate: '320k'   // Chất lượng cao
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

    // Bước 2: Poll trạng thái job (chờ tối đa ~8 giây để tránh timeout Vercel Hobby)
    const maxAttempts = 8;
    const delayMs = 1000; // 1 giây mỗi lần thử

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const statusResponse = await fetch(`${BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (!statusResponse.ok) {
        // Nếu lỗi khi poll, trả về lỗi luôn
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
        return res.status(200).json({
          success: true,
          url: downloadUrl,
          ext: '.mp3'
        });
      }

      if (jobStatus === 'Failed' || jobStatus === 'Warning' || jobStatus === 'Cancelled') {
        return res.status(500).json({ 
          error: `Job thất bại với trạng thái: ${jobStatus}`, 
          detail: statusData.error || 'Không có chi tiết lỗi' 
        });
      }

      // Nếu vẫn Pending/Processing, tiếp tục vòng lặp
    }

    // Nếu hết thời gian chờ mà job chưa xong
    return res.status(504).json({ 
      error: 'TornadoAPI xử lý quá lâu. Vui lòng thử lại sau giây lát.',
      detail: `Job ID: ${jobId} vẫn đang xử lý.`
    });

  } catch (error) {
    console.error('Lỗi Server:', error);
    return res.status(500).json({ error: 'Lỗi kết nối đến TornadoAPI', detail: error.message });
  }
};
