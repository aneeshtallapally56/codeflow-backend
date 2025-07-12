"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const file_controller_1 = require("../../controllers/file-controller");
const router = (0, express_1.Router)();
router.post("/", auth_1.default, file_controller_1.createFile);
router.get("/", auth_1.default, file_controller_1.getFilesByProject);
router.put("/", auth_1.default, file_controller_1.updateFileContent);
exports.default = router;
