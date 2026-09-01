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
            .filter(f => f.hasAudio)
            .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];

        if (!audioFormat) {
            return res.status(404).json({ error: 'No audio format found' });
        }

        res.json({ audioUrl: audioFormat.url });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
    }
}; 
