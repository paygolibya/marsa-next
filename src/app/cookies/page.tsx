import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

// Honest and short on purpose — the app genuinely doesn't use tracking
// cookies today (see CookieConsentBanner's own comment); this names
// exactly what's real instead of generic boilerplate legalese.
export default function CookiesPolicyPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl bg-white/90 shadow-xl p-8">
          <h1 className="font-display text-3xl font-extrabold text-harbor mb-6">سياسة ملفات تعريف الارتباط</h1>
          <div className="space-y-5 text-rope leading-relaxed">
            <p>
              رفقة لا تستخدم ملفات تعريف ارتباط (cookies) للتتبع أو الإعلانات. تسجيل الدخول وسلة التسوق
              يعملان عبر تخزين محلي (localStorage) على جهازك، وهو ليس ملف تعريف ارتباط — لا يُرسَل تلقائيًا
              مع كل طلب، ويبقى على جهازك فقط.
            </p>
            <p>
              الاستثناء الوحيد: إذا فعّل المتجر محادثة الدعم المباشر (Crisp)، فإن هذه الخدمة الخارجية تضع
              ملفات تعريف ارتباط خاصة بها لإدارة جلسة المحادثة. تظهر هذه فقط بعد موافقتك، ويمكنك سحب
              موافقتك في أي وقت عبر مسح بيانات الموقع من إعدادات متصفحك.
            </p>
            <p>لا نشارك أي بيانات تصفح مع جهات إعلانية، ولا نستخدم أي أداة تحليلات تتبعك عبر مواقع أخرى.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
