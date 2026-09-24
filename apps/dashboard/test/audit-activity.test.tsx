import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  openDatabase,
  runMigrations,
  SqliteAdminAssignmentRepository,
  SqliteAuditLogRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { Package, User, UserRole } from "@repo/shared";
import { AUDIT_ACTIONS } from "@/lib/audit";
import {
  getAuditActionLabel,
  getClientAuditActivity,
} from "@/lib/audit-activity";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { DASHBOARD_STRINGS } from "@/lib/i18n/strings";

type Db = ReturnType<typeof openDatabase>;

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(db: Db, code = "gold"): Promise<Package> {
  return new SqlitePackageRepository(db).create({
    name: "Gold",
    description: "Gold plan",
    code,
    collectionFrequency: 1,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: null,
    defaultVisibleKpis: [],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
  });
}

async function createClient(db: Db, packageId: string, name = "Acme") {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "E-commerce",
    contactEmail: `${name.toLowerCase()}@example.com`,
    packageId,
    isActive: true,
  });
}

async function createUser(
  db: Db,
  role: UserRole,
  clientId: string | null = null
): Promise<User> {
  return new SqliteUserRepository(db).create({
    role,
    fullName: `${role} Test`,
    email: `${role}-${Math.random().toString(36).slice(2)}@example.com`,
    clientId,
  });
}

function actor(user: User) {
  return { role: user.role, id: user.id, clientId: user.clientId };
}

test("audit activity: authorized admin reads client-targeted audit entries with actor names", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Acme");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, client.id);
  const actorUser = await createUser(db, "super_admin");

  await new SqliteAuditLogRepository(db).append({
    actorUserId: actorUser.id,
    action: AUDIT_ACTIONS.CLIENT_UPDATED,
    targetEntityType: "client",
    targetEntityId: client.id,
    metadata: {
      name: "Acme Renamed",
      previousName: "Acme",
      isActive: true,
      previousIsActive: true,
    },
  });

  const page = await getClientAuditActivity(actor(admin), client.id, "en", { limit: 10 }, db);
  assert.equal(page.entries.length, 1);
  assert.equal(page.nextCursor, null);
  assert.equal(page.entries[0].actionLabel, DASHBOARD_STRINGS.en.auditActionClientUpdated);
  assert.equal(page.entries[0].actorName, actorUser.fullName);
  assert.match(page.entries[0].metadataSummary ?? "", /Acme/);

  db.close();
});

test("audit activity: admin cannot read another client's audit history by changing the URL", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const assignedClient = await createClient(db, pkg.id, "Assigned");
  const otherClient = await createClient(db, pkg.id, "Other");
  const admin = await createUser(db, "admin");
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, assignedClient.id);
  const actorUser = await createUser(db, "super_admin");

  await new SqliteAuditLogRepository(db).append({
    actorUserId: actorUser.id,
    action: AUDIT_ACTIONS.CLIENT_CREATED,
    targetEntityType: "client",
    targetEntityId: otherClient.id,
    metadata: { name: "Other", packageId: pkg.id },
  });

  await assert.rejects(
    () => getClientAuditActivity(actor(admin), otherClient.id, "en", { limit: 10 }, db),
    /اجازه/
  );

  db.close();
});

test("audit activity: super_admin can read any client's audit history", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Acme");
  const superUser = await createUser(db, "super_admin");

  await new SqliteAuditLogRepository(db).append({
    actorUserId: superUser.id,
    action: AUDIT_ACTIONS.PACKAGE_ASSIGNED,
    targetEntityType: "client",
    targetEntityId: client.id,
    metadata: { previousPackageId: null, packageId: pkg.id },
  });

  const page = await getClientAuditActivity(actor(superUser), client.id, "fa", { limit: 10 }, db);
  assert.equal(page.entries.length, 1);
  assert.equal(page.entries[0].actionLabel, DASHBOARD_STRINGS.fa.auditActionPackageAssigned);

  db.close();
});

