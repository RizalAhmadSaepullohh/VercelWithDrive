"use client";

import Image from "next/image";
import { Poppins } from "next/font/google";
import AssessmentFlow from "@/app/components/AssessmentFlow";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export default function Home() {
  return (
    <main className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/60 text-slate-900 ${poppins.className}`}>
      {/* Latar Belakang Lingkaran Dinamis Premium */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 right-10 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <section className="max-w-5xl mx-auto px-4 pt-8 pb-4">
        <header className="hidden md:flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur-md border border-slate-100/80 shadow-sm p-5 transition-all hover:shadow">
          <div className="flex items-center gap-3.5">
            <Image
              src="/loogo.png"
              alt="I-Speak Logo"
              width={42}
              height={42}
              priority
              className="rounded-full shadow-sm"
            />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">I-Speak Terpadu</h1>
              <p className="text-xs text-slate-500 font-medium">
                Sistem Penilaian Kemahiran Berbicara Bahasa Inggris Otomatis (Server IS ITENAS)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              FastAPI Backend Link
            </span>
          </div>
        </header>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-12">
        <AssessmentFlow />
      </section>
    </main>
  );
}
