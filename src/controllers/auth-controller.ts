import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { randomUUID } from 'crypto';
import { generateAvatarUrl } from "../utils/avatar";

// Interface for authenticated requests
interface AuthRequest extends Request {
  user?: any;
}

// JWT Token generation helper
const generateToken = (userId: string, email: string): string => {
  const payload = { userId, email };

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  } as SignOptions);
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name: username,
      email,
      password: plainPassword,
      confirmPassword,
    } = req.body;

    const avatarSeed = randomUUID();
     const avatarUrl = generateAvatarUrl(avatarSeed);

    // Validation
    if (!username || !email || !plainPassword || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
      return;
    }

    if (plainPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
      return;
    }

    if (plainPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
        return;
      }
      if (existingUser.username === username) {
        res.status(400).json({
          success: false,
          message: "Username is already taken",
        });
        return;
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // Create user
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      avatarUrl: avatarUrl,
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id.toString(), user.email);

    // Remove password from response
    const { password, ...userResponse } = user.toObject();

    // Set token as an HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userResponse,
      },
    });
  } catch (error: any) {
    console.error("Register error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (err: any) => err.message
      );
      res.status(400).json({
        success: false,
        message: messages[0],
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
      return;
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }


    // Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }


    // Generate JWT token
    const token = generateToken(user._id.toString(), user.email);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Remove password from response
    const { password: omitPassword, ...userResponse } = user.toObject();

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // In a JWT system, logout is mainly handled client-side by removing the token
    // But we can track logout time or implement token blacklisting here if needed
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
};

