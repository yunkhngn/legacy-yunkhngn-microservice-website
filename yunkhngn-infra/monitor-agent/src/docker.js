const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function listContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map(c => ({
    id: c.Id,
    names: c.Names,
    image: c.Image,
    state: c.State,
    status: c.Status
  }));
}

module.exports = { docker, listContainers };
