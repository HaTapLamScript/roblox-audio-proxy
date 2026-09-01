const https = require('https');
const http = require('http');

function extractVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

function requestJson(url, postData = null, timeout = 4500) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const protocol = isHttps ? https : http;
        const u = new URL(url);

        const options = {
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: postData ? 'POST' : 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                ...(postData && { 'Content-Type': 'application/json' })
            }
        };

        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

// Lấy audio stream qua hệ thống Cobalt / Direct Extractors
async function fetchAudioStream(cleanUrl, videoId) {
    // 1. Thử Cobalt API Instances
    const cobaltInstances = [
        'https://api.cobalt.tools/',
        'https://cobalt-api.kwiatek.xyz/',
        'https://co.wuk.sh/'
    ];

    for (const inst of cobaltInstances) {
        try {
            const data = await requestJson(inst, {
                url: cleanUrl,
                downloadMode: 'audio',
                audioFormat: 'mp3'
            }, 4000);

            if (data && (data.url || data.audio)) {
                return data.url || data.audio;
            }
            if (data && data.picker && data.picker.length > 0) {
                return data.picker[0].url;
            }
        } catch (e) {
            continue;
        }
    }

    // 2. Thử Public Direct Audio Resolver (Nguồn dự phòng)
    try {
        const altData = await requestJson(`https://yt-api.mp3juices.click/api/info/${videoId}`, null, 4000);
        if (altData && altData.downloadUrl) {
            return altData.downloadUrl;
        }
    } catch (e) {}

    throw new Error('All resolver instances failed');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url, type } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, error: 'Missing ?url=' });
    }

    const cleanUrl = url.trim();
    const videoId = extractVideoId(cleanUrl);

    if (!videoId) {
        return res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
    }

    try {
        const audioStreamUrl = await fetchAudioStream(cleanUrl, videoId);

        // Trả về dạng JSON nếu gọi từ Roblox HttpService hoặc API
        if (type === 'json') {
            return res.status(200).json({
                success: true,
                videoId: videoId,
                audioUrl: audioStreamUrl
            });
        }

        // Mặc định: Redirect (302) trình duyệt thẳng đến URL file audio
        return res.redirect(302, audioStreamUrl);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Không thể khởi tạo luồng phát âm thanh.',
            details: error.message
        });
    }
};
 
