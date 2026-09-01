const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing ?url=' });
    }

    try {
        // Lấy video ID từ URL
        const videoId = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)[1];
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Gọi API Vevioz
        const response = await axios.get(
            `https://api.vevioz.com/api/button/mp3/${videoId}`,
            { timeout: 10000 }
        );

        const data = response.data;
        // Kiểm tra nhiều trường có thể chứa link
        const audioUrl = data.link || data.download || data.url || data['1080'] || data['720'] || data['360'];
        if (!audioUrl) {
            return res.status(404).json({ error: 'No audio link found' });
        }

        res.json({ audioUrl });
    } catch (error) {
        console.error('Play error:', error.message);
        res.status(500).json({ error: error.message });
    }
}; 
