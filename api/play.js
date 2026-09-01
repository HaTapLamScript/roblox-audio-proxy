const ytdl = require('@distube/ytdl-core');

// Cache audioUrl, thời gian 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Hàm lấy audio với timeout 9.5 giây và header giống trình duyệt
function getAudioUrl(videoUrl, timeout = 9500) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('⏱ Timeout: Vercel giới hạn 10s, video quá dài hoặc mạng chậm.'));
        }, timeout);

        // Header để giảm bị chặn
        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            maxRedirects: 0, // giữ nguyên
        };

        ytdl.getInfo(videoUrl, { requestOptions })
            .then(info => {
                clearTimeout(timer);
                // Ưu tiên format audio chất lượng thấp nhất
                let audioFormat = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio', filter: 'audioonly' });
                // Nếu không có, thử tất cả format có audio (không lọc)
                if (!audioFormat) {
                    audioFormat = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio' });
                }
                if (!audioFormat) {
                    reject(new Error('❌ Không tìm thấy định dạng audio cho video này.'));
                } else {
                    resolve(audioFormat.url);
                }
            })
            .catch(err => {
                clearTimeout(timer);
                // Phân loại lỗi để trả về thông báo rõ ràng
                if (err.statusCode === 403) {
                    reject(new Error('🚫 YouTube chặn IP Vercel. Hãy thử lại sau.'));
                } else if (err.statusCode === 404) {
                    reject(new Error('🔍 Video không tồn tại hoặc bị ẩn.'));
                } else {
                    reject(new Error(`⚠️ Lỗi từ YouTube: ${err.message}`));
                }
            });
    });
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ success: false, error: 'Thiếu tham số ?url=' });
    }

    const cleanUrl = url.trim();

    // Kiểm tra cache
    const cached = audioCache.get(cleanUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ success: true, audioUrl: cached.audioUrl });
    }

    try {
        const audioUrl = await getAudioUrl(cleanUrl);
        // Lưu cache chỉ khi thành công
        audioCache.set(cleanUrl, {
            timestamp: Date.now(),
            audioUrl: audioUrl
        });
        // Xóa cache sau 2 giờ
        setTimeout(() => audioCache.delete(cleanUrl), CACHE_TTL);

        return res.status(200).json({ success: true, audioUrl });
    } catch (error) {
        console.error('[play.js] Lỗi:', error.message);
        // Trả về status 500 nhưng kèm message lỗi chi tiết (client sẽ đọc được)
        return res.status(500).json({ success: false, error: error.message });
    }
};
