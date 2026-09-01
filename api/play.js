const ytdl = require('@distube/ytdl-core');
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

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
        const info = await ytdl.getInfo(cleanUrl, {
            requestOptions: {
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        });

        const audioFormat = info.formats
            .filter(f => f.hasAudio)
            .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];

        if (!audioFormat || !audioFormat.url) {
            throw new Error('No audio format found');
        }

        audioCache.set(cleanUrl, { timestamp: Date.now(), audioUrl: audioFormat.url });
        return res.status(200).json({ success: true, audioUrl: audioFormat.url });
    } catch (error) {
        console.error('Play error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}; 
