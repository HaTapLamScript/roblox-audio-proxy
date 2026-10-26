module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  // Danh sách các instance Cobalt public (ít phổ biến, miễn phí)
  const COBALT_INSTANCES = [
    'https://api.cobalt.best',
    'https://cobalt-api.kwiatekmiki.com',
    'https://cobalt-api.ayo.tf',
    'https://co.wuk.sh'
  ];

  let lastError = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          downloadMode: 'audio',
          audioFormat: 'mp3'
        }),
        signal: AbortSignal.timeout(8000) // Chờ tối đa 8s
      });

      if (!response.ok) {
        lastError = `${instance} trả về mã ${response.status}`;
        continue;
      }

      const data = await response.json();

      // Cobalt trả về link stream đã được proxy qua server của nó
      if (data.status === 'stream' || data.status === 'redirect') {
        return res.status(200).json({
          success: true,
          url: data.url,
          ext: '.mp3'
        });
      }
      
      lastError = `${instance}: ${data.text || 'Lỗi không xác định'}`;
    } catch (err) {
      lastError = `${instance}: ${err.message}`;
    }
  }

  return res.status(500).json({ 
    error: 'Tất cả instance Cobalt đều thất bại', 
    detail: lastError 
  });
};
