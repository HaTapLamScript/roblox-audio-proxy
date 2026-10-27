import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

// Cấu hình FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    responseLimit: false, // Cho phép gửi file dung lượng lớn
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const TORNADO_KEY = process.env.TORNADO_API_KEY;
  if (!TORNADO_KEY) return res.status(500).json({ error: 'Thiếu TORNADO_API_KEY' });

  const TORNADO_BASE = 'https://api.tornadoapi.io';

  try {
    // 1. Gọi Tornado lấy link M4A
    const createRes = await fetch(`${TORNADO_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': TORNADO_KEY },
      body: JSON.stringify({ url: url, audio_only: true, format: 'mp3' })
    });

    if (!createRes.ok) return res.status(500).json({ error: 'Tornado tạo job lỗi' });
    const { job_id } = await createRes.json();
    
    let m4aUrl = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await fetch(`${TORNADO_BASE}/jobs/${job_id}`, {
        headers: { 'x-api-key': TORNADO_KEY }
      });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      
      if (statusData.status === 'Completed' && statusData.s3_url) {
        m4aUrl = statusData.s3_url;
        break;
      }
      if (['Failed', 'Warning', 'Cancelled'].includes(statusData.status)) {
        return res.status(500).json({ error: `Tornado lỗi` });
      }
    }

    if (!m4aUrl) return res.status(504).json({ error: 'Tornado quá thời gian' });

    // 2. Tải file M4A về Vercel
    const audioRes = await fetch(m4aUrl);
    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 3. Lưu file tạm và Convert sang MP3
    const inputPath = path.join('/tmp', 'input.m4a');
    const outputPath = path.join('/tmp', 'output.mp3');
    
    fs.writeFileSync(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioBitrate('320k')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    // 4. Gửi file MP3 về cho Roblox
    const mp3Buffer = fs.readFileSync(outputPath);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mp3Buffer.length);
    return res.status(200).send(mp3Buffer);

  } catch (error) {
    console.error('Lỗi Convert:', error);
    return res.status(500).json({ error: 'Lỗi Server', detail: error.message });
  }
}
