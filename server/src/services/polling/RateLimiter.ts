/**
 * Rate limiter for SwitchBot API.
 * Tracks daily API usage and warns at 80% of the 10k/day limit.
 */
export class RateLimiter {
  private dailyLimit: number;
  private warningThreshold: number;
  private requestCount = 0;
  private lastResetDate: string;
  private warningLogged = false;

  constructor(dailyLimit = 10000, warningThreshold = 0.8) {
    this.dailyLimit = dailyLimit;
    this.warningThreshold = warningThreshold;
    this.lastResetDate = this.getTodayDate();
  }

  /**
   * Check if a request can be made. Resets counter if it's a new day.
   */
  canMakeRequest(): boolean {
    this.resetIfNewDay();
    return this.requestCount < this.dailyLimit;
  }

  /**
   * Record a request. Returns false if limit exceeded.
   */
  recordRequest(): boolean {
    this.resetIfNewDay();

    if (this.requestCount >= this.dailyLimit) {
      console.error('[RateLimiter] Daily limit exceeded! Skipping request.');
      return false;
    }

    this.requestCount++;

    // Check warning threshold
    const usagePercent = this.requestCount / this.dailyLimit;
    if (usagePercent >= this.warningThreshold && !this.warningLogged) {
      console.warn(
        `[RateLimiter] Warning: ${Math.round(usagePercent * 100)}% of daily limit used ` +
        `(${this.requestCount}/${this.dailyLimit})`
      );
      this.warningLogged = true;
    }

    return true;
  }

  /**
   * Get current usage statistics.
   */
  getStats(): { count: number; limit: number; remaining: number; percentUsed: number } {
    this.resetIfNewDay();
    return {
      count: this.requestCount,
      limit: this.dailyLimit,
      remaining: this.dailyLimit - this.requestCount,
      percentUsed: Math.round((this.requestCount / this.dailyLimit) * 100),
    };
  }

  /**
   * Reset the counter if it's a new day.
   */
  private resetIfNewDay(): void {
    const today = this.getTodayDate();
    if (today !== this.lastResetDate) {
      console.log(`[RateLimiter] New day, resetting counter (was: ${this.requestCount})`);
      this.requestCount = 0;
      this.lastResetDate = today;
      this.warningLogged = false;
    }
  }

  /**
   * Get today's date as a string for comparison.
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
