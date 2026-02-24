import { BottomNav } from "@/components/ui/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, var(--color-page-bg-light) 0%, var(--color-page-bg) 100%)", backgroundAttachment: "fixed" }}>
      <main className="max-w-lg mx-auto pb-24 min-h-screen">{children}</main>
      <BottomNav />
    </div>
  );
}
