-- [MAMBO PROJECT] Audio Proxy - Play Endpoint
const ytdl = require('@distube/ytdl-core');

// Cache với TTL 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Hàm lấy URL audio với retry và timeout mềm
async function getAudioUrl(videoUrl, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const info = await ytdl.getInfo(videoUrl, {
                requestOptions: {
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 8000 // 8 giây cho mỗi request
                }
            });

            // Lọc các định dạng chỉ có âm thanh, không video
            const audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo);

            if (audioFormats.length === 0) {
                throw new Error('No audio-only format available');
            }

            // Sắp xếp theo bitrate tăng dần (lấy chất lượng thấp nhất để nhanh)
            audioFormats.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
            const bestFormat = audioFormats[0];

            // Nếu URL không có, thử lấy từ các định dạng khác
            if (!bestFormat.url) {
                // Fallback: tìm bất kỳ format nào có url
                const anyFormat = info.formats.find(f => f.url);
                if (anyFormat) return anyFormat.url;
                throw new Error('No valid URL found in any format');
            }

            return bestFormat.url;
        } catch (error) {
            if (attempt === retries) {
                throw new Error(`Failed after ${retries} attempts: ${error.message}`);
            }
            // Chờ 1 giây trước khi thử lại (tránh spam)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
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
        return res.status(400).json({ success: false, error: 'Missing ?url=' });
    }

    const cleanUrl = url.trim();

    // Kiểm tra cache
    const cached = audioCache.get(cleanUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ success: true, audioUrl: cached.audioUrl });
    }

    try {
        const audioUrl = await getAudioUrl(cleanUrl);
        // Lưu cache
        audioCache.set(cleanUrl, {
            timestamp: Date.now(),
            audioUrl: audioUrl
        });

        // Trả về JSON
        return res.status(200).json({ success: true, audioUrl });
    } catch (error) {
        console.error('Play error:', error.message);
        // Trả về lỗi rõ ràng
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract audio URL'
        });
    }
};
