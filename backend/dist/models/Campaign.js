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
exports.Campaign = void 0;
const typeorm_1 = require("typeorm");
const Sender_1 = require("./Sender");
const EmailJob_1 = require("./EmailJob");
let Campaign = class Campaign {
};
exports.Campaign = Campaign;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Campaign.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500 }),
    __metadata("design:type", String)
], Campaign.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Campaign.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', length: 255 }),
    __metadata("design:type", String)
], Campaign.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['scheduled', 'in_progress', 'completed', 'failed', 'paused'],
        default: 'scheduled',
    }),
    __metadata("design:type", String)
], Campaign.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scheduled_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Campaign.prototype, "scheduledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hourly_limit', default: 100 }),
    __metadata("design:type", Number)
], Campaign.prototype, "hourlyLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delay_between_emails_ms', default: 2000 }),
    __metadata("design:type", Number)
], Campaign.prototype, "delayBetweenEmailsMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_recipients', default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "totalRecipients", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_count', default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "sentCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failed_count', default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "failedCount", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Sender_1.Sender, (sender) => sender.campaigns, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'sender_id' }),
    __metadata("design:type", Sender_1.Sender)
], Campaign.prototype, "sender", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Campaign.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Campaign.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => EmailJob_1.EmailJob, (job) => job.campaign, { cascade: true }),
    __metadata("design:type", Array)
], Campaign.prototype, "jobs", void 0);
exports.Campaign = Campaign = __decorate([
    (0, typeorm_1.Entity)('campaigns')
], Campaign);
