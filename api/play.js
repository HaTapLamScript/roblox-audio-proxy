const ytdl = require('@distube/ytdl-core');
const { HttpsProxyAgent } = require('https-proxy-agent');

// ====== HÀM TẠO AGENT VỚI PROXY (NẾU CÓ) ======
function buildAgent(cookieJson, proxyUri = null) {
    // Nếu có proxy, tạo agent với proxy
    if (proxyUri) {
        const proxyAgent = new HttpsProxyAgent(proxyUri);
        return ytdl.createAgent(cookieJson, { agent: proxyAgent });
    }
    // Không proxy, dùng agent mặc định từ cookie
    return ytdl.createAgent(cookieJson);
}

// ====== HÀM XỬ LÝ CHÍNH ======
module.exports = async (req, res) => {
    // 1. Lấy URL từ query
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    // 2. Lấy cookie và proxy từ biến môi trường
    const cookieRaw = process.env.YOUTUBE_COOKIE;
    const proxyUri = process.env.YOUTUBE_PROXY || null; // Ví dụ: http://user:pass@proxy.com:8080

    // 3. Kiểm tra cookie
    if (!cookieRaw) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_COOKIE trong biến môi trường' });
    }

    let cookieJson;
    try {
        cookieJson = JSON.parse(cookieRaw);
    } catch (e) {
        return res.status(400).json({ error: 'Cookie không đúng định dạng JSON' });
    }

    try {
        // 4. Thử nhiều tổ hợp playerClients để tăng khả năng thành công
        const clientsList = [
            ['TV', 'IOS'],
            ['WEB', 'IOS'],
            ['WEB_EMBEDDED', 'TV'],
            ['IOS', 'WEB'],
            ['TV', 'WEB_EMBEDDED']
        ];

        let info = null;
        let lastError = null;

        // Lần lượt thử từng tổ hợp
        for (const clients of clientsList) {
            try {
                const agent = buildAgent(cookieJson, proxyUri);
                info = await ytdl.getInfo(url, {
                    agent,
                    playerClients: clients,
                    requestOptions: { timeout: 30000 } // 30 giây timeout
                });
                // Nếu có formats thì thoát vòng lặp
                if (info && info.formats && info.formats.length > 0) {
                    break;
                }
            } catch (e) {
                lastError = e;
                console.warn(`Thử với clients [${clients.join(', ')}] thất bại:`, e.message);
            }
        }

        // Nếu vẫn không có info, thử không dùng agent (chỉ cookie header)
        if (!info || !info.formats || info.formats.length === 0) {
            try {
                info = await ytdl.getInfo(url, {
                    requestOptions: { timeout: 30000 }
                });
            } catch (e) {
                lastError = e;
                console.warn('Thử không agent thất bại:', e.message);
            }
        }

        // Nếu vẫn không có format -> báo lỗi
        if (!info || !info.formats || info.formats.length === 0) {
            return res.status(404).json({
                error: 'Không thể lấy định dạng audio từ YouTube',
                detail: lastError ? lastError.message : 'Không có format nào'
            });
        }

        // 5. Chọn format audio tốt nhất
        // Ưu tiên: có audio, không video, có bitrate
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
        if (!format) {
            format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        }
        if (!format) {
            format = info.formats.find(f => f.hasAudio);
        }
        if (!format) {
            // Fallback: chọn chất lượng thấp nhất có audio
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
        }

        if (!format || !format.url) {
            return res.status(404).json({ error: 'Không tìm thấy URL phát audio' });
        }

        // 6. Thiết lập header trả về file MP3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Cho phép CORS

        // 7. Tạo stream và pipe sang response
        const stream = ytdl.downloadFromInfo(info, {
            format,
            highWaterMark: 1 << 24, // 16MB buffer
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Lỗi stream: ' + err.message });
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Lỗi toàn cục:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Lỗi xử lý: ' + error.message });
        }
    }
};