test("audit activity: pagination returns a cursor until the last page has none", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const client = await createClient(db, pkg.id, "Acme");
  const superUser = await createUser(db, "super_admin");
  const auditRepo = new SqliteAuditLogRepository(db);

  for (let index = 0; index < 3; index++) {
    await auditRepo.append({
      actorUserId: superUser.id,
      action: AUDIT_ACTIONS.CLIENT_UPDATED,
      targetEntityType: "client",
      targetEntityId: client.id,
      metadata: {
        name: `Acme ${index}`,
        previousName: `Acme ${index - 1}`,
        isActive: true,
        previousIsActive: true,
      },
    });
  }

  const first = await getClientAuditActivity(actor(superUser), client.id, "en", { limit: 2 }, db);
  assert.equal(first.entries.length, 2);
  assert.ok(first.nextCursor);

  const second = await getClientAuditActivity(
    actor(superUser),
    client.id,
    "en",
    { limit: 2, cursor: first.nextCursor! },
    db
  );
  assert.equal(second.entries.length, 1);
  assert.equal(second.nextCursor, null);

  db.close();
});

test("audit activity: existing audit action identifiers map through i18n labels", () => {
  const t = DASHBOARD_STRINGS.en;
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.PACKAGE_ASSIGNED, "en"), t.auditActionPackageAssigned);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.PACKAGE_CREATED, "en"), t.auditActionPackageCreated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.PACKAGE_UPDATED, "en"), t.auditActionPackageUpdated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.PRICING_RULE_CREATED, "en"), t.auditActionPricingRuleCreated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.KPI_CONFIG_CHANGED, "en"), t.auditActionKpiConfigChanged);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.CLIENT_CREATED, "en"), t.auditActionClientCreated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.CLIENT_UPDATED, "en"), t.auditActionClientUpdated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.CLIENT_DEACTIVATED, "en"), t.auditActionClientDeactivated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.AD_ACCOUNT_CREATED, "en"), t.auditActionAdAccountCreated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.AD_ACCOUNT_SOURCE_UPDATED, "en"), t.auditActionAdAccountSourceUpdated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.AD_ACCOUNT_STATUS_UPDATED, "en"), t.auditActionAdAccountStatusUpdated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.CAMPAIGN_ASSIGNED, "en"), t.auditActionCampaignAssigned);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_CHANGED, "en"), t.auditActionCampaignAssignmentChanged);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.CAMPAIGN_ASSIGNMENT_DEACTIVATED, "en"), t.auditActionCampaignAssignmentDeactivated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.DATA_EXPORT_CREATED, "en"), t.auditActionDataExportCreated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.USER_CREATED, "en"), t.auditActionUserCreated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.USER_UPDATED, "en"), t.auditActionUserUpdated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.USER_ACTIVATED, "en"), t.auditActionUserActivated);
  assert.equal(getAuditActionLabel(AUDIT_ACTIONS.USER_DEACTIVATED, "en"), t.auditActionUserDeactivated);
  assert.equal(getAuditActionLabel("unknown.action", "en"), t.auditActivityUnknownAction);
});

test("audit activity: list renders entries and safe empty state without raw metadata", () => {
  const html = renderToStaticMarkup(
    <AuditActivityList
      page={{
        entries: [
          {
            id: "a1",
            actionLabel: DASHBOARD_STRINGS.en.auditActionClientUpdated,
            actorName: "Super Admin",
            createdAt: new Date("2026-09-22T10:00:00.000Z"),
            metadataSummary: "from “Old” to “New”",
          },
        ],
        nextCursor: "10",
      }}
      lang="en"
      strings={DASHBOARD_STRINGS.en}
      clientId="c1"
      cursor={null}
    />
  );
  assert.match(html, /Audit Activity/);
  assert.match(html, /Client updated/);
  assert.match(html, /by Super Admin/);
  assert.match(html, /Load more/);
  assert.doesNotMatch(html, /rawPayload|access_token|cookie|password/);

  const emptyHtml = renderToStaticMarkup(
    <AuditActivityList
      page={{ entries: [], nextCursor: null }}
      lang="en"
      strings={DASHBOARD_STRINGS.en}
      clientId="c1"
      cursor={null}
    />
  );
  assert.match(emptyHtml, /No audit activity/);
});
