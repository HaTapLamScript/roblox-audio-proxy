const axios = require('axios');

// Cache lưu audioUrl trong 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Hàm trích xuất Video ID
function extractVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

// Client HTTP với timeout mặc định
const http = axios.create({
    timeout: 4000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

// Layer 1: Piped API (Thử 6 instance ổn định nhất)
async function tryPiped(videoId) {
    const instances = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.privacydev.net',
        'https://pipedapi.tokhmi.xyz',
        'https://pipedapi.moomoo.me',
        'https://api.piped.projectsegfau.lt',
        'https://pipedapi.in.projectsegfau.lt'
    ];

    for (const inst of instances) {
        try {
            const res = await http.get(`${inst}/streams/${videoId}`);
            if (res.data && res.data.audioStreams && res.data.audioStreams.length > 0) {
                // Ưu tiên chọn bitrate tốt
                res.data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                return res.data.audioStreams[0].url;
            }
        } catch (e) { continue; }
    }
    throw new Error('Piped instances failed');
}

// Layer 2: Invidious API (Thử 5 instance mới nhất)
async function tryInvidious(videoId) {
    const instances = [
        'https://invidious.nerdvpn.de',
        'https://inv.tux.pizza',
        'https://invidious.drgns.space',
        'https://vid.puffyan.us',
        'https://invidious.privacydev.net'
    ];

    for (const inst of instances) {
        try {
            const res = await http.get(`${inst}/api/v1/videos/${videoId}`);
            if (res.data && res.data.adaptiveFormats) {
                const audios = res.data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
                if (audios.length > 0) {
                    audios.sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
                    return audios[0].url;
                }
            }
        } catch (e) { continue; }
    }
    throw new Error('Invidious instances failed');
}

// Layer 3: Cobalt API (Dịch vụ chuyển đổi mạnh)
async function tryCobalt(videoUrl) {
    const instances = [
        'https://api.cobalt.tools/',
        'https://cobalt-api.kwiatek.xyz/',
        'https://co.wuk.sh/'
    ];

    for (const inst of instances) {
        try {
            const res = await http.post(inst, {
                url: videoUrl,
                downloadMode: 'audio',
                audioFormat: 'mp3'
            }, {
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            });
            if (res.data && (res.data.url || res.data.audio)) {
                return res.data.url || res.data.audio;
            }
        } catch (e) { continue; }
    }
    throw new Error('Cobalt instances failed');
}

// Layer 4: Direct Public Audio Proxy Fallback (Nguồn dự phòng 4)
async function tryAlternativeProxy(videoId) {
    try {
        const res = await http.get(`https://ytdl.api.1337337.xyz/api/info?id=${videoId}`);
        if (res.data && res.data.url) {
            return res.data.url;
        }
    } catch (e) {}
    throw new Error('Alternative proxy failed');
}

module.exports = async (req, res) => {
    // CORS Header cho Roblox và Browser
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
    const videoId = extractVideoId(cleanUrl);

    if (!videoId) {
        return res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
    }

    // Trả về từ Cache nếu có
    const cached = audioCache.get(videoId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ success: true, audioUrl: cached.audioUrl, cached: true });
    }

    // Quá trình vét cạn 4 tầng
    let audioUrl = null;
    let errors = [];

    // 1. Thử Piped
    try { audioUrl = await tryPiped(videoId); } 
    catch (e) { errors.push(e.message); }

    // 2. Thử Invidious (nếu 1 xịt)
    if (!audioUrl) {
        try { audioUrl = await tryInvidious(videoId); } 
        catch (e) { errors.push(e.message); }
    }

    // 3. Thử Cobalt (nếu 2 xịt)
    if (!audioUrl) {
        try { audioUrl = await tryCobalt(cleanUrl); } 
        catch (e) { errors.push(e.message); }
    }

    // 4. Thử Proxy dự phòng (nếu 3 xịt)
    if (!audioUrl) {
        try { audioUrl = await tryAlternativeProxy(videoId); } 
        catch (e) { errors.push(e.message); }
    }

    // Trả kết quả thành công
    if (audioUrl) {
        audioCache.set(videoId, { timestamp: Date.now(), audioUrl: audioUrl });
        return res.status(200).json({ success: true, audioUrl: audioUrl, cached: false });
    }

    // Thất bại hoàn toàn
    return res.status(500).json({ 
        success: false, 
        error: 'Tất cả 4 tầng proxy đều bị YouTube chặn IP trên Vercel.',
        details: errors 
    });
};
 
