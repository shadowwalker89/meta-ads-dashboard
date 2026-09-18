-- 002_add_campaign_assignments_pg.sql
-- CampaignAssignment table for explicit client ownership of campaigns.
-- At most one active assignment per campaign is enforced by a partial unique index.

CREATE TABLE campaign_assignments (
    id                  UUID PRIMARY KEY,
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_at         TIMESTAMPTZ NOT NULL,
    assigned_by         UUID NOT NULL REFERENCES users(id),
    is_active           BOOLEAN NOT NULL DEFAULT true
);

-- Ensure only one active assignment per campaign
CREATE UNIQUE INDEX idx_campaign_assignments_active_unique
ON campaign_assignments (campaign_id)
WHERE is_active = true;

-- Client/active lookup index
CREATE INDEX idx_campaign_assignments_client_active
ON campaign_assignments (client_id, is_active);
