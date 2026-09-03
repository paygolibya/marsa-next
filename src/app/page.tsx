import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";

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
    icon: "💳",
    eyebrow: "الدفع عند الاستلام",
    title: "إدارة الدفع النقدي بثقة",
    body: "تتبّع كل طلب دفع عند الاستلام من لحظة الطلب حتى تحصيل المندوب للمبلغ، بلا فوضى في الدفاتر.",
  },
  {
    icon: "📊",
    eyebrow: "المزامنة",
    title: "طلباتك في جدول بيانات، تلقائيًا",
    body: "كل طلب يُسجَّل في Google Sheets فور تأكيده، جاهز لفريق المبيعات أو المحاسبة دون نسخ يدوي.",
  },
  {
    icon: "⚡",
    eyebrow: "الدفع الفوري",
    title: "دفع بثلاث خطوات من الجوال",
    body: "تجربة دفع سريعة عبر مجمّع دي‑باي (معاملات، موبي‑كاش، إدفعلي، وان‑باي) بلا إعادة توجيه مربكة.",
  },
  {
    icon: "🚚",
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

      {/* HERO — moved off the flat navy panel onto a warm, light gradient
          that actually echoes the logo's own palette (cream → soft
          rose/gold), with the logo's colors as slow-drifting decorative
          blobs rather than a solid dark block. Fully opaque at every stop
          (previously faded to rose-light/10 at the bottom, relying on the
          plain cream page behind it) so it stays visually identical now
          that the rest of the site sits on the brand gradient instead. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-canvas via-canvas to-canvas">
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-rose-light/40 blur-3xl animate-drift"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-brass/20 blur-3xl animate-drift-slow"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div className="text-center lg:text-right">
              <Image src="/logo.png" alt="رفقة" width={64} height={64} priority className="mx-auto lg:mx-0 mb-6 h-14 w-14 object-contain" />
              <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight text-harbor">
                التجارة الإلكترونية في ليبيا أصبحت أسهل مع رفقة
              </h1>
              <p className="mt-6 text-lg text-harbor/70 max-w-xl mx-auto lg:mx-0">
                متجرك، دفعك، وشحنك — في مرسى واحد. أنشئ متجرك في دقائق واربطه فورًا
                بشركات الشحن ومزوّدي الدفع الليبيين.
              </p>
              <div className="mt-10 flex items-center justify-center lg:justify-start gap-4 flex-wrap">
                <Link
                  href="/register"
                  className="rounded-full bg-signal px-8 py-3 font-bold text-canvas shadow-lg shadow-signal/30 hover:bg-signal-dark hover:-translate-y-0.5 hover:shadow-xl transition-all"
                >
                  أنشئ متجرك الآن
                </Link>
                <Link
                  href="/store/alhayes-fashion"
                  className="rounded-full border-2 border-harbor/15 px-8 py-3 font-bold text-harbor hover:bg-harbor/5 hover:-translate-y-0.5 transition-all"
                >
                  شاهد متجرًا حقيقيًا
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={150}>
            <div className="relative mx-auto max-w-md">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-rose via-signal to-brass opacity-20 blur-2xl" aria-hidden />
              <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500">
                <Image
                  src="/marketing/hero-shopper.jpg"
                  alt="تجربة تسوّق إلكتروني"
                  width={640}
                  height={480}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
              <span
                className="absolute -bottom-5 -right-5 rounded-2xl bg-white shadow-xl px-5 py-3 text-sm font-bold text-harbor animate-bob"
                dir="rtl"
              >
                ✓ طلب جديد مؤكد
              </span>
              <span
                className="absolute -top-5 -left-5 rounded-2xl bg-brass shadow-xl px-4 py-2.5 text-xs font-bold text-harbor animate-bob"
                style={{ animationDelay: "1.5s" }}
                dir="rtl"
              >
                +٤.٨ ★ تقييم العملاء
              </span>
            </div>
          </Reveal>
        </div>

        {/* Docked partners — an infinite marquee instead of a static row,
            duplicated once so the loop is seamless. */}
        <div className="relative border-t border-harbor/10 bg-white/40 overflow-hidden py-6">
          <div className="flex w-max animate-marquee gap-16">
            {[...partners, ...partners].map((p, i) => (
              <span key={`${p.label}-${i}`} className="text-harbor/50 font-display font-bold tracking-wide text-lg whitespace-nowrap">
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="max-w-xl mb-14 text-center lg:text-right mx-auto lg:mx-0">
            <p className="text-brass font-bold text-sm mb-2">لماذا رفقة</p>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-harbor">
              كل ما يحتاجه متجرك، مبني لسوق ليبيا تحديدًا
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((f, i) => (
            <Reveal key={f.title} delayMs={i * 100}>
              <div className="group h-full rounded-2xl border border-harbor/10 bg-white/60 p-8 hover:-translate-y-1.5 hover:shadow-xl hover:border-brass/40 transition-all duration-300">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brass/15 text-2xl mb-5 group-hover:scale-110 transition-transform">
                  {f.icon}
                </span>
                <p className="text-brass text-xs font-bold tracking-widest uppercase mb-3">{f.eyebrow}</p>
                <h3 className="font-display text-xl font-bold text-harbor mb-2">{f.title}</h3>
                <p className="text-rope leading-relaxed">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SHOWCASE — the two illustrations, each paired with a real part of
          the merchant journey rather than dropped in as generic decoration. */}
      <section className="bg-white/40 border-y border-harbor/10">
        <div className="mx-auto max-w-6xl px-6 py-24 space-y-20">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="order-2 md:order-1">
                <p className="text-signal font-bold text-sm mb-2">لكل تاجر</p>
                <h3 className="font-display text-2xl md:text-3xl font-extrabold text-harbor mb-4">
                  من فكرة متجر إلى أول عملية بيع، في نفس اليوم
                </h3>
                <p className="text-rope leading-relaxed max-w-md">
                  اختر قالبًا، ارفع منتجاتك، وشارك رابط متجرك — بلا حاجة لمبرمج أو
                  تصميم من الصفر. رفقة تهتم بالتفاصيل التقنية لتركّز أنت على منتجك.
                </p>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="absolute -inset-6 rounded-full bg-rose-light/30 blur-3xl" aria-hidden />
                <Image
                  src="/marketing/illustration-family-shopping.jpg"
                  alt="عائلة تتسوّق عبر الإنترنت"
                  width={600}
                  height={480}
                  className="relative w-full h-auto"
                />
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-brass/20 blur-3xl" aria-hidden />
                <Image
                  src="/marketing/illustration-baby-shopping.jpg"
                  alt="تسوّق منتجات متنوعة عبر متجرك"
                  width={600}
                  height={480}
                  className="relative w-full h-auto"
                />
              </div>
              <div>
                <p className="text-signal font-bold text-sm mb-2">لكل قطاع</p>
                <h3 className="font-display text-2xl md:text-3xl font-extrabold text-harbor mb-4">
                  أزياء، أطفال، إلكترونيات — أي منتج تبيعه
                </h3>
                <p className="text-rope leading-relaxed max-w-md">
                  فئات منتجات غير محدودة، صور متعددة لكل منتج، وخيارات كالمقاس واللون
                  — متجرك يكبر مع تشكيلتك، لا العكس.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-harbor-deep/5">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <div className="max-w-xl mb-14">
              <p className="text-brass font-bold text-sm mb-2">الاشتراك</p>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-harbor">
                خطة واحدة تناسب حجم متجرك
              </h2>
              <p className="mt-3 text-rope">جميع الأسعار شهرية بالدينار الليبي، بلا رسوم خفية.</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan, i) => (
              <Reveal key={plan.name} delayMs={i * 100}>
                <div
                  className={`relative h-full rounded-2xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-1.5 ${
                    plan.popular
                      ? "bg-harbor text-canvas shadow-xl scale-[1.03] hover:shadow-2xl"
                      : "bg-white/60 text-harbor border border-harbor/10 hover:shadow-lg"
                  }`}
                >
                  {plan.popular && (
                    <span className="stamp absolute -top-4 right-8 h-14 w-14 border-rose bg-rose text-canvas text-[11px] font-bold leading-tight text-center animate-bob">
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-l from-signal via-rose to-brass" aria-hidden />
        <Reveal>
          <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4">
              جاهز تبدأ متجرك اليوم؟
            </h2>
            <p className="text-white/85 mb-8 max-w-xl mx-auto">
              دقائق معدودة تفصلك عن متجر إلكتروني كامل، متصل بالشحن والدفع الليبي.
            </p>
            <Link
              href="/register"
              className="inline-block rounded-full bg-white px-10 py-3.5 font-bold text-signal shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all"
            >
              أنشئ متجرك مجانًا
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter transparent />
    </>
  );
}
