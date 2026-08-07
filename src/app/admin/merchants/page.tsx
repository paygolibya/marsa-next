"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface MerchantStore {
  id: string;
  name: string;
  slug: string;
}

interface Merchant {
  id: string;
  name: string;
  phone: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  createdAt: string;
  stores: MerchantStore[];
}

export default function MerchantsPage() {
  const { token } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    void fetchMerchants();
  }, [token]);

  async function fetchMerchants() {
    try {
      const response = await fetch("/api/admin/merchants", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        setMerchants(data.merchants || []);
      }
    } catch (error) {
      console.error("Error fetching merchants:", error);
    } finally {
      setLoading(false);
    }
  }

  async function acceptMerchant(merchantId: string) {
    if (!window.confirm("تأكيد قبول هذا التاجر؟")) return;

    try {
      const response = await fetch("/api/admin/merchants/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ merchantId }),
      });

      if (response.ok) {
        alert("✓ تم قبول التاجر");
        await fetchMerchants();
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.error || "فشل قبول التاجر");
      }
    } catch (error) {
      console.error("Error accepting merchant:", error);
      alert("حدث خطأ");
    }
  }

  async function rejectMerchant(merchantId: string) {
    const reason = window.prompt("السبب:");
    if (!reason) return;

    try {
      const response = await fetch("/api/admin/merchants/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ merchantId, reason }),
      });

      if (response.ok) {
        alert("✓ تم رفض التاجر");
        await fetchMerchants();
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.error || "فشل رفض التاجر");
      }
    } catch (error) {
      console.error("Error rejecting merchant:", error);
      alert("حدث خطأ");
    }
  }

  async function suspendMerchant(merchantId: string) {
    if (!window.confirm("تأكيد إيقاف هذا التاجر مؤقتاً؟")) return;

    try {
      const response = await fetch("/api/admin/merchants/suspend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ merchantId }),
      });

      if (response.ok) {
        alert("✓ تم إيقاف التاجر");
        await fetchMerchants();
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.error || "فشل إيقاف التاجر");
      }
    } catch (error) {
      console.error("Error suspending merchant:", error);
      alert("حدث خطأ");
    }
  }

  async function deleteMerchant(merchantId: string) {
    if (!window.confirm("تأكيد حذف هذا التاجر؟ لا يمكن التراجع عن هذا الإجراء")) return;

    try {
      const response = await fetch("/api/admin/merchants/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ merchantId }),
      });

      if (response.ok) {
        alert("✓ تم حذف التاجر");
        await fetchMerchants();
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.error || "فشل حذف التاجر");
      }
    } catch (error) {
      console.error("Error deleting merchant:", error);
      alert("حدث خطأ");
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "active":
        return "نشط";
      case "suspended":
        return "معلق";
      case "rejected":
        return "مرفوض";
      case "pending":
        return "قيد المراجعة";
      default:
        return "غير نشط";
    }
  }

  function getStatusClasses(status: string) {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      case "rejected":
        return "bg-orange-100 text-orange-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold text-harbor">التجار</h1>

      {showDetails && selectedMerchant && (
        <MerchantDetailsModal
          merchant={selectedMerchant}
          onClose={() => {
            setShowDetails(false);
            setSelectedMerchant(null);
          }}
        />
      )}

      {loading ? (
        <p className="text-rope">جاري التحميل...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-right font-bold">الاسم</th>
                <th className="px-6 py-4 text-right font-bold">الهاتف</th>
                <th className="px-6 py-4 text-right font-bold">الخطة</th>
                <th className="px-6 py-4 text-right font-bold">الحالة</th>
                <th className="px-6 py-4 text-right font-bold">المتاجر</th>
                <th className="px-6 py-4 text-right font-bold">التاريخ</th>
                <th className="px-6 py-4 text-right font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr key={merchant.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{merchant.name}</td>
                  <td className="px-6 py-4">{merchant.phone}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                      {merchant.subscriptionTier || "لم يختر"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${getStatusClasses(merchant.subscriptionStatus)}`}>
                      {getStatusLabel(merchant.subscriptionStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4">{merchant.stores.length}</td>
                  <td className="px-6 py-4">{new Date(merchant.createdAt).toLocaleDateString("ar-LY")}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedMerchant(merchant);
                          setShowDetails(true);
                        }}
                        className="rounded bg-blue-600 px-3 py-1 text-sm font-bold text-white hover:bg-blue-700"
                        title="عرض التفاصيل"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => {
                          const store = merchant.stores[0];
                          if (store?.slug) {
                            window.open(`/store/${store.slug}`, "_blank", "noopener,noreferrer");
                          }
                        }}
                        disabled={!merchant.stores.length}
                        className="rounded bg-green-600 px-3 py-1 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
                        title="عرض المتجر"
                      >
                        🔗
                      </button>
                      {(merchant.subscriptionStatus === "pending" || merchant.subscriptionStatus === "inactive") && (
                        <>
                          <button
                            onClick={() => void acceptMerchant(merchant.id)}
                            className="rounded bg-emerald-600 px-3 py-1 text-sm font-bold text-white hover:bg-emerald-700"
                            title="قبول"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => void rejectMerchant(merchant.id)}
                            className="rounded bg-orange-600 px-3 py-1 text-sm font-bold text-white hover:bg-orange-700"
                            title="رفض"
                          >
                            ✗
                          </button>
                        </>
                      )}
                      {merchant.subscriptionStatus === "active" && (
                        <button
                          onClick={() => void suspendMerchant(merchant.id)}
                          className="rounded bg-red-600 px-3 py-1 text-sm font-bold text-white hover:bg-red-700"
                          title="إيقاف مؤقت"
                        >
                          ⏸️
                        </button>
                      )}
                      <button
                        onClick={() => void deleteMerchant(merchant.id)}
                        className="rounded bg-red-800 px-3 py-1 text-sm font-bold text-white hover:bg-red-900"
                        title="حذف نهائي"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MerchantDetailsModal({
  merchant,
  onClose,
}: {
  merchant: Merchant;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{merchant.name}</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">الهاتف</p>
              <p className="font-bold">{merchant.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">الخطة</p>
              <p className="font-bold">{merchant.subscriptionTier || "لم يختر"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">الحالة</p>
              <p className="font-bold">{merchant.subscriptionStatus}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">تاريخ الإنشاء</p>
              <p className="font-bold">{new Date(merchant.createdAt).toLocaleDateString("ar-LY")}</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 font-bold">المتاجر ({merchant.stores.length})</h3>
            {merchant.stores.length === 0 ? (
              <p className="text-gray-600">لا توجد متاجر</p>
            ) : (
              <div className="space-y-2">
                {merchant.stores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between rounded bg-gray-50 p-3">
                    <div>
                      <p className="font-bold">{store.name}</p>
                      <p className="text-sm text-gray-600">{store.slug}</p>
                    </div>
                    <a
                      href={`/store/${store.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      عرض
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-gray-200 py-2 font-bold text-gray-800 hover:bg-gray-300"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
