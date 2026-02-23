import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "pink" | "gray" | "green" | "orange";
  className?: string;
}

export function Badge({ children, variant = "pink", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full",
        variant === "pink" && "bg-[#FAE0EE] text-[#E8599A]",
        variant === "gray" && "bg-gray-100 text-gray-600",
        variant === "green" && "bg-green-100 text-green-700",
        variant === "orange" && "bg-orange-100 text-orange-700",
        className
      )}
    >
      {children}
    </span>
  );
}
