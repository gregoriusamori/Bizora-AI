import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-4">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          <span className="font-semibold">AI BI</span>
        </div>
        <nav className="space-y-1 px-4">
          {['Overview', 'Sales', 'Profit', 'Products', 'Branches', 'Predictive', 'AI Chat', 'Reports'].map(
            (item) => (
              <Link
                key={item}
                to={
                  item === 'Predictive'
                    ? '/dashboard/predictive'
                    : item === 'Reports'
                      ? '/dashboard/reports'
                      : item === 'AI Chat'
                        ? '/dashboard/chat'
                        : '/dashboard'
                }
                className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {item}
              </Link>
            ),
          )}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold">Dashboard Overview</h1>
        <p className="mt-2 text-slate-600">Belum ada dataset aktif. Import dataset untuk memulai analisis.</p>
      </main>
    </div>
  );
}
