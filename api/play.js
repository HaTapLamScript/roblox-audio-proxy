const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing ?url=' });
    }

    try {
        const info = await ytdl.getInfo(url);
        const audioFormat = info.formats
            .filter(f => f.hasAudio && !f.hasVideo)
            .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];

        if (!audioFormat) {
            return res.status(404).json({ error: 'No audio format' });
        }

        res.json({ audioUrl: audioFormat.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
