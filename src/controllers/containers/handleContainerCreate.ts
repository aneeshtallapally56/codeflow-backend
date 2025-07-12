import Docker from "dockerode";
import path from "path";
import { getProjectPath } from "../../utils/projectPath/projectPath"

const creatingContainers = new Set<string>();

// Initialize Docker client with error handling
let dockerClient: Docker | null = null;
try {
  dockerClient = new Docker();
} catch (error) {
  console.warn('⚠️ Docker not available, container features will be disabled');
}

export const listContainers = async ()=>{
  if (!dockerClient) {
    console.warn('⚠️ Docker not available, skipping container listing');
    return;
  }
  const allContainers = await dockerClient.listContainers({ all: true });
  console.log(`Listing all containers...${allContainers.length} found`);
  //print ports arrau
  allContainers.forEach((container)=>{
    console.log(container.Ports);
  })
}

export const handleContainerCreate = async (projectId: string) => {
  if (!dockerClient) {
    console.warn(`⚠️ Docker not available, skipping container creation for ${projectId}`);
    return;
  }

  const containerName = `project-${projectId}`;
  console.log(`🔁 Creating container for project ${projectId}`);

  if (creatingContainers.has(projectId)) {
    console.log(`⏳ Container creation already in progress for ${projectId}`);
    return;
  }

  creatingContainers.add(projectId);

  try {
    const allContainers = await dockerClient.listContainers({ all: true });
    const existing = allContainers.find(c =>
      c.Names.includes(`/${containerName}`)
    );

    if (existing) {
      console.log(`📦 Container "${containerName}" already exists`);

      const container = dockerClient.getContainer(existing.Id);
      const info = await container.inspect();

      if (!info.State.Running) {
        console.log(`▶️ Starting existing container "${containerName}"...`);
        await container.start();
      }

      return;
    }

    
    const projectPath = getProjectPath(projectId);
    console.log(`📁 Mounting project path: ${projectPath}`);

    const container = await dockerClient.createContainer({
      name: containerName,
      Image: "sandbox",
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/bash', '-c', 'echo "\n💡 To preview your app, run:\nnpm run dev -- --host 0.0.0.0\n"; exec bash'],
      User: "sandbox",
      Env: ["HOST=0.0.0.0"],
      ExposedPorts: {
        "5173/tcp": {}
      },
      HostConfig: {
        Binds: [
          `${projectPath}:/home/sandbox/app` // Use getProjectPath instead of hardcoded path
        ],
        PortBindings: {
          "5173/tcp": [{ HostPort: "0" }]
        }
      }
    });

    await container.start();
    console.log(`✅ Container ${containerName} created and started successfully.`);

  } catch (err) {
    console.error(`❌ Error creating container for ${projectId}:`, err);
  } finally {
    creatingContainers.delete(projectId);
  }
};

export const getContainerPort = async (projectId: string): Promise<number | null> => {
  if (!dockerClient) {
    return null;
  }

  try {
    const container = dockerClient.getContainer(`project-${projectId}`);
    const info = await container.inspect();
    const portBindings = info.NetworkSettings.Ports["5173/tcp"];
    
    if (portBindings && portBindings.length > 0) {
      return parseInt(portBindings[0].HostPort);
    }
    
    return null;
  } catch (err) {
    console.error(`❌ Error getting container port for ${projectId}:`, err);
    return null;
  }
};