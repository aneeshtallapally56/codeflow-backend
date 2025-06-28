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
import * as cookie from 'cookie';
import { connectDB } from './config/db-config';
import './types/socket';
import cookieParser from 'cookie-parser';
import { setupEditorNamespace } from './socket-handlers/editorNamespace';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // ✅ Match exactly with frontend
    credentials: true,               // ✅ Required for cookie auth
    methods: ["GET", "POST"],
  }
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
     origin: "http://localhost:3000",
    credentials: true,  
}));



connectDB();

io.on('connection', (socket) => {
 console.log("✅ Backend received a socket connection");
});

setupEditorNamespace(io);


app.use('/api', apiRoutes);

server.listen(serverConfig.PORT, () => {
    console.log(`Server is running on port ${serverConfig.PORT}`);
});