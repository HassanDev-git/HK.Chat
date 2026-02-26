const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'hkchat.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ========================
// CREATE TABLES
// ========================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    unique_id TEXT UNIQUE NOT NULL,
    about TEXT DEFAULT 'Hey there! I am using HK Chat',
    profile_pic TEXT DEFAULT NULL,
    phone TEXT DEFAULT '',
    is_online INTEGER DEFAULT 0,
    last_seen TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    last_seen_visibility TEXT DEFAULT 'everyone',
    profile_photo_visibility TEXT DEFAULT 'everyone',
    about_visibility TEXT DEFAULT 'everyone',
    read_receipts INTEGER DEFAULT 1,
    notifications INTEGER DEFAULT 1,
    notification_sound TEXT DEFAULT 'default',
    theme TEXT DEFAULT 'light',
    wallpaper TEXT DEFAULT '',
    font_size TEXT DEFAULT 'medium',
    enter_to_send INTEGER DEFAULT 1,
    media_auto_download TEXT DEFAULT 'wifi',
    blocked_users TEXT DEFAULT '[]',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT 'private' CHECK(type IN ('private', 'group')),
    name TEXT DEFAULT NULL,
    description TEXT DEFAULT '',
    group_pic TEXT DEFAULT NULL,
    created_by INTEGER,
    is_archived INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_muted INTEGER DEFAULT 0,
    mute_until TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
    is_archived INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_muted INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'location', 'contact', 'system')),
    content TEXT DEFAULT '',
    file_url TEXT DEFAULT NULL,
    file_name TEXT DEFAULT NULL,
    file_size INTEGER DEFAULT NULL,
    file_type TEXT DEFAULT NULL,
    thumbnail_url TEXT DEFAULT NULL,
    duration INTEGER DEFAULT NULL,
    reply_to INTEGER DEFAULT NULL,
    forwarded_from INTEGER DEFAULT NULL,
    is_forwarded INTEGER DEFAULT 0,
    is_starred INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    is_edited INTEGER DEFAULT 0,
    delivered_to TEXT DEFAULT '[]',
    read_by TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    edited_at TEXT DEFAULT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (reply_to) REFERENCES messages(id)
  );

  CREATE TABLE IF NOT EXISTS starred_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'video')),
    content TEXT DEFAULT '',
    background_color TEXT DEFAULT '#128C7E',
    font_style TEXT DEFAULT 'normal',
    file_url TEXT DEFAULT NULL,
    thumbnail_url TEXT DEFAULT NULL,
    caption TEXT DEFAULT '',
    viewers TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT DEFAULT (datetime('now', '+24 hours')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    nickname TEXT DEFAULT NULL,
    is_blocked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, contact_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
  CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON statuses(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS group_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    max_uses INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    expires_at TEXT DEFAULT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_group_invites_code ON group_invites(invite_code);
  CREATE INDEX IF NOT EXISTS idx_group_invites_chat ON group_invites(chat_id);
`);

module.exports = db;
