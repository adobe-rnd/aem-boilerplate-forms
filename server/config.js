export const config = {
  isDevelopment: true,
  get minSessions() {
    return this.isDevelopment ? 1 : 30;
  },
  port: Number(process.env.PORT) || 3000,
  dbFile: './server/data/sessions.json',

  dashboardUrl: process.env.DASHBOARD_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    alertCooldownMs: Number(process.env.SLACK_COOLDOWN_MS) || 60 * 60 * 1000,

    thresholds: {
      dropOffRate:    Number(process.env.THRESHOLD_DROP_OFF)    || 0.5,
      errorRate:      Number(process.env.THRESHOLD_ERROR_RATE)  || 0.3,
      bounceRate:     Number(process.env.THRESHOLD_BOUNCE_RATE) || 0.4,
      completionRate: Number(process.env.THRESHOLD_COMPLETION)  || 0.3,
      crashRate:      Number(process.env.THRESHOLD_CRASH_RATE)  || 0.05,
    },
    digestHour: Number(process.env.DIGEST_HOUR ?? 9), // 9 AM local time by default
  },

};
