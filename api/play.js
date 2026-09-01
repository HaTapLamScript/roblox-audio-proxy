const ytdl = require('@distube/ytdl-core');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const audioCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

async function getAudioUrlYtdl(videoUrl) {
    const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cookie': 'PREF=hl=en&gl=US' // giả lập vị trí
            }
        }
    });

    // Lọc tất cả format có audio, không video
    const audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo);
    if (audioFormats.length === 0) {
        // Fallback: lấy bất kỳ format có audio (có thể kèm video)
        const anyAudio = info.formats.filter(f => f.hasAudio);
        if (anyAudio.length > 0) {
            // Sắp xếp theo bitrate và chọn link trực tiếp
            anyAudio.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
            return anyAudio[0].url;
        }
        throw new Error('No audio format found in any form');
    }

    audioFormats.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
    return audioFormats[0].url;
}

async function getAudioUrlYtdlExec(videoUrl) {
    // Dùng youtube-dl-exec (binary) nếu có
    try {
        const { stdout } = await execPromise(
            `youtube-dl -f bestaudio -g ${videoUrl} --no-check-certificate`,
            { timeout: 10000, maxBuffer: 1024 * 1024 }
        );
        const url = stdout.trim();
        if (url) return url;
        throw new Error('Empty output from youtube-dl');
    } catch (err) {
        throw new Error(`youtube-dl failed: ${err.message}`);
    }
}

async function getAudioUrl(videoUrl) {
    // Thử ytdl-core trước
    try {
        return await getAudioUrlYtdl(videoUrl);
    } catch (ytdlError) {
        console.warn('ytdl-core failed, falling back to youtube-dl:', ytdlError.message);
        // Fallback sang youtube-dl-exec
        return await getAudioUrlYtdlExec(videoUrl);
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
