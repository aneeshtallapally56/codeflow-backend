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

// Initialize Docker client only if Docker is available
let dockerClient: Docker | null = null;
try {
  dockerClient = new Docker();
} catch (error) {
  console.warn('⚠️ Docker not available, terminal features will be disabled');
}

// --- Middleware ---
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Production-ready CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://codeflow.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Health check endpoint
app.get("/api/health", (_, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- MongoDB + REST API ---
connectDB();
app.use('/api', apiRoutes);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    socket.destroy();
    return;
  }

  // Check if Docker is available
  if (!dockerClient) {
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
  if (!dockerClient) {
    ws.close();
    return;
  }

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

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = serverConfig.PORT || 3002;
server.listen(PORT, () => {
  console.log(`✅ Backend is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});