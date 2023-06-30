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
  notFound: 404,
  limitReached: 401.1,
  expired: 401.2
};

// session record
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

// key record
db.run(`CREATE TABLE IF NOT EXISTS
  keys (
    id TEXT NOT NULL UNIQUE,
    name TEXT,
    total INT,
    remaining INT,
    created INT,
    expires INT
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
    db.get(`SELECT * FROM sessions WHERE id = ?`,
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

const addKey = (p) =>
  new Promise((resolve, reject) => {
    db.run(`INSERT INTO 
      keys (id, name, total, remaining, created, expires)
      VALUES (?,?,?,?,?,?)`,
      [p.id, p.name, p.count, p.count, Date.now(), p.expires],
      (err) => {
        if (err) reject(err);
        resolve(STAT.ok);
      }
    );
  }
);

const deleteKey = (key) =>
  new Promise((resolve, reject) => {
    db.run(`DELETE FROM keys WHERE id = ?`,
      [key],
      (err) => {
        if (err) reject(err);
        resolve(STAT.ok);
      }
    );
  }
);

const useKey = (key) =>
  new Promise((resolve, reject) => {
    db.get(`SELECT * FROM keys WHERE id = ?`,
      [key],
      (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(STAT.notFound);
        else if (row.expires < Date.now()) resolve(STAT.expired);
        else if (row.remaining < 1) resolve(STAT.limitReached);
        else {
          db.run(`UPDATE keys SET remaining = remaining - 1 WHERE id = ?`,
            [key],
            (err) => {
              if (err) reject(err);
              resolve(STAT.ok);
            }
          );
        }
      }
    );
  }
);

const checkKey = (key) =>
  new Promise((resolve, reject) => {
    db.get(`SELECT * FROM keys WHERE id = ?`,
      [key],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  }
);

const refundKey = (key) =>
  new Promise((resolve, reject) => {
    db.run(`UPDATE keys SET remaining = remaining + 1 WHERE id = ?`,
      [key],
      (err) => {
        if (err) reject(err);
        resolve(STAT.ok);
      }
    );
  }
);

const getAllKeys = () =>
  new Promise((resolve, reject) => {
    db.all(`SELECT * FROM keys`,
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  }
);

export default {
  STAT,
  saveSession, getSession, getAllSessions, existsMessageId,
  addKey, deleteKey, useKey, checkKey, refundKey, getAllKeys
}