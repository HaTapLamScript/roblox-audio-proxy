const { ytmp3 } = require('iguro-ytdl');

// Bộ nhớ đệm lưu link audio để tối ưu cho lượng truy cập lớn (Cache 2 tiếng)
const audioCache = new Map();
const AUDIO_CACHE_TTL = 2 * 60 * 60 * 1000;

module.exports = async (req, res) => {
    // 1. Cấu hình CORS đầy đủ để Roblox CoreGui gọi không bị lỗi chặn
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

    // 2. Kiểm tra cache trước để tiết kiệm tài nguyên server và trả kết quả tức thì
    const cachedItem = audioCache.get(cleanUrl);
    if (cachedItem && (Date.now() - cachedItem.timestamp < AUDIO_CACHE_TTL)) {
        return res.redirect(302, cachedItem.audioUrl);
    }

    try {
        const result = await ytmp3(cleanUrl);
        
        // Kiểm tra kết quả trả về từ thư viện
        if (!result || !result.status || !result.result || !result.result.url) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy audio hoặc link đã hết hạn',
                detail: result?.error || 'Không có link tải'
            });
        }

        const audioStreamUrl = result.result.url;

        // 3. Lưu vào Cache RAM phục vụ các request tiếp theo
        audioCache.set(cleanUrl, {
            timestamp: Date.now(),
            audioUrl: audioStreamUrl
        });

        // Redirect sang link tải/phát thực tế
        return res.redirect(302, audioStreamUrl);
        
    } catch (error) {
        console.error('Lỗi Play API:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Lỗi server khi trích xuất audio' 
        });
    }
};
