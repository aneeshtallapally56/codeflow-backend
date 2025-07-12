"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAvatarUrl = void 0;
const generateAvatarUrl = (seed) => `https://api.dicebear.com/9.x/bottts-neutral/png?seed=${encodeURIComponent(seed)}`;
exports.generateAvatarUrl = generateAvatarUrl;
