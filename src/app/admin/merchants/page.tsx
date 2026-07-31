"use client";

import { useEffect, useState } from "react";

interface Merchant {
  id: string;
  name: string;
  phone: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  createdAt: string;
  stores: Array<{ id: string; name: string }>;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchMerchants();
  }, []);

  async function fetchMerchants() {
    try {
      const response = await fetch("/api/admin/merchants");
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

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold text-harbor">التجار</h1>

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
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${merchant.subscriptionStatus === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {merchant.subscriptionStatus === "active" ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td className="px-6 py-4">{merchant.stores.length}</td>
                  <td className="px-6 py-4">{new Date(merchant.createdAt).toLocaleDateString("ar-LY")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
