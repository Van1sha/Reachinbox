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
exports.EmailJob = void 0;
const typeorm_1 = require("typeorm");
const Campaign_1 = require("./Campaign");
let EmailJob = class EmailJob {
};
exports.EmailJob = EmailJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EmailJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipient_email', length: 255 }),
    __metadata("design:type", String)
], EmailJob.prototype, "recipientEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipient_name', length: 255, nullable: true }),
    __metadata("design:type", String)
], EmailJob.prototype, "recipientName", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'bull_job_id', length: 500, nullable: true }),
    __metadata("design:type", String)
], EmailJob.prototype, "bullJobId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['scheduled', 'queued', 'sending', 'sent', 'failed', 'retrying'],
        default: 'scheduled',
    }),
    __metadata("design:type", String)
], EmailJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'estimated_send_time', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EmailJob.prototype, "estimatedSendTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actual_sent_time', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EmailJob.prototype, "actualSentTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retry_count', default: 0 }),
    __metadata("design:type", Number)
], EmailJob.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_retry_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EmailJob.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EmailJob.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'message_id', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], EmailJob.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'preview_url', type: 'varchar', length: 1000, nullable: true }),
    __metadata("design:type", Object)
], EmailJob.prototype, "previewUrl", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Campaign_1.Campaign, (campaign) => campaign.jobs, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'campaign_id' }),
    __metadata("design:type", Campaign_1.Campaign)
], EmailJob.prototype, "campaign", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], EmailJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], EmailJob.prototype, "updatedAt", void 0);
exports.EmailJob = EmailJob = __decorate([
    (0, typeorm_1.Entity)('email_jobs')
], EmailJob);
