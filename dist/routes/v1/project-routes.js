"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const project_controller_1 = require("../../controllers/project-controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const projectAccess_1 = require("../../middlewares/projectAccess");
const router = express_1.default.Router();
router.post('/create-project', auth_1.default, project_controller_1.createProject);
router.get('/:projectId/tree', auth_1.default, projectAccess_1.checkProjectAccess, project_controller_1.getProjectTree);
router.get('/', auth_1.default, project_controller_1.getUserProjects);
router.delete('/:projectId', auth_1.default, project_controller_1.deleteProject);
router.get('/:projectId', auth_1.default, projectAccess_1.checkProjectAccess, project_controller_1.getProjectById);
router.post('/join', auth_1.default, project_controller_1.joinProject);
router.post('/leave', auth_1.default, project_controller_1.leaveProject);
exports.default = router;
