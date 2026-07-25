import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const partners = [
  { label: "Moamalat" },
  { label: "MobiCash" },
  { label: "EDFali" },
  { label: "OnePay" },
  { label: "Vanex" },
  { label: "دريب السبيل" },
];

const features = [
  {
    eyebrow: "الدفع عند الاستلام",
    title: "إدارة الدفع النقدي بثقة",
    body: "تتبّع كل طلب دفع عند الاستلام من لحظة الطلب حتى تحصيل المندوب للمبلغ، بلا فوضى في الدفاتر.",
  },
  {
    eyebrow: "المزامنة",
    title: "طلباتك في جدول بيانات، تلقائيًا",
    body: "كل طلب يُسجَّل في Google Sheets فور تأكيده، جاهز لفريق المبيعات أو المحاسبة دون نسخ يدوي.",
  },
  {
    eyebrow: "الدفع الفوري",
    title: "دفع بثلاث خطوات من الجوال",
    body: "تجربة دفع سريعة عبر مجمّع دي‑باي (معاملات، موبي‑كاش، إدفعلي، وان‑باي) بلا إعادة توجيه مربكة.",
  },
  {
    eyebrow: "الشحن",
    title: "إرسال تلقائي لشركات التوصيل",
    body: "بمجرد تأكيد الطلب، يُرسَل مباشرة إلى فانكس أو دريب السبيل، ويعود رقم التتبع فورًا للعميل.",
  },
];

const plans = [
  {
    name: "الأساسية",
    price: "150",
    tagline: "لمن يبدأ متجره الأول",
    features: ["حتى 10,000 د.ل مبيعات شهريًا", "حتى 150 طلب شهريًا", "دفع عند الاستلام + دي‑باي", "دعم عبر واتساب"],
    popular: false,
  },
  {
    name: "الاحترافية",
    price: "280",
    tagline: "الأكثر اختيارًا من التجار",
    features: [
      "حتى 40,000 د.ل مبيعات شهريًا",
      "حتى 600 طلب شهريًا",
      "نطاق مخصص لمتجرك",
      "إرسال تلقائي عبر API لشركات الشحن",
    ],
    popular: true,
  },
  {
    name: "المتقدمة",
    price: "450",
    tagline: "لمن يدير فريقًا كاملاً",
    features: ["مبيعات وطلبات غير محدودة", "10 مقاعد لأعضاء الفريق", "دعم VIP بأولوية قصوى", "تقارير أداء متقدمة"],
    popular: false,
  },
];

export default function MarketingPage() {
  return (
    <>
      <SiteNav />

      {/* HERO */}
      <section className="relative overflow-hidden bg-harbor text-canvas">
        <div className="absolute inset-0 bg-compass-ring" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32 text-center">
          <span className="stamp mx-auto mb-8 h-16 w-16 border-brass text-brass text-2xl font-bold">م</span>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight max-w-3xl mx-auto">
            التجارة الإلكترونية في ليبيا أصبحت أسهل مع رفقة
          </h1>
          <p className="mt-6 text-lg md:text-xl text-canvas/75 max-w-2xl mx-auto">
            متجرك، دفعك، وشحنك — في مرسى واحد. أنشئ متجرك في دقائق واربطه فورًا
            بشركات الشحن ومزوّدي الدفع الليبيين.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="rounded-full bg-signal px-8 py-3 font-bold hover:bg-signal-dark transition-colors"
            >
              أنشئ متجرك الآن
            </Link>
            <Link
              href="/store/alhayes-fashion"
              className="rounded-full border border-canvas/30 px-8 py-3 font-bold hover:bg-canvas/10 transition-colors"
            >
              شاهد متجرًا حقيقيًا
            </Link>
          </div>
        </div>

        {/* Docked partners */}
        <div className="relative border-t border-canvas/10 bg-harbor-deep/60">
          <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {partners.map((p) => (
              <span key={p.label} className="text-canvas/60 font-display font-bold tracking-wide text-sm">
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-xl mb-14">
          <p className="text-brass font-bold text-sm mb-2">لماذا رفقة</p>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-harbor">
            كل ما يحتاجه متجرك، مبني لسوق ليبيا تحديدًا
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-harbor/10 bg-white/40 p-8 hover:border-brass/40 transition-colors"
            >
              <p className="text-brass text-xs font-bold tracking-widest uppercase mb-3">{f.eyebrow}</p>
              <h3 className="font-display text-xl font-bold text-harbor mb-2">{f.title}</h3>
              <p className="text-rope leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-harbor-deep/5">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-xl mb-14">
            <p className="text-brass font-bold text-sm mb-2">الاشتراك</p>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-harbor">
              خطة واحدة تناسب حجم متجرك
            </h2>
            <p className="mt-3 text-rope">جميع الأسعار شهرية بالدينار الليبي، بلا رسوم خفية.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.popular
                    ? "bg-harbor text-canvas shadow-xl scale-[1.03]"
                    : "bg-white/60 text-harbor border border-harbor/10"
                }`}
              >
                {plan.popular && (
                  <span className="stamp absolute -top-4 right-8 h-14 w-14 border-brass bg-canvas text-brass text-[11px] font-bold leading-tight text-center">
                    الأكثر
                    <br />
                    طلبًا
                  </span>
                )}
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                <p className={`text-sm mt-1 ${plan.popular ? "text-canvas/70" : "text-rope"}`}>{plan.tagline}</p>
                <p className="mt-6 mb-6">
                  <span className="font-display text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-sm"> د.ل / شهر</span>
                </p>
                <ul className="space-y-3 flex-1 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className={plan.popular ? "text-brass-light" : "text-brass"}>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-8 block text-center rounded-full py-3 font-bold transition-colors ${
                    plan.popular ? "bg-signal hover:bg-signal-dark" : "bg-harbor text-canvas hover:bg-harbor-deep"
                  }`}
                >
                  ابدأ مع {plan.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
