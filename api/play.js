const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thiếu tham số ?url=");
    }

    try {
        // Cấu hình Cookie chuyên nghiệp sử dụng createAgent của @distube/ytdl-core
        const cookieString = process.env.YOUTUBE_COOKIE;
        let agentOptions = {};
        
        if (cookieString) {
            try {
                // Xử lý cookie nếu bạn lưu trong biến môi trường dưới dạng JSON Array (chuẩn nhất)
                const parsedCookie = JSON.parse(cookieString);
                agentOptions = { agent: ytdl.createAgent(parsedCookie) };
            } catch (e) {
                // Fallback nếu cookie là dạng string thuần túy
                agentOptions = {
                    requestOptions: {
                        headers: { 'Cookie': cookieString }
                    }
                };
            }
        }

        // 1. Lấy thông tin metadata của video bằng Agent đã gắn Cookie bypass
        const info = await ytdl.getInfo(url, agentOptions);

        // 2. Lọc định dạng Audio chuẩn nhất
        const format = ytdl.chooseFormat(info.formats, { 
            filter: 'audioonly', 
            quality: 'highestaudio' 
        });

        if (!format || !format.url) {
            return res.status(404).send("Lỗi: Không bóc tách được luồng âm thanh.");
        }

        // 3. PRO MOVE: Redirect (Chuyển hướng) thẳng Delta X / Trình duyệt sang máy chủ Google CDN.
        // Bỏ qua hoàn toàn bước Stream qua Vercel giúp giải quyết triệt để lỗi 0:00.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.redirect(302, format.url);

    } catch (error) {
        console.error("Lỗi hệ thống:", error.message);
        res.status(500).send("Lỗi API Vercel: " + error.message);
    }
};
