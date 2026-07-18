const express = require('express');
const ytdl = require('@distube/ytdl-core');
const app = express();
const port = process.env.PORT || 3000;

app.get('/play', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('Thieu URL Video!');
    
    try {
        const info = await ytdl.getInfo(videoUrl);
        const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
        
        if (format && format.url) {
            // Chuyển hướng Roblox trực tiếp tới link stream của YouTube
            res.redirect(format.url);
        } else {
            res.status(404).send('Khong tim thay luong am thanh phu hop.');
        }
    } catch (err) {
        res.status(500).send('Loi API: ' + err.message);
    }
});

app.listen(port, () => console.log(`Server dang chay tren port ${port}`));

