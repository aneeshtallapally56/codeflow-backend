import Docker from "dockerode";
import path from "path";
import { Socket } from "socket.io";
const dockerClient = new Docker();

// Simple map to track if container exists
const existingContainers = new Set<string>();

export const handleContainerCreate = async (projectId: string, socket: Socket) => {
  console.log(`Creating container for project ${projectId}`);
  const containerName = `project-${projectId}`;

  // Check if we already created this container
  if (existingContainers.has(projectId)) {
    console.log(`Container for project ${projectId} already exists`);
    socket.emit("containerReady", { projectId });
    return;
  }

  try {
    // Check if container already exists in Docker
    const containers = await dockerClient.listContainers({ all: true });
    const existingContainer = containers.find(c => 
      c.Names.includes(`/${containerName}`)
    );

    if (existingContainer) {
      console.log(`Docker container ${containerName} already exists`);
      existingContainers.add(projectId);
      socket.emit("containerReady", { projectId });
      return;
    }

    // Mark as creating
    existingContainers.add(projectId);

    const container = await dockerClient.createContainer({
      name: containerName,
      Image: 'sandbox',
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ["/bin/bash"],
      Tty: true,
      User: 'sandbox',
      ExposedPorts: {
        '5173/tcp': {}
      },
      Env: ["HOST=0.0.0.0"],
      HostConfig: {
        Binds: [`${process.cwd()}/generated-projects/${projectId}:/home/sandbox/app`],
        PortBindings: {
          '5173/tcp': [
            {
              HostPort: '0'
            }
          ]
        },
      }
    });

    await container.start();
    console.log(`Container ${containerName} created and started successfully.`);
    socket.emit("containerReady", { projectId });

  } catch (err) {
    console.error("Error creating container:", err);
    // Remove from set if creation failed
    existingContainers.delete(projectId);
    socket.emit("containerCreateError", { error: "Failed to create container" });
  }
};