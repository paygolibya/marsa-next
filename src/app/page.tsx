import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter, RIFQA_SOCIAL_LINKS } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import { subscriptionPeriods } from "@/lib/checkout-features";
import { Icon, type IconName } from "@/components/ui/Icon";

const periodList = Object.values(subscriptionPeriods);

// What every subscription period includes — one plan, so the list is the
// same on each card. Only features that actually ship today.
const PLAN_INCLUDES = [
  "منتجات وطلبات غير محدودة",
  "الدفع ببطاقات معاملات أو عند الاستلام",
  "شحن تلقائي مع فانكس لكل ليبيا",
  "رسائل SMS وبريد إلكتروني لعملائك",
  "تحليلات وبكسلات فيسبوك وتيك توك و Google",
  "قوالب جاهزة لكل نوع نشاط",
];

// Section titles sit directly on the brand gradient in white — they were
// each wrapped in a floating white card, which read as a stray box
// rather than a heading.
function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <span className="mb-4 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-sm">
        {eyebrow}
      </span>
      <h2 className="font-display text-3xl font-extrabold leading-tight text-white drop-shadow-sm md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg leading-relaxed text-white/90">{subtitle}</p>}
    </div>
  );
}

// Only integrations that are actually live — DPay (and the MobiCash/
// EDFali/OnePay wallets it aggregated) was reverted; card payments go
// directly through Moamalat now.
const partners = [
  { label: "Moamalat" },
  { label: "Vanex" },
  { label: "Facebook Pixel" },
  { label: "TikTok Pixel" },
  { label: "Google Ads" },
];

