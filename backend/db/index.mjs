import sqlite3 from 'sqlite3';
import { log } from '../utils/logging.mjs';

const db = new sqlite3.Database(
  process.env.DB_PATH || (
    log.warn('Database not specified, using lastjourney.db') ||
    'lastjourney.db'
  )
);

const STAT = {
  ok: 201,
  badRequest: 400,
  unavailable: 409,
  nonexistent: 404
};

db.run(`CREATE TABLE IF NOT EXISTS
  sessions (
    id TEXT NOT NULL UNIQUE,
    type TEXT,
    prompt TEXT,
    messageId TEXT,
    customId TEXT,
    imageUrl TEXT,
    timestamp INT
  )`
);

const saveSession = (s) =>
  new Promise((resolve, reject) => {
    db.run(`INSERT INTO 
      sessions (id, type, prompt, messageId, customId, imageUrl, timestamp)
      VALUES (?,?,?,?,?,?,?)`,
      [s.id, s.type, s.prompt, s.messageId, s.customId, s.hereUrl, Date.now()],
      (err) => {
        if (err) reject(err);
        resolve(STAT.ok);
      }
    );
  }
);

const getSession = (id) =>
  new Promise((resolve, reject) => {
    db.get(`SELECT *
      FROM sessions
      WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  }
);

const getAllSessions = () =>
  new Promise((resolve, reject) => {
    db.all(`SELECT * FROM sessions`,
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  }
);

const existsMessageId = (messageId) =>
  new Promise((resolve, reject) => {
    db.get(`SELECT *
      FROM sessions
      WHERE messageId = ?`,
      [messageId],
      (err, row) => {
        if (err) reject(err);
        if (row) resolve(true);
        else resolve(false);
      }
    );
  }
);

export default {
  saveSession, getSession, getAllSessions, existsMessageId
}