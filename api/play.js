const play = require('play-dl');

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

async function getAudioUrl(videoUrl) {
    try {
        // stream() trả về object có .url – chất lượng 0 = thấp nhất (audio)
        const stream = await play.stream(videoUrl, { quality: 0 });
        if (stream && stream.url) return stream.url;
        throw new Error('No URL returned from stream');
    } catch (streamError) {
        // Fallback: dùng video_info để lấy format audio trực tiếp
        const info = await play.video_info(videoUrl);
        const formats = info.format;
        const audioFormats = formats.filter(f => f.hasAudio && !f.hasVideo);
        if (audioFormats.length === 0) {
            throw new Error('No audio-only format found');
        }
        audioFormats.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
        return audioFormats[0].url;
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
