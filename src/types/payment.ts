// Shared types for the payout/commission system, used by both the admin
// and merchant dashboards.

export type PayoutStatus = "pending" | "processing" | "completed";

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
  markedPaidAt: string | null;
  note: string | null;
  createdAt: string;
};

export type CalculatePayoutsResult = {
  periodStart: string;
  periodEnd: string;
  merchantsCount: number;
  ordersCount: number;
  totalCommissionCents: number;
  totalPayoutCents: number;
  payouts: Payout[];
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
