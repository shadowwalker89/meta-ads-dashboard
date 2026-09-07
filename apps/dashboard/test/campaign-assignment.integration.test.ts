import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, runMigrations, createRepositories } from "@repo/database";
import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

describe("CampaignAssignment integration", () => {
  let db: ReturnType<typeof openDatabase>;
  let repos: ReturnType<typeof createRepositories>;

  before(() => {
    db = openDatabase(":memory:");
    runMigrations(db);
    repos = createRepositories(db);
  });

  after(() => {
    db.close();
  });

  // Helper to insert a client
  function insertClient(id: string, name: string) {
    db.prepare(
      `INSERT INTO clients (id, name, business_type, contact_email, package_id, package_assigned_at, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, "test", "test@example.com", "pkg1", new Date().toISOString(), 1, new Date().toISOString());
  }

  function insertUser(id: string, role: string) {
    db.prepare(
      `INSERT INTO users (id, role, full_name, email, client_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, role, "User", "user@example.com", null, new Date().toISOString());
  }

  function insertAdAccount(id: string, clientId: string, name: string) {
    db.prepare(
      `INSERT INTO ad_accounts (id, client_id, name, status, source, meta_ad_account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, clientId, name, "connected", "playwright", null, new Date().toISOString());
  }

  function insertCampaign(id: string, adAccountId: string, name: string) {
    db.prepare(
      `INSERT INTO campaigns (id, ad_account_id, name, objective, status, scraped_label, meta_campaign_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, adAccountId, name, "test", "active", null, null, new Date().toISOString());
  }

  it("should respect explicit assignment override and tenant isolation", async () => {
    const clientA = randomUUID();
    const clientB = randomUUID();
    const userA = randomUUID();
    const adAccountA = randomUUID();
    const adAccountB = randomUUID();
    const campaignX = randomUUID();

    insertClient(clientA, "Client A");
    insertClient(clientB, "Client B");
    insertUser(userA, "admin");
    insertAdAccount(adAccountA, clientA, "Ad Account A");
    insertAdAccount(adAccountB, clientB, "Ad Account B");
    insertCampaign(campaignX, adAccountB, "Campaign X");

    // Initially no assignment: campaign should belong to Client B (via AdAccount)
    let campaignsForA = await repos.campaignRepository.findByClient(clientA);
    assert.ok(!campaignsForA.map(c => c.id).includes(campaignX));
    let campaignsForB = await repos.campaignRepository.findByClient(clientB);
    assert.ok(campaignsForB.map(c => c.id).includes(campaignX));

    // Create assignment: Campaign X -> Client A
    await repos.campaignAssignmentRepository.create({
      campaignId: campaignX,
      clientId: clientA,
      assignedAt: new Date(),
      assignedBy: userA,
      isActive: true,
    });

    // Now Client A should see it, Client B should NOT (even though AdAccount is B)
    campaignsForA = await repos.campaignRepository.findByClient(clientA);
    assert.ok(campaignsForA.map(c => c.id).includes(campaignX));
    campaignsForB = await repos.campaignRepository.findByClient(clientB);
    assert.ok(!campaignsForB.map(c => c.id).includes(campaignX));

    // getEffectiveClientIdForCampaign should return Client A
    const effective = await repos.campaignAssignmentRepository.findActiveByCampaign(campaignX);
    assert.equal(effective?.clientId, clientA);
  });

  it("should enforce at most one active assignment per campaign", async () => {
    const clientA = randomUUID();
    const clientB = randomUUID();
    const userA = randomUUID();
    const adAccountA = randomUUID();
    const campaignY = randomUUID();

    insertClient(clientA, "Client A");
    insertClient(clientB, "Client B");
    insertUser(userA, "admin");
    insertAdAccount(adAccountA, clientA, "Ad Account A");
    insertCampaign(campaignY, adAccountA, "Campaign Y");

    // Create first active assignment
    await repos.campaignAssignmentRepository.create({
      campaignId: campaignY,
      clientId: clientA,
      assignedAt: new Date(),
      assignedBy: userA,
      isActive: true,
    });

    // Attempt to create second active assignment for same campaign should fail (unique index)
    try {
      await repos.campaignAssignmentRepository.create({
        campaignId: campaignY,
        clientId: clientB,
        assignedAt: new Date(),
        assignedBy: userA,
        isActive: true,
      });
      assert.fail("Expected create to throw");
    } catch (err) {
      assert.ok(err instanceof Error);
    }

    // Deactivate first, then second should succeed
    const active = await repos.campaignAssignmentRepository.findActiveByCampaign(campaignY);
    assert.ok(active !== null);
    await repos.campaignAssignmentRepository.deactivate(active!.id);

    const second = await repos.campaignAssignmentRepository.create({
      campaignId: campaignY,
      clientId: clientB,
      assignedAt: new Date(),
      assignedBy: userA,
      isActive: true,
    });
    assert.equal(second.clientId, clientB);
    assert.equal(second.isActive, true);
  });

  it("should fall back to AdAccount ownership when no assignment", async () => {
    const clientA = randomUUID();
    const adAccountA = randomUUID();
    const campaignZ = randomUUID();

    insertClient(clientA, "Client A");
    insertAdAccount(adAccountA, clientA, "Ad Account A");
    insertCampaign(campaignZ, adAccountA, "Campaign Z");

    const campaigns = await repos.campaignRepository.findByClient(clientA);
    assert.ok(campaigns.map(c => c.id).includes(campaignZ));
    // No assignment, so effective client should be AdAccount's client
    const effective = await repos.campaignAssignmentRepository.findActiveByCampaign(campaignZ);
    assert.equal(effective, null);
  });
});