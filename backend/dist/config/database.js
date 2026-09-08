"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("dotenv/config");
const typeorm_1 = require("typeorm");
const Sender_1 = require("../models/Sender");
const Campaign_1 = require("../models/Campaign");
const EmailJob_1 = require("../models/EmailJob");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Sender_1.Sender, Campaign_1.Campaign, EmailJob_1.EmailJob],
    synchronize: true, // use migrations in prod
    logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
});
