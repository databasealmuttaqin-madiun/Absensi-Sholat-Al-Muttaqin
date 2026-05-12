import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentSholat, getSholatLabel } from '../utils/sholat';
import { Santri, AbsenSholat } from '../types';
import { CheckCircle2, Circle, Clock, Flame, Users, Bell, Search, Filter, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function AttendanceList() {
  const [sholatSession, setSholatSession] = useState(getCurrentSholat());
  const [allSantri, setAllSantri] = useState<Santri[]>([]);
  const [checkedSantriIds, setCheckedSantriIds] = useState<Set<string>>(new Set());
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [isIqomah, setIsIqomah] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Update session every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setSholatSession(getCurrentSholat());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Santri and existing attendance for current session
  useEffect(() => {
    fetchData();
  }, [sholatSession]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch all santri
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('*');
      
      if (santriError) throw santriError;
      setAllSantri(santriData || []);

      // 2. INSPECTION: Cek kolom yang tersedia di absen_sholat
      const { data: testData } = await supabase.from('absen_sholat').select('*').limit(1);
      if (testData && testData.length > 0) {
        console.log("Kolom yang ditemukan di tabel 'absen_sholat':", Object.keys(testData[0]));
      }

      // 3. Fetch attendance for TODAY and current sholat
      if (sholatSession !== 'None') {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        // Kita coba ambil berdasarkan sholat dan waktu hari ini
        let query = supabase.from('absen_sholat').select('nama, kelas').eq('sholat', sholatSession);
        
        // PENTING: Jika kolom 'created_at' tidak ada, query ini akan error. 
        // Kita gunakan try-catch blok di dalam query ini
        const { data: absenData, error: absenError } = await query
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);

        let finalAbsenData = absenData;
        if (absenError) {
          console.warn("Gagal filter tanggal (mungkin kolom 'created_at' tidak ada):", absenError.message);
          const { data: backupData } = await supabase.from('absen_sholat').select('nama, kelas').eq('sholat', sholatSession);
          finalAbsenData = backupData;
        }

        // Map already checked-in students
        const checked = new Set<string>();
        finalAbsenData?.forEach(item => {
           const santri = santriData?.find(s => s.nama === item.nama && s.kelas === item.kelas);
           const studentKey = santri?.id || `${item.nama}-${item.kelas}`;
           checked.add(studentKey);
        });
        setCheckedSantriIds(checked);
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      // alert(`Gagal memuat data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const kelasList = useMemo(() => {
    return Array.from(new Set(allSantri.map(s => s.kelas))).sort();
  }, [allSantri]);

  const filteredSantri = useMemo(() => {
    return allSantri.filter(s => {
      const matchKelas = selectedKelas ? s.kelas === selectedKelas : true;
      // Make status check more flexible (case insensitive)
      const matchStatus = s.status?.toLowerCase() === 'aktif';
      // Use name+class as fallback if ID is missing
      const studentKey = s.id || `${s.nama}-${s.kelas}`;
      const notChecked = !checkedSantriIds.has(studentKey);
      const matchSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase());
      return matchKelas && matchStatus && notChecked && matchSearch;
    });
  }, [allSantri, selectedKelas, checkedSantriIds, searchQuery]);

  async function handleCheck(santri: Santri) {
    if (sholatSession === 'None') {
      alert("Maaf, saat ini bukan waktu sholat (atau di luar jendela waktu presensi).");
      return;
    }

    try {
      const studentKey = santri.id || `${santri.nama}-${santri.kelas}`;
      
      // Pastikan data yang dikirim sesuai dengan kolom di database
      const newAbsen = {
        nama: santri.nama || '',
        kelas: santri.kelas || '',
        sholat: sholatSession,
        kehadiran: isIqomah ? 'Telat' : 'Berjamaah'
      };

      console.log("Mencoba kirim ke Supabase:", newAbsen);

      const { data, error } = await supabase
        .from('absen_sholat')
        .insert([newAbsen])
        .select();

      if (error) {
        console.error("Supabase Error API:", error);
        throw new Error(error.message);
      }

      console.log("Berhasil simpan:", data);

      // Update state lokal agar nama langsung hilang dari daftar
      setCheckedSantriIds(prev => {
        const next = new Set(prev);
        next.add(studentKey);
        return next;
      });

    } catch (err: any) {
      console.error("Detail Error Lengkap:", err);
      
      let errorMsg = err.message;
      if (errorMsg.includes("column") && errorMsg.includes("sholat")) {
        errorMsg = "Kolom 'sholat' tidak ditemukan di tabel Supabase. Silakan tambahkan kolom tersebut.";
      } else if (errorMsg.includes("row-level security")) {
        errorMsg = "Akses ditolak oleh Supabase (RLS Policy). Silakan matikan RLS atau tambahkan Policy 'Insert' untuk publik.";
      }

      alert(`Gagal Absen: ${errorMsg}\n\nPeriksa SQL Editor di Supabase untuk memastikan struktur tabel sesuai.`);
    }
  }

  // Effect to automatically handle Pulang/Sakit students
  // In a real production app, this might be a cron job or triggered once per session.
  // Here we can do a check when the session starts.
  useEffect(() => {
    if (sholatSession !== 'None' && allSantri.length > 0) {
      autoMarkStatusStudents();
    }
  }, [sholatSession, allSantri]);

  async function autoMarkStatusStudents() {
    const inactiveSantri = allSantri.filter(s => s.status === 'Pulang' || s.status === 'Sakit');
    if (inactiveSantri.length === 0) return;

    // Check if they are already recorded for this session today
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    
    const { data: existing } = await supabase
      .from('absen_sholat')
      .select('nama')
      .eq('sholat', sholatSession)
      .gte('created_at', startOfDay);

    const existingNames = new Set(existing?.map(e => e.nama));

    const toInsert = inactiveSantri
      .filter(s => !existingNames.has(s.nama))
      .map(s => ({
        nama: s.nama,
        kelas: s.kelas,
        sholat: sholatSession,
        kehadiran: s.status as any
      }));

    if (toInsert.length > 0) {
      await supabase.from('absen_sholat').insert(toInsert);
    }
  }

  if (loading && allSantri.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-4"></div>
        <p>Memuat data santri...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* LEFT: Attendance Control */}
      <div className="col-span-12 lg:col-span-12 flex flex-col gap-6">
        {/* Session Info Bar */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-4 rounded-2xl",
              sholatSession !== 'None' ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
            )}>
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Session</p>
              <h2 className="text-2xl font-black text-indigo-900 leading-none">
                {sholatSession !== 'None' ? getSholatLabel(sholatSession) : 'No Active Session'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
             <span className="text-xs font-bold uppercase text-slate-400">Iqomah Status</span>
             <div className={cn(
               "flex items-center gap-2 px-3 py-1 rounded-full border transition-all",
               isIqomah ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-emerald-50 border-emerald-100 text-emerald-600"
             )}>
                <div className={cn("w-2 h-2 rounded-full", isIqomah ? "bg-rose-500 animate-pulse" : "bg-emerald-500")}></div>
                <span className="text-[10px] font-bold uppercase">{isIqomah ? 'SUDAH IQOMAH' : 'BELUM IQOMAH'}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main List Section */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[700px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800">Presensi Santri</h2>
                <select 
                  value={selectedKelas} 
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="bg-slate-100 border-none text-xs font-bold rounded-xl px-4 py-2 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
                </select>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 pl-10 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all"
                />
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2 pr-1">
                {filteredSantri.map((santri, idx) => (
                  <div 
                    key={santri.id || `${santri.nama}-${idx}`} 
                    onClick={() => handleCheck(santri)}
                    className="group flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all cursor-pointer select-none active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 group-hover:scale-110 transition-transform">
                        {santri.nama?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-800">{santri.nama}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">Kelas {santri.kelas}</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-indigo-500 group-hover:bg-indigo-500/10 flex items-center justify-center transition-all">
                       <CheckCircle2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all" />
                    </div>
                  </div>
                ))}
                {filteredSantri.length === 0 && !loading && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 px-6 text-center">
                    <div className="bg-slate-50 p-6 rounded-full mb-4">
                       {allSantri.length === 0 ? <Users className="w-12 h-12 text-slate-300" /> : <CheckCircle2 className="w-12 h-12 text-emerald-100" />}
                    </div>
                    <p className="text-sm font-bold text-slate-600">
                      {allSantri.length === 0 ? 'Tabel Santri Kosong' : 'Selesai!'}
                    </p>
                    <p className="text-xs mt-1">
                      {allSantri.length === 0 
                        ? 'Pastikan Anda sudah mengisi data santri di tabel Supabase dengan kolom: nama, kelas, status.' 
                        : 'Semua santri di daftar ini sudah diabsen.'}
                    </p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsIqomah(!isIqomah)}
                className={cn(
                  "mt-6 w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95",
                  isIqomah 
                    ? "bg-slate-800 text-white shadow-slate-200" 
                    : "bg-rose-500 text-white shadow-rose-200 hover:bg-rose-600"
                )}
              >
                🔥 {isIqomah ? 'BATALKAN STATUS IQOMAH' : 'TOMBOL IQOMAH'}
              </button>
            </section>
          </div>

          {/* Secondary Stats / Right Part of Attendance */}
          <div className="col-span-12 lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-indigo-900 text-white p-8 rounded-3xl flex flex-col justify-between shadow-xl shadow-indigo-100 min-h-[220px]">
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-4">Live Participation</p>
                  <h3 className="text-5xl font-black italic">
                    {Math.round((checkedSantriIds.size / (allSantri.length || 1)) * 100)}%
                  </h3>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                   <TrendingUp className="w-4 h-4 text-emerald-400" />
                   <p className="text-xs text-indigo-200 font-medium">{checkedSantriIds.size} dari {allSantri.length} santri hari ini</p>
                </div>
             </div>

             <div className="bg-white border border-slate-200 p-8 rounded-3xl flex flex-col justify-between shadow-sm min-h-[220px]">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Late Arrivals</p>
                  <h3 className="text-5xl font-black text-rose-500 italic">
                    {allSantri.length > 0 ? (checkedSantriIds.size > 0 ? 'Active' : '0') : '0'}
                  </h3>
                </div>
                <div className="flex flex-col gap-1">
                   <p className="text-xs font-bold text-slate-800">Monitoring Sesi {sholatSession}</p>
                   <p className="text-[10px] text-slate-400 font-medium">Santri yang absen setelah iqomah tercatat otomatis.</p>
                </div>
             </div>

             <div className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Sistem Status</h3>
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                         <span className="text-xs font-bold text-slate-700">Database Connection</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold uppercase">Online</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                         <span className="text-xs font-bold text-slate-700">Current Sholat Window</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold uppercase">{getSholatLabel(sholatSession)}</span>
                   </div>
                </div>
                <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                   <p className="text-[10px] text-indigo-700 leading-relaxed font-bold">
                     Sistem secara otomatis mengunci nama santri yang sudah melakukan presensi. Daftar akan di-reset pada jendela waktu sholat berikutnya.
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
