import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AbsenSholat, Santri } from '../types';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3, 
  PieChart, 
  Target,
  ArrowUpRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { 
  startOfDay, endOfDay, 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth,
  format
} from 'date-fns';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    bySholat: {} as Record<string, number>,
    byKelas: {} as Record<string, number>
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const now = new Date();
      
      // Fetch Santri Count
      const { count: totalSantri } = await supabase.from('santri').select('*', { count: 'exact', head: true });
      const baseCount = totalSantri || 0;

      // Fetch Attendance
      const { data: monthData } = await supabase
        .from('absen_sholat')
        .select('*')
        .gte('created_at', startOfMonth(now).toISOString());

      if (monthData) {
        const todayStr = format(now, 'yyyy-MM-dd');
        const startOfWk = startOfWeek(now, { weekStartsOn: 1 });

        const todayAbsen = monthData.filter(a => format(new Date(a.created_at!), 'yyyy-MM-dd') === todayStr);
        const weekAbsen = monthData.filter(a => new Date(a.created_at!) >= startOfWk);

        const sholatCounts: Record<string, number> = {};
        const kelasCounts: Record<string, number> = {};
        
        monthData.forEach(a => {
          if (a.kehadiran === 'Berjamaah' || a.kehadiran === 'Telat') {
            sholatCounts[a.sholat] = (sholatCounts[a.sholat] || 0) + 1;
            kelasCounts[a.kelas] = (kelasCounts[a.kelas] || 0) + 1;
          }
        });

        // 5 sholat per day per santri
        const totalExpectToday = baseCount * 5; 
        const totalExpectWeek = baseCount * 35;
        const totalExpectMonth = baseCount * 150; // Approximation

        setStats({
          today: totalExpectToday > 0 ? Math.round((todayAbsen.length / totalExpectToday) * 100) : 0,
          week: totalExpectWeek > 0 ? Math.round((weekAbsen.length / totalExpectWeek) * 100) : 0,
          month: totalExpectMonth > 0 ? Math.round((monthData.length / totalExpectMonth) * 100) : 0,
          bySholat: sholatCounts,
          byKelas: kelasCounts
        });
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
     return <div className="py-20 text-center text-slate-400">Menghitung statistik...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Hadir Berjamaah" 
          value={`${stats.today}%`} 
          icon={<CheckCircle2 className="w-5 h-5 text-indigo-300" />}
          trend="+4% dari kemarin"
          color="indigo-dark"
        />
        <StatCard 
          label="Rata-rata Telat" 
          value={`${stats.week}%`} 
          icon={<Clock className="w-5 h-5 text-rose-500" />}
          trend="Minggu ini"
          color="white"
        />
        <StatCard 
          label="Total Presensi" 
          value={`${stats.month}%`} 
          icon={<Users className="w-5 h-5 text-emerald-100" />}
          trend="Bulan ini"
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sholat Distribution */}
        <div className="lg:col-span-12 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-50 p-3 rounded-2xl">
                 <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-black text-2xl text-slate-800 tracking-tight">Kehadiran per Sholat</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Data Akumulatif Bulan Ini</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'].map(s => {
              const count = stats.bySholat[s] || 0;
              const values = Object.values(stats.bySholat) as number[];
              const max = values.length > 0 ? Math.max(...values) : 1;
              const height = (count / (max || 1)) * 100;
              return (
                <div key={s} className="flex flex-col items-center gap-4 group">
                  <div className="w-full flex-1 min-h-[200px] bg-slate-50 rounded-3xl p-1.5 flex flex-col justify-end overflow-hidden border border-slate-100">
                    <div 
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl transition-all duration-1000 ease-out group-hover:from-indigo-500 group-hover:to-indigo-300" 
                      style={{ height: `${height}%` }} 
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s}</p>
                    <p className="text-lg font-black text-slate-800">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performa Section */}
        <div className="lg:col-span-12 bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl text-white overflow-hidden relative">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                 <div className="bg-white/10 p-3 rounded-2xl">
                   <Target className="w-6 h-6 text-emerald-400" />
                 </div>
                 <div>
                   <h3 className="font-black text-2xl tracking-tight">Top Performa Kelas</h3>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Peringkat Berdasarkan Kedisiplinan</p>
                 </div>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Update</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries((stats.byKelas as Record<string, number>))
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 6)
                .map(([kelas, count], idx) => (
                  <div key={kelas} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-5xl font-black text-white/5 group-hover:text-white/10 transition-colors italic">0{idx + 1}</span>
                      <div className="bg-emerald-500/20 px-3 py-1 rounded-lg text-emerald-400 text-xs font-black uppercase">Rank {idx + 1}</div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Kelas</p>
                        <h4 className="text-2xl font-black">{kelas}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Check-ins</p>
                        <p className="text-2xl font-black text-emerald-400">{count}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-10 p-6 bg-white/5 rounded-3xl border border-dashed border-white/10 flex items-center gap-6">
               <div className="hidden md:flex p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/50">
                  <ArrowUpRight className="w-6 h-6 text-white" />
               </div>
               <p className="text-sm text-slate-400 leading-relaxed font-medium">
                 Data statistik dikalkulasi secara otomatis dari record presensi 30 hari terakhir. 
                 Kelas dengan persentase <span className="text-emerald-400 font-bold">Berjamaah</span> tertinggi akan muncul di daftar teratas.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend, color }: { label: string, value: string, icon: React.ReactNode, trend: string, color: string }) {
  const styles = {
    "indigo-dark": "bg-indigo-900 text-white shadow-indigo-100",
    "white": "bg-white text-slate-900 border border-slate-200",
    "emerald": "bg-emerald-500 text-white shadow-emerald-100"
  } as any;

  const trendStyles = {
    "indigo-dark": "text-indigo-300 border-indigo-700",
    "white": "text-rose-500 border-slate-100",
    "emerald": "text-emerald-100 border-emerald-400"
  } as any;

  return (
    <div className={cn("p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between min-h-[220px] transition-transform hover:scale-[1.02]", styles[color])}>
      <div className="flex justify-between items-start">
        <p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", 
          color === 'white' ? "text-slate-400" : color === 'emerald' ? "text-emerald-100" : "text-indigo-300"
        )}>{label}</p>
        <div className={cn("p-2 rounded-xl bg-white/10", color === 'white' && "bg-slate-50")}>
           {icon}
        </div>
      </div>
      
      <div>
        <div className="flex items-baseline gap-2 mb-2">
           <h4 className="text-5xl font-black italic tracking-tighter">{value}</h4>
           <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded border mb-2", trendStyles[color])}>
             {trend}
           </div>
        </div>
      </div>
    </div>
  );
}