const features = [
  {
    icon: "card" as IconName,
    eyebrow: "الدفع عند الاستلام",
    title: "إدارة الدفع النقدي بثقة",
    body: "تتبّع كل طلب دفع عند الاستلام من لحظة الطلب حتى تحصيل المندوب للمبلغ، بلا فوضى في الدفاتر.",
  },
  {
    icon: "chart" as IconName,
    eyebrow: "التحليلات",
    title: "اعرف من أين تأتي مبيعاتك",
    body: "لوحة تحليلات لزياراتك وطلباتك ومبيعاتك، وربط مباشر ببكسل فيسبوك وتيك توك و Google Ads لتعرف أي إعلان يبيع فعلًا.",
  },
  {
    icon: "zap" as IconName,
    eyebrow: "الدفع الإلكتروني",
    title: "دفع فوري ببطاقات معاملات",
    body: "عملاؤك يدفعون ببطاقات معاملات مباشرة داخل متجرك دون مغادرته، ويُؤكَّد الطلب تلقائيًا فور نجاح الدفع.",
  },
  {
    icon: "truck" as IconName,
    eyebrow: "الشحن",
    title: "إرسال تلقائي لشركات التوصيل",
    body: "بمجرد تأكيد الطلب، يُرسَل مباشرة إلى فانكس، ويعود رقم التتبع فورًا للعميل.",
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
              {/* logo.png is 720x836 (portrait) — width matches that real
                  aspect ratio for a 56px-tall box instead of forcing a
                  square that letterboxes it smaller than its own box. */}
              <Image src="/logo.png" alt="رفقة" width={55} height={64} priority className="mx-auto lg:mx-0 mb-6 h-14 w-auto object-contain" />
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
                  className="rounded-full bg-signal px-8 py-3 font-bold text-canvas shadow-lg shadow-signal/30 hover:bg-signal-dark hover:-translate-y-0.5 hover:shadow-xl transition"
                >
                  أنشئ متجرك الآن
                </Link>
                <Link
                  href="/store/alhayes-fashion"
                  className="rounded-full border-2 border-harbor/15 px-8 py-3 font-bold text-harbor hover:bg-harbor/5 hover:-translate-y-0.5 transition"
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
                className="absolute -bottom-5 -right-5 inline-flex items-center gap-2 rounded-2xl bg-white shadow-xl px-5 py-3 text-sm font-bold text-harbor animate-bob"
                dir="rtl"
              >
                <Icon name="checkCircle" size={18} className="text-green-600" />
                طلب جديد مؤكد
              </span>
              <span
                className="absolute -top-5 -left-5 rounded-2xl bg-brass shadow-xl px-4 py-2.5 text-xs font-bold text-harbor animate-bob"
                style={{ animationDelay: "1.5s" }}
                dir="rtl"
              >
                <span className="inline-flex items-center gap-1.5">
                  +٤.٨
                  <Icon name="star" size={14} filled strokeWidth={1.5} />
                  تقييم العملاء
                </span>
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
      {/* Layout adapted from 21st.dev's "Feature Grid" (lavikatiyar):
          solid cards with the icon beside the copy on wider screens,
          rebuilt with Rifqa's own tokens. The previous translucent
          bg-white/60 cards let the pink page gradient bleed through and
          left the grey body text with poor contrast. */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <SectionHeading eyebrow="لماذا رفقة" title="كل ما يحتاجه متجرك، مبني لسوق ليبيا تحديدًا" />
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-2">
          {features.map((f, i) => (
            <Reveal key={f.title} delayMs={i * 100}>
              <div className="group flex h-full flex-col gap-5 rounded-2xl border border-white/60 bg-white p-7 shadow-lg shadow-harbor/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:flex-row sm:items-start">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-signal to-rose text-white shadow-md shadow-signal/30">
                  <Icon name={f.icon} size={26} />
                </span>
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-bold text-signal">{f.eyebrow}</p>
                  <h3 className="mb-2 font-display text-xl font-bold text-harbor">{f.title}</h3>
                  <p className="leading-relaxed text-harbor/70">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* VANEX PARTNERSHIP — a real, working integration (auto shipment
          creation on order confirmation, live tracking via their webhook,
          production API as of this section shipping — see docs/vanex.md
          equivalent in the codebase), not a logo dropped in for
          decoration. The "+115 مدينة" figure is the real count synced
          from Vanex's own /city/all endpoint against the live production
          account, kept as a safely-round "+115" rather than the exact
          117 so it doesn't need editing every time their coverage shifts
          by a city or two. */}
      <section className="bg-harbor">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <Image src="/marketing/vanex-logo.jpg" alt="Vanex" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
                  <span className="text-canvas/60 text-sm font-bold">بالشراكة مع</span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-extrabold text-canvas mb-4">
                  شحن حقيقي وسريع مع فانكس، في كل ليبيا
                </h2>
                <p className="text-canvas/70 leading-relaxed max-w-md mx-auto md:mx-0 mb-8">
                  متجرك متصل مباشرة بفانكس — فور تأكيد أي طلب، تُنشأ الشحنة تلقائيًا
                  ويحصل عميلك على رقم تتبع لحظي حتى وصول طرده لبابه، بلا تدخل يدوي
                  منك أو من فريقك.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <span className="rounded-full bg-canvas/10 px-4 py-2 text-sm font-bold text-canvas">+115 مدينة ومنطقة</span>
                  <span className="rounded-full bg-canvas/10 px-4 py-2 text-sm font-bold text-canvas">إنشاء شحنة تلقائي</span>
                  <span className="rounded-full bg-canvas/10 px-4 py-2 text-sm font-bold text-canvas">تتبع لحظي</span>
                  <span className="rounded-full bg-canvas/10 px-4 py-2 text-sm font-bold text-canvas">دفع عند الاستلام</span>
                </div>
              </div>
              <div className="relative mx-auto max-w-sm">
                <div className="absolute -inset-6 rounded-full bg-signal/20 blur-3xl" aria-hidden />
                <div className="relative rounded-[2rem] overflow-hidden border-4 border-canvas/10 shadow-2xl">
                  <Image src="/marketing/vanex-van.jpg" alt="شحنات فانكس" width={480} height={420} className="w-full h-auto object-cover" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SHOWCASE — the two illustrations, each paired with a real part of
          the merchant journey rather than dropped in as generic decoration.
          Sits directly on the site's own brand gradient now (no washed-out
          white section backdrop) so the blended images read against real
          color, with the copy in its own card for legibility. */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-24 space-y-20">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="order-2 md:order-1 rounded-2xl bg-white/90 shadow-xl p-8">
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
                {/* mix-blend-multiply drops the illustration's white canvas
                    out entirely (its white pixels let the page's own
                    background show through, so only the colored artwork
                    reads), and the radial mask feathers the rectangular
                    edge into a soft fade instead of a hard-cut border —
                    together the image sits IN the page, not on a tile. */}
                <Image
                  src="/marketing/illustration-family-shopping.jpg"
                  alt="عائلة تتسوّق عبر الإنترنت"
                  width={600}
                  height={480}
                  className="relative w-full h-auto mix-blend-multiply"
                  style={{ maskImage: "radial-gradient(ellipse 65% 65% at center, black 55%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 65% 65% at center, black 55%, transparent 100%)" }}
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
                  className="relative w-full h-auto mix-blend-multiply"
                  style={{ maskImage: "radial-gradient(ellipse 65% 65% at center, black 55%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 65% 65% at center, black 55%, transparent 100%)" }}
                />
              </div>
              <div className="rounded-2xl bg-white/90 shadow-xl p-8">
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

      {/* PRICING — one plan, every feature included; only the billing
          PERIOD varies now (was three feature-gated tiers). Kept the
          brand-gradient popular-card treatment from that redesign, just
          swapped what the three cards represent. */}
      <section id="pricing">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <SectionHeading
              eyebrow="الاشتراك"
              title="خطة واحدة، بكل الميزات — اختر المدة فقط"
              subtitle="كل مدة تشمل كل شيء من أول يوم — الفرق الوحيد هو كم توفّر."
            />
          </Reveal>

          {/* Card structure adapted from 21st.dev's "Pricing Section"
              (uilayout.contact): badge inline in the header row (it used
              to sit at -top-3 inside an overflow-hidden card, so it was
              clipped to a thin white sliver), the popular plan marked by a
              ring instead of only a gradient, and an "included" checklist
              so every card states what the price buys. */}
          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {periodList.map((period, i) => {
              const popular = period.id === "3m";
              return (
                <Reveal key={period.id} delayMs={i * 100}>
                  <div
                    className={`relative flex h-full flex-col rounded-3xl p-7 transition duration-300 hover:-translate-y-1 ${
                      popular
                        ? "bg-gradient-to-br from-signal via-rose to-brass text-white shadow-2xl shadow-signal/30 ring-4 ring-white/70 md:scale-[1.03]"
                        : "border border-white/60 bg-white text-harbor shadow-lg shadow-harbor/5 hover:shadow-xl"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-2xl font-extrabold">{period.label}</h3>
                        <p className={`mt-1 text-sm ${popular ? "text-white/85" : "text-harbor/60"}`}>{period.tagline}</p>
                      </div>
                      {period.badge && (
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                            popular ? "bg-white text-signal shadow-md" : "bg-signal/10 text-signal"
                          }`}
                        >
                          {period.badge}
                        </span>
                      )}
                    </div>

                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-display text-5xl font-extrabold tracking-tight">{period.totalPriceLYD}</span>
                      <span className="text-base font-bold">د.ل</span>
                    </p>
                    <p className={`mt-1 text-sm ${popular ? "text-white/85" : "text-harbor/60"}`}>= {period.monthlyEquivalentLYD} د.ل / شهر</p>
                    {period.savingsLabel && (
                      <p className={`mt-3 inline-block w-fit rounded-full px-3 py-1 text-xs font-bold ${popular ? "bg-white/20 text-white" : "bg-signal/10 text-signal"}`}>
                        {period.savingsLabel}
                      </p>
                    )}

                    <Link
                      href="/register"
                      className={`mt-6 block rounded-2xl py-3.5 text-center font-bold transition-colors ${
                        popular ? "bg-white text-signal shadow-lg hover:bg-white/90" : "bg-harbor text-canvas hover:bg-harbor-deep"
                      }`}
                    >
                      ابدأ بـ{period.label}
                    </Link>

                    <ul className={`mt-6 space-y-2.5 border-t pt-5 text-sm ${popular ? "border-white/25" : "border-harbor/10"}`}>
                      {PLAN_INCLUDES.map((item) => (
                        <li key={item} className="flex items-center gap-2.5">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              popular ? "bg-white/25 text-white" : "bg-signal/10 text-signal"
                            }`}
                          >
                            <Icon name="check" size={13} strokeWidth={3} />
                          </span>
                          <span className={popular ? "text-white/95" : "text-harbor/80"}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal delayMs={300}>
            <p className="mt-10 flex items-center justify-center gap-2 text-center rounded-2xl bg-white/90 shadow-xl px-6 py-4 mx-auto max-w-xl font-bold text-harbor">
              <Icon name="gift" size={20} className="text-signal shrink-0" />
              بونص: أول شهر مجانًا عند التسجيل، ثم خصم 50% على أول شهر مدفوع.
            </p>
          </Reveal>
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
              className="inline-block rounded-full bg-white px-10 py-3.5 font-bold text-signal shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition"
            >
              أنشئ متجرك مجانًا
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter transparent socialLinks={RIFQA_SOCIAL_LINKS} />
    </>
  );
}
