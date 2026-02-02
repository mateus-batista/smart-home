import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import httpProxy from 'http-proxy';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  port: parseInt(process.env.PROXY_PORT || '443'),
  webApp: process.env.WEB_APP_URL || 'http://localhost:5173',
  server: process.env.SERVER_URL || 'http://localhost:3001',
  voiceAssistant: process.env.VOICE_ASSISTANT_URL || 'http://localhost:3002',
};

// Load SSL certificates
const certPath = path.join(__dirname, 'certs');
let sslOptions;

try {
  sslOptions = {
    key: fs.readFileSync(path.join(certPath, 'key.pem')),
    cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
  };
} catch (err) {
  console.error('❌ SSL certificates not found!');
  console.error('   Run: npm run generate-certs');
  console.error('   Or manually create certs/key.pem and certs/cert.pem');
  process.exit(1);
}

// Create proxy instances
const webProxy = httpProxy.createProxyServer({ target: config.webApp, ws: true });
const serverProxy = httpProxy.createProxyServer({ target: config.server });
const voiceProxy = httpProxy.createProxyServer({ target: config.voiceAssistant, ws: true });

// Error handling
[webProxy, serverProxy, voiceProxy].forEach(proxy => {
  proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    if (res.writeHead) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    }
  });
});

// Create HTTPS server
const server = https.createServer(sslOptions, (req, res) => {
  const url = req.url || '/';

  // Route based on path
  if (url.startsWith('/api')) {
    // Smart home server API
    serverProxy.web(req, res);
  } else if (url.startsWith('/ws')) {
    // Voice assistant HTTP endpoints (non-WebSocket)
    voiceProxy.web(req, res);
  } else {
    // Everything else goes to web app
    webProxy.web(req, res);
  }
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';

  if (url.startsWith('/ws')) {
    // Voice assistant WebSocket
    voiceProxy.ws(req, socket, head);
  } else {
    // Vite HMR WebSocket
    webProxy.ws(req, socket, head);
  }
});

// Start server
server.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('🔒 Smart Home HTTPS Proxy');
  console.log('='.repeat(40));
  console.log(`   Listening on: https://0.0.0.0:${config.port}`);
  console.log('');
  console.log('   Routes:');
  console.log(`   /api/*  → ${config.server}`);
  console.log(`   /ws     → ${config.voiceAssistant}`);
  console.log(`   /*      → ${config.webApp}`);
  console.log('');
  console.log('   Access from your phone:');
  console.log(`   https://192.168.5.17:${config.port}`);
  console.log('');
  console.log('   Note: Accept the self-signed certificate warning');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close();
  process.exit(0);
});
