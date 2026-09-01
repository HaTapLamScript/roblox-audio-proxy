const ytdl = require('@distube/ytdl-core');

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

function getAudioUrl(videoUrl, timeout = 9500) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('⏱ Timeout: Vercel giới hạn 10s, video quá dài hoặc mạng chậm.'));
        }, timeout);

        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            maxRedirects: 0,
        };

        ytdl.getInfo(videoUrl, {
            requestOptions: requestOptions,
            cache: false  // 🔥 Quan trọng: Tắt cache đĩa để tránh lỗi EROFS
        })
        .then(info => {
            clearTimeout(timer);
            let audioFormat = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio', filter: 'audioonly' });
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
    const cached = audioCache.get(cleanUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ success: true, audioUrl: cached.audioUrl });
    }

    try {
        const audioUrl = await getAudioUrl(cleanUrl);
        audioCache.set(cleanUrl, { timestamp: Date.now(), audioUrl });
        setTimeout(() => audioCache.delete(cleanUrl), CACHE_TTL);
        return res.status(200).json({ success: true, audioUrl });
    } catch (error) {
        console.error('[play.js] Lỗi:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};
