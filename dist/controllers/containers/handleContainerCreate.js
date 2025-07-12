"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContainerPort = exports.handleContainerCreate = exports.listContainers = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
const projectPath_1 = require("../../utils/projectPath/projectPath");
const creatingContainers = new Set();
// Initialize Docker client with error handling
let dockerClient = null;
try {
    dockerClient = new dockerode_1.default();
}
catch (error) {
    console.warn('⚠️ Docker not available, container features will be disabled');
}
const listContainers = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!dockerClient) {
        console.warn('⚠️ Docker not available, skipping container listing');
        return;
    }
    const allContainers = yield dockerClient.listContainers({ all: true });
    console.log(`Listing all containers...${allContainers.length} found`);
    //print ports arrau
    allContainers.forEach((container) => {
        console.log(container.Ports);
    });
});
exports.listContainers = listContainers;
const handleContainerCreate = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
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
        const allContainers = yield dockerClient.listContainers({ all: true });
        const existing = allContainers.find(c => c.Names.includes(`/${containerName}`));
        if (existing) {
            console.log(`📦 Container "${containerName}" already exists`);
            const container = dockerClient.getContainer(existing.Id);
            const info = yield container.inspect();
            if (!info.State.Running) {
                console.log(`▶️ Starting existing container "${containerName}"...`);
                yield container.start();
            }
            return;
        }
        const projectPath = (0, projectPath_1.getProjectPath)(projectId);
        console.log(`📁 Mounting project path: ${projectPath}`);
        const container = yield dockerClient.createContainer({
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
        yield container.start();
        console.log(`✅ Container ${containerName} created and started successfully.`);
    }
    catch (err) {
        console.error(`❌ Error creating container for ${projectId}:`, err);
    }
    finally {
        creatingContainers.delete(projectId);
    }
});
exports.handleContainerCreate = handleContainerCreate;
const getContainerPort = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!dockerClient) {
        return null;
    }
    try {
        const container = dockerClient.getContainer(`project-${projectId}`);
        const info = yield container.inspect();
        const portBindings = info.NetworkSettings.Ports["5173/tcp"];
        if (portBindings && portBindings.length > 0) {
            return parseInt(portBindings[0].HostPort);
        }
        return null;
    }
    catch (err) {
        console.error(`❌ Error getting container port for ${projectId}:`, err);
        return null;
    }
});
exports.getContainerPort = getContainerPort;
