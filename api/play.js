const ytdl = require('@distube/ytdl-core');
const { HttpsProxyAgent } = require('https-proxy-agent');

function buildCookieString(cookieObj) {
    return Object.entries(cookieObj)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
}

function getRandomUserAgent() {
    const uas = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return uas[Math.floor(Math.random() * uas.length)];
}

function getProxyList() {
    const proxyListEnv = process.env.YOUTUBE_PROXIES;
    if (proxyListEnv) {
        try {
            const list = JSON.parse(proxyListEnv);
            if (Array.isArray(list) && list.length > 0) {
                return list.map(p => p.startsWith('http://') ? p : `http://${p}`);
            }
        } catch (e) {
            console.warn('YOUTUBE_PROXIES không phải JSON hợp lệ');
        }
    }
    const singleProxy = process.env.YOUTUBE_PROXY;
    if (singleProxy) {
        return [singleProxy.startsWith('http://') ? singleProxy : `http://${singleProxy}`];
    }
    return [];
}

function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(url);
}

module.exports = async (req, res) => {
    let { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    if (!isValidYouTubeUrl(url)) {
        return res.status(400).json({ error: 'URL YouTube không hợp lệ' });
    }

    const cookieRaw = process.env.YOUTUBE_COOKIE;
    if (!cookieRaw) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_COOKIE' });
    }
    let cookieObj;
    try {
        cookieObj = JSON.parse(cookieRaw);
    } catch (e) {
        return res.status(400).json({ error: 'Cookie sai định dạng JSON' });
    }
    const cookieString = buildCookieString(cookieObj);

    const proxies = getProxyList();
    if (proxies.length === 0) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_PROXY hoặc YOUTUBE_PROXIES' });
    }

    let lastError = null;
    for (let i = 0; i < proxies.length; i++) {
        const proxyUri = proxies[i];
        console.log(`[Proxy ${i+1}/${proxies.length}] Thử: ${proxyUri.replace(/\/\/.*@/, '//***@')}`);

        try {
            const proxyAgent = new HttpsProxyAgent(proxyUri);
            const clientsList = [
                ['TV', 'IOS'],
                ['WEB_EMBEDDED', 'TV'],
                ['IOS', 'WEB'],
                ['WEB', 'IOS'],
                ['TV', 'WEB_EMBEDDED']
            ];

            let info = null;
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
                            timeout: 45000
                        }
                    });
                    if (info && info.formats && info.formats.length > 0) break;
                } catch (e) {
                    lastError = e;
                    console.warn(`[Proxy ${i+1}] clients ${clients.join(',')} thất bại:`, e.message);
                }
            }

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
                    console.warn(`[Proxy ${i+1}] Fallback thất bại:`, e.message);
                }
            }

            if (info && info.formats && info.formats.length > 0) {
                let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
                if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
                if (!format) format = info.formats.find(f => f.hasAudio);
                if (!format) {
                    format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
                }
                if (!format || !format.url) {
                    return res.status(404).json({ error: 'Không tìm thấy URL audio' });
                }

                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Access-Control-Allow-Origin', '*');

                const stream = ytdl.downloadFromInfo(info, {
                    format,
                    highWaterMark: 1 << 24,
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
                return;
            }
        } catch (e) {
            lastError = e;
            console.warn(`[Proxy ${i+1}] Lỗi kết nối:`, e.message);
        }
    }

    return res.status(500).json({
        error: 'Tất cả proxy đều thất bại',
        detail: lastError ? lastError.message : 'Không xác định'
    });
};
