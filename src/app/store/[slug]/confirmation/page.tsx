"use client";

import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { formatLYD } from "@/lib/api";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
  sabil: "دريب السبيل",
  shaheen: "شاهين",
};

export default function ConfirmationPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();

  const orderId = search.get("orderId");
  const totalCents = Number(search.get("totalCents") ?? 0);
  const trackingId = search.get("trackingId");
  const courier = search.get("courier") ?? "";
  const paymentStatus = search.get("paymentStatus");

  if (!orderId) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">لا يوجد طلب لعرضه</h1>
        <Link href={`/store/${params.slug}`} className="text-brass font-bold mt-4 inline-block">
          العودة إلى المتجر
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-center">
      <span className="stamp mx-auto mb-6 h-16 w-16 border-brass text-brass text-2xl font-bold">✓</span>
      <h1 className="font-display text-3xl font-extrabold text-harbor">تم تأكيد طلبك</h1>
      <p className="text-rope mt-2">سيصلك المندوب قريبًا. احتفظ برقم التتبع أدناه لمتابعة الشحنة.</p>

      <dl className="mt-10 rounded-2xl border border-harbor/10 bg-white/50 p-6 text-right space-y-4">
        <Row label="رقم الطلب" value={orderId} mono />
        <Row label="رقم التتبع" value={trackingId ?? "—"} mono />
        <Row label="شركة الشحن" value={courierLabels[courier] ?? courier} />
        <Row label="الإجمالي" value={formatLYD(totalCents)} />
        <Row label="حالة الدفع" value={paymentStatus === "paid" ? "مدفوع" : "قيد الدفع عند الاستلام"} />
      </dl>

      <Link
        href={`/store/${params.slug}`}
        className="mt-10 inline-block rounded-full bg-harbor text-canvas px-8 py-3 font-bold hover:bg-harbor-deep transition-colors"
      >
        متابعة التسوق
      </Link>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-rope text-sm">{label}</dt>
      <dd className={`font-bold text-harbor text-sm ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
