import { Link } from 'react-router-dom';
import { BarChart3, BrainCircuit, Database, ShieldCheck, Sparkles } from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description: 'Analisis penjualan, revenue, profit, produk, cabang, dan regional dari data aktual.',
  },
  {
    icon: BrainCircuit,
    title: 'Conversational AI',
    description: 'Tanyakan apa saja tentang bisnis dalam bahasa alami, AI langsung menjawab berdasarkan data.',
  },
  {
    icon: Database,
    title: 'Dynamic Dataset',
    description: 'Import dataset CSV, Excel, JSON, atau database tanpa perlu hardcode struktur tabel.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    description: 'Read-only database, SQL validation, audit log, dan akses berdasarkan organisasi.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            <span>AI Business Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Login Admin
            </Link>
            <Link
              to="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Login User
            </Link>
            <Link
              to="/dashboard"
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Open Dashboard
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1 text-sm text-indigo-700">
            <Sparkles className="h-4 w-4" />
            AI + Business Intelligence Platform
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight">
            Analisis Bisnis Cerdas dengan AI
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Platform AI Business Intelligence yang menggabungkan analisis data,
            visualisasi interaktif, dan conversational analytics dalam satu.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/dashboard"
              className="rounded-md bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
            >
              Coba Dashboard
            </Link>
            <Link
              to="/dashboard"
              className="rounded-md border border-slate-300 px-6 py-3 hover:bg-slate-50"
            >
              Pelajari Fitur
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-200 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold">Fitur Utama</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-slate-200 p-6">
                  <f.icon className="h-8 w-8 text-indigo-600" />
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <p>AI Business Intelligence Platform</p>
      </footer>
    </div>
  );
}
