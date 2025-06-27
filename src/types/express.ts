// Method 1: Create a types file (recommended)
// Create a file: src/types/express.ts

import { Request } from 'express';
import mongoose from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: mongoose.Types.ObjectId;
        email?: string;
        // Add other user properties as needed
      };
    }
  }
}

export {}; // Make this file a module