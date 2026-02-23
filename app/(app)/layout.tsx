import { BottomNav } from "@/components/ui/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#4D4465]">
      <main className="max-w-lg mx-auto pb-24 min-h-screen">{children}</main>
      <BottomNav />
    </div>
  );
}
