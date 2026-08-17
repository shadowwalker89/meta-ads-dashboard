// Pure domain types — no storage-specific concerns, no ORM decorators,
// no SQL. Mirrors docs/domain-model.md.

import type { DashboardKpiKey } from "./kpi-catalog";
import type { PackagePricingDefaults } from "./pricing";

export type UserRole = "super_admin" | "admin" | "client";

export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  clientId: string | null;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  businessType: string;
  contactEmail: string;
  packageId: string;
  /**
   * When the client was assigned to its current package. Set at client
   * creation and refreshed whenever packageId changes (reassignment).
   * Backfilled to created_at for legacy rows. This timestamp is the
   * lifecycle anchor for future package changes and package
   * pricing-default propagation.
   */
  packageAssignedAt: Date;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Feature entitlements a package grants. Boolean per feature; the client
 * dashboard renders only what the package allows. These are stored as
 * package data (rows), never hard-coded tier logic.
 */
export interface PackageFeatures {
  charts: boolean;
  dataExport: boolean;
  advancedReporting: boolean;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  /**
   * Stable machine key for the tier (e.g. "bronze", "silver", "gold").
   * Nullable only for backward compatibility with rows created before
   * the column existed; the seed and repository always write a
   * non-empty code. Unique when present.
   */
  code: string | null;
  /**
   * Collections per day the package entitles. Package-authoritative
   * (Bronze/Silver/Gold values are seed data, not code).
   */
  collectionFrequency: number;
  /** Max connected ad accounts; null = unlimited. Package-authoritative. */
  maxAdAccounts: number | null;
  /** Max tracked campaigns; null = unlimited. Package-authoritative. */
  maxCampaigns: number | null;
  /** Report-history retention in days; null = keep indefinitely. */
  retentionDays: number | null;
  /**
   * Default KPI set for a client with no explicit preference. Per-client
   * DashboardPreference still wins when present.
   */
  defaultVisibleKpis: DashboardKpiKey[];
  features: PackageFeatures;
  /**
   * Default pricing per pricable metric — the starting point that feeds
   * the client-scoped PricingRule foundation. Never the runtime truth.
   */
  pricingDefaults: PackagePricingDefaults;
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
  /**
   * The reporting window Meta supplied for this snapshot's cumulative
   * values, as calendar dates (UTC midnight). Null when the export did
   * not provide bounds — never inferred from `capturedAt`, and
   * `capturedAt` is never a substitute for either boundary.
   */
  reportingFrom: Date | null;
  reportingTo: Date | null;
  impressions: number;
  clicks: number;
  /**
   * Meta reports "Clicks (all)" (any click on the ad) and "Link clicks"
   * (only clicks that navigate somewhere) as two distinct, both-meaningful
   * metrics -- not one superseding the other. `clicks` maps to "Link
   * clicks"; `linkClicks` also maps to "Link clicks"; `clicksAll` maps to
   * "Clicks (all)". `clicks` and `linkClicks` share the same Meta column
   * by design: the dashboard KPI named "کلیک" represents link clicks, and
   * `clicksAll` is exposed separately. Confirmed 2026-08-15.
   */
  linkClicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  /**
   * Extended Meta Ads metric set (added 2026-08-14). Stored in their own
   * columns with a DEFAULT of 0, so snapshots created before these fields
   * existed read back as 0 — never undefined. `clicksAll` maps to Meta's
   * "Clicks (all)" column.
   */
  frequency: number;
  clicksAll: number;
  uniqueClicks: number;
  uniqueCtr: number;
  landingPageViews: number;
  outboundClicks: number;
  outboundCtr: number;
  leads: number;
  messagesStarted: number;
  messagesContacts: number;
  results: number;
  costPerResult: number;
  postReactions: number;
  postComments: number;
  rawPayload: Record<string, unknown> | null;
}

export interface DashboardPreference {
  id: string;
  userId: string | null;
  clientId: string | null;
  visibleMetrics: DashboardKpiKey[];
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
