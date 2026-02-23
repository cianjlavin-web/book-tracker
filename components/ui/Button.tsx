import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-[#E8599A] text-white hover:bg-[#d44d8a] active:scale-95",
        variant === "secondary" && "bg-[#FAE0EE] text-[#E8599A] hover:bg-[#F4A7CB]",
        variant === "ghost" && "bg-transparent text-[#6B6B6B] hover:bg-white/20",
        variant === "danger" && "bg-red-500 text-white hover:bg-red-600",
        size === "sm" && "text-xs px-3 py-1.5",
        size === "md" && "text-sm px-4 py-2",
        size === "lg" && "text-base px-6 py-3",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
