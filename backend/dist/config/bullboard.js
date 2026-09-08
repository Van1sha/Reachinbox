"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupBullBoard = setupBullBoard;
const api_1 = require("@bull-board/api");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const express_1 = require("@bull-board/express");
function setupBullBoard(queue) {
    const serverAdapter = new express_1.ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    (0, api_1.createBullBoard)({
        queues: [new bullMQAdapter_1.BullMQAdapter(queue)],
        serverAdapter,
    });
    return { router: serverAdapter.getRouter() };
}
