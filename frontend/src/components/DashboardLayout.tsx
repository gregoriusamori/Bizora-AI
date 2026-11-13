import { Link, useLocation } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import type { ReactNode } from 'react';

const NAV_ITEMS: Array<{ label: string; to: string }> = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'Sales', to: '/dashboard/sales' },
  { label: 'Profit', to: '/dashboard/profit' },
  { label: 'Products', to: '/dashboard/products' },
  { label: 'Branches', to: '/dashboard/branches' },
  { label: 'Predictive', to: '/dashboard/predictive' },
  { label: 'AI Chat', to: '/dashboard/chat' },
  { label: 'Reports', to: '/dashboard/reports' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-4">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          <span className="font-semibold">AI BI</span>
        </div>
        <nav className="space-y-1 px-4">
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`block rounded-md px-3 py-2 text-sm hover:bg-slate-100 ${
                  active ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
