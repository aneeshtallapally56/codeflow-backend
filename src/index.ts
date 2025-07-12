import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Docker from 'dockerode';

import { serverConfig } from './config';
import { connectDB } from './config/db-config';
import apiRoutes from './routes';
import { setupEditorNamespace } from './socket-handlers/editorNamespace';
import { handleContainerCreate } from './controllers/containers/handleContainerCreate';


const app = express();
const server = createServer(app);
const dockerClient = new Docker(); 

// --- Middleware ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

// --- MongoDB + REST API ---
connectDB();
app.use('/api', apiRoutes);



// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
});
setupEditorNamespace(io);

io.on('connection', (socket) => {
  console.log('✅ Backend received a Socket.IO connection');
});

// --- Terminal WebSocket Setup ---
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  const isTerminal = req.url?.startsWith('/terminal');
  if (!isTerminal) return;

  const url = new URL(`http://localhost${req.url}`);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    socket.destroy();
    return;
  }

  

  // WAIT for container creation to complete before proceeding
  await handleContainerCreate(projectId);

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleTerminalSocket(ws, projectId);
  });
});

const handleTerminalSocket = async (ws: WebSocket, projectId: string) => {
  

  try {
    const container = dockerClient.getContainer(`project-${projectId}`);

    // Wait for container to be ready for exec
    await new Promise(resolve => setTimeout(resolve, 1500));

    const exec = await container.exec({
      Cmd: ['/bin/bash'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    // Pipe: container → client
    stream.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data.toString());
      }
    });

    // Pipe: client → container
    ws.on('message', (msg) => {
      stream.write(msg);
    });

    ws.on('close', async () => {
   
      try {
        stream.destroy();
      } catch (err) {
        console.error(`❌ Error removing container:`, err);
      }
    });
  } catch (err) {
    console.error(`❌ Error handling terminal WebSocket for ${projectId}:`, err);
    ws.close();
  }
};

server.listen(serverConfig.PORT, () => {

});