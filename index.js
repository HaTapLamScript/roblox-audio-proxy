const express = require('express');
const ytdl = require('@distube/ytdl-core');
const app = express();
const port = process.env.PORT || 3000;

// Giải mã chuỗi JSON Cookie từ biến môi trường
let cookies = [];
if (process.env.YOUTUBE_COOKIE) {
    try {
        cookies = JSON.parse(process.env.YOUTUBE_COOKIE);
    } catch (e) {
        console.error("Loi cau hinh Cookie JSON:", e.message);
    }
}

const agent = ytdl.createAgent(cookies.length > 0 ? cookies : []);

app.get('/play', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('Thieu URL Video!');
    
    try {
        const info = await ytdl.getInfo(videoUrl, { agent });
        const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
        
        if (format && format.url) {
            res.redirect(format.url);
        } else {
            res.status(404).send('Khong tim thay luong am thanh phu hop.');
        }
    } catch (err) {
        res.status(500).send('Loi API: ' + err.message);
    }
});

app.listen(port, () => console.log(`Server dang chay tren port ${port}`));
