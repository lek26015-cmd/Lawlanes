-- D1 Schema for LawsLane: Legal Practice & Billing

-- Cases Table: Tracks active and past legal matters
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    lawyer_id TEXT NOT NULL, -- References users.id
    client_id TEXT NOT NULL, -- References users.id
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, drafting, in-court, closed
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
    metadata TEXT, -- JSON for additional case details
    
    FOREIGN KEY (lawyer_id) REFERENCES users(id),
    FOREIGN KEY (client_id) REFERENCES users(id)
);

-- Milestones Table: Breaks down cases into billable or trackable tasks
CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed
    dueDate INTEGER,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Invoices Table: Handles billing for cases and milestones
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    milestone_id TEXT, -- Optional: link to a specific milestone
    client_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'THB',
    status TEXT DEFAULT 'pending', -- pending, paid, overdue
    due_date INTEGER NOT NULL,
    paidAt INTEGER,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (milestone_id) REFERENCES milestones(id),
    FOREIGN KEY (client_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_lawyerId ON cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_clientId ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_milestones_caseId ON milestones(case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_caseId ON invoices(case_id);
