import net from 'net';

const LISTEN_PORT = 6379;
const LISTEN_HOST = '127.0.0.1';
const TARGET_PORT = 6379;
const TARGET_HOST = '172.21.71.178'; // WSL IP address

const server = net.createServer((clientSocket) => {
  console.log(`[Proxy] Client connected from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

  const targetSocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[Proxy] Connected to target ${TARGET_HOST}:${TARGET_PORT}`);
  });

  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    console.error('[Proxy] Client socket error:', err.message);
    targetSocket.destroy();
  });

  targetSocket.on('error', (err) => {
    console.error('[Proxy] Target socket error:', err.message);
    clientSocket.destroy();
  });

  clientSocket.on('close', () => {
    console.log('[Proxy] Client connection closed');
    targetSocket.destroy();
  });

  targetSocket.on('close', () => {
    console.log('[Proxy] Target connection closed');
    clientSocket.destroy();
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`🚀 TCP Proxy listening on ${LISTEN_HOST}:${LISTEN_PORT} -> forwarding to ${TARGET_HOST}:${TARGET_PORT}`);
});

server.on('error', (err) => {
  console.error('[Proxy] Server error:', err.message);
});
