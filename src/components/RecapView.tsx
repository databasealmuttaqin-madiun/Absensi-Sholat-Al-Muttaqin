import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AbsenSholat, Santri } from '../types';
import { 
  FileDown, 
  Search, 
  Calendar, 
  ChevronDown, 
  ArrowUpDown, 
  TrendingUp, 
  Download,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { 
  startOfDay, endOfDay, 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  subDays
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { cn } from '../lib/utils';

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function RecapView() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<AbsenSholat[]>([]);
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');

  useEffect(() => {
    fetchRecapData();
  }, [viewMode]);

  async function fetchRecapData() {
    setLoading(true);
    try {
      const now = new Date();
      let start, end;

      if (viewMode === 'daily') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (viewMode === 'weekly') {
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
      } else {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }

      // 1. Ambil daftar santri sebagai baseline
      const { data: sData, error: sError } = await supabase.from('santri').select('*');
      if (sError) throw new Error(`Gagal ambil data santri: ${sError.message}`);
      setSantriList(sData || []);

      // 2. Ambil data absensi
      // Kita coba filter berdasarkan waktu, jika gagal (mungkin kolom created_at tidak ada), ambil semua
      let query = supabase.from('absen_sholat').select('*');
      
      // Coba tambahkan filter waktu
      const { data: aData, error: aError } = await query
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      
      if (aError) {
        console.warn("Gagal filter waktu (mungkin kolom created_at tidak ada), mencoba ambil semua data...");
        const { data: allData, error: allErr } = await supabase.from('absen_sholat').select('*');
        if (allErr) throw new Error(`Gagal ambil data absen: ${allErr.message}`);
        setAttendanceData(allData || []);
      } else {
        setAttendanceData(aData || []);
      }
    } catch (err: any) {
      console.error("Error fetching recap:", err);
      alert(`Error Rekap: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const recapItems = useMemo(() => {
    const stats: Record<string, any> = {};

    // Baseline stats for each santri
    santriList.forEach(s => {
      const key = `${s.nama}-${s.kelas}`;
      stats[key] = {
        nama: s.nama,
        kelas: s.kelas,
        berjamaah: 0,
        telat: 0,
        pulang: 0,
        sakit: 0,
        unmarked: 0
      };
    });

    // Populate from actual attendance
    attendanceData.forEach(a => {
      const key = `${a.nama}-${a.kelas}`;
      if (!stats[key]) return;

      if (a.kehadiran === 'Berjamaah') stats[key].berjamaah++;
      else if (a.kehadiran === 'Telat') stats[key].telat++;
      else if (a.kehadiran === 'Pulang') stats[key].pulang++;
      else if (a.kehadiran === 'Sakit') stats[key].sakit++;
    });

    // Determine total sholat opportunities in period
    let totalOpportunities = 0;
    const now = new Date();
    if (viewMode === 'daily') {
       // Total sholat today that HAVE HAPPENED or are IN PROGRESS
       totalOpportunities = 5; // Simplified for report
    } else if (viewMode === 'weekly') {
       totalOpportunities = 35;
    } else {
       totalOpportunities = 30 * 5; // Approx
    }

    // Convert map to array and calculate "Tidak Hadir"
    return Object.values(stats)
      .map(item => {
        const totalFound = item.berjamaah + item.telat + item.pulang + item.sakit;
        item.tidakHadir = Math.max(0, totalOpportunities - totalFound);
        item.score = item.berjamaah * 2 + item.telat * 1; // Heuristic for ordering
        return item;
      })
      .filter(item => {
        const matchSearch = item.nama.toLowerCase().includes(searchQuery.toLowerCase());
        const matchKelas = selectedKelas ? item.kelas === selectedKelas : true;
        return matchSearch && matchKelas;
      })
      .sort((a, b) => b.berjamaah - a.berjamaah || b.score - a.score);
  }, [santriList, attendanceData, viewMode, searchQuery, selectedKelas]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Nama", "Kelas", "Hadir", "Telat", "Tidak Hadir", "Status"];
    const tableRows: any[] = [];

    recapItems.forEach(item => {
      const rowData = [
        item.nama,
        item.kelas,
        item.berjamaah,
        item.telat,
        item.tidakHadir,
        item.pulang > 0 ? 'Pulang' : item.sakit > 0 ? 'Sakit' : 'Aktif'
      ];
      tableRows.push(rowData);
    });

    doc.setFontSize(18);
    doc.text(`Rekap Absensi Sholat (${viewMode.toUpperCase()})`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] }
    });

    doc.save(`rekap_sholat_${viewMode}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const kelasList = useMemo(() => Array.from(new Set(santriList.map(s => s.kelas))).sort(), [santriList]);

  const showStudentHistory = (item: any) => {
    const sholatList = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];
    
    if (viewMode === 'daily') {
      const studentRecords = attendanceData.filter(a => a.nama === item.nama && a.kelas === item.kelas);
      
      let historyHtml = '<div class="text-left space-y-2 mt-4">';
      sholatList.forEach(s => {
        const record = studentRecords.find(r => r.sholat === s);
        let statusText = 'Tidak Berjamaah';
        let statusColor = 'text-slate-400';
        
        if (record) {
          statusText = record.kehadiran;
          if (statusText === 'Berjamaah') statusColor = 'text-emerald-500';
          else if (statusText === 'Telat') statusColor = 'text-amber-500';
          else if (statusText === 'Pulang') statusColor = 'text-indigo-500';
          else if (statusText === 'Sakit') statusColor = 'text-rose-400';
        }
        
        historyHtml += `
          <div class="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
            <span class="font-bold text-slate-600">${s}</span>
            <span class="font-black text-[10px] uppercase tracking-[0.1em] ${statusColor}">${statusText}</span>
          </div>
        `;
      });
      historyHtml += '</div>';

      Swal.fire({
        title: item.nama,
        text: `Presensi Sholat - Hari Ini`,
        html: historyHtml,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Tutup',
        customClass: {
          title: 'text-xl font-black text-slate-800',
          popup: 'rounded-[1.5rem] p-6',
        }
      });
    } else {
      const total = item.berjamaah + item.telat + item.tidakHadir;
      const percentage = total > 0 ? Math.round((item.berjamaah / total) * 100) : 0;
      
      const statsHtml = `
        <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-emerald-50 p-4 rounded-2xl flex flex-col items-center justify-center">
            <div class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Berjamaah</div>
            <div class="text-2xl font-black text-emerald-700">${item.berjamaah} x</div>
          </div>
          <div class="bg-amber-50 p-4 rounded-2xl flex flex-col items-center justify-center">
            <div class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Telat</div>
            <div class="text-2xl font-black text-amber-700">${item.telat} x</div>
          </div>
          <div class="bg-rose-50 p-4 rounded-2xl flex flex-col items-center justify-center">
            <div class="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Tidak Berjamaah</div>
            <div class="text-2xl font-black text-rose-700">${item.tidakHadir} x</div>
          </div>
          <div class="bg-indigo-50 p-4 rounded-2xl flex flex-col items-center justify-center">
            <div class="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Persentase</div>
            <div class="text-2xl font-black text-indigo-700">${percentage}%</div>
          </div>
        </div>
      `;

      Swal.fire({
        title: item.nama,
        html: `
          <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Rekap ${viewMode === 'weekly' ? 'Mingguan' : 'Bulanan'} - Kelas ${item.kelas}</div>
          ${statsHtml}
        `,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Tutup',
        customClass: {
          title: 'text-xl font-black text-slate-800',
          popup: 'rounded-[1.5rem] p-6',
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Export Section */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex w-fit">
          <ViewButton active={viewMode === 'daily'} onClick={() => setViewMode('daily')}>Harian</ViewButton>
          <ViewButton active={viewMode === 'weekly'} onClick={() => setViewMode('weekly')}>Mingguan</ViewButton>
          <ViewButton active={viewMode === 'monthly'} onClick={() => setViewMode('monthly')}>Bulanan</ViewButton>
        </div>

        <button 
          onClick={exportPDF}
          className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 w-full lg:w-auto justify-center"
        >
          <Download className="w-4 h-4" />
          Unduh Rekap PDF
        </button>
      </div>

      {/* Main Recap Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Table Section */}
        <section className="col-span-12 bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm flex flex-col min-h-[600px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Rekapitulasi Kehadiran</h2>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-colors group-focus-within:text-indigo-600" />
                <input 
                  type="text" 
                  placeholder="Cari santri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 pl-11 pr-4 py-2.5 rounded-xl border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none w-full md:w-64"
                />
              </div>
              <select 
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 text-sm font-bold text-slate-600 outline-none cursor-pointer"
              >
                <option value="">Semua Kelas</option>
                {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <table className="w-full text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50">
                <tr>
                  <th className="pb-4 px-2">Nama Santri & Kelas</th>
                  <th className="pb-4 px-2 text-center">Berjamaah</th>
                  <th className="pb-4 px-2 text-center">Telat</th>
                  <th className="pb-4 px-2 text-center">Alpha</th>
                  <th className="pb-4 px-2 text-right">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic font-medium">Bentar, lagi narik data...</td></tr>
                ) : recapItems.map((item, idx) => {
                  const total = item.berjamaah + item.telat + item.tidakHadir;
                  const percentage = total > 0 ? Math.round((item.berjamaah / total) * 100) : 0;
                  
                  return (
                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-5 px-2">
                        <button 
                          onClick={() => showStudentHistory(item)}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.nama}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Kelas {item.kelas}</div>
                        </button>
                      </td>
                      <td className="py-5 px-2 text-center font-mono font-bold text-slate-700">{item.berjamaah}</td>
                      <td className="py-5 px-2 text-center font-mono font-bold text-rose-500">{item.telat}</td>
                      <td className="py-5 px-2 text-center font-mono font-bold text-slate-300">{item.tidakHadir}</td>
                      <td className="py-5 px-2 text-right">
                        <span className={cn(
                          "px-2.5 py-1 text-[10px] font-black rounded-lg inline-block",
                          percentage > 90 ? "bg-emerald-100 text-emerald-700" : 
                          percentage > 75 ? "bg-indigo-100 text-indigo-700" :
                          percentage > 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {percentage}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Chart Visual Footer similar to Design */}
          <div className="mt-8 pt-8 border-t border-slate-50 flex items-end gap-1.5 h-16 px-2">
            {[0.8, 0.9, 0.75, 0.85, 0.6, 0.95, 0.88, 0.7, 0.9, 0.8, 0.85, 0.9].map((h, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex-1 rounded-t-lg transition-all duration-500",
                  h > 0.8 ? "bg-indigo-100 border-t-4 border-indigo-500" : "bg-slate-100 border-t-4 border-slate-300"
                )}
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
        active ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-indigo-600"
      )}
    >
      {children}
    </button>
  );
}
