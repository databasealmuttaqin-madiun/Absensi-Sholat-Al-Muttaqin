import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, ClipboardCheck, FileText, Settings, UserCheck, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';
import AttendanceList from './components/AttendanceList';
import RecapView from './components/RecapView';
import Dashboard from './components/Dashboard';

type Tab = 'attendance' | 'recap' | 'stats';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('attendance');

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 selection:bg-indigo-100">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-900">Absensi Sholat Digital</h1>
            <p className="text-slate-500 font-medium mt-1">Pondok Pesantren • <span className="text-indigo-600 font-bold">Al Muttaqin</span></p>
          </div>
          
          <nav className="flex items-center bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
            <NavButton 
              active={activeTab === 'attendance'} 
              onClick={() => setActiveTab('attendance')}
              label="Presensi"
            />
            <NavButton 
              active={activeTab === 'recap'} 
              onClick={() => setActiveTab('recap')}
              label="Rekap Data"
            />
            <NavButton 
              active={activeTab === 'stats'} 
              onClick={() => setActiveTab('stats')}
              label="Statistik"
            />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 pb-24">
        {activeTab === 'attendance' && <AttendanceList />}
        {activeTab === 'recap' && <RecapView />}
        {activeTab === 'stats' && <Dashboard />}
      </main>

      {/* Mobile Footer Status (Visible on desktop too in design) */}
      <footer className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] opacity-80">
        <div className="flex gap-6">
          <span>Connected</span>
          <span className="hidden sm:inline">DB Active</span>
        </div>
        <div className="bg-white px-3 py-1 rounded-lg border border-slate-200">
          Al Muttaqin v1
        </div>
      </footer>
    </div>
  );
}

function NavButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-xl transition-all duration-200 font-bold text-xs uppercase tracking-wider",
        active ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "hover:bg-slate-50 text-slate-500"
      )}
    >
      {label}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-200",
        active ? "text-emerald-700" : "text-slate-400"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-emerald-700 mt-0.5" />}
    </button>
  );
}
