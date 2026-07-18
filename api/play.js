const ytdl = require('@distube/ytdl-core');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Hàm chuyển object cookie thành chuỗi Cookie header
function buildCookieString(cookieObj) {
    return Object.entries(cookieObj)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
}

// Hàm tạo User-Agent ngẫu nhiên (giả lập trình duyệt thật)
function getRandomUserAgent() {
    const uas = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return uas[Math.floor(Math.random() * uas.length)];
}

module.exports = async (req, res) => {
    // 1. Lấy URL
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    // 2. Lấy cookie và proxy từ env
    const cookieRaw = process.env.YOUTUBE_COOKIE;
    const proxyUri = process.env.YOUTUBE_PROXY;

    // Kiểm tra bắt buộc
    if (!cookieRaw) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_COOKIE trong biến môi trường' });
    }
    if (!proxyUri) {
        return res.status(401).json({ 
            error: 'Thiếu YOUTUBE_PROXY. IP Vercel bị chặn, cần proxy dân cư để hoạt động.' 
        });
    }

    let cookieObj;
    try {
        cookieObj = JSON.parse(cookieRaw);
    } catch (e) {
        return res.status(400).json({ error: 'Cookie không đúng định dạng JSON' });
    }

    const cookieString = buildCookieString(cookieObj);

    try {
        // 3. Tạo proxy agent
        const proxyAgent = new HttpsProxyAgent(proxyUri);

        // 4. Danh sách tổ hợp client sẽ thử (ưu tiên TV, IOS)
        const clientsList = [
            ['TV', 'IOS'],
            ['WEB_EMBEDDED', 'TV'],
            ['IOS', 'WEB'],
            ['WEB', 'IOS'],
            ['TV', 'WEB_EMBEDDED']
        ];

        let info = null;
        let lastError = null;

        for (const clients of clientsList) {
            try {
                info = await ytdl.getInfo(url, {
                    agent: proxyAgent,
                    playerClients: clients,
                    requestOptions: {
                        headers: {
                            Cookie: cookieString,
                            'User-Agent': getRandomUserAgent()
                        },
                        timeout: 45000 // 45 giây
                    }
                });
                if (info && info.formats && info.formats.length > 0) {
                    break;
                }
            } catch (e) {
                lastError = e;
                console.warn(`[Proxy] Thử clients [${clients.join(', ')}] thất bại:`, e.message);
            }
        }

        // Fallback: thử không chỉ định playerClients
        if (!info || !info.formats || info.formats.length === 0) {
            try {
                info = await ytdl.getInfo(url, {
                    agent: proxyAgent,
                    requestOptions: {
                        headers: {
                            Cookie: cookieString,
                            'User-Agent': getRandomUserAgent()
                        },
                        timeout: 45000
                    }
                });
            } catch (e) {
                lastError = e;
                console.warn('[Proxy] Thử không playerClients thất bại:', e.message);
            }
        }

        if (!info || !info.formats || info.formats.length === 0) {
            return res.status(404).json({
                error: 'Không thể lấy định dạng audio từ YouTube',
                detail: lastError ? lastError.message : 'Không có format nào'
            });
        }

        // 5. Chọn format audio tốt nhất
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
        if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        if (!format) format = info.formats.find(f => f.hasAudio);
        if (!format) {
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
        }

        if (!format || !format.url) {
            return res.status(404).json({ error: 'Không tìm thấy URL phát audio' });
        }

        // 6. Trả về stream MP3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const stream = ytdl.downloadFromInfo(info, {
            format,
            highWaterMark: 1 << 24, // 16MB
            agent: proxyAgent,
            requestOptions: {
                headers: {
                    Cookie: cookieString,
                    'User-Agent': getRandomUserAgent()
                }
            }
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
