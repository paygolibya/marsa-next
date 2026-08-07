"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface Payment {
  id: string;
  merchantId: string;
  merchant: { name: string; phone: string };
  tier: string;
  amount: number;
  status: string;
  receiptFile: string | null;
  createdAt: string;
  receiptUploadedAt: string | null;
}

export default function PaymentsPage() {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    fetchPayments();
  }, [filter, token]);

  async function fetchPayments() {
    try {
      const response = await fetch(`/api/admin/payments?status=${filter}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  }

  async function approvePayment(paymentId: string) {
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        alert("تم الموافقة على الدفع");
        fetchPayments();
      }
    } catch (error) {
      alert("حدث خطأ");
    }
  }

  async function rejectPayment(paymentId: string) {
    const reason = prompt("السبب:");
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        alert("تم رفض الدفع");
        fetchPayments();
      }
    } catch (error) {
      alert("حدث خطأ");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-4xl font-bold">إدارة الدفع</h1>

        <div className="mb-6 flex gap-4">
          {[
            { key: "pending", label: "قيد الانتظار" },
            { key: "approved", label: "موافق عليه" },
            { key: "rejected", label: "مرفوض" },
          ].map((status) => (
            <button
              key={status.key}
              onClick={() => setFilter(status.key)}
              className={`rounded-lg px-6 py-2 font-bold transition ${filter === status.key ? "bg-signal text-white" : "border border-harbor/10 bg-white text-harbor hover:border-signal"}`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p>جاري التحميل...</p>
        ) : payments.length === 0 ? (
          <p className="text-gray-600">لا توجد دفعات</p>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-harbor/10 bg-white p-6">
                <div className="mb-4 grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-rope">التاجر</p>
                    <p className="font-bold">{payment.merchant.name}</p>
                    <p className="text-sm text-rope">{payment.merchant.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-rope">الخطة</p>
                    <p className="font-bold">{payment.tier}</p>
                  </div>
                  <div>
                    <p className="text-sm text-rope">المبلغ</p>
                    <p className="font-bold text-signal">{payment.amount} د.ل</p>
                  </div>
                  <div>
                    <p className="text-sm text-rope">التاريخ</p>
                    <p className="font-bold">{payment.receiptUploadedAt ? new Date(payment.receiptUploadedAt).toLocaleDateString("ar-LY") : "—"}</p>
                  </div>
                </div>

                {payment.receiptFile && (
                  <div className="mb-4">
                    <a href={payment.receiptFile} target="_blank" rel="noreferrer" className="font-bold text-signal hover:underline">
                      👁️ عرض الإيصال
                    </a>
                  </div>
                )}

                {payment.status === "pending" && (
                  <div className="flex gap-3">
                    <button onClick={() => approvePayment(payment.id)} className="flex-1 rounded-lg bg-green-600 py-2 font-bold text-white transition hover:bg-green-700">
                      ✓ موافقة
                    </button>
                    <button onClick={() => rejectPayment(payment.id)} className="flex-1 rounded-lg bg-red-600 py-2 font-bold text-white transition hover:bg-red-700">
                      ✗ رفض
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
