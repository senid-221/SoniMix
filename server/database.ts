import { createHash, randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { statSync } from 'node:fs';
import { DATA_ROOT, resolveDataFile } from './lib.js';

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 14;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export class SoniMixDatabase {
  private readonly db: DatabaseSync;

  private constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects(user_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL, state TEXT NOT NULL, payload TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_user_created_idx ON jobs(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL, title TEXT NOT NULL, format TEXT NOT NULL, file_size INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        preferences TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_id TEXT, file_size INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_settings (id INTEGER PRIMARY KEY CHECK(id = 1), config TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS brand_assets (filename TEXT PRIMARY KEY, content_type TEXT NOT NULL, data BLOB NOT NULL, created_at INTEGER NOT NULL);
    `);
    const googleColumns = this.db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    if (!googleColumns.some((column) => column.name === 'google_sub')) this.db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub) WHERE google_sub IS NOT NULL');
    const userColumns = this.db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    if (!userColumns.some((column) => column.name === 'status')) this.db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    const fileColumns = this.db.prepare('PRAGMA table_info(files)').all() as Array<{ name: string }>;
    if (!fileColumns.some((column) => column.name === 'file_size')) this.db.exec('ALTER TABLE files ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0');
    this.db.prepare("UPDATE jobs SET state = 'failed', updated_at = ? WHERE state IN ('queued', 'processing')").run(new Date().toISOString());
    this.bootstrapAdmin();
  }

  static async open() {
    const directory = path.join(DATA_ROOT, 'database');
    await mkdir(directory, { recursive: true });
    return new SoniMixDatabase(path.join(directory, 'sonimix.sqlite'));
  }

  private bootstrapAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    if (password.length < 14) throw new Error('ADMIN_PASSWORD must be at least 14 characters');
    const existing = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (existing) {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      this.db.prepare("UPDATE users SET role = 'admin', status = 'active', password_salt = ?, password_hash = ? WHERE id = ?").run(salt, hash, existing.id);
      return;
    }
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    this.db.prepare('INSERT INTO users (id, name, email, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(randomUUID(), 'SoniMix Administrator', email, salt, hash, 'admin', Date.now());
  }

  private async hashPassword(password: string, salt: string) {
    return Buffer.from(await scrypt(password, salt, 64) as Buffer).toString('hex');
  }

  private sessionToken() { return randomBytes(32).toString('base64url'); }
  private tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async register(name: string, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address');
    if (password.length < 12 || password.length > 256) throw new Error('Password must contain 12 to 256 characters');
    if (name.trim().length < 2 || name.trim().length > 80) throw new Error('Name must contain 2 to 80 characters');
    const salt = randomBytes(16).toString('hex');
    const hash = await this.hashPassword(password, salt);
    const user: SessionUser = { id: randomUUID(), name: name.trim(), email: normalizedEmail, role: 'user', createdAt: Date.now() };
    try {
      this.db.prepare('INSERT INTO users (id, name, email, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(user.id, user.name, user.email, salt, hash, user.role, user.createdAt);
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new Error('An account with this email already exists');
      throw error;
    }
    return { user, token: this.createSession(user.id) };
  }

  private createSession(userId: string) {
    const token = this.sessionToken();
    const now = Date.now();
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(this.tokenHash(token), userId, now + SESSION_LIFETIME_MS, now);
    return token;
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const row = this.db.prepare("SELECT id, name, email, role, created_at AS createdAt, password_salt, password_hash FROM users WHERE email = ? AND status = 'active'")
      .get(normalizedEmail) as (SessionUser & { password_salt: string; password_hash: string }) | undefined;
    const salt = row?.password_salt || randomBytes(16).toString('hex');
    const candidate = await this.hashPassword(password, salt);
    const expected = Buffer.from(row?.password_hash || '0'.repeat(128), 'hex');
    const actual = Buffer.from(candidate, 'hex');
    if (!row || !timingSafeEqual(expected, actual)) throw new Error('Email or password is incorrect');
    const user: SessionUser = { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.createdAt };
    return { user, token: this.createSession(user.id) };
  }

  loginGoogle(identity: { subject: string; email: string; name: string }) {
    const email = identity.email.trim().toLowerCase();
    const subject = identity.subject.trim();
    const name = identity.name.trim().slice(0, 80) || email.split('@')[0];
    if (!subject || subject.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Google returned an invalid account identity');
    let row = this.db.prepare("SELECT id, name, email, role, status, created_at AS createdAt, google_sub AS googleSub FROM users WHERE google_sub = ?").get(subject) as (SessionUser & { status: string; googleSub: string | null }) | undefined;
    if (!row) {
      row = this.db.prepare("SELECT id, name, email, role, status, created_at AS createdAt, google_sub AS googleSub FROM users WHERE email = ?").get(email) as (SessionUser & { status: string; googleSub: string | null }) | undefined;
      if (row?.googleSub && row.googleSub !== subject) throw new Error('This account is linked to a different Google identity');
      if (row) this.db.prepare('UPDATE users SET google_sub = ? WHERE id = ? AND google_sub IS NULL').run(subject, row.id);
    }
    if (!row) {
      const user: SessionUser = { id: randomUUID(), name, email, role: 'user', createdAt: Date.now() };
      const salt = randomBytes(16).toString('hex');
      const randomPasswordHash = randomBytes(64).toString('hex');
      this.db.prepare('INSERT INTO users (id, name, email, password_salt, password_hash, role, status, created_at, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(user.id, user.name, user.email, salt, randomPasswordHash, user.role, 'active', user.createdAt, subject);
      return { user, token: this.createSession(user.id) };
    }
    if (row.status !== 'active') throw new Error('This account is suspended');
    return { user: { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.createdAt }, token: this.createSession(row.id) };
  }

  getSession(token: string | undefined): SessionUser | null {
    if (!token) return null;
    const row = this.db.prepare(`SELECT u.id, u.name, u.email, u.role, u.created_at AS createdAt
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`)
      .get(this.tokenHash(token), Date.now()) as SessionUser | undefined;
    if (!row) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(this.tokenHash(token));
    return row || null;
  }

  revokeSession(token: string | undefined) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(this.tokenHash(token));
  }

  getProfile(userId: string) {
    const profile = this.db.prepare(`SELECT u.id, u.name, u.email, u.role, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projectCount,
      (SELECT COUNT(*) FROM exports e WHERE e.user_id = u.id) AS exportCount,
      (SELECT COALESCE(SUM(f.file_size), 0) FROM files f WHERE f.user_id = u.id) AS storageBytes
      FROM users u WHERE u.id = ?`).get(userId) as Record<string, unknown> | undefined;
    const settings = this.db.prepare('SELECT preferences FROM user_preferences WHERE user_id = ?').get(userId) as { preferences: string } | undefined;
    return profile ? { ...profile, preferences: settings ? JSON.parse(settings.preferences) : {} } : undefined;
  }

  savePreferences(userId: string, preferences: Record<string, unknown>) {
    const allowedRates = [22050, 32000, 44100, 48000, 88200, 96000];
    if (preferences.defaultSampleRate !== undefined && !allowedRates.includes(Number(preferences.defaultSampleRate))) throw new Error('Unsupported default sample rate');
    if (preferences.defaultTargetLufs !== undefined && (!Number.isFinite(Number(preferences.defaultTargetLufs)) || Number(preferences.defaultTargetLufs) < -24 || Number(preferences.defaultTargetLufs) > -8)) throw new Error('Target loudness must be between -24 and -8 LUFS');
    if (preferences.defaultBitDepth !== undefined && ![16, 24].includes(Number(preferences.defaultBitDepth))) throw new Error('Bit depth must be 16 or 24');
    const current = this.getProfile(userId)?.preferences as Record<string, unknown> || {};
    const updated = { ...current, defaultSampleRate: preferences.defaultSampleRate ?? current.defaultSampleRate ?? 48000, defaultTargetLufs: preferences.defaultTargetLufs ?? current.defaultTargetLufs ?? -14, defaultBitDepth: preferences.defaultBitDepth ?? current.defaultBitDepth ?? 24, autoSaveEnabled: preferences.autoSaveEnabled === undefined ? current.autoSaveEnabled ?? true : Boolean(preferences.autoSaveEnabled) };
    this.db.prepare(`INSERT INTO user_preferences (user_id, preferences, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET preferences = excluded.preferences, updated_at = excluded.updated_at`).run(userId, JSON.stringify(updated), Date.now());
    return updated;
  }

  listUsers() {
    return this.db.prepare(`SELECT u.id, u.name, u.email, u.role, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects,
      (SELECT COUNT(*) FROM exports e WHERE e.user_id = u.id) AS exports,
      (SELECT COALESCE(SUM(f.file_size), 0) FROM files f WHERE f.user_id = u.id) AS storageBytes,
      u.status,
      (SELECT MAX(created_at) FROM sessions s WHERE s.user_id = u.id) AS lastSeen
      FROM users u ORDER BY u.created_at DESC`).all() as Array<Record<string, unknown>>;
  }

  getAppConfig() {
    const row = this.db.prepare('SELECT config FROM app_settings WHERE id = 1').get() as { config: string } | undefined;
    return row ? JSON.parse(row.config) as Record<string, unknown> : null;
  }

  saveBrandAsset(filename: string, contentType: string, data: Buffer) {
    this.db.prepare('INSERT INTO brand_assets (filename, content_type, data, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(filename) DO UPDATE SET content_type = excluded.content_type, data = excluded.data')
      .run(filename, contentType, data, Date.now());
  }

  getBrandAsset(filename: string) {
    return this.db.prepare('SELECT content_type, data FROM brand_assets WHERE filename = ?').get(filename) as { content_type: string; data: Uint8Array } | undefined;
  }

  saveAppConfig(config: Record<string, unknown>) {
    this.db.prepare(`INSERT INTO app_settings (id, config, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`).run(JSON.stringify(config), Date.now());
  }

  saveProject(userId: string, id: string | undefined, name: string, metadata: Record<string, unknown> = {}) {
    const cleanName = name.trim();
    if (cleanName.length < 1 || cleanName.length > 120) throw new Error('Project name must contain 1 to 120 characters');
    const now = Date.now();
    const projectId = id || randomUUID();
    const existing = id ? this.db.prepare('SELECT id, created_at FROM projects WHERE id = ? AND user_id = ?').get(id, userId) as { id: string; created_at: number } | undefined : undefined;
    if (id && !existing) throw new Error('Project not found');
    this.db.prepare(`INSERT INTO projects (id, user_id, name, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, metadata = excluded.metadata, updated_at = excluded.updated_at WHERE projects.user_id = excluded.user_id`)
      .run(projectId, userId, cleanName, JSON.stringify(metadata), existing?.created_at || now, now);
    return this.getProject(userId, projectId)!;
  }

  getProject(userId: string, id: string) {
    const row = this.db.prepare('SELECT id, name, metadata, created_at AS createdAt, updated_at AS updatedAt FROM projects WHERE id = ? AND user_id = ?')
      .get(id, userId) as ({ metadata: string } & Record<string, unknown>) | undefined;
    return row ? { ...row, metadata: JSON.parse(row.metadata) as Record<string, unknown> } : null;
  }

  listProjects(userId: string) {
    return (this.db.prepare('SELECT id, name, metadata, created_at AS createdAt, updated_at AS updatedAt FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId) as Array<{ metadata: string } & Record<string, unknown>>).map((row) => ({ ...row, metadata: JSON.parse(row.metadata) as Record<string, unknown> }));
  }

  deleteProject(userId: string, id: string) {
    return this.db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  }

  saveJob(job: { id: string; userId: string; type: string; state: string; createdAt: string; updatedAt: string }, payload: Record<string, unknown>) {
    this.db.prepare(`INSERT INTO jobs (id, user_id, type, state, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET state = excluded.state, payload = excluded.payload, updated_at = excluded.updated_at`)
      .run(job.id, job.userId, job.type, job.state, JSON.stringify(payload), job.createdAt, job.updatedAt);
    const outputs = Array.isArray(payload.outputs) ? payload.outputs.filter((output): output is string => typeof output === 'string') : [];
    const insertFile = this.db.prepare('INSERT INTO files (path, user_id, job_id, file_size, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET user_id = excluded.user_id, job_id = excluded.job_id, file_size = excluded.file_size');
    for (const file of outputs) {
      let size = 0;
      try { size = statSync(resolveDataFile(file)).size; } catch {}
      insertFile.run(file, job.userId, job.id, size, Date.now());
    }
  }

  registerUpload(userId: string, file: string, fileSize: number) {
    this.db.prepare('INSERT INTO files (path, user_id, file_size, created_at) VALUES (?, ?, ?, ?)').run(file, userId, fileSize, Date.now());
  }

  canAccessFile(userId: string, file: string, isAdmin = false) {
    if (isAdmin) return true;
    return Boolean(this.db.prepare('SELECT 1 FROM files WHERE path = ? AND user_id = ?').get(file, userId));
  }

  addExport(userId: string, file: string, title: string, format: string, fileSize: number) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO exports (id, user_id, file_path, title, format, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, file, title.slice(0, 160), format.slice(0, 40), fileSize, Date.now());
    return id;
  }

  listExports(userId: string) {
    return this.db.prepare('SELECT id, file_path AS filePath, title, format, file_size AS fileSize, created_at AS timestamp FROM exports WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId) as Array<Record<string, unknown>>;
  }

  updateUser(id: string, change: { role?: 'user' | 'admin'; status?: 'active' | 'suspended' }, currentAdminId: string) {
    if (id === currentAdminId && change.status === 'suspended') throw new Error('You cannot suspend your own account');
    const allowed = Object.entries(change).filter(([key, value]) => ['role', 'status'].includes(key) && value !== undefined);
    if (!allowed.length) throw new Error('No supported user changes were provided');
    const assignments = allowed.map(([key]) => `${key} = ?`).join(', ');
    const values = allowed.map(([, value]) => value);
    return this.db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(...values, id).changes > 0;
  }

  getJob(userId: string, id: string) {
    const row = this.db.prepare('SELECT payload, state FROM jobs WHERE id = ? AND user_id = ?').get(id, userId) as { payload: string; state: string } | undefined;
    return row ? { ...JSON.parse(row.payload) as Record<string, unknown>, state: row.state } : null;
  }

  listJobs(userId: string) {
    return (this.db.prepare('SELECT payload, state FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId) as Array<{ payload: string; state: string }>).map((row) => ({ ...JSON.parse(row.payload) as Record<string, unknown>, state: row.state }));
  }

  close() { this.db.close(); }
}
