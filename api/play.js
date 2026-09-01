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

            function extractVideoId(url) {
                const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                return match ? match[1] : null;
            }

            // Engine 1: Client Direct Fetch (Invidious CORS Bypass)
            async function tryClientInvidious(videoId) {
                const instances = [
                    'https://inv.tux.pizza',
                    'https://invidious.nerdvpn.de',
                    'https://vid.puffyan.us'
                ];
                for (const inst of instances) {
                    try {
                        const res = await fetch(\`\${inst}/api/v1/videos/\${videoId}\`);
                        const data = await res.json();
                        if (data && data.adaptiveFormats) {
                            const audio = data.adaptiveFormats.find(f => f.type && f.type.includes('audio'));
                            if (audio && audio.url) return audio.url;
                        }
                    } catch (e) { continue; }
                }
                throw new Error('Invidious Engine Failed');
            }

            // Engine 2: Y2Mate Client Bridge
            async function tryY2Mate(videoId) {
                const form = new URLSearchParams();
                form.append('url', \`https://www.youtube.com/watch?v=\${videoId}\`);
                form.append('q_auto', '0');
                form.append('ajax', '1');

                const res = await fetch('https://www.y2mate.com/matemy/analyze/ajax', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: form
                });
                const data = await res.json();
                if (data && data.result) {
                    const match = data.result.match(/k__id\s*=\s*"([^"]+)"/);
                    if (match && match[1]) {
                        const convForm = new URLSearchParams();
                        convForm.append('type', 'youtube');
                        convForm.append('_id', match[1]);
                        convForm.append('v_id', videoId);
                        convForm.append('ajax', '1');
                        convForm.append('ftype', 'mp3');
                        convForm.append('fquality', '128');

                        const convRes = await fetch('https://www.y2mate.com/matemy/convert', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                            body: convForm
                        });
                        const convData = await convRes.json();
                        if (convData && convData.result) {
                            const linkMatch = convData.result.match(/href="([^"]+)"/);
                            if (linkMatch && linkMatch[1]) return linkMatch[1];
                        }
                    }
                }
                throw new Error('Y2Mate Engine Failed');
            }

            async function startExtraction() {
                const videoId = extractVideoId(targetUrl);
                if (!videoId) {
                    loader.style.display = 'none';
                    statusDiv.innerText = 'Lỗi: URL YouTube không hợp lệ!';
                    return;
                }

                let audioUrl = null;

                // Thử Engine 1
                try {
                    statusDiv.innerText = 'Đang giải mã luồng audio (Engine 1)...';
                    audioUrl = await tryClientInvidious(videoId);
                } catch (e) {}

                // Thử Engine 2 nếu Engine 1 lỗi
                if (!audioUrl) {
                    try {
                        statusDiv.innerText = 'Đang chuyển đổi định dạng MP3 (Engine 2)...';
                        audioUrl = await tryY2Mate(videoId);
                    } catch (e) {}
                }

                if (audioUrl) {
                    loader.style.display = 'none';
                    statusDiv.innerText = 'Giải mã thành công!';
                    player.src = audioUrl;
                    player.style.display = 'block';
                    downloadArea.innerHTML = \`<a href="\${audioUrl}" class="btn" target="_blank" download>Tải File MP3</a>\`;
                } else {
                    loader.style.display = 'none';
                    statusDiv.innerText = 'Lỗi: Không thể lấy luồng âm thanh từ IP hiện tại. Vui lòng thử lại sau.';
                }
            }

            startExtraction();
        </script>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlResponse);
};
