// Pure domain types — no storage-specific concerns, no ORM decorators,
// no SQL. Mirrors docs/domain-model.md.

export type UserRole = "super_admin" | "admin" | "client";

export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  businessType: string;
  contactEmail: string;
  packageId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  metricThresholds: Record<string, unknown>;
  createdAt: Date;
}

export interface AdminAssignment {
  id: string;
  adminUserId: string;
  clientId: string;
  assignedAt: Date;
}

export type AdAccountStatus = "connected" | "pending" | "error";
export type CollectorSource = "playwright" | "meta_api";

export interface AdAccount {
  id: string;
  clientId: string;
  name: string;
  status: AdAccountStatus;
  source: CollectorSource;
  metaAdAccountId: string | null;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  adAccountId: string;
  name: string;
  objective: string;
  status: string;
  scrapedLabel: string | null;
  metaCampaignId: string | null;
  createdAt: Date;
}

export interface InsightSnapshot {
  id: string;
  campaignId: string;
  capturedAt: Date;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  rawPayload: Record<string, unknown> | null;
}

export interface DashboardPreference {
  id: string;
  userId: string | null;
  clientId: string | null;
  visibleMetrics: string[];
  theme: "light" | "dark" | "system";
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type CollectorJobStatus = "running" | "success" | "failed";

export interface CollectorJob {
  id: string;
  adAccountId: string;
  source: CollectorSource;
  status: CollectorJobStatus;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}
