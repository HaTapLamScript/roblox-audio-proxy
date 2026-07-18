const ytdl = require('@distube/ytdl-core');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Chuyển cookie object thành header string
function buildCookieHeader(cookieObj) {
    return Object.entries(cookieObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

// Lấy danh sách proxy (ưu tiên mảng)
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
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
}

module.exports = async (req, res) => {
    // 1. Lấy URL
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
    try { cookieObj = JSON.parse(cookieRaw); } catch {
        return res.status(400).json({ error: 'Invalid YOUTUBE_COOKIE JSON' });
    }
    const cookieHeader = buildCookieHeader(cookieObj);

    // 3. Proxy
    const proxies = getProxyList();
    if (!proxies.length) {
        return res.status(401).json({ error: 'Missing YOUTUBE_PROXY or YOUTUBE_PROXIES' });
    }

    // 4. Thử tối đa 3 proxy đầu tiên (để tiết kiệm thời gian)
    const maxProxies = Math.min(proxies.length, 3);
    let lastError = null;

    for (let i = 0; i < maxProxies; i++) {
        const proxyUri = proxies[i];
        console.log(`[Proxy ${i+1}] Trying...`);

        try {
            const proxyAgent = new HttpsProxyAgent(proxyUri);
            const requestOptions = {
                agent: proxyAgent,
                headers: {
                    Cookie: cookieHeader,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000, // 15 giây
            };

            // Lấy info video
            const info = await ytdl.getInfo(url, {
                requestOptions,
                playerClients: ['TV', 'IOS', 'WEB_EMBEDDED']
            });

            if (info && info.formats && info.formats.length) {
                // Chọn audio tốt nhất
                let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
                if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
                if (!format) format = info.formats.find(f => f.hasAudio);
                if (!format) format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });

                if (!format || !format.url) {
                    return res.status(404).json({ error: 'No audio format found' });
                }

                // Stream
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Access-Control-Allow-Origin', '*');

                const stream = ytdl.downloadFromInfo(info, {
                    format,
                    highWaterMark: 1 << 24,
                    requestOptions,
                });

                stream.on('error', (err) => {
                    console.error('Stream error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Stream error: ' + err.message });
                    }
                });

                stream.pipe(res);
                return; // Thành công
            }
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${i+1} failed:`, e.message);
        }
    }

    // Nếu tất cả đều thất bại
    res.status(500).json({
        error: 'All proxies failed',
        detail: lastError ? lastError.message : 'Unknown error'
    });
};
