import { config } from './config.js';

function getPossibleReason(stats) {
  if (stats.avgIdleTimeMs > 30000) return 'Possibly confused — users idle for long time on this field';
  if (stats.avgErrorCount > 2) return 'Possibly unclear validation — users making repeated errors';
  if (stats.dropOffRate > 0.5 && stats.avgTimeSpentMs < 5000) return 'Possibly too long or trust issue — users leaving quickly';
  if (stats.copyPasteRate > 0.5) return 'Possibly had to look up info — many users copy-pasted';
  if (stats.visibilityRate < 0.4) return 'Possibly never seen — many users did not scroll to this field';
  if (stats.avgTimeSpentMs > 60000) return 'Possibly confusing — users spending too long on this field';
  return 'No strong signal detected';
}

export function analyzeSessions(sessions) {
  if (sessions.length < config.minSessions) {
    return {
      ready: false,
      message: `Need at least ${config.minSessions} sessions. Currently have ${sessions.length}.`,
    };
  }

  const totalSessions = sessions.length;
  const completed = sessions.filter((s) => s.events.some((e) => e.type === 'form_submit')).length;
  const abandoned = sessions.filter((s) => s.events.some((e) => e.type === 'form_abandon')).length;
  const returned = sessions.filter((s) => s.returned).length;

  // aggregate per-field stats
  const fieldMap = {};

  sessions.forEach((session) => {
    const blurEvents = session.events.filter((e) => e.type === 'field_blur');
    const abandonEvent = session.events.find((e) => e.type === 'form_abandon');
    const submitEvent = session.events.find((e) => e.type === 'form_submit');

    blurEvents.forEach((blur) => {
      const { field } = blur;
      if (!fieldMap[field]) {
        fieldMap[field] = {
          field,
          totalInteractions: 0,
          dropOffCount: 0,
          totalTimeSpentMs: 0,
          totalIdleTimeMs: 0,
          totalErrors: 0,
          copyPasteCount: 0,
          visibleCount: 0,
          totalVisitCount: 0,
        };
      }

      const f = fieldMap[field];
      f.totalInteractions += 1;
      f.totalTimeSpentMs += blur.timeSpentMs || 0;
      f.totalIdleTimeMs += blur.idleTimeMs || 0;
      f.totalErrors += blur.errorCount || 0;
      f.totalVisitCount += blur.visitCount || 1;
      if (blur.copyPasted) f.copyPasteCount += 1;

      // count as drop-off if session was abandoned and this was the last field
      if (abandonEvent && !submitEvent) {
        const lastBlur = blurEvents[blurEvents.length - 1];
        if (lastBlur.field === field) f.dropOffCount += 1;
      }
    });

    // track visibility
    session.events
      .filter((e) => e.type === 'field_visible')
      .forEach((e) => {
        if (fieldMap[e.field]) fieldMap[e.field].visibleCount += 1;
      });
  });

  const fields = Object.values(fieldMap).map((f) => {
    const stats = {
      field: f.field,
      dropOffRate: f.dropOffCount / totalSessions,
      avgTimeSpentMs: f.totalInteractions ? f.totalTimeSpentMs / f.totalInteractions : 0,
      avgIdleTimeMs: f.totalInteractions ? f.totalIdleTimeMs / f.totalInteractions : 0,
      avgErrorCount: f.totalInteractions ? f.totalErrors / f.totalInteractions : 0,
      copyPasteRate: f.totalInteractions ? f.copyPasteCount / f.totalInteractions : 0,
      visibilityRate: totalSessions ? f.visibleCount / totalSessions : 0,
      avgVisitCount: f.totalInteractions ? f.totalVisitCount / f.totalInteractions : 1,
    };
    stats.severityScore = stats.dropOffRate * 3 + (stats.avgErrorCount / 5) + (stats.avgIdleTimeMs / 60000);
    stats.possibleReason = getPossibleReason(stats);
    return stats;
  });

  fields.sort((a, b) => b.severityScore - a.severityScore);

  return {
    ready: true,
    summary: {
      totalSessions,
      completionRate: completed / totalSessions,
      dropOffRate: abandoned / totalSessions,
      returnRate: returned / totalSessions,
    },
    fields,
  };
}
