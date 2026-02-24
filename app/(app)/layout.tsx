import { BottomNav } from "@/components/ui/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-page-bg)" }}>
      <main className="max-w-lg mx-auto pb-24 min-h-screen">{children}</main>
      <BottomNav />
    </div>
  );
}
