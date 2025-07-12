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
exports.redisDel = exports.redisKeys = exports.redisSismember = exports.redisSmembers = exports.redisSrem = exports.redisSadd = exports.redisSet = exports.redisGet = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
let redis = null;
try {
    redis = new ioredis_1.default(process.env.NODE_ENV === "production"
        ? process.env.REDIS_URL || "redis://localhost:6379"
        : "redis://localhost:6379");
    redis.on('error', (err) => {
        console.warn('⚠️ Redis connection error:', err.message);
        redis = null;
    });
    redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
    });
}
catch (error) {
    console.warn('⚠️ Redis not available, some features will be disabled');
    redis = null;
}
// Helper functions to safely use Redis
const redisGet = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return null;
    try {
        return yield redis.get(key);
    }
    catch (error) {
        console.warn('Redis get error:', error);
        return null;
    }
});
exports.redisGet = redisGet;
const redisSet = (key, value, ...args) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return false;
    try {
        return yield redis.set(key, value, ...args);
    }
    catch (error) {
        console.warn('Redis set error:', error);
        return false;
    }
});
exports.redisSet = redisSet;
const redisSadd = (key, ...members) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return 0;
    try {
        return yield redis.sadd(key, ...members);
    }
    catch (error) {
        console.warn('Redis sadd error:', error);
        return 0;
    }
});
exports.redisSadd = redisSadd;
const redisSrem = (key, ...members) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return 0;
    try {
        return yield redis.srem(key, ...members);
    }
    catch (error) {
        console.warn('Redis srem error:', error);
        return 0;
    }
});
exports.redisSrem = redisSrem;
const redisSmembers = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return [];
    try {
        return yield redis.smembers(key);
    }
    catch (error) {
        console.warn('Redis smembers error:', error);
        return [];
    }
});
exports.redisSmembers = redisSmembers;
const redisSismember = (key, member) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return false;
    try {
        return yield redis.sismember(key, member);
    }
    catch (error) {
        console.warn('Redis sismember error:', error);
        return false;
    }
});
exports.redisSismember = redisSismember;
const redisKeys = (pattern) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return [];
    try {
        return yield redis.keys(pattern);
    }
    catch (error) {
        console.warn('Redis keys error:', error);
        return [];
    }
});
exports.redisKeys = redisKeys;
const redisDel = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redis)
        return 0;
    try {
        return yield redis.del(key);
    }
    catch (error) {
        console.warn('Redis del error:', error);
        return 0;
    }
});
exports.redisDel = redisDel;
exports.default = redis;
