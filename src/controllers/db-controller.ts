import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import  User  from '../models/User';

export const test = async  (req: Request, res: Response) => {
   try {
    const userCount = await User.countDocuments();
     res.status(StatusCodes.OK).json({
    success: true,
    message: 'Database connected successfully!',
    userCount: userCount,
    error: {},
    data: {},
  });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
};