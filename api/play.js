const ytdl = require('@distube/ytdl-core');

// Cache lưu audioUrl, thời gian 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Hàm lấy URL audio với timeout 8 giây
function getAudioUrl(url, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Timeout'));
        }, timeout);

        ytdl.getInfo(url, { requestOptions: { maxRedirects: 0 } })
            .then(info => {
                clearTimeout(timer);
                // Chọn định dạng âm thanh chất lượng thấp nhất để tối ưu
                const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio' });
                if (!audioFormat) {
                    reject(new Error('No audio format found'));
                } else {
                    resolve(audioFormat.url);
                }
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
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
        audioCache.set(cleanUrl, {
            timestamp: Date.now(),
            audioUrl: audioUrl
        });

        // Trả về JSON thay vì redirect
        return res.status(200).json({ success: true, audioUrl });
    } catch (error) {
        console.error('Error in play.js:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to get audio' });
    }
};
