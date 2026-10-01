# Pelan Pelaksanaan: Google Drive Fuel Log Receipt & Pembetulan Isu Auto-Refresh Borang

## 1. Objektif & Keperluan Pengguna
1. **Muat Naik Resit Petrol ke Google Drive**:
   - Resit yang dimuat naik dalam modul **Fuel Log** akan disimpan terus ke Google Drive milik organisasi (`tenant.googleDriveId`).
   - Struktur folder yang teratur: `Folder Induk > Fuel Logs > [No Plat Kenderaan]`.
   - Format nama fail automatik: `DD-MM-YYYY_Noplat.ext` (contoh: `01-10-2026_VAA8821.jpg`).
   - Kemas kini skrip Google Apps Script (`Code.gs`) di bahagian tetapan (*Settings*) untuk menyokong penciptaan sub-folder bersarang (*nested subfolders*).

2. **Penyelesaian Isu Form Refresh**:
   - Memperbaiki punca utama borang ter-refresh/terpadam sendiri (kitaran auto-refresh 15 saat dalam `AppContext` yang mencetuskan re-render dan `useEffect` pada rujukan tatasusunan `vehicles` / `users`).
   - Memastikan `useEffect` dalam semua modal borang hanya menginisialisasi nilai semasa modal mula-mula dibuka (*mount / isOpen transition*), bukan setiap kali data latar belakang dikemas kini.
   - Menyediakan perlindungan draf (*Auto-Save Draft*) supaya jika staf menaip, data tidak hilang sekiranya berlaku sebarang gangguan.

---

## 2. Pelan Tindakan Terperinci

### Bahagian A: Integrasi Google Drive untuk Fuel Log
1. **`services/googleDrive.ts`**:
   - Menambah fungsi pembina nama fail resit standard: `formatFuelReceiptFileName(dateStr, plateNumber, originalFileName)` -> `DD-MM-YYYY_Noplat.ext`.
   - Menambah sokongan laluan folder bertingkat (*nested folder paths*) seperti `folderPath: ['Fuel Logs', plateNumber]` atau `Fuel Logs/${plateNumber}` dalam panggilan payload Google Apps Script.
2. **`components/FuelLogModal.tsx` & `components/FuelLogForm.tsx`**:
   - Memanggil `uploadToGoogleDrive` semasa pengguna memilih resit minyak, menghantar `folderPath: ['Fuel Logs', vehiclePlateNumber]` dan nama fail `DD-MM-YYYY_Noplat.ext`.
   - Menyimpan URL direct Drive (`receiptAttachmentUrl`) dan nama fail (`receiptAttachmentName`) ke dalam rekod database Supabase.
3. **`components/SettingsView.tsx` (Google Apps Script Code)**:
   - Mengemas kini templat kod `Code.gs` untuk mencipta sub-folder bertingkat (`DriveApp` folder hierarchy recursive check) secara automatik sekiranya folder `Fuel Logs` atau `[No Plat]` belum wujud.

---

### Bahagian B: Menghapuskan Masalah Form Refresh di Seluruh Sistem
1. **`context/AppContext.tsx`**:
   - Mengoptimumkan `useEffect` auto-refresh (15 saat) agar ia berjalan secara senyap di latar belakang (*silent background sync*) tanpa mengganggu komponen yang sedang aktif.
   - Menghapuskan `setIsLoading(true)` semasa auto-refresh berkala (hanya aktifkan pada *initial load* pertama).
2. **Semua Modal & Borang Input**:
   - **`components/FuelLogModal.tsx` & `components/FuelLogForm.tsx`**
   - **`components/OdometerModal.tsx`**
   - **`components/BookingModal.tsx` & `components/BookingManagementList.tsx`**
   - **`components/IssueModal.tsx` / `components/IssueManagement.tsx`**
   - **`components/VehicleForm.tsx` & `components/VehicleModal.tsx`**
   - **`components/MaintenanceManagement.tsx`**
   - Membaiki corak `useEffect` dengan menggunakan `useRef(isOpen)` supaya `formData` HANYA diisi sekali sahaja apabila pengguna membuka borang, dan TIDAK direset apabila `vehicles`, `users`, atau `currentUser` diperbaharui di latar belakang.
   - Menambah perlindungan auto-save draf ringkas ke `sessionStorage` untuk borang-borang utama.

---

## 3. Ujian & Pengesahan
- Uji muat naik resit minyak pada kenderaan pilihan -> Semak nama fail terhasil (`DD-MM-YYYY_Noplat.ext`) dan susunan folder `Fuel Logs > [No Plat]`.
- Buka borang Fuel Log, isi separuh, tunggu lebih 30 saat -> Sahkan teks tidak hilang dan borang tidak ter-refresh.
- Uji borang-borang lain (Booking, Odometer, Vehicle, Maintenance) bagi memastikan tiada reset input yang berlaku.
- Jalankan `npm run lint` dan `compile_applet` untuk memastikan tiada sebarang ralat kod.
