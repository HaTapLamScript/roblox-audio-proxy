const https = require('https');
const http = require('http');

// Cache lưu audioUrl trong 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Hàm trích xuất Video ID từ URL YouTube
function extractVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

// Hàm gửi request JSON (POST / GET)
function requestJson(options, postData = null, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const protocol = options.url.startsWith('https') ? https : http;
        const req = protocol.request(options.url, {
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });

        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

// Layer 1: Lấy audio qua Cobalt API (Mới & Rất ổn định)
async function getAudioFromCobalt(videoUrl) {
    const cobaltInstances = [
        'https://api.cobalt.tools/',
        'https://cobalt-api.kwiatek.xyz/'
    ];

    for (const instance of cobaltInstances) {
        try {
            const data = await requestJson({
                url: instance,
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }, {
                url: videoUrl,
                downloadMode: 'audio',
                audioFormat: 'mp3'
            }, 4500);

            if (data && (data.url || data.audio)) {
                return data.url || data.audio;
            }
        } catch (err) {
            continue;
        }
    }
    throw new Error('Cobalt failed');
}

// Layer 2: Lấy audio qua Piped API (Dự phòng)
async function getAudioFromPiped(videoId) {
    const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.privacydev.net',
        'https://pipedapi.tokhmi.xyz'
    ];

    for (const instance of pipedInstances) {
        try {
            const data = await requestJson({
                url: `${instance}/streams/${videoId}`
            }, null, 4000);

            if (data && data.audioStreams && data.audioStreams.length > 0) {
                // Sắp xếp chọn bitrate tốt nhất
                data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                return data.audioStreams[0].url;
            }
        } catch (err) {
            continue;
        }
    }
    throw new Error('Piped failed');
}

module.exports = async (req, res) => {
    // CORS Header
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

    // Check Cache
    const cached = audioCache.get(videoId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ 
            success: true, 
            audioUrl: cached.audioUrl, 
            cached: true 
        });
    }

    // Thử lấy audio qua Cobalt trước, nếu thất bại tự động chuyển qua Piped
    try {
        let audioUrl;
        try {
            audioUrl = await getAudioFromCobalt(cleanUrl);
        } catch (cobaltErr) {
            audioUrl = await getAudioFromPiped(videoId);
        }

        // Lưu Cache
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
        console.error('API Error:', error.message);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch audio stream',
            details: error.message 
        });
    }
};
