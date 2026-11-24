import https from 'node:https';

const INDEXNOW_KEY = 'b8f9a2e64c1d30587e9b0a2f4c6d8e1a';
const HOSTS = ['www.calipartner.site', 'calipartner.site'];

const URL_PATHS = [
  '/',
  '/about',
  '/features',
  '/pricing',
  '/download',
  '/privacy',
  '/terms',
  '/support',
  '/delete-account',
];

async function submitToIndexNow(host: string, endpoint: string) {
  const urlList = URL_PATHS.map((p) => `https://${host}${p === '/' ? '/' : p}`);
  const payload = JSON.stringify({
    host,
    key: INDEXNOW_KEY,
    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
    urlList,
  });

  return new Promise<{ status?: number; host: string; endpoint: string }>((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, host, endpoint });
        });
      },
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`Submitting URLs to IndexNow (key: ${INDEXNOW_KEY})...`);
  const endpoints = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow'];

  for (const host of HOSTS) {
    for (const endpoint of endpoints) {
      try {
        const result = await submitToIndexNow(host, endpoint);
        console.log(`[${result.endpoint}] ${result.host} -> Status ${result.status}`);
      } catch (err) {
        console.error(`Failed to submit to ${endpoint} for ${host}:`, err);
      }
    }
  }
}

main();
