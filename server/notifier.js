import https from 'https';
import http from 'http';
import { URL } from 'url';
import { config } from './config.js';

const lastAlerted = new Map();

function postWebhookOnce(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsed = new URL(webhookUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 8000,
      },
      (res) => { res.resume(); resolve(res.statusCode); },
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('webhook timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function postWebhook(webhookUrl, payload, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await postWebhookOnce(webhookUrl, payload);
    } catch (e) {
      if (attempt === retries) throw e;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 1000 * 2 ** attempt); });
    }
  }
  return null;
}

function bar(rate) {
  const filled = Math.round(rate * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildChecks(summary, thresholds) {
  const crashRate = summary.totalSessions
    ? (summary.errors?.suspectedCrashes || 0) / summary.totalSessions
    : 0;
  return [
    {
      key: 'dropOffRate',
      label: 'High Drop-off Rate',
      emoji: '⚠️',
      color: '#dc2626',
      value: summary.dropOffRate,
      threshold: thresholds.dropOffRate,
    },
    {
      key: 'errorRate',
      label: 'High Error Rate',
      emoji: '❌',
      color: '#ca8a04',
      value: summary.errorRate,
      threshold: thresholds.errorRate,
    },
    {
      key: 'bounceRate',
      label: 'High Bounce Rate',
      emoji: '💨',
      color: '#ea580c',
      value: summary.bounceRate,
      threshold: thresholds.bounceRate,
    },
    {
      key: 'completionRate',
      label: 'Low Completion Rate',
      emoji: '📉',
      color: '#7c3aed',
      value: 1 - summary.completionRate,
      threshold: 1 - thresholds.completionRate,
    },
    {
      key: 'crashRate',
      label: 'Crash Spike Detected',
      emoji: '💥',
      color: '#b91c1c',
      value: crashRate,
      threshold: thresholds.crashRate ?? 0.05,
    },
  ];
}

function buildPayload(check, formId, totalSessions) {
  const pct = (check.value * 100).toFixed(1);
  const thresholdPct = (check.threshold * 100).toFixed(0);
  const nowSec = Math.floor(Date.now() / 1000);
  const dashboardUrl = `${config.dashboardUrl}/analytics/index.html?form=${encodeURIComponent(formId)}`;

  return {
    attachments: [{
      color: check.color,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${check.emoji} ${check.label}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Form*\n\`${formId}\`` },
            { type: 'mrkdwn', text: `*Current Rate*\n${bar(check.value)} ${pct}%` },
            { type: 'mrkdwn', text: `*Threshold*\n${thresholdPct}%` },
            { type: 'mrkdwn', text: `*Sessions Analysed*\n${totalSessions}` },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🕐 <!date^${nowSec}^{date_short_pretty} at {time}|${new Date().toISOString()}>  ·  You won't receive this alert again for 1 hour.`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '📊 View Dashboard', emoji: true },
              url: dashboardUrl,
              style: 'primary',
            },
          ],
        },
      ],
    }],
  };
}

export async function sendWeeklyDigest(formSummaries) {
  if (!config.slack.webhookUrl) return;
  if (!formSummaries.length) return;

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() - 1);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const dateLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const rows = formSummaries.map(({ formId, summary }) => {
    const name = formId.split('/').filter(Boolean).pop() || formId;
    const completion = `${(summary.completionRate * 100).toFixed(0)}%`;
    const sessions = summary.totalSessions;
    const errors = (summary.errors?.jsErrors || 0) + (summary.errors?.apiErrors || 0);
    const flag = summary.completionRate < 0.3 || errors > 5 ? ' ⚠️' : '';
    return `• *${name}*${flag}  —  ${sessions} sessions · ${completion} completion · ${errors} errors`;
  });

  const totalSessions = formSummaries.reduce((s, f) => s + f.summary.totalSessions, 0);

  const payload = {
    attachments: [{
      color: '#0070f3',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `📊 Weekly Form Digest — ${dateLabel}`, emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${formSummaries.length} form${formSummaries.length !== 1 ? 's' : ''} · ${totalSessions} total sessions yesterday*\n\n${rows.join('\n')}`,
          },
        },
        {
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: '📊 Open Dashboard', emoji: true },
            url: `${config.dashboardUrl}/analytics/index.html`,
            style: 'primary',
          }],
        },
      ],
    }],
  };

  try {
    await postWebhook(config.slack.webhookUrl, payload);
    console.log(`[notifier] Weekly digest sent — ${formSummaries.length} forms`);
  } catch (e) {
    console.error(`[notifier] Digest error: ${e.message}`);
  }
}

export async function checkThresholds(formId, analysis) {
  if (!analysis?.ready) return;
  if (!config.slack.webhookUrl) return;

  const { summary } = analysis;
  const now = Date.now();
  const checks = buildChecks(summary, config.slack.thresholds);

  for (const check of checks) {
    if (check.value === undefined || check.value === null) continue;
    if (check.value < check.threshold) continue;

    const key = `slack::${formId}::${check.key}`;
    const lastSent = lastAlerted.get(key) ?? 0;
    if (now - lastSent < config.slack.alertCooldownMs) continue;

    lastAlerted.set(key, now);
    const payload = buildPayload(check, formId, summary.totalSessions);
    postWebhook(config.slack.webhookUrl, payload)
      .then(() => console.log(`[notifier] Slack — ${check.key} for ${formId}`))
      .catch((e) => console.error(`[notifier] Slack error: ${e.message}`));
  }
}
