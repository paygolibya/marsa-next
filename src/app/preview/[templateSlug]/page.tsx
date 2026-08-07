import Link from "next/link";
import { notFound } from "next/navigation";
import { templatesData } from "@/lib/templates-data";

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateSlug: string }>;
}) {
  const { templateSlug } = await params;
  const template = templatesData.find((t) => t.slug === templateSlug);

  if (!template) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-harbor/10 bg-white p-8">
        <h1 className="font-display text-3xl font-extrabold text-harbor mb-3">
          معاينة قالب: {template.nameAr}
        </h1>
        <p className="text-rope mb-6">{template.descriptionAr}</p>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl border border-harbor/10 p-4">
            <p className="text-sm text-rope mb-1">اللون الأساسي</p>
            <div
              className="h-10 rounded-md border"
              style={{ backgroundColor: template.defaultColors.primaryColor }}
            />
          </div>
          <div className="rounded-xl border border-harbor/10 p-4">
            <p className="text-sm text-rope mb-1">اللون الثانوي</p>
            <div
              className="h-10 rounded-md border"
              style={{ backgroundColor: template.defaultColors.secondaryColor }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-harbor/5 p-4 mb-8">
          <h2 className="font-bold text-harbor mb-2">مميزات القالب</h2>
          <ul className="list-disc pr-5 space-y-1 text-rope">
            {template.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Link
            href="/onboarding"
            className="rounded-full bg-signal px-6 py-3 text-canvas font-bold hover:bg-signal-dark transition-colors"
          >
            اختر هذا القالب
          </Link>
          <Link
            href="/"
            className="rounded-full border border-harbor/20 px-6 py-3 text-harbor font-bold hover:bg-harbor/5 transition-colors"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
