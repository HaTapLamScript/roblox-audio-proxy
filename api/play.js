module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'Missing ?url= parameter'
        });
    }

    const htmlResponse = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Client Audio Streamer</title>
        <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #121212; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #1e1e1e; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 90%; }
            .status { margin: 15px 0; font-size: 14px; color: #aaa; word-break: break-word; }
            audio { width: 100%; margin-top: 15px; }
            .btn { background: #ff0000; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-block; margin-top: 15px; }
            .loader { border: 3px solid #333; border-top: 3px solid #ff0000; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 10px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    </head>
    <body>
        <div class="card">
            <h3>🎵 Client Audio Streamer</h3>
            <div id="loader" class="loader"></div>
            <div id="status" class="status">Đang giải mã bằng IP của bạn...</div>
            <audio id="player" controls autoplay style="display:none;"></audio>
            <div id="download-area"></div>
        </div>

        <script>
            const targetUrl = "${url}";
            const statusDiv = document.getElementById('status');
            const loader = document.getElementById('loader');
            const player = document.getElementById('player');
            const downloadArea = document.getElementById('download-area');

            async function fetchCobalt(apiUrl) {
                const res = await fetch(apiUrl, {
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
                return await res.json();
            }

            async function extractAudioClientSide() {
                const instances = [
                    'https://api.cobalt.tools/',
                    'https://cobalt-api.kwiatek.xyz/',
                    'https://co.wuk.sh/'
                ];

                let streamUrl = null;

                for (const instance of instances) {
                    try {
                        statusDiv.innerText = 'Đang thử kết nối...';
                        const data = await fetchCobalt(instance);

                        // Xử lý các dạng dữ liệu trả về của Cobalt API
                        if (data.status === 'stream' || data.status === 'redirect' || data.status === 'tunnel') {
                            streamUrl = data.url;
                            break;
                        } else if (data.url) {
                            streamUrl = data.url;
                            break;
                        } else if (data.picker && data.picker.length > 0) {
                            streamUrl = data.picker[0].url;
                            break;
                        }
                    } catch (err) {
                        continue;
                    }
                }

                if (streamUrl) {
                    loader.style.display = 'none';
                    statusDiv.innerText = 'Giải mã thành công!';
                    player.src = streamUrl;
                    player.style.display = 'block';
                    downloadArea.innerHTML = \`<a href="\${streamUrl}" class="btn" target="_blank" download>Tải File MP3</a>\`;
                } else {
                    loader.style.display = 'none';
                    statusDiv.innerText = 'Lỗi: Không thể lấy luồng âm thanh. Vui lòng kiểm tra lại URL YouTube.';
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
