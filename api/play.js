const ytdl = require('@distube/ytdl-core');

// Cache lưu audioUrl trong 2 tiếng
const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Giả lập Client Android để vượt Anti-Bot (Sign in to confirm you're not a bot)
const agent = ytdl.createAgent([
    {
        name: 'ANDROID',
        version: '19.02.39',
        clientName: 'ANDROID'
    }
]);

// Hàm lấy direct stream URL với Timeout tối đa 9 giây (phù hợp với giới hạn 10s của Vercel Free)
function getAudioUrl(url, timeout = 9000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Request Timeout (Vercel Serverless Limit)'));
        }, timeout);

        ytdl.getInfo(url, { agent })
            .then(info => {
                clearTimeout(timer);
                
                // Lọc định dạng chỉ có âm thanh với dung lượng tối ưu
                const audioFormat = ytdl.chooseFormat(info.formats, { 
                    quality: 'lowestaudio', 
                    filter: 'audioonly' 
                });

                if (audioFormat && audioFormat.url) {
                    resolve(audioFormat.url);
                } else {
                    reject(new Error('No audio format found'));
                }
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

module.exports = async (req, res) => {
    // Thiết lập CORS cho Roblox HttpService và Client Web
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

    // Trả về dữ liệu từ Cache nếu có
    const cached = audioCache.get(cleanUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({ 
            success: true, 
            audioUrl: cached.audioUrl, 
            cached: true 
        });
    }

    try {
        const audioUrl = await getAudioUrl(cleanUrl);
        
        // Lưu kết quả vào Cache
        audioCache.set(cleanUrl, {
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
            error: error.message || 'Failed to get audio',
            hint: 'YouTube IP check triggered or stream fetch timed out' 
        });
    }
};
 
