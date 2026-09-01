const ytdl = require('ytdl-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing ?url=' });
    }

    try {
        const info = await ytdl.getInfo(url);
        const audio = info.formats.find(f => f.audioCodec && !f.videoCodec);
        if (!audio) {
            return res.status(404).json({ error: 'No audio' });
        }
        res.json({ audioUrl: audio.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}; 
