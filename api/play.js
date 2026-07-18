const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('Thieu URL Video!');

    let cookies = [];
    if (process.env.YOUTUBE_COOKIE) {
        try {
            cookies = JSON.parse(process.env.YOUTUBE_COOKIE);
        } catch (e) {
            console.error("Loi cau hinh Cookie JSON:", e.message);
        }
    }

    try {
        const agent = ytdl.createAgent(cookies.length > 0 ? cookies : []);
        const info = await ytdl.getInfo(videoUrl, { agent });
        const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

        if (format && format.url) {
            res.redirect(format.url);
        } else {
            res.status(404).send('Khong tim thay luong am thanh phu hop.');
        }
    } catch (err) {
        res.status(500).send('Loi API Vercel: ' + err.message);
    }
};

