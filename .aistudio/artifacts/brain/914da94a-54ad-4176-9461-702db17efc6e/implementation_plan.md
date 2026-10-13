# Pelan Pelaksanaan: Minimalist Logs & Penyelesaian Edit Pemandu Self-Drive

Pelan ini memperkemaskan struktur navigasi **Logs** daripada 3 tab bertindih kepada **2 tab terfokus (Odometer & Trip Logs, dan Fuel Logs)**, menghapuskan tab "Reports & Exports" yang mengelirukan, dan menyelesaikan isu modal kemas kini odometer bagi pemandu luar (*other / self-drive driver*).

---

## Ringkasan Cadangan & Pandangan

> [!NOTE]
> **Pandangan Jurutera:** Cadangan anda untuk menghapuskan tab *Reports & Exports* dan memindahkan analitik ke dalam tab log masing-masing adalah **langkah reka bentuk UX yang sangat tepat dan praktikal**. Sebelum ini berlaku pertindihan kerana pengguna terpaksa bertukar ke Tab 3 hanya untuk melihat carta atau muat turun laporan trip/minyak, sedangkan data asalnya berada di Tab 1 dan Tab 2.

Struktur baharu ini memberikan pengalaman **"single source of truth"**:
1. Melihat jarak dan perjalanan? Semuanya ada di **Odometer & Trip Logs**.
2. Melihat kos dan penggunaan minyak? Semuanya ada di **Fuel Logs**.
3. Menyunting log odometer pemandu luar? Boleh disimpan terus tanpa dipaksa memilih pemandu berdaftar.

---

## 1. Perubahan Struktur Tab (2-Tab Minimalist)

```
SEBELUM (3 Tab + Sub-switchers yang berselerak):
├── Tab 1: Odometer Logs (Jadual & Kad Asas)
├── Tab 2: Fuel Purchase Logs (Jadual & Bulk Delete)
└── Tab 3: Reports & Export
    ├── Sub-view A: Fuel Analytics Dashboard (Graf, KPI, Anomali, Eksport)
    └── Sub-view B: Fleet Trip Reports & Export (Trip mileage, Bulanan, Eksport)

SELEPAS (2 Tab Bersih & Bersepadu):
├── Tab 1: Odometer & Trip Logs
│   ├── Sub-toggle Kemas / Segmented Switcher:
│   │   ├── [Analitik & Laporan] (KPI Jarak, Trend Bulanan, Eksport CSV/PDF Trip)
│   │   └── [Senarai Log Perjalanan] (Jadual terperinci Odometer & Perjalanan + Edit)
│   └── Butang Tindakan Pantas: "Log Odometer Baharu" & "Eksport Laporan"
└── Tab 2: Fuel Purchase Logs
    ├── Sub-toggle Kemas / Segmented Switcher:
    │   ├── [Telematik & Analitik] (Kecekapan km/L, Amaran Enjin, Kos & Anomali)
    │   └── [Senarai Pembelian Minyak] (Jadual terperinci resit & belian minyak)
    └── Butang Tindakan Pantas: "Tambah Belian Minyak" & "Eksport Laporan"
```

---

## 2. Penyelesaian Masalah Edit Odometer (Other / Self-Drive Driver)

### Isu Semasa
Apabila log dimasukkan menerusi portal `?action=odometer` oleh pemandu *self-drive* atau staf luar (bukan pemandu berdaftar sistem), nilainya disimpan sebagai `staff-nama` atau `staffName`. Apabila pengguna cuba mengedit log tersebut dalam `OdometerLogEditForm`:
- Borang menganggap pemandu tersebut tidak sah atau memaksa memilih pemandu berdaftar (`users.role === 'driver'`).
- Jika pengguna cuba simpan, ralat timbul atau butang simpan tidak membenarkan pengubahsuaian tanpa memilih pemandu berdaftar.

### Penyelesaian Praktikal
1. **Pengecaman Automatik Nama Pemandu Luar:**
   - Apabila modal dibuka, jika `logToEdit.driverId` bukan ID pemandu berdaftar (atau ada `staffName`), dropdown akan memilih pilihan `__other__` (atau senarai staf self-drive) dan memaparkan nama pemandu tersebut secara automatik dalam kotak teks nama pemandu.
2. **Pilihan Staf & Pemandu Lengkap:**
   - Menyediakan kumpulan pilihan yang jelas:
     - **Pemandu Berdaftar & Pentadbir** (akaun sistem).
     - **Staf Self-Drive** (senarai sah dari sistem self-drive).
     - **Pemandu Luar / Pemandu Ganti (Custom Name)**.
3. **Validasi Fleksibel & Selamat:**
   - Membenarkan simpanan terus dengan nama teks biasa bagi pemandu luar tanpa sebarang halangan atau keperluan membuka akaun pemandu rasmi.

---

## 3. Komponen & Pelaksanaan Teknikal

### A. Kemas Kini `components/Reports.tsx`
- Buang tab `reports` daripada `activeSubTab` (`'odometer' | 'fuel'`).
- Di bawah tab **Odometer & Trip Logs**:
  - Satukan `TripAnalyticsDashboard` bersama jadual log odometer dengan kawalan sub-tab / toggle kemas (Overview Analitik vs Log Perjalanan).
- Di bawah tab **Fuel Logs**:
  - Satukan `FuelAnalyticsDashboard` bersama fungsi resit dan pembelian bahan api.
- Padamkan kod berulang dan permudahkan bilah penapis utama.

### B. Kemas Kini `components/OdometerLogEditForm.tsx`
- Pastikan sokongan penuh kepada medan pemandu luar:
  - Paparan input nama pemandu yang diisi secara automatik mengikut data sedia ada (`logToEdit.staffName || logToEdit.driverId`).
  - Benarkan penjimatan rekod tanpa memerlukan pemandu berdaftar.
  - Sediakan senarai pilihan staf *self-drive* yang aktif daripada storan jika pengguna ingin memilih staf yang sudah berdaftar di bahagian self-drive.

### C. Kemas Kini Butang Navigasi Luaran & Pautan
- Pastikan pautan pintasan dari papan pemuka utama (contohnya pautan terus ke `/reports` atau `/fuel`) memetakan secara tepat kepada tab `'odometer'` atau `'fuel'`.

---

## 4. Pengesahan & Ujian (Verification)
1. **Ujian Aliran Tab:**
   - Navigasi ke halaman Logs dan sahkan hanya ada 2 tab utama yang kemas.
   - Uji penukaran antara paparan Analitik dan paparan Log terperinci bagi kedua-dua tab.
2. **Ujian Edit Log Pemandu Self-Drive:**
   - Buka log perjalanan yang didaftarkan daripada portal awam atau pemandu tidak berdaftar.
   - Klik butang edit (ikon pensel) dan pastikan nama pemandu muncul dengan betul.
   - Ubah sebarang data (contohnya bacaan odometer atau tujuan) dan klik **Update Odometer Log**.
   - Sahkan rekod berjaya dikemas kini tanpa sebarang ralat validasi.
3. **Ujian Eksport & Semakan Kompilasi:**
   - Pastikan butang eksport PDF dan CSV berfungsi lancar dalam kedua-dua paparan.
   - Jalankan `compile_applet` untuk memastikan tiada sebarang ralat sintaks atau TypeScript.
