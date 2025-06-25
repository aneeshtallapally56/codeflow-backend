import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const ping = (req: Request, res: Response) => {
   res.status(StatusCodes.OK).json({
    success: true,
    message: 'Ping!!! API is live',
    error: {},
    data: {},
  });
};