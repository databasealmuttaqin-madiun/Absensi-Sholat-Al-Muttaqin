export interface Santri {
  id: string;
  nama: string;
  kelas: string;
  status: 'Aktif' | 'Pulang' | 'Sakit';
}

export interface AbsenSholat {
  id?: string;
  nama: string;
  kelas: string;
  sholat: string;
  kehadiran: 'Berjamaah' | 'Telat' | 'Tidak Sholat Berjamaah' | 'Pulang' | 'Sakit';
  created_at?: string;
}

export type SholatType = 'Subuh' | 'Dzuhur' | 'Ashar' | 'Maghrib' | 'Isya' | 'None';
