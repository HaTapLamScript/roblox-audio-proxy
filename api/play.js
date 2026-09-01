const { youtube } = require('dew-downloader');
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

async function getAudioUrl(videoUrl, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await youtube.download(videoUrl, 'mp3');
            if (!result || !result.download) {
                throw new Error('No download link');
            }
            return result.download;
        } catch (err) {
            if (attempt === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, 2000));
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
