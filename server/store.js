import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const dbPath = path.resolve(config.dbFile);

function ensureDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
}

export function saveSession(session) {
  ensureDb();
  const sessions = getAllSessions();
  const existing = sessions.findIndex((s) => s.sessionId === session.sessionId);
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.push(session);
  }
  fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2));
}

export function getAllSessions() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

export function getSessionsByFormId(formId) {
  return getAllSessions().filter((s) => s.formId === formId);
}
