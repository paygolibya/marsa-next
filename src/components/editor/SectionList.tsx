"use client";

import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SECTION_TYPE_LABELS, type SectionType } from "@/components/storefront/sections/types";

export type EditableSection = {
  id: string; // always present client-side, even for a not-yet-saved section (see SectionEditor)
  type: SectionType;
  enabled: boolean;
  settings: unknown;
};

// Drag-and-drop reorder + enable-toggle + remove + select-for-settings, all
// on one ordered list. Uses @dnd-kit (not the native-HTML5-DnD pattern
// elsewhere in this codebase) specifically for touch support — merchants
// manage stores from phones, and native HTML5 DnD has no touch backing at
// all — plus keyboard accessibility (arrow-key reordering) for free.
export function SectionList({
  sections,
  selectedId,
  onReorder,
  onToggleEnabled,
  onRemove,
  onSelect,
}: {
  sections: EditableSection[];
  selectedId: string | null;
  onReorder: (next: EditableSection[]) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              selected={selectedId === section.id}
              onToggleEnabled={(enabled) => onToggleEnabled(section.id, enabled)}
              onRemove={() => onRemove(section.id)}
              onSelect={() => onSelect(section.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SectionRow({
  section,
  selected,
  onToggleEnabled,
  onRemove,
  onSelect,
}: {
  section: EditableSection;
  selected: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onRemove: () => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border bg-white p-3 transition-colors ${
        selected ? "border-brass shadow-sm" : "border-harbor/10"
      } ${isDragging ? "opacity-50" : ""} ${!section.enabled ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="اسحب لإعادة الترتيب"
        className="cursor-grab active:cursor-grabbing text-rope select-none px-1 touch-none"
      >
        ⠿
      </button>

      <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-right">
        <p className="text-sm font-bold text-harbor truncate">{SECTION_TYPE_LABELS[section.type]}</p>
      </button>

      <label className="inline-flex items-center cursor-pointer shrink-0" title={section.enabled ? "مفعّل" : "غير مفعّل"}>
        <input type="checkbox" checked={section.enabled} onChange={(e) => onToggleEnabled(e.target.checked)} className="sr-only peer" />
        <span className="w-9 h-5 rounded-full bg-harbor/15 peer-checked:bg-brass transition-colors relative">
          <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-4" />
        </span>
      </label>

      <button type="button" onClick={onSelect} className="text-xs font-bold text-harbor hover:underline shrink-0">
        إعدادات
      </button>
      <button type="button" onClick={onRemove} className="text-xs font-bold text-signal hover:underline shrink-0">
        حذف
      </button>
    </div>
  );
}
