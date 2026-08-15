export function SectionEyebrow({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="text-sm font-medium uppercase tracking-[0.32em] text-primary md:text-base">
      {number} — {label}
    </div>
  );
}

export function GoldDivider({ className = "" }: { className?: string }) {
  return <div className={`h-px w-10 bg-primary ${className}`} />;
}
