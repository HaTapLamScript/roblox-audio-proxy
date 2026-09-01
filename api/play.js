const axios = require('axios');

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

function extractVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

// Nguồn 1: Rapid YouTube API Proxy
async function getAudioSource1(videoId) {
    const res = await axios.get(`https://yt-api.mp3juices.click/api/info/${videoId}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.data && res.data.downloadUrl) {
        return res.data.downloadUrl;
    }
    throw new Error('Source 1 failed');
}

// Nguồn 2: Direct Sound Engine API
async function getAudioSource2(videoId) {
    const res = await axios.get(`https://ytdl.vkrdownloader.com/server?v=${videoId}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.data && res.data.data && res.data.data.downloads) {
        const audio = res.data.data.downloads.find(item => item.format_id.includes('audio') || item.extension === 'mp3');
        if (audio && audio.url) return audio.url;
    }
    throw new Error('Source 2 failed');
}

// Nguồn 3: Y2Mate Engine Converter Proxy
async function getAudioSource3(videoId) {
    const initRes = await axios.post('https://www.y2mate.com/matemy/analyze/ajax', 
        `url=https://www.youtube.com/watch?v=${videoId}&q_auto=0&ajax=1`, 
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 5000
        }
    );
    
    if (initRes.data && initRes.data.result) {
        const match = initRes.data.result.match(/k__id\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
            const convertRes = await axios.post('https://www.y2mate.com/matemy/convert', 
                `type=youtube&_id=${match[1]}&v_id=${videoId}&ajax=1&token=&ftype=mp3&fquality=128`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    timeout: 5000
                }
            );
            if (convertRes.data && convertRes.data.result) {
                const linkMatch = convertRes.data.result.match(/href="([^"]+)"/);
                if (linkMatch && linkMatch[1]) return linkMatch[1];
            }
        }
    }
    throw new Error('Source 3 failed');
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

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
        return res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
    }

    // Check Cache
    const cached = audioCache.get(videoId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ success: true, audioUrl: cached.audioUrl, cached: true });
    }

    let audioUrl = null;
    let errors = [];

    // Thử 3 nguồn Converter Engine độc lập
    try { audioUrl = await getAudioSource1(videoId); } catch (e) { errors.push(e.message); }

    if (!audioUrl) {
        try { audioUrl = await getAudioSource2(videoId); } catch (e) { errors.push(e.message); }
    }

    if (!audioUrl) {
        try { audioUrl = await getAudioSource3(videoId); } catch (e) { errors.push(e.message); }
    }

    if (audioUrl) {
        audioCache.set(videoId, { timestamp: Date.now(), audioUrl: audioUrl });
        return res.status(200).json({ success: true, audioUrl: audioUrl, cached: false });
    }

    return res.status(500).json({
        success: false,
        error: 'Tất cả engine converter đều thất bại.',
        details: errors
    });
};
