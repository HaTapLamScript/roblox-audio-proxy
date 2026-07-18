const ytdl = require('@distube/ytdl-core');

// ====== CẤU HÌNH ======
// Lấy proxy URI từ biến môi trường (nếu có)
// Ví dụ: http://user:pass@proxy-provider.com:8080
const PROXY_URI = process.env.YOUTUBE_PROXY || null;

// Tạo agent nếu có proxy
function createAgentWithProxy(cookieJson) {
    let agent = ytdl.createAgent(cookieJson);
    if (PROXY_URI) {
        // ytdl-core hỗ trợ proxy qua `agent` tùy chỉnh
        // Nhưng @distube/ytdl-core không có sẵn proxyAgent, ta cần dùng `axios` hoặc `https-proxy-agent`
        // Ta sẽ dùng `https-proxy-agent` để tạo agent cho ytdl
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const proxyAgent = new HttpsProxyAgent(PROXY_URI);
        agent = ytdl.createAgent(cookieJson, { agent: proxyAgent });
    }
    return agent;
}

// ====== HÀM XỬ LÝ CHÍNH ======
module.exports = async (req, res) => {
    // 1. Lấy URL
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    // 2. Kiểm tra cookie
    const cookieString = process.env.YOUTUBE_COOKIE;
    if (!cookieString) {
        return res.status(401).json({ error: 'Thiếu YOUTUBE_COOKIE trong env' });
    }

    let cookieJson;
    try {
        cookieJson = JSON.parse(cookieString);
    } catch {
        return res.status(400).json({ error: 'YOUTUBE_COOKIE không đúng định dạng JSON' });
    }

    try {
        // 3. Tạo agent (có proxy nếu có)
        const agent = createAgentWithProxy(cookieJson);

        // 4. Ép client để bypass bot
        const agentOptions = {
            agent,
            playerClients: ['TV', 'IOS', 'WEB_EMBEDDED'],
            // Tăng timeout
            requestOptions: {
                timeout: 30000,
            }
        };

        // 5. Lấy thông tin video
        const info = await ytdl.getInfo(url, agentOptions);

        // 6. Lọc format audio tốt nhất
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo && f.audioBitrate);
        if (!format) {
            format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        }
        if (!format) {
            format = info.formats.find(f => f.hasAudio);
        }
        if (!format) {
            // Fallback cuối
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowest' });
        }

        if (!format || !format.url) {
            return res.status(404).json({ error: 'Không tìm thấy format audio hợp lệ' });
        }

        // 7. Thiết lập header
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 8. Stream audio
        const stream = ytdl.downloadFromInfo(info, {
            format: format,
            highWaterMark: 1 << 24, // 16MB
            ...agentOptions
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Lỗi stream: ' + err.message });
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Lỗi hệ thống:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Lỗi xử lý: ' + error.message });
        }
    }
};
