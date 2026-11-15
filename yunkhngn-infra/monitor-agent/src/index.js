const fastify = require('fastify')({ logger: true });
const WebSocket = require('ws');
const { docker, listContainers } = require('./docker');

fastify.get('/containers', async (request, reply) => {
  try {
    return await listContainers();
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Failed to fetch containers' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 9100, host: '0.0.0.0' });
    
    const wssLogs = new WebSocket.Server({ noServer: true });
    const wssStats = new WebSocket.Server({ noServer: true });

    fastify.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/logs') {
        wssLogs.handleUpgrade(request, socket, head, (ws) => {
          wssLogs.emit('connection', ws, request);
        });
      } else if (url.pathname === '/stats') {
        wssStats.handleUpgrade(request, socket, head, (ws) => {
          wssStats.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Handle Log Streaming
    wssLogs.on('connection', (ws, req) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const containerId = url.searchParams.get('containerId');
        if (!containerId) return ws.close();

        const container = docker.getContainer(containerId);
        container.logs({ follow: true, stdout: true, stderr: true, timestamps: true, tail: 100 }, (err, stream) => {
          if (err || !stream) return ws.close();
          ws.on('close', () => stream && typeof stream.destroy === 'function' && stream.destroy());
          stream.on('data', (chunk) => {
            let message = chunk.toString('utf8');
            if (chunk.length >= 8 && chunk[0] <= 2 && chunk[1] === 0 && chunk[2] === 0 && chunk[3] === 0) {
              message = chunk.slice(8).toString('utf8');
            }
            if (message) ws.send(JSON.stringify({ type: 'log', containerId, message: message.trimEnd() }));
          });
        });
      } catch (err) { ws.close(); }
    });

    // Handle Stats Streaming
    wssStats.on('connection', (ws, req) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const containerId = url.searchParams.get('containerId');
        if (!containerId) return ws.close();

        const container = docker.getContainer(containerId);
        container.stats({ stream: true }, (err, stream) => {
          if (err || !stream) return ws.close();
          ws.on('close', () => stream && typeof stream.destroy === 'function' && stream.destroy());
          stream.on('data', (chunk) => {
            try {
              const data = JSON.parse(chunk.toString('utf8'));
              // Calculate CPU percentage
              const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
              const systemDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
              const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * data.cpu_stats.online_cpus * 100.0 : 0.0;
              
              // Memory usage
              const memUsage = data.memory_stats.usage;
              
              ws.send(JSON.stringify({
                type: 'stats',
                containerId,
                cpu: cpuPercent.toFixed(2),
                memory: memUsage,
                memoryFormatted: (memUsage / (1024 * 1024)).toFixed(2) + 'MB',
                networks: data.networks,
                restartPolicy: data.HostConfig?.RestartPolicy?.Name || 'always'
              }));
            } catch (e) {}
          });
        });
      } catch (err) { ws.close(); }
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
