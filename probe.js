const https = require('https');

const endpoints = [
  "/api/admin/spin/reset-cooldown",
  "/api/admin/spin/reset-cooldown-user",
  "/api/admin/spin/reset-cooldown-by-username",
  "/api/admin/spin/reset-cooldown-one",
  "/api/admin/spin/reset-for-user"
];
const host = "life-rpg-api-router.evgeny-mahnach.workers.dev";
const token = "life-rpg-admin-dev-token";
const username = "evgeny";

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ username });
    const options = {
      hostname: host,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'x-admin-token': token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', (e) => {
      resolve({ status: 0, body: e.message });
    });

    req.write(data);
    req.end();
  });
}

async function run() {
  for (const path of endpoints) {
    process.stdout.write('Testing endpoint: ' + path + '\n');
    const result = await testEndpoint(path);
    process.stdout.write('Status: ' + result.status + '\n');
    process.stdout.write('Body: ' + result.body + '\n');
    if (result.status === 200 && result.body.includes('"ok":true')) {
      process.stdout.write('SUCCESS: Found working endpoint: ' + path + '\n');
      break;
    }
    process.stdout.write('---\n');
  }
}

run();
