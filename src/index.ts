import express from 'express';
import jwt, { JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";
import { createServer } from 'node:http';
import chokidar from 'chokidar';
import {serverConfig} from './config';
import apiRoutes from './routes';
import cors from 'cors';
import path from 'node:path';
import { handleEditorSocketEvents } from './socket-handlers/editorHandler';
import { connect } from 'node:http2';
import { connectDB } from './config/db-config';
import './types/socket';


const app = express();
const server = createServer(app);
const io = new Server(server,{
    cors:{
        origin:'*',
        methods: ['GET', 'POST'],
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());



connectDB();

io.on('connection', (socket) => {

 console.log("✅ Backend received a socket connection");
});

const editorNamespace = io.of('/editor');
editorNamespace.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.error("❌ No token provided");
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    socket.userId = decoded.userId; 
    next();
  } catch (err) {
    console.error("❌ Invalid token:", err);
    return next(new Error("Authentication failed"));
  }
});


editorNamespace.on('connection', (socket) => {
    console.log('editor namespace connected');
    
// get projectId from frontend

const queryParams = socket.handshake.query;
const projectId = queryParams.projectId as string;

console.log('Project ID from backend query params:', projectId);
if(projectId){
     const projectPath = path.join(process.cwd(), "generated-projects", projectId);
    var watcher = chokidar.watch(projectPath,{
        ignored: (path) => (
            path.includes('node_modules') 
        ),
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        }
    });
    watcher.on('all', (event, path) => {
        console.log(`File ${path} has been ${event}`);
       
    });
}


handleEditorSocketEvents(socket, editorNamespace);
socket.on('disconnect', async () => {
    await watcher.close();
    console.log('editor namespace disconnected');

});
});



app.use('/api', apiRoutes);

server.listen(serverConfig.PORT, () => {
    console.log(`Server is running on port ${serverConfig.PORT}`);
});