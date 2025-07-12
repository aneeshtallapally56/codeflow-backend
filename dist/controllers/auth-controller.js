"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutUser = exports.getCurrentUser = exports.loginUser = exports.registerUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
const crypto_1 = require("crypto");
const avatar_1 = require("../utils/avatar");
// JWT Token generation helper
const generateToken = (userId, email) => {
    const payload = { userId, email };
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not defined");
    }
    return jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: process.env.JWT_EXPIRE || "7d",
    });
};
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name: username, email, password: plainPassword, confirmPassword, } = req.body;
        const avatarSeed = (0, crypto_1.randomUUID)();
        const avatarUrl = (0, avatar_1.generateAvatarUrl)(avatarSeed);
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
        const existingUser = yield User_1.default.findOne({
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
        const hashedPassword = yield bcryptjs_1.default.hash(plainPassword, saltRounds);
        // Create user
        const user = new User_1.default({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            avatarUrl: avatarUrl,
        });
        yield user.save();
        // Generate JWT token
        const token = generateToken(user._id.toString(), user.email);
        // Remove password from response
        const _a = user.toObject(), { password } = _a, userResponse = __rest(_a, ["password"]);
        // Set token as an HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user: userResponse,
            },
        });
    }
    catch (error) {
        console.error("Register error:", error);
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((err) => err.message);
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
});
exports.registerUser = registerUser;
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield User_1.default.findOne({ email: email.toLowerCase() }).select("+password");
        if (!user) {
            res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
            return;
        }
        // Compare password using bcrypt
        const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
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
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Remove password from response
        const _a = user.toObject(), { password: omitPassword } = _a, userResponse = __rest(_a, ["password"]);
        res.json({
            success: true,
            message: "Login successful",
            data: {
                user: userResponse,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during login",
        });
    }
});
exports.loginUser = loginUser;
// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.default.findById(req.user._id).select("-password");
        res.json({
            success: true,
            data: {
                user,
            },
        });
    }
    catch (error) {
        console.error("Get current user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});
exports.getCurrentUser = getCurrentUser;
// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during logout",
        });
    }
});
exports.logoutUser = logoutUser;
