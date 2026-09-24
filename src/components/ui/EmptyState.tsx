export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-center py-16 px-6 ${className}`}>
      <p className="text-harbor font-bold">{title}</p>
      {description && <p className="text-rope text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
