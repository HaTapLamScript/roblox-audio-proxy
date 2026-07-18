const ytdl = require('@distube/ytdl-core');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Hàm chuyển object cookie thành chuỗi header Cookie
function buildCookieString(cookieObj) {
    return Object.entries(cookieObj)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
}

module.exports = async (req, res) => {
    // 1. Lấy URL
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    // 2. Lấy cookie và proxy từ env
    const cookieRaw = process.env.YOUTUBE_COOKIE;
    const proxyUri = process.env.YOUTUBE_PROXY || null;

    if (!cookieRaw) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_COOKIE trong biến môi trường' });
    }

    let cookieObj;
    try {
        cookieObj = JSON.parse(cookieRaw);
    } catch (e) {
        return res.status(400).json({ error: 'Cookie không đúng định dạng JSON' });
    }

    // 3. Xây dựng cookie string
    const cookieString = buildCookieString(cookieObj);

    try {
        // 4. Tạo agent proxy (nếu có)
        let agent = null;
        if (proxyUri) {
            agent = new HttpsProxyAgent(proxyUri);
        }

        // 5. Tùy chọn request (gửi kèm cookie header)
        const requestOptions = {
            headers: {
                Cookie: cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        };

        // 6. Thử nhiều tổ hợp playerClients
        const clientsList = [
            ['TV', 'IOS'],
            ['WEB', 'IOS'],
            ['WEB_EMBEDDED', 'TV'],
            ['IOS', 'WEB'],
            ['TV', 'WEB_EMBEDDED']
        ];

        let info = null;
        let lastError = null;

        for (const clients of clientsList) {
            try {
                info = await ytdl.getInfo(url, {
                    agent,
                    playerClients: clients,
                    requestOptions
                });
                if (info && info.formats && info.formats.length > 0) {
                    break;
                }
            } catch (e) {
                lastError = e;
                console.warn(`Thử với clients [${clients.join(', ')}] thất bại:`, e.message);
            }
        }

        // Fallback: thử không dùng playerClients
        if (!info || !info.formats || info.formats.length === 0) {
            try {
                info = await ytdl.getInfo(url, {
                    agent,
                    requestOptions
                });
            } catch (e) {
                lastError = e;
                console.warn('Thử không playerClients thất bại:', e.message);
            }
        }

        if (!info || !info.formats || info.formats.length === 0) {
            return res.status(404).json({
                error: 'Không thể lấy định dạng audio từ YouTube',
                detail: lastError ? lastError.message : 'Không có format nào'
            });
        }

        // 7. Chọn format audio tốt nhất
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
        if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        if (!format) format = info.formats.find(f => f.hasAudio);
        if (!format) {
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
        }

        if (!format || !format.url) {
            return res.status(404).json({ error: 'Không tìm thấy URL phát audio' });
        }

        // 8. Trả về stream MP3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const stream = ytdl.downloadFromInfo(info, {
            format,
            highWaterMark: 1 << 24, // 16MB
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
