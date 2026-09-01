module.exports = async (req, res) => {
    // Cấu hình CORS mở cho mọi nguồn (Roblox Client, Web Client)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url, mode } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'Missing ?url= parameter',
            usage: '/api/play?url=https://www.youtube.com/watch?v=...'
        });
    }

    // Nếu gọi dưới dạng JSON API để hướng dẫn Client-Side Extraction
    if (mode === 'json') {
        return res.status(200).json({
            success: true,
            extractionMode: 'Client-IP',
            targetUrl: url,
            message: 'Hãy sử dụng Client Engine ở trình duyệt hoặc LocalScript để fetch stream trực tiếp.'
        });
    }

    // Mặc định: Trả về một Web App Client-Side nhẹ để người dùng mở bằng trình duyệt 
    // Trình duyệt sẽ dùng IP cá nhân để giải mã và phát/tải nhạc 100% không bị chặn.
    const htmlResponse = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Client-Side Audio Engine</title>
        <style>
            body { font-family: system-ui, sans-serif; background: #121212; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #1e1e1e; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 100%; }
            .status { margin: 15px 0; font-size: 14px; color: #aaa; }
            audio { width: 100%; margin-top: 15px; }
            .btn { background: #ff0000; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-block; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h3>🎵 Client Audio Streamer</h3>
            <div id="status" class="status">Đang giải mã bằng IP của bạn...</div>
            <audio id="player" controls autoplay style="display:none;"></audio>
            <div id="download-area"></div>
        </div>

        <script>
            const targetUrl = "${url}";
            const statusDiv = document.getElementById('status');
            const player = document.getElementById('player');
            const downloadArea = document.getElementById('download-area');

            async function extractAudioClientSide() {
                try {
                    // Gọi qua public Cobalt Client Endpoint trực tiếp từ IP Người Dùng
                    const response = await fetch('https://api.cobalt.tools/', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            url: targetUrl,
                            downloadMode: 'audio',
                            audioFormat: 'mp3'
                        })
                    });

                    const data = await response.json();
                    if (data && (data.url || data.audio)) {
                        const streamUrl = data.url || data.audio;
                        statusDiv.innerText = 'Giải mã thành công bằng IP Client!';
                        player.src = streamUrl;
                        player.style.display = 'block';
                        downloadArea.innerHTML = \`<a href="\${streamUrl}" class="btn" target="_blank" download>Tải File MP3</a>\`;
                    } else {
                        throw new Error('Client extraction returned empty audio stream');
                    }
                } catch (err) {
                    statusDiv.innerText = 'Lỗi: ' + err.message;
                }
            }

            extractAudioClientSide();
        </script>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlResponse);
};
 
