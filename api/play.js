const axios = require('axios');
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

function extractVideoId(url) {
    const match = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

async function getAudioUrl(videoUrl) {
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
        throw new Error('No audio URL');
    }
    return audio.url;
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
