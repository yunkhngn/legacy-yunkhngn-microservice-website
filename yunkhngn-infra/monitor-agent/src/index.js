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
            let message = chunk.toString('utf8');
            // Check if chunk has Docker multiplexed header signature (type <= 2, padding 0 0 0)
            if (chunk.length >= 8 && chunk[0] <= 2 && chunk[1] === 0 && chunk[2] === 0 && chunk[3] === 0) {
              message = chunk.slice(8).toString('utf8');
            }
            
            // Send valid message lines
            if (message) {
              ws.send(JSON.stringify({
                type: 'log',
                containerId,
                message: message.trimEnd()
              }));
            }
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
