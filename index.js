const express = require('express');
const ytdl = require('@distube/ytdl-core');
const app = express();
const port = process.env.PORT || 3000;

// Khởi tạo agent sử dụng cookie để vượt qua lỗi 429
const agent = ytdl.createAgent(process.env.YOUTUBE_COOKIE ? [{ cookie: process.env.YOUTUBE_COOKIE }] : []);

app.get('/play', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('Thieu URL Video!');
    
    try {
        // Truyền agent đã có cookie vào hàm getInfo để xác thực với YouTube
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
