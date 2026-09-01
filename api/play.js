const axios = require('axios');

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

function extractVideoId(url) {
    const match = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

async function getAudioFromSaveTube(videoUrl) {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const response = await axios.post(
        'https://api.savetube.su/v1/download',
        { url: `https://www.youtube.com/watch?v=${videoId}` },
        {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        }
    );

    const data = response.data;
    if (data.status !== 'success') {
        throw new Error('SaveTube error: ' + (data.message || 'Unknown'));
    }
    const audio = data.data.audio || data.data.audios?.[0];
    if (!audio || !audio.url) {
        throw new Error('No audio URL from SaveTube');
    }
    return audio.url;
}

async function getAudioFromNrop(videoUrl) {
    const response = await axios.get('https://v1.nrop.me/api/ytdl', {
        params: { url: videoUrl, format: 'mp3' },
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const data = response.data;
    let audioUrl = null;
    if (data?.success && data?.data) {
        audioUrl = data.data.link || data.data.download || data.data.url;
    } else if (data?.link) {
        audioUrl = data.link;
    }
    if (!audioUrl) {
        throw new Error('No audio URL from nrop.me');
    }
    return audioUrl;
}

async function getAudioUrl(videoUrl) {
    try {
        return await getAudioFromSaveTube(videoUrl);
    } catch (err) {
        console.warn('[SaveTube] Failed:', err.message);
        try {
            return await getAudioFromNrop(videoUrl);
        } catch (err2) {
            console.warn('[nrop.me] Failed:', err2.message);
            throw new Error('All audio providers failed');
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
        console.error('[Play] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}; 
