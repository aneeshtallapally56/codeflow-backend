import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/User";
import dotenv from "dotenv";
dotenv.config();
import { Request, Response, NextFunction } from "express";

const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token; 

    if (!token) {
       res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decoded === "string") {
       res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
      return;
    }

    const user = await User.findById((decoded as JwtPayload).userId).select("-password");

    if (!user) {
       res.status(401).json({
        success: false,
        message: "Token is not valid",
      });
      return;
    }

    // @ts-ignore or use a custom type extension
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    });
     return;
  }
};

export default auth;