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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileLock = exports.unlockFile = exports.lockFile = void 0;
const redis_1 = __importDefault(require("./redis"));
const LOCK_PREFIX = "file-lock:";
const lockFile = (path, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = `${LOCK_PREFIX}${path}`;
    const success = yield redis_1.default.set(key, userId, "NX", "EX", 300);
    return success === "OK";
});
exports.lockFile = lockFile;
const unlockFile = (path, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const key = `${LOCK_PREFIX}${path}`;
    const current = yield redis_1.default.get(key);
    if (current === userId) {
        yield redis_1.default.del(key);
    }
});
exports.unlockFile = unlockFile;
const getFileLock = (path) => __awaiter(void 0, void 0, void 0, function* () {
    const key = `file-lock:${path}`;
    return yield redis_1.default.get(key); // returns userId or null
});
exports.getFileLock = getFileLock;
