// Trial → paid conversion: where each merchant is in the funnel, what to
// do next, and the WhatsApp follow-up text with their payment link. Used by
// the admin conversion view (/admin/conversion) so the team can follow up
// on every merchant without anyone hand-auditing the database.

export type ConversionStage = "not_verified" | "no_store" | "no_products" | "booking_no_hours" | "no_orders" | "selling" | "paid";

export type ConversionInput = {
  phoneVerified: boolean;
  approvedPayments: number;
  store: null | {
    type: string;
    products: number;
    orders: number;
    bookableHours: boolean;
  };
};

export function conversionStage(m: ConversionInput): ConversionStage {
  if (m.approvedPayments > 0) return "paid";
  if (!m.phoneVerified) return "not_verified";
  if (!m.store) return "no_store";
  if (m.store.products === 0) return "no_products";
  if (m.store.type === "booking" && !m.store.bookableHours) return "booking_no_hours";
  if (m.store.orders === 0) return "no_orders";
  return "selling";
}

export const STAGE_LABELS: Record<ConversionStage, string> = {
  not_verified: "لم يُفعّل رقمه",
  no_store: "بدون متجر",
  no_products: "متجر بدون منتجات",
  booking_no_hours: "حجوزات بدون مواعيد",
  no_orders: "منتجات بدون طلبات",
  selling: "يبيع",
  paid: "مشترك",
};

// Libyan local number (09x…) → WhatsApp international digits (2189x…).
export function whatsappNumber(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "218" + d.slice(1);
  return d;
}

const PAYMENT_LINK = "https://rifqa.ly/payment?period=1m";

// The suggested next WhatsApp message for this merchant's stage. Close to a
// trial's end (≤10 days) a merchant who has a working store gets the
// subscribe message with the payment link instead of the activation one.
export function followUpMessage(name: string, stage: ConversionStage, daysLeft: number | null): string {
  const hi = `أهلًا ${name.trim().split(/\s+/)[0] ?? ""} 👋`.replace("أهلًا  👋", "أهلًا 👋");
  const ending = daysLeft !== null && daysLeft <= 10;
  if (ending && (stage === "selling" || stage === "no_orders")) {
    const when = daysLeft! <= 0 ? "تنتهي اليوم" : daysLeft === 1 ? "تنتهي غدًا" : `تنتهي خلال ${daysLeft} أيام`;
    return `${hi}\nفترتك التجريبية في رفقة ${when}، وبعدها يتوقف متجرك عن استقبال الطلبات.\nاشترك الآن ليبقى متجرك يعمل — أول شهر بـ 75 د.ل فقط بدل 150 د.ل:\n${PAYMENT_LINK}\n\nفريق رفقة`;
  }
  switch (stage) {
    case "not_verified":
      return `${hi}\nلاحظنا إن تسجيلك في رفقة ما اكتمل (رمز التحقق). نقدر نفعّل حسابك مباشرة ونساعدك تنشئ متجرك، تحب؟\n\nفريق رفقة`;
    case "no_store":
      return `${hi}\nسجّلت في رفقة لكن ما أنشأت متجرك بعد. تحب نساعدك تنشئه في دقيقتين؟ قولنا اسم نشاطك ونوع منتجاتك.\n\nفريق رفقة`;
    case "no_products":
      return `${hi}\nمتجرك جاهز لكن ما فيه منتجات بعد. ابعث لنا صور المنتجات وأسعارها هنا ونحن ننزلها لك مجانًا 🙌\n\nفريق رفقة`;
    case "booking_no_hours":
      return `${hi}\nمتجر الحجوزات تبعك ما فيه مواعيد عمل محددة، لذلك ما يقدر الزبائن يحجزوا. حددها من: لوحة التحكم ← إعدادات المتجر ← ساعات العمل.\n\nفريق رفقة`;
    case "no_orders":
      return `${hi}\nمتجرك جاهز ومنتجاتك منزّلة 👏 نقدر نساعدك تجيب أول طلب: نربط بكسل إعلاناتك ونجهّز لك رابط متجرك للمشاركة. تحب نبدأ؟\n\nفريق رفقة`;
    case "selling":
      return `${hi}\nمبروك على طلبات متجرك 🎉 هل في شي نقدر نسهّله عليك؟\n\nفريق رفقة`;
    case "paid":
      return `${hi}\nشكرًا لاشتراكك في رفقة 🙏 إذا احتجت أي مساعدة في متجرك نحن هنا.\n\nفريق رفقة`;
  }
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;
}
