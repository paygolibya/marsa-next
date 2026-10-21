import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";
import { getAuthMerchantId } from "@/lib/auth";
import { readJsonBody, MalformedJsonError, malformedJsonResponse } from "@/lib/http/read-json";
import { deleteMerchantData, type DeleteAccountTx } from "@/lib/account/delete-account";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose so the real PrismaClient fits.
type Any = any;

export type DeleteAccountDeps = {
  db: {
    merchant: { findUnique: (args: Any) => Promise<{ id: string; passwordHash: string } | null> };
    payout: { count: (args: Any) => Promise<number> };
    commission: { count: (args: Any) => Promise<number> };
    $transaction: Any;
  };
};

// POST /api/merchant/account/delete — { password }. The merchant deletes
// their own account and all its data (stores, products, orders, payments,
// notifications…). Re-asks for the password so a stolen or left-open
// session can't wipe an account. Refused while Rifqa still owes the
// merchant money (a payout not yet transferred, or a commission not yet
// paid out) — those records must survive until settled; the merchant is
// told to contact support instead.
export async function handleDeleteAccount(deps: DeleteAccountDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { password } = await readJsonBody(req);
    if (typeof password !== "string" || password.length === 0) {
      return NextResponse.json({ error: "أدخل كلمة المرور لتأكيد الحذف" }, { status: 400 });
    }

    const merchant = await deps.db.merchant.findUnique({ where: { id: merchantId }, select: { id: true, passwordHash: true } });
    if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!bcrypt.compareSync(password, merchant.passwordHash)) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 403 });
    }

    const [pendingPayouts, unpaidCommissions] = await Promise.all([
      deps.db.payout.count({ where: { merchantId, status: "ready_for_transfer" } }),
      deps.db.commission.count({ where: { merchantId, payoutId: null } }),
    ]);
    if (pendingPayouts > 0 || unpaidCommissions > 0) {
      return NextResponse.json(
        { error: "لديك مستحقات مالية لم تُحوَّل لك بعد — تواصل مع الدعم لإتمامها قبل حذف الحساب." },
        { status: 409 }
      );
    }

    // ~10 sequential statements, each a round trip to the remote database:
    // Prisma's default 5s interactive-transaction timeout was hit in
    // testing (the delete rolled back), so allow it real time to finish.
    const result = await deps.db.$transaction((tx: DeleteAccountTx) => deleteMerchantData(tx, merchantId), { maxWait: 10_000, timeout: 30_000 });
    return NextResponse.json({ deleted: true, ...result });
  } catch (err) {
    if (err instanceof MalformedJsonError) return malformedJsonResponse();
    console.error("Account deletion failed:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "تعذّر حذف الحساب، حاول لاحقًا أو تواصل مع الدعم" }, { status: 500 });
  }
}
