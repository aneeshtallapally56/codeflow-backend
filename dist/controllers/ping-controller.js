"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ping = void 0;
const http_status_codes_1 = require("http-status-codes");
const ping = (req, res) => {
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: 'Ping!!! API is live',
        error: {},
        data: {},
    });
};
exports.ping = ping;
