import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "bg-[#F7F4F0] rounded-[20px] shadow-sm p-5",
        onClick && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[#6B6B6B] uppercase tracking-wider mb-1">{children}</p>;
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-4",
        className
      )}
    >
      {children}
    </h2>
  );
}
