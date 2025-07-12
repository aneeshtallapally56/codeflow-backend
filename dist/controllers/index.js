"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = exports.ping = void 0;
var ping_controller_1 = require("./ping-controller");
Object.defineProperty(exports, "ping", { enumerable: true, get: function () { return ping_controller_1.ping; } });
var project_controller_1 = require("./project-controller");
Object.defineProperty(exports, "createProject", { enumerable: true, get: function () { return project_controller_1.createProject; } });
