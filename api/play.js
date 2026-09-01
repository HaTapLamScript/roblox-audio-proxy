const ytdl = require('@distube/ytdl-core');
const axios = require('axios');

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Hàm lấy URL từ ytdl-core với cookie giả lập
async function getYtdlUrl(videoUrl) {
    const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cookie': 'PREF=hl=en&gl=US' // cookie mặc định
            }
        }
    });

    // Lọc định dạng audio-only, ưu tiên chất lượng thấp
    const audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo);
    if (audioFormats.length === 0) {
        // Nếu không có audio-only, lấy bất kỳ có audio
        const anyAudio = info.formats.filter(f => f.hasAudio);
        if (anyAudio.length === 0) {
            throw new Error('No audio format');
        }
        anyAudio.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
        return anyAudio[0].url;
    }
    audioFormats.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
    return audioFormats[0].url;
}

// Hàm dự phòng dùng API Vevioz (không cần key)
async function getVeviozUrl(videoUrl) {
    // Lấy video ID từ URL
    const videoId = videoUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (!videoId) throw new Error('Invalid YouTube URL');

    const apiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;
    const response = await axios.get(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
    });

    // Response thường chứa link trong data.link hoặc data.download
    const data = response.data;
    const link = data.link || data.download || data.url || data['1080'] || data['720'] || data['360'];
    if (!link) {
        throw new Error('No download link from Vevioz');
    }
    return link;
}

// Hàm tổng hợp với fallback
async function getAudioUrl(videoUrl) {
    try {
        // Thử ytdl-core trước
        return await getYtdlUrl(videoUrl);
    } catch (ytdlError) {
        console.warn('ytdl-core failed, falling back to Vevioz:', ytdlError.message);
        // Thử Vevioz
        return await getVeviozUrl(videoUrl);
    }
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
        return res.status(400).json({ success: false, error: 'Missing ?url=' });
    }

    const cleanUrl = url.trim();
    const cached = audioCache.get(cleanUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ success: true, audioUrl: cached.audioUrl });
    }

    try {
        const audioUrl = await getAudioUrl(cleanUrl);
        audioCache.set(cleanUrl, { timestamp: Date.now(), audioUrl });
        return res.status(200).json({ success: true, audioUrl });
    } catch (error) {
        console.error('Play error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'Failed to extract audio' });
    }
};
