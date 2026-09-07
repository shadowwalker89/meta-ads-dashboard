-- CampaignAssignment table for explicit client ownership of campaigns.
-- At most one active assignment per campaign is enforced by a partial unique index.
CREATE TABLE campaign_assignments (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL,
    assigned_by TEXT NOT NULL REFERENCES users(id),
    is_active INTEGER NOT NULL DEFAULT 1
);

-- Ensure only one active assignment per campaign
CREATE UNIQUE INDEX idx_campaign_assignments_active_unique
ON campaign_assignments (campaign_id)
WHERE is_active = 1;

CREATE INDEX idx_campaign_assignments_client_active
ON campaign_assignments (client_id, is_active);