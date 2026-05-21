import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateInsights(analysis) {
  const prompt = `
You are a UX expert analyzing form analytics data. Based on the data below, generate clear insights and specific fix suggestions for each problematic field.

Form Summary:
- Total sessions: ${analysis.summary.totalSessions}
- Completion rate: ${(analysis.summary.completionRate * 100).toFixed(1)}%
- Drop-off rate: ${(analysis.summary.dropOffRate * 100).toFixed(1)}%
- Return rate: ${(analysis.summary.returnRate * 100).toFixed(1)}%

Field Data (sorted by severity):
${analysis.fields
    .map(
      (f) => `
Field: ${f.field}
- Drop-off rate: ${(f.dropOffRate * 100).toFixed(1)}%
- Avg time spent: ${(f.avgTimeSpentMs / 1000).toFixed(1)}s
- Avg idle time: ${(f.avgIdleTimeMs / 1000).toFixed(1)}s
- Avg errors: ${f.avgErrorCount.toFixed(1)}
- Copy-paste rate: ${(f.copyPasteRate * 100).toFixed(1)}%
- Visibility rate: ${(f.visibilityRate * 100).toFixed(1)}%
- Possible reason: ${f.possibleReason}
`,
    )
    .join('\n')}

For each field that has issues (drop-off > 10% or avg errors > 1 or avg idle > 15s), respond with a JSON array:
[
  {
    "field": "field name",
    "insight": "Clear explanation of what's wrong in 1-2 sentences",
    "fix": "Specific actionable fix in 1-2 sentences",
    "why": "Why this fix will help in 1 sentence",
    "priority": "high | medium | low"
  }
]

Only respond with the JSON array, no extra text.
`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();
  return JSON.parse(text);
}
