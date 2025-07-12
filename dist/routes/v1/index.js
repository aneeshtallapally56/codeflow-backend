"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const controllers_1 = require("../../controllers");
const project_routes_1 = __importDefault(require("./project-routes")); // Add this import
const db_controller_1 = require("../../controllers/db-controller");
const auth_routes_1 = __importDefault(require("./auth-routes")); // Import auth routes
const file_routes_1 = __importDefault(require("./file-routes")); // Import file routes
const ai_routes_1 = __importDefault(require("./ai-routes"));
const router = express_1.default.Router();
router.use('/ping', controllers_1.ping);
router.use('/projects', project_routes_1.default);
router.use('/project', project_routes_1.default);
router.use('/test', db_controller_1.test); // Use the imported router
router.use('/auth', auth_routes_1.default);
router.use('/files', file_routes_1.default);
router.use('/ai', ai_routes_1.default);
exports.default = router;
