const https = require('https');
const http = require('http');

// Cache lưu audioUrl trong 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Danh sách các Invidious Instance công khai ổn định
const INVIDIOUS_INSTANCES = [
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
    'https://invidious.drgns.space',
    'https://vid.puffyan.us'
];

// Hàm trích xuất Video ID từ URL YouTube
function extractVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

// Hàm gửi request HTTP/HTTPS cơ bản
function fetchJson(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON'));
                    }
                } else {
                    reject(new Error(`HTTP Status ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });
    });
}

// Hàm tìm audio stream từ các Invidious Instance
async function getAudioFromInvidious(videoId) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const data = await fetchJson(`${instance}/api/v1/videos/${videoId}`, 4000);
            
            if (data && data.adaptiveFormats) {
                // Lọc các format chỉ chứa audio (mimeType audio/mp4 hoặc audio/webm)
                const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
                if (audioFormats.length > 0) {
                    // Ưu tiên chọn format bitrate cao hơn
                    audioFormats.sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
                    return audioFormats[0].url;
                }
            }
        } catch (err) {
            // Thử instance tiếp theo nếu instance hiện tại lỗi
            continue;
        }
    }
    throw new Error('All Invidious instances failed to retrieve audio');
}

module.exports = async (req, res) => {
    // Thiết lập CORS
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

    // Kiểm tra Cache
    const cached = audioCache.get(videoId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ 
            success: true, 
            audioUrl: cached.audioUrl, 
            cached: true 
        });
    }

    try {
        const audioUrl = await getAudioFromInvidious(videoId);
        
        // Lưu cache
        audioCache.set(videoId, {
            timestamp: Date.now(),
            audioUrl: audioUrl
        });

        return res.status(200).json({ 
            success: true, 
            audioUrl: audioUrl, 
            cached: false 
        });
    } catch (error) {
        console.error('Error in play.js:', error.message);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch audio stream',
            details: error.message 
        });
    }
};
