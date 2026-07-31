"use client";

import { useEffect, useState } from "react";

interface Order {
  id: string;
  buyerName: string;
  buyerPhone: string;
  paymentStatus: string;
  status: string;
  totalCents: number;
  createdAt: string;
  store: { name: string };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const response = await fetch("/api/admin/orders");
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold text-harbor">الطلبات</h1>

      {loading ? (
        <p className="text-rope">جاري التحميل...</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-harbor">{order.buyerName}</p>
                  <p className="text-sm text-rope">{order.buyerPhone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-rope">المتجر</p>
                  <p className="font-bold">{order.store.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-rope">الحالة</p>
                  <p className="font-bold">{order.status}</p>
                </div>
                <div>
                  <p className="text-sm text-rope">دفع</p>
                  <p className="font-bold">{order.paymentStatus}</p>
                </div>
                <div>
                  <p className="text-sm text-rope">الإجمالي</p>
                  <p className="font-bold text-signal">{order.totalCents} د.ل</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
