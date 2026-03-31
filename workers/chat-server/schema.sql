-- D1 Schema for Lawslane Chat

CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    participants TEXT, -- JSON array of user IDs
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    caseTitle TEXT,
    status TEXT DEFAULT 'active',
    lastMessage TEXT,
    lastMessageAt INTEGER,
    hasNewMessage INTEGER DEFAULT 0, -- 0 for false, 1 for true
    lawyerReadAt INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chatId TEXT,
    text TEXT,
    senderId TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (chatId) REFERENCES chats(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);

CREATE TABLE IF NOT EXISTS user_keys (
    userId TEXT PRIMARY KEY,
    publicKey TEXT, -- Base64 encoded SPKI
    updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
);
