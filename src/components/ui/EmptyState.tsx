import { Icon, type IconName } from "./Icon";

// An icon in a soft tinted circle above the message — an empty list reads
// as an intentional "nothing here yet" state, not a page that failed to
// load. Every existing call site keeps working unchanged (icon defaults
// to "inbox").
export function EmptyState({
  title,
  description,
  action,
  icon = "inbox",
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center py-14 px-6 ${className}`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brass/15 text-brass">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-harbor font-bold text-base">{title}</p>
      {description && <p className="text-rope text-sm mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
