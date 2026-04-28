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
    const wss = new WebSocket.Server({ server: fastify.server, path: '/logs' });

    wss.on('connection', (ws, req) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const containerId = url.searchParams.get('containerId');
        
        if (!containerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing containerId' }));
          return ws.close();
        }

        const container = docker.getContainer(containerId);
        const logOpts = {
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: true,
          tail: 100
        };

        // dockerode logs returns a stream when follow is true
        container.logs(logOpts, (err, stream) => {
          if (err || !stream) {
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to stream logs' }));
            return ws.close();
          }

          ws.on('close', () => {
            if (stream && typeof stream.destroy === 'function') {
              stream.destroy();
            }
          });

          stream.on('data', (chunk) => {
            // Docker stream format has an 8-byte header (1 byte type, 3 bytes padding, 4 bytes size)
            // if it's a TTY stream it's raw, but container.logs with follow:true usually has headers
            // We'll clean up non-printable chars or extract actual payload if needed, 
            // but for simplicity sending clean string.
            const cleanMessage = chunk.slice(8).toString('utf8');
            ws.send(JSON.stringify({
              type: 'log',
              containerId,
              message: cleanMessage || chunk.toString('utf8')
            }));
          });
        });
      } catch (err) {
        fastify.log.error(err);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close();
      }
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
