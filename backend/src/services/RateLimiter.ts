import { Redis } from 'ioredis';
import { redisClient } from '../config/redis';

/**
 * Redis-backed rate limiter for email sends.
 * Uses atomic INCR + EXPIREAT to maintain per-sender/per-hour counters.
 * Safe across multiple workers/instances.
 */
export class RateLimiter {
  private redis: Redis;
  private globalLimit: number;
  private perSenderLimit: number;

  constructor() {
    this.redis = redisClient;
    this.globalLimit = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
    this.perSenderLimit = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100');
  }

  /**
   * Returns the Redis key for a given sender and hour window.
   */
  private getSenderKey(senderId: string, hourWindow: Date): string {
    const y = hourWindow.getFullYear();
    const m = String(hourWindow.getMonth() + 1).padStart(2, '0');
    const d = String(hourWindow.getDate()).padStart(2, '0');
    const h = String(hourWindow.getHours()).padStart(2, '0');
    return `rate:sender:${senderId}:${y}-${m}-${d}-${h}`;
  }

  private getGlobalKey(hourWindow: Date): string {
    const y = hourWindow.getFullYear();
    const m = String(hourWindow.getMonth() + 1).padStart(2, '0');
    const d = String(hourWindow.getDate()).padStart(2, '0');
    const h = String(hourWindow.getHours()).padStart(2, '0');
    return `rate:global:${y}-${m}-${d}-${h}`;
  }

  /**
   * Gets the start of the next hour from a given date.
   */
  getNextHourStart(from: Date = new Date()): Date {
    const next = new Date(from);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  /**
   * Gets the end of the current hour.
   */
  getCurrentHourEnd(from: Date = new Date()): Date {
    const end = new Date(from);
    end.setHours(end.getHours(), 59, 59, 999);
    return end;
  }

  /**
   * Gets how many emails have been sent in the current hour for a sender.
   */
  async getCurrentCount(senderId: string, atTime: Date = new Date()): Promise<number> {
    const key = this.getSenderKey(senderId, atTime);
    const count = await this.redis.get(key);
    return count ? parseInt(count) : 0;
  }

  /**
   * Gets the configured hourly limit for a sender (uses per-sender limit).
   */
  getSenderLimit(customLimit?: number): number {
    return customLimit ?? this.perSenderLimit;
  }

  /**
   * Checks if a send is allowed, and increments the counter atomically if so.
   * Returns: { allowed: boolean, currentCount: number, limit: number }
   */
  async checkAndIncrement(
    senderId: string,
    limit: number,
    atTime: Date = new Date()
  ): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    const key = this.getSenderKey(senderId, atTime);

    // Lua script for atomic check-and-increment
    const script = `
      local current = tonumber(redis.call('GET', KEYS[1]) or '0')
      if current < tonumber(ARGV[1]) then
        local newval = redis.call('INCR', KEYS[1])
        -- Set expiry to end of hour (3600 seconds max)
        redis.call('EXPIREAT', KEYS[1], ARGV[2])
        return {1, newval}
      else
        return {0, current}
      end
    `;

    const hourEnd = this.getCurrentHourEnd(atTime);
    const expireAt = Math.floor(hourEnd.getTime() / 1000) + 1;

    const result = await this.redis.eval(
      script,
      1,
      key,
      String(limit),
      String(expireAt)
    ) as [number, number];

    return {
      allowed: result[0] === 1,
      currentCount: result[1],
      limit,
    };
  }

  /**
   * Core algorithm: Given a sender's hourly limit and an array of email positions,
   * compute the estimated send time for each email.
   *
   * This is the Smart Adaptive Scheduler logic:
   * - Fills current hour slots first
   * - Spills over into next hour(s) when limit is reached
   * - Respects minimum delay between sends
   */
  async computeEstimatedSendTimes(params: {
    senderId: string;
    senderHourlyLimit: number;
    totalEmails: number;
    startTime: Date;
    delayBetweenEmailsMs: number;
  }): Promise<Date[]> {
    const { senderId, senderHourlyLimit, totalEmails, startTime, delayBetweenEmailsMs } = params;

    const estimatedTimes: Date[] = [];
    let cursor = new Date(startTime);
    let hourSlotStart = new Date(cursor);
    hourSlotStart.setMinutes(0, 0, 0);

    // Get already-sent count in the starting hour
    let currentHourSent = await this.getCurrentCount(senderId, cursor);

    for (let i = 0; i < totalEmails; i++) {
      // Check if we've hit the hourly limit for the current hour window
      if (currentHourSent >= senderHourlyLimit) {
        // Move to next hour
        const nextHour = this.getNextHourStart(hourSlotStart);
        cursor = new Date(nextHour);
        hourSlotStart = new Date(nextHour);
        // Fetch count for the new hour (should be 0 unless already partially filled)
        currentHourSent = await this.getCurrentCount(senderId, cursor);
      }

      estimatedTimes.push(new Date(cursor));
      currentHourSent++;

      // Advance cursor by delay
      cursor = new Date(cursor.getTime() + Math.max(delayBetweenEmailsMs, 1000));
    }

    return estimatedTimes;
  }

  /**
   * Returns the remaining slots in the current hour for a sender.
   */
  async getRemainingSlots(senderId: string, limit: number): Promise<number> {
    const current = await this.getCurrentCount(senderId);
    return Math.max(0, limit - current);
  }
}

export const rateLimiter = new RateLimiter();
