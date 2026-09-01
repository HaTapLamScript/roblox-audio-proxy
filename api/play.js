const ytdl = require('@distube/ytdl-core');

// Cache lưu link/stream để hạn chế request trùng lặp
const audioCache = new Map();
const AUDIO_CACHE_TTL = 2 * 60 * 60 * 1000;

module.exports = async (req, res) => {
    // 1. Cấu hình CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'Thiếu tham số ?url=' 
        });
    }

    const cleanUrl = url.trim();

    try {
        // Kiểm tra link YouTube có hợp lệ không
        if (!ytdl.validateURL(cleanUrl)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Link YouTube không hợp lệ' 
            });
        }

        // Thiết lập Header trả về Binary Audio cho Roblox (Không dùng Redirect 302)
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=7200');

        // Stream âm thanh trực tiếp từ YouTube về Client
        const audioStream = ytdl(cleanUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25 // Buffer 32MB chống đứt luồng
        });

        audioStream.on('error', (err) => {
            console.error('Lỗi Stream YTDL:', err);
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Lỗi trích xuất luồng âm thanh từ YouTube' 
                });
            }
        });

        // Pipe dữ liệu âm thanh thẳng về response cho Roblox
        audioStream.pipe(res);

    } catch (error) {
        console.error('Lỗi Play API:', error);
        if (!res.headersSent) {
            return res.status(500).json({ 
                success: false, 
                error: error.message || 'Lỗi server khi xử lý audio' 
            });
        }
    }
};
