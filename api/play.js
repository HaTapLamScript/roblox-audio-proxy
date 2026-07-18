const ytdl = require('@distube/ytdl-core');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Chuyển cookie object thành header string
function buildCookieHeader(cookieObj) {
    return Object.entries(cookieObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

// Lấy danh sách proxy
function getProxyList() {
    const proxies = process.env.YOUTUBE_PROXIES;
    if (proxies) {
        try {
            const list = JSON.parse(proxies);
            if (Array.isArray(list) && list.length) return list;
        } catch {}
    }
    const single = process.env.YOUTUBE_PROXY;
    if (single) return [single];
    return [];
}

// Kiểm tra URL YouTube
function isValidYoutubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

module.exports = async (req, res) => {
    // 1. URL
    let { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing ?url=' });
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!isValidYoutubeUrl(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // 2. Cookie
    const cookieRaw = process.env.YOUTUBE_COOKIE;
    if (!cookieRaw) return res.status(401).json({ error: 'Missing YOUTUBE_COOKIE' });
    let cookieObj;
    try {
        cookieObj = JSON.parse(cookieRaw);
    } catch {
        return res.status(400).json({ error: 'Invalid YOUTUBE_COOKIE JSON' });
    }
    const cookieHeader = buildCookieHeader(cookieObj);

    // 3. Proxy
    const proxies = getProxyList();
    // Chỉ lấy proxy đầu tiên nếu có
    const proxyUri = proxies.length > 0 ? proxies[0] : null;

    try {
        // 4. Cấu hình request options
        const requestOptions = {
            headers: {
                Cookie: cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000 // 10 giây
        };

        // Nếu có proxy, thêm agent
        if (proxyUri) {
            try {
                const proxyAgent = new HttpsProxyAgent(proxyUri);
                requestOptions.agent = { http: proxyAgent, https: proxyAgent };
                console.log('[Proxy] Đang sử dụng proxy');
            } catch (e) {
                console.warn('[Proxy] Lỗi tạo agent, bỏ qua proxy');
            }
        } else {
            console.log('[Proxy] Không dùng proxy');
        }

        // 5. Thử nhiều tổ hợp playerClients
        const clientsList = [
            undefined,
            ['TV', 'IOS'],
            ['WEB_EMBEDDED', 'TV'],
            ['IOS', 'WEB'],
            ['WEB', 'IOS'],
            ['TV', 'WEB_EMBEDDED']
        ];

        let info = null;
        for (const clients of clientsList) {
            try {
                const opts = clients ? { requestOptions, playerClients: clients } : { requestOptions };
                info = await ytdl.getInfo(url, opts);
                if (info && info.formats && info.formats.length > 0) {
                    break;
                }
            } catch (e) {
                // Log lỗi nhưng tiếp tục thử client khác
                console.warn(`[Client ${clients || 'default'}] Lỗi:`, e.message);
            }
        }

        if (!info || !info.formats || info.formats.length === 0) {
            // Kiểm tra xem có phải lỗi do cookie hay không
            return res.status(404).json({
                error: 'No formats found',
                detail: 'Cookie có thể đã hết hạn hoặc IP bị chặn. Vui lòng cập nhật cookie mới hoặc dùng proxy khác.'
            });
        }

        // 6. Chọn format audio tốt nhất
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
        if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        if (!format) format = info.formats.find(f => f.hasAudio);
        if (!format) {
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
        }

        if (!format || !format.url) {
            return res.status(404).json({ error: 'No audio URL found' });
        }

        // 7. Stream
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const stream = ytdl.downloadFromInfo(info, {
            format,
            highWaterMark: 1 << 24,
            requestOptions
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error: ' + err.message });
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Lỗi toàn cục:', error);
        res.status(500).json({ error: error.message });
    }
};
