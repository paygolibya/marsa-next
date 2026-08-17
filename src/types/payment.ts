// Shared types for the automatic payout/commission system, used by both
// the admin and merchant dashboards.

export type PayoutStatus = "ready_for_transfer" | "transferred";
export type CommissionStatus = "calculated" | "paid";

export type Payout = {
  id: string;
  merchantId: string;
  merchantName: string;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  totalSalesCents: number;
  commissionCents: number;
  amountCents: number;
  status: PayoutStatus;
  transferredAt: string | null;
  transferredBy: string | null;
  transferReference: string | null;
  note: string | null;
  createdAt: string;
};

export type PlatformStats = {
  totalSalesCents: number;
  totalCommissionCents: number;
  pendingPayoutCents: number;
  pendingPayoutCount: number;
};

export type MerchantPayoutSummary = {
  pendingAmountCents: number;
  commissionRate: number;
  lastPayout: Payout | null;
  history: Payout[];
};

export type CronLog = {
  id: string;
  jobName: string;
  status: "success" | "failed";
  ordersProcessed: number;
  payoutsCreated: number;
  errorMessage: string | null;
  durationMs: number | null;
  executedAt: string;
};
