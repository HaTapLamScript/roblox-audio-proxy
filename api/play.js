const ytdl = require('@distube/ytdl-core');

// Hàm chuyển object cookie thành mảng cookie cho ytdl
function convertCookieToArray(cookieObj) {
    return Object.entries(cookieObj).map(([name, value]) => ({
        name,
        value,
        domain: '.youtube.com',
        path: '/',
        secure: true,
        httpOnly: false,
    }));
}

// Hàm lấy danh sách proxy
function getProxyList() {
    const proxyListEnv = process.env.YOUTUBE_PROXIES;
    if (proxyListEnv) {
        try {
            const list = JSON.parse(proxyListEnv);
            if (Array.isArray(list) && list.length > 0) {
                return list;
            }
        } catch (e) {
            console.warn('YOUTUBE_PROXIES không phải JSON hợp lệ');
        }
    }
    const singleProxy = process.env.YOUTUBE_PROXY;
    if (singleProxy) {
        return [singleProxy];
    }
    return [];
}

// Hàm kiểm tra URL YouTube
function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(url);
}

module.exports = async (req, res) => {
    // 1. Lấy URL và kiểm tra
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

    // 2. Cookie
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
    const cookieArray = convertCookieToArray(cookieObj);

    // 3. Proxy list
    const proxies = getProxyList();
    if (proxies.length === 0) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_PROXY hoặc YOUTUBE_PROXIES' });
    }

    let lastError = null;

    // 4. Thử từng proxy
    for (let i = 0; i < proxies.length; i++) {
        const proxyUri = proxies[i];
        console.log(`[Proxy ${i+1}/${proxies.length}] Đang thử...`);

        try {
            // Tạo agent với proxy và cookie bằng hàm chính thức
            const agent = ytdl.createProxyAgent(
                { uri: proxyUri },
                cookieArray
            );

            // Các tổ hợp client để tăng khả năng thành công
            const clientsList = [
                ['TV', 'IOS'],
                ['WEB_EMBEDDED', 'TV'],
                ['IOS', 'WEB'],
                ['WEB', 'IOS'],
            ];

            let info = null;

            for (const clients of clientsList) {
                try {
                    info = await ytdl.getInfo(url, {
                        agent: agent,
                        playerClients: clients,
                        requestOptions: {
                            timeout: 45000
                        }
                    });
                    if (info && info.formats && info.formats.length > 0) break;
                } catch (e) {
                    lastError = e;
                    console.warn(`[Proxy ${i+1}] clients ${clients.join(',')} thất bại:`, e.message);
                }
            }

            // Fallback nếu không có client nào hoạt động
            if (!info || !info.formats || info.formats.length === 0) {
                try {
                    info = await ytdl.getInfo(url, {
                        agent: agent,
                        requestOptions: {
                            timeout: 45000
                        }
                    });
                } catch (e) {
                    lastError = e;
                    console.warn(`[Proxy ${i+1}] Fallback thất bại:`, e.message);
                }
            }

            // Nếu thành công
            if (info && info.formats && info.formats.length > 0) {
                // Chọn format audio tốt nhất
                let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
                if (!format) format = info.formats.find(f => f.hasAudio && !f.hasVideo);
                if (!format) format = info.formats.find(f => f.hasAudio);
                if (!format) {
                    format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
                }

                if (!format || !format.url) {
                    return res.status(404).json({ error: 'Không tìm thấy URL audio' });
                }

                // Trả về stream
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Access-Control-Allow-Origin', '*');

                const stream = ytdl.downloadFromInfo(info, {
                    format,
                    highWaterMark: 1 << 24,
                    agent: agent,
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

    // Nếu tất cả proxy thất bại
    return res.status(500).json({
        error: 'Tất cả proxy đều thất bại',
        detail: lastError ? lastError.message : 'Không xác định'
    });
};
