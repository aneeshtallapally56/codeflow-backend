import { Socket, Server } from "socket.io";
import { handleContainerCreate } from "../containers/handleContainerCreate";

export function setUpTerminalNamespace(io: Server): void {
    const terminalNamespace = io.of("/terminal");
    
    terminalNamespace.on("connection", (socket: Socket) => {
        console.log("Terminal namespace connected", socket.id);
        let projectId = socket.handshake.query.projectId as string;
        
        // Handle shell input from client
        socket.on("shell-input", (data) => {
            console.log("Received input:", data);
            
            // Extract the actual input string from the data object
            const input = data.data;
            
            // For now, just echo the input back (you can replace this with actual shell processing)
            socket.emit("shell-output", input);
        });

        socket.on("disconnect", () => {
            console.log("Terminal namespace disconnected", socket.id);
        });
        handleContainerCreate(projectId, socket);
    });
}