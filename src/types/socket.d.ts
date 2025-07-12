// Method 1: Create a types file (recommended)
// Create a file: src/types/socket.ts

import { Socket } from 'socket.io';

declare module 'socket.io' {
  interface Socket {
    userId?: string;
     projectId?: string;
  }
}
export {}; // Make this file a module