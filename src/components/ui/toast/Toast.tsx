export type ToastTone = "success" | "error" | "info";

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "bg-green-600",
  error: "bg-signal",
  info: "bg-harbor",
};

export function Toast({ message, tone }: { message: string; tone: ToastTone }) {
  return (
    <div role="status" className={`rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg ${TONE_CLASSES[tone]}`}>
      {message}
    </div>
  );
}
