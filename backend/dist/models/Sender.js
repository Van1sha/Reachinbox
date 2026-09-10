"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sender = void 0;
const typeorm_1 = require("typeorm");
const Campaign_1 = require("./Campaign");
let Sender = class Sender {
};
exports.Sender = Sender;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Sender.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], Sender.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, length: 255 }),
    __metadata("design:type", String)
], Sender.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ethereal_user', length: 255, nullable: true, default: null }),
    __metadata("design:type", String)
], Sender.prototype, "etherealUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ethereal_pass', length: 255, nullable: true, default: null }),
    __metadata("design:type", String)
], Sender.prototype, "etherealPass", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'smtp_user', length: 255, nullable: true, default: null }),
    __metadata("design:type", String)
], Sender.prototype, "smtpUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'smtp_pass', length: 255, nullable: true, default: null }),
    __metadata("design:type", String)
], Sender.prototype, "smtpPass", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'smtp_host', length: 255, default: 'smtp.gmail.com' }),
    __metadata("design:type", String)
], Sender.prototype, "smtpHost", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'smtp_port', default: 587 }),
    __metadata("design:type", Number)
], Sender.prototype, "smtpPort", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'smtp_secure', default: false }),
    __metadata("design:type", Boolean)
], Sender.prototype, "smtpSecure", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hourly_limit', default: 100 }),
    __metadata("design:type", Number)
], Sender.prototype, "hourlyLimit", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Sender.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Sender.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Campaign_1.Campaign, (campaign) => campaign.sender),
    __metadata("design:type", Array)
], Sender.prototype, "campaigns", void 0);
exports.Sender = Sender = __decorate([
    (0, typeorm_1.Entity)('senders')
], Sender);
