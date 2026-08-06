'use client';

import Image from "next/image";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  description: string;
  descriptionAr: string;
  price: number;
  billingType: string;
  thumbnail: string;
  previewUrl: string;
  features: readonly string[];
  usageCount: number;
  rating: number;
  reviews: number;
  isNew: boolean;
  featured: boolean;
}

interface TemplateSelectorProps {
  templates: readonly Template[];
  onSelect: (template: Template) => void;
  selectedId?: string | null;
}

export default function TemplateSelector({ templates, onSelect, selectedId }: TemplateSelectorProps) {
  const freeTemplates = templates.filter((t) => t.price === 0);
  const paidTemplates = templates.filter((t) => t.price > 0);

  return (
    <div className="space-y-12 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">اختر تصميم متجرك</h1>
        <p className="text-gray-600">اختر من مجموعة قوالبنا المتعددة لتجعل متجرك فريداً</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-bold">قوالب مجانية</h2>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">مجاني</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {freeTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} isSelected={selectedId === template.id} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {paidTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-bold">قوالب متميزة</h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">مميز</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paidTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} isSelected={selectedId === template.id} onSelect={onSelect} isPaid />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
  isPaid = false,
}: {
  template: Template;
  isSelected: boolean;
  onSelect: (template: Template) => void;
  isPaid?: boolean;
}) {
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i += 1) {
      stars.push(<span key={i} className={i < Math.floor(rating) ? "text-yellow-400" : "text-gray-300"}>⭐</span>);
    }
    return stars;
  };

  return (
    <div
      onClick={() => onSelect(template)}
      className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
        isSelected ? "border-blue-600 shadow-lg ring-2 ring-blue-500 ring-offset-2" : "border-gray-200 hover:border-gray-400"
      }`}
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        <Image src={template.thumbnail} alt={template.nameAr} fill className="object-cover" />
        {template.isNew && (
          <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">جديد ✨</div>
        )}
        {isPaid && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            {template.price} د.ل{template.billingType === "monthly" && "/شهر"}
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
            <div className="bg-white text-blue-600 rounded-full p-3">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-lg font-bold text-gray-900">{template.nameAr}</h3>
        <p className="text-sm text-gray-600 line-clamp-2">{template.descriptionAr}</p>

        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">{renderStars(template.rating)}</div>
          <span className="text-sm text-gray-600">({template.reviews} تقييم)</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {template.features.slice(0, 2).map((feature, idx) => (
            <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {feature}
            </span>
          ))}
          {template.features.length > 2 && <span className="text-xs text-gray-500">+{template.features.length - 2} أخرى</span>}
        </div>

        <p className="text-xs text-gray-500">{template.usageCount}+ متجر يستخدم هذا القالب</p>

        <Link href={template.previewUrl} target="_blank" className="text-sm text-blue-600 hover:underline">
          عرض حي →
        </Link>

        <button className={`w-full py-2 rounded-lg font-bold transition ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"}`}>
          {isSelected ? "✓ مختار" : "اختر هذا القالب"}
        </button>
      </div>
    </div>
  );
}
