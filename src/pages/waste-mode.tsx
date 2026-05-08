import { useLocation } from "wouter";
import { ClipboardList, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ModeCardProps = {
  title: string;
  desc: string;
  bullets: string[];
  icon: React.ElementType;
  accent: string;
  onClick: () => void;
};

function ModeCard({ title, desc, bullets, icon: Icon, accent, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border-2 border-[#2a2a2a] bg-[#111] p-5 text-left shadow-nb-md transition-all hover:-translate-y-0.5 hover:border-[#FFE500] hover:bg-[#141414]"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black uppercase tracking-wide text-white">{title}</h2>
          <p className="mt-1 text-sm text-[#9CA3AF]">{desc}</p>
        </div>
      </div>

      <ul className="space-y-1.5 text-xs text-[#C9D1D9]">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span className="mt-0.5 text-[#FFE500]">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

export default function WasteMode() {
  const [, setLocation] = useLocation();
  const { tenantName } = useAuth();

  return (
    <div className="flex-1 bg-[#0a0a0a] text-[#f0f0f0]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
        <div className="rounded-xl border-2 border-[#222] bg-[#111] p-5 shadow-nb-md">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#FFE500]">Pilih Metode Input</p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide text-white">Input Waste</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            {tenantName ? `${tenantName} • ` : ""}pilih cara input sesuai kebutuhan shift sekarang.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ModeCard
            title="Manual Input"
            desc="Isi item satu-satu lewat UI builder. Aman buat input teliti dan koreksi per baris."
            bullets={[
              "Pilih item dari katalog per station",
              "Cocok buat input campuran dan edit detail",
              "Flow sama seperti input waste current",
            ]}
            icon={ClipboardList}
            accent="border-[#4FD1FF] bg-[#08131a] text-[#4FD1FF]"
            onClick={() => setLocation("/manual-waste")}
          />

          <ModeCard
            title="Auto Waste"
            desc="Paste banyak item sekaligus pakai format cepat: NAMA (KODE LOT): QTY SATUAN ALASAN."
            bullets={[
              "Config shift/QC/manager dipilih di UI",
              "Cocok buat power-user dan batch input cepat",
              "Ada preview hasil parse sebelum submit",
            ]}
            icon={Zap}
            accent="border-[#FFE500] bg-[#1a1a00] text-[#FFE500]"
            onClick={() => setLocation("/auto-waste")}
          />
        </div>
      </div>
    </div>
  );
}
