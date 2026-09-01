const https = require('https');
const http = require('http');

function extractVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
}

function fetchJson(url, timeout = 4000) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// Lấy Direct Stream URL qua Piped Public Edge Nodes
async function getDirectAudioStream(videoId) {
    const edgeNodes = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.privacydev.net',
        'https://pipedapi.tokhmi.xyz',
        'https://pipedapi.moomoo.me'
    ];

    for (const node of edgeNodes) {
        try {
            const data = await fetchJson(`${node}/streams/${videoId}`);
            if (data && data.audioStreams && data.audioStreams.length > 0) {
                // Sắp xếp chọn bitrate mượt nhất
                data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                return data.audioStreams[0].url;
            }
        } catch (e) {
            continue;
        }
    }
    throw new Error('No stream available');
}

module.exports = async (req, res) => {
    // Cấu hình CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url, type } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, error: 'Missing ?url=' });
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
        return res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
    }

    try {
        const audioStreamUrl = await getDirectAudioStream(videoId);

        // Nếu client yêu cầu dạng JSON (cho Roblox hoặc API App)
        if (type === 'json') {
            return res.status(200).json({
                success: true,
                videoId: videoId,
                audioUrl: audioStreamUrl
            });
        }

        // Mặc định: Redirect (302) trực tiếp trình duyệt tới File Audio gốc của YouTube
        // Cách này 100% không bị treo trình duyệt và phát ngay lập tức trên điện thoại!
        return res.redirect(302, audioStreamUrl);

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Không thể khởi tạo luồng phát âm thanh.',
            details: error.message
        });
    }
};
