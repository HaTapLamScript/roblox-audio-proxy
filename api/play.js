const ytdlp = require('yt-dlp-exec');
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Lấy link audio bằng yt-dlp (ưu tiên)
async function getAudioUrlYtDlp(videoUrl) {
    try {
        const url = await ytdlp(videoUrl, {
            flag: ['-f', 'bestaudio', '-g'],
            extractorArgs: ['--no-check-certificate'],
            timeout: 15000
        });
        if (typeof url === 'string') return url;
        if (Array.isArray(url) && url.length > 0) return url[0];
        throw new Error('No URL from yt-dlp');
    } catch (err) {
        throw new Error(`yt-dlp failed: ${err.message}`);
    }
}

// Fallback: ytdl-core
async function getAudioUrlYtdl(videoUrl) {
    const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Cookie': process.env.YT_COOKIE || ''
            },
            timeout: 10000
        }
    });
    const audioFormats = info.formats.filter(f => f.hasAudio);
    if (audioFormats.length === 0) throw new Error('No audio format');
    audioFormats.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
    return audioFormats[0].url;
}

// Fallback cuối cùng: API savetube (không cần key)
async function getAudioUrlSaveTube(videoUrl) {
    const videoId = videoUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (!videoId) throw new Error('Invalid video ID');
    // Lấy link trực tiếp từ savetube
    const response = await axios.post('https://api.savetube.app/v1/download', {
        url: `https://www.youtube.com/watch?v=${videoId}`
    }, {
        headers: { 'Content-Type': 'application/json' }
    });
    const data = response.data;
    if (data.status !== 'success') throw new Error('SaveTube API failed');
    const audio = data.data.audio || data.data.audios?.[0];
    if (!audio || !audio.url) throw new Error('No audio URL from SaveTube');
    return audio.url;
}

// Hàm tổng hợp với thứ tự ưu tiên
async function getAudioUrl(videoUrl) {
    // Thử yt-dlp trước
    try {
        return await getAudioUrlYtDlp(videoUrl);
    } catch (err) {
        console.warn('yt-dlp error:', err.message);
        // Thử ytdl-core
        try {
            return await getAudioUrlYtdl(videoUrl);
        } catch (err2) {
            console.warn('ytdl-core error:', err2.message);
            // Thử SaveTube
            return await getAudioUrlSaveTube(videoUrl);
        }
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
        return res.status(500).json({ success: false, error: error.message });
    }
};
