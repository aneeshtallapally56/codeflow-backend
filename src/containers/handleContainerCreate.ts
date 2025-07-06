import Docker from "dockerode";
import path from "path";

const dockerClient = new Docker();

// Track in-progress creations to avoid race conditions
const creatingContainers = new Set<string>();

export const listContainers = async ()=>{
  const allContainers = await dockerClient.listContainers({ all: true });
  console.log(`Listing all containers...${allContainers.length} found`);
  //print ports arrau
  allContainers.forEach((container)=>{
    console.log(container.Ports);
  })
}


export const handleContainerCreate = async (projectId: string) => {
  const containerName = `project-${projectId}`;
  console.log(`🔁 Creating container for project ${projectId}`);

  // Avoid duplicate creation attempts
  if (creatingContainers.has(projectId)) {
    console.log(`⏳ Container creation already in progress for ${projectId}`);
    return;
  }

  creatingContainers.add(projectId);

  try {
    // Check if container already exists
    const allContainers = await dockerClient.listContainers({ all: true });
    const existing = allContainers.find(c =>
      c.Names.includes(`/${containerName}`)
    );

    if (existing) {
      console.log(`📦 Container "${containerName}" already exists`);
      return;
    }

    const container = await dockerClient.createContainer({
      name: containerName,
      Image: "sandbox", // ✅ Ensure "sandbox" image is pulled
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["/bin/bash"],
      User: "sandbox",
      Env: ["HOST=0.0.0.0"],
      ExposedPorts: {
        "5173/tcp": {}
      },
      HostConfig: {
        Binds: [
          `${process.cwd()}/generated-projects/${projectId}:/home/sandbox/app`
        ],
        PortBindings: {
          "5173/tcp": [
            {
              HostPort: "0" // ⚠️ Will pick random available host port
            }
          ]
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