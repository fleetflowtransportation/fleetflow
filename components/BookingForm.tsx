import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking, PassengerCount } from '../types';
import { DEPARTMENTS, PICKUP_POINTS } from '../types';
import { XIcon, PaperClipIcon, ClockIcon } from './icons/Icons';
import { BookingResultModal } from './BookingResultModal';
import type { AutoAssignResult } from '../services/bookingEngine';

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  bookingToEdit?: Booking | null;
}

const OTHER_PICKUP = 'Lokasi Lain (Sila Nyatakan)';
const FREE_VEHICLE_CHOICE = 'Bebas';

const emptyFormData = {
  requesterName: '',
  requesterEmail: '',
  department: '',
  purpose: '',
  bookingDate: '',
  startTime: '',
  endTime: '',
  destination: '',
  pickupPoint: '',
  address: '',
  staffCount: '',
  kidsCount: '',
  teenagersCount: '',
  serviceType: '' as '' | 'Perlu Driver' | 'Self-Drive',
  vehiclePreference: FREE_VEHICLE_CHOICE,
  shouldWait: false,
  icNumber: '',
  remarks: '',
};

type FormData = typeof emptyFormData;

// Pisahkan satu ISO datetime string kepada { date, time } untuk isi field date/time berasingan
const splitIso = (iso?: string) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const BookingForm: React.FC<BookingFormProps> = ({ isOpen, onClose, bookingToEdit }) => {
  const { addBooking, updateBooking, vehicles } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{ name: string; url: string } | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<AutoAssignResult | null>(null);
  const [recurrence, setRecurrence] = useState({
    frequency: 'weekly' as 'weekly' | 'bi-weekly' | 'monthly',
    endDate: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showDriveSetup, setShowDriveSetup] = useState(false);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setAttachmentFile(null);
    setExistingAttachment(null);
    setIsRecurring(false);
    setRecurrence({ frequency: 'weekly', endDate: '' });
  }, []);

  useEffect(() => {
    if (isOpen && bookingToEdit) {
      const { date, time: startTime } = splitIso(bookingToEdit.dateTime);
      const { time: endTime } = splitIso(bookingToEdit.finishDateTime);
      const staffCount = bookingToEdit.passengers?.find(p => p.category === 'Staff')?.count ?? '';
      const kidsCount = bookingToEdit.passengers?.find(p => p.category === 'Kids')?.count ?? '';
      const teenagersCount = bookingToEdit.passengers?.find(p => p.category === 'Teenagers')?.count ?? '';

      setFormData({
        requesterName: bookingToEdit.requesterName,
        requesterEmail: bookingToEdit.requesterEmail || '',
        department: bookingToEdit.department || '',
        purpose: bookingToEdit.purpose,
        bookingDate: date,
        startTime,
        endTime,
        destination: bookingToEdit.destination,
        pickupPoint: bookingToEdit.pickupPoint || '',
        address: bookingToEdit.address || '',
        staffCount: staffCount === '' ? '' : String(staffCount),
        kidsCount: kidsCount === '' ? '' : String(kidsCount),
        teenagersCount: teenagersCount === '' ? '' : String(teenagersCount),
        serviceType: bookingToEdit.serviceType || '',
        vehiclePreference: bookingToEdit.vehiclePreference || FREE_VEHICLE_CHOICE,
        shouldWait: Boolean(bookingToEdit.shouldWait),
        icNumber: bookingToEdit.icNumber || '',
        remarks: bookingToEdit.remarks || '',
      });
      if (bookingToEdit.attachmentName && bookingToEdit.attachmentUrl) {
          setExistingAttachment({ name: bookingToEdit.attachmentName, url: bookingToEdit.attachmentUrl });
      } else {
          setExistingAttachment(null);
      }
      setAttachmentFile(null);
      setIsRecurring(false); // Recurrence tak boleh diedit
    } else if (isOpen && !bookingToEdit) {
      resetForm();
    }
  }, [isOpen, bookingToEdit, resetForm]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setAttachmentFile(e.target.files[0]);
        setExistingAttachment(null);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setExistingAttachment(null);
    const fileInput = document.getElementById('attachment-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    const passengers: PassengerCount[] = [];
    if (Number(formData.staffCount) > 0) passengers.push({ category: 'Staff', count: Number(formData.staffCount) });
    if (Number(formData.kidsCount) > 0) passengers.push({ category: 'Kids', count: Number(formData.kidsCount) });
    if (Number(formData.teenagersCount) > 0) passengers.push({ category: 'Teenagers', count: Number(formData.teenagersCount) });
    if (passengers.length === 0) {
        alert('Sila isi bilangan penumpang (Staff, Kanak-kanak, atau Remaja).');
        return;
    }

    if (!formData.serviceType) {
        alert('Sila pilih Jenis Perkhidmatan Diperlukan.');
        return;
    }

    if (formData.pickupPoint === OTHER_PICKUP && !formData.address.trim()) {
        alert('Sila nyatakan alamat pickup.');
        return;
    }

    if (formData.serviceType === 'Self-Drive' && !formData.icNumber.trim()) {
        alert('Sila isi No. IC untuk rekod lesen memandu.');
        return;
    }

    if (isRecurring && !recurrence.endDate) {
        alert('Sila pilih tarikh tamat untuk booking berulang.');
        return;
    }

    const dateTime = `${formData.bookingDate}T${formData.startTime}:00`;
    const finishDateTime = formData.endTime
        ? `${formData.bookingDate}T${formData.endTime}:00`
        : undefined;

    const processedData: Partial<Booking> = {
        requesterName: formData.requesterName,
        requesterEmail: formData.requesterEmail,
        department: formData.department,
        purpose: formData.purpose,
        dateTime,
        finishDateTime,
        destination: formData.destination,
        pickupPoint: formData.pickupPoint,
        address: formData.pickupPoint === OTHER_PICKUP ? formData.address.trim() : '',
        passengers,
        serviceType: formData.serviceType,
        vehiclePreference: formData.serviceType === 'Perlu Driver' ? formData.vehiclePreference : undefined,
        icNumber: formData.serviceType === 'Self-Drive' ? formData.icNumber.trim() : undefined,
        shouldWait: formData.shouldWait,
        remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
        recurrence: isRecurring ? recurrence : undefined,
    };

    if (attachmentFile) {
        if (bookingToEdit?.attachmentUrl && bookingToEdit.attachmentUrl.startsWith('blob:')) {
            URL.revokeObjectURL(bookingToEdit.attachmentUrl);
        }
        processedData.attachmentName = attachmentFile.name;
        
        const driveUrl = import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL;
        if (driveUrl) {
            setIsUploading(true);
            try {
                const base64Str = await fileToBase64(attachmentFile);
                const response = await fetch(driveUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify({
                        base64: base64Str,
                        fileName: attachmentFile.name,
                        mimeType: attachmentFile.type
                    })
                });
                
                const resText = await response.text();
                let resJson;
                try {
                    resJson = JSON.parse(resText);
                } catch {
                    throw new Error("Respon dari Google Apps Script tidak sah (bukan JSON).");
                }

                if (resJson && resJson.success && resJson.url) {
                    processedData.attachmentUrl = resJson.url;
                } else {
                    throw new Error(resJson?.error || 'Pemuatan fail ke Google Drive gagal.');
                }
            } catch (error: any) {
                console.error("Ralat Google Drive:", error);
                const confirmFallback = window.confirm(
                    `Gagal memuat naik lampiran ke Google Drive: ${error.message || 'Sila pastikan URL Google Apps Script adalah betul'}.\n\nAdakah anda mahu meneruskan tempahan menggunakan storan fail tempatan (lokal)?`
                );
                if (!confirmFallback) {
                    setIsUploading(false);
                    return;
                }
                if (attachmentFile.size < 500 * 1024) {
                    try {
                        const base64Str = await fileToBase64(attachmentFile);
                        processedData.attachmentUrl = `data:${attachmentFile.type};base64,${base64Str}`;
                    } catch {
                        processedData.attachmentUrl = URL.createObjectURL(attachmentFile);
                    }
                } else {
                    processedData.attachmentUrl = URL.createObjectURL(attachmentFile);
                }
            } finally {
                setIsUploading(false);
            }
        } else {
            if (attachmentFile.size < 500 * 1024) {
                try {
                    const base64Str = await fileToBase64(attachmentFile);
                    processedData.attachmentUrl = `data:${attachmentFile.type};base64,${base64Str}`;
                } catch {
                    processedData.attachmentUrl = URL.createObjectURL(attachmentFile);
                }
            } else {
                processedData.attachmentUrl = URL.createObjectURL(attachmentFile);
            }
        }
    } else if (existingAttachment) {
        processedData.attachmentName = existingAttachment.name;
        processedData.attachmentUrl = existingAttachment.url;
    } else {
        if (bookingToEdit?.attachmentUrl && bookingToEdit.attachmentUrl.startsWith('blob:')) {
            URL.revokeObjectURL(bookingToEdit.attachmentUrl);
        }
        processedData.attachmentName = undefined;
        processedData.attachmentUrl = undefined;
    }

    if (bookingToEdit) {
        updateBooking(bookingToEdit.id, processedData);
        onClose();
    } else {
        const newBooking: Omit<Booking, 'id'> = {
            ...(processedData as Omit<Booking, 'id' | 'status' | 'driverId' | 'vehicleId'>),
            status: 'Pending',
            driverId: null,
            vehicleId: null,
        };
        const result = addBooking(newBooking);
        setSubmissionResult(result);
    }
  };

  if (!isOpen && !submissionResult) return null;

  const inputClass = "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <>
      {isOpen && !submissionResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">{bookingToEdit ? 'Edit Booking Van' : 'Booking Van Baharu'}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">

            {/* 1 & 2: Nama Pemohon & Jabatan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Nama Pemohon</label>
                    <input type="text" name="requesterName" value={formData.requesterName} onChange={handleChange} required className={inputClass}/>
                </div>
                <div>
                    <label className={labelClass}>Jabatan</label>
                    <select name="department" value={formData.department} onChange={handleChange} required className={inputClass}>
                        <option value="" disabled>Pilih Jabatan</option>
                        {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className={labelClass}>Emel Pemohon</label>
                <input type="email" name="requesterEmail" value={formData.requesterEmail} onChange={handleChange} required className={inputClass} placeholder="anda@yck.org.my"/>
            </div>

            {/* 3, 4, 5: Tarikh & Masa */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className={labelClass}>Tarikh Penggunaan</label>
                    <input type="date" name="bookingDate" value={formData.bookingDate} onChange={handleChange} required className={inputClass}/>
                </div>
                <div>
                    <label className={labelClass}>Masa Mula</label>
                    <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required className={inputClass}/>
                </div>
                <div>
                    <label className={labelClass}>Masa Tamat</label>
                    <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required className={inputClass}/>
                </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <span>Polisi Waktu Rehat Rasmi (Sekatan Tempahan)</span>
              </div>
              <div className="text-xs text-amber-950 leading-relaxed space-y-1.5 pl-7">
                <p>• <b>Isnin – Khamis & Ahad:</b> 12:00 tengah hari – 1:00 petang</p>
                <p>• <b>Jumaat:</b> 12:30 tengah hari – 2:30 petang</p>
                <div className="pt-2 border-t border-amber-200 mt-1.5 text-amber-900 font-medium flex items-start space-x-1">
                  <span>💡</span>
                  <span><i>Tempahan yang bermula <b>DI DALAM</b> waktu rehat di atas akan <b>DITOLAK SECARA AUTOMATIK</b> demi memelihara kebajikan waktu rehat pemandu.</i></span>
                </div>
              </div>
            </div>

            {/* 6: Tujuan Perjalanan */}
            <div>
                <label className={labelClass}>Tujuan Perjalanan</label>
                <input type="text" name="purpose" value={formData.purpose} onChange={handleChange} required className={inputClass}/>
            </div>

            {/* 7: Destinasi */}
            <div>
                <label className={labelClass}>Destinasi / Alamat Penuh</label>
                <textarea name="destination" value={formData.destination} onChange={handleChange} required rows={2} className={inputClass}></textarea>
            </div>

            {/* 8 & 9: Lokasi Pickup & Alamat Pickup Lain */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Lokasi Pickup</label>
                    <select name="pickupPoint" value={formData.pickupPoint} onChange={handleChange} required className={inputClass}>
                        <option value="" disabled>Pilih Lokasi</option>
                        {PICKUP_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                {formData.pickupPoint === OTHER_PICKUP && (
                    <div>
                        <label className={labelClass}>Alamat Pickup</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} required className={inputClass}/>
                    </div>
                )}
            </div>

            {/* Bilangan Penumpang: Staff, Kanak-kanak, Remaja */}
            <div>
                <label className={labelClass}>Bilangan Penumpang</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                    <div>
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Staf (Staff)</span>
                        <input
                            type="number"
                            min="0"
                            name="staffCount"
                            value={formData.staffCount}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Kanak-kanak (Kids)</span>
                        <input
                            type="number"
                            min="0"
                            name="kidsCount"
                            value={formData.kidsCount}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Remaja (Teenagers)</span>
                        <input
                            type="number"
                            min="0"
                            name="teenagersCount"
                            value={formData.teenagersCount}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>

            {/* Keperluan Pemandu Menunggu (shouldWait) */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        name="shouldWait"
                        checked={formData.shouldWait}
                        onChange={(e) => setFormData(prev => ({ ...prev, shouldWait: e.target.checked }))}
                        className="h-5 w-5 rounded text-amber-600 border-gray-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    />
                    <div>
                        <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                            ⏳ Pemandu Perlu Menunggu di Destinasi?
                        </span>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                            Tandakan jika pemandu perlu menunggu di lokasi urusan untuk membawa penumpang balik. Pemohon tidak perlu lagi menaipnya di ruangan catatan.
                        </p>
                    </div>
                </label>
            </div>

            {/* 12: Jenis Perkhidmatan */}
            <div>
                <label className={labelClass}>Jenis Perkhidmatan Diperlukan</label>
                <select name="serviceType" value={formData.serviceType} onChange={handleChange} required className={inputClass}>
                    <option value="" disabled>Pilih Jenis Perkhidmatan</option>
                    <option value="Perlu Driver">Perlu Driver</option>
                    <option value="Self-Drive">Self-Drive (Alza sahaja)</option>
                </select>
            </div>

            {/* Cabang: Perlu Driver -> pilih kenderaan */}
            {formData.serviceType === 'Perlu Driver' && (
                <div>
                    <label className={labelClass}>Kenderaan Pilihan</label>
                    <select name="vehiclePreference" value={formData.vehiclePreference} onChange={handleChange} className={inputClass}>
                        <option value={FREE_VEHICLE_CHOICE}>Bebas (Tiada keutamaan - Pemandu akan pilih kenderaan semasa tugasan)</option>
                        {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                        Pilihan "Bebas" tidak akan mengunci mana-mana van terlebih dahulu; kenderaan akan direkodkan berdasarkan van yang dipandu pemandu.
                    </p>
                </div>
            )}

            {/* Cabang: Self-Drive -> No. IC */}
            {formData.serviceType === 'Self-Drive' && (
                <div>
                    <label className={labelClass}>No. IC (untuk rekod lesen memandu)</label>
                    <input type="text" name="icNumber" value={formData.icNumber} onChange={handleChange} required className={inputClass} placeholder="cth: 990101-14-5566"/>
                    <p className="mt-1 text-xs text-gray-500">Kenderaan Alza akan terus di-assign secara automatik untuk booking self-drive.</p>
                </div>
            )}

            {/* Nota Tambahan */}
            <div>
                <label className={labelClass}>Nota Tambahan (Jika Ada)</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="cth: Ambil barang di pejabat, laluan tertentu, atau info lain."></textarea>
            </div>

            <div>
                <label className={labelClass}>Lampiran (Jika Ada)</label>
                
                {/* Google Drive Status indicator */}
                <div className="mt-1 mb-2.5 flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-md p-2">
                    <div className="flex items-center space-x-1.5 text-slate-700">
                        <span>☁️</span>
                        <span className="font-semibold text-slate-800">Penyimpanan Lampiran:</span>
                        {import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Google Drive Aktif
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                Storan Tempatan (Bukan Drive)
                            </span>
                        )}
                    </div>
                    
                    {!import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL && (
                        <button
                            type="button"
                            onClick={() => setShowDriveSetup(!showDriveSetup)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline focus:outline-none"
                        >
                            {showDriveSetup ? "Tutup Cara Setup" : "Cara Setup Google Drive"}
                        </button>
                    )}
                </div>

                {/* Google Drive Setup Instructions Panel */}
                {showDriveSetup && !import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL && (
                    <div className="mb-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-1">
                            <span>🛠️</span>
                            <span>Cara Simpan Lampiran Terus Ke Google Drive Anda (Percuma!)</span>
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Sistem ini menyokong penyimpanan automatik semua fail lampiran tempahan ke dalam akaun Google Drive Workspace anda menggunakan <b>Google Apps Script Web App</b> yang berjalan di akaun Google anda secara selamat tanpa sebarang kos.
                        </p>
                        
                        <div className="text-xs text-slate-700 space-y-2">
                            <p><b>Langkah 1:</b> Buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">script.google.com</a> dan buat projek baharu.</p>
                            <p><b>Langkah 2:</b> Salin kod berikut dan gantikan semua kod di dalam projek tersebut:</p>
                            
                            <div className="relative">
                                <pre className="bg-slate-900 text-slate-100 text-[11px] p-3 rounded-md overflow-x-auto select-all max-h-48 whitespace-pre font-mono">
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Tindakan: Padam fail jika parameter action disediakan
    if (data.action === 'delete') {
      var fileId = data.fileId;
      if (!fileId) throw new Error("ID fail tidak dibekalkan.");
      var file = DriveApp.getFileById(fileId);
      file.setTrashed(true); // Memindahkan fail ke Tong Sampah Google Drive
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Fail berjaya dipindahkan ke Tong Sampah."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Tindakan: Muat naik fail secara lalai
    var base64Data = data.base64;
    var fileName = data.fileName;
    var mimeType = data.mimeType;
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    var folderId = "1N2r4Ctwz9qVnAGgoFNQpCWSLPzU7f-29";
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      url: file.getUrl(),
      fileId: file.getId()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                                </pre>
                            </div>

                            <p><b>Langkah 3:</b> Klik betang <b>Deploy &gt; New deployment</b>.</p>
                            <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                <li>Pilih jenis deployment: <b>Web app</b>.</li>
                                <li>Set <i>Execute as:</i> <b>Me</b> (Akaun Google anda).</li>
                                <li>Set <i>Who has access:</i> <b>Anyone</b> (Penting!).</li>
                            </ul>
                            <p><b>Langkah 4:</b> Salin <b>Web app URL</b> yang diberikan (bermula dengan <code className="bg-slate-200 px-1 rounded font-mono font-bold text-slate-800">https://script.google.com/macros/s/...</code>).</p>
                            <p><b>Langkah 5:</b> Buka bahagian <b>Settings</b> dalam panel AI Studio anda, tambah pembolehubah persekitaran (Environment Variable) dengan nama <b><code className="bg-slate-200 px-1 rounded font-mono font-bold text-slate-800 font-semibold text-slate-900">VITE_GOOGLE_SCRIPT_UPLOAD_URL</code></b> dan tampalkan URL Web App tadi.</p>
                        </div>
                    </div>
                )}

                {/* File input / display */}
                {!attachmentFile && !existingAttachment ? (
                    <div className="mt-1">
                        <input
                            id="attachment-input"
                            type="file"
                            onChange={handleFileChange}
                            disabled={isUploading}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 disabled:opacity-50"
                        />
                    </div>
                ) : (
                    <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-gray-50">
                        <div className="flex items-center space-x-2 truncate">
                            <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                            <span className="text-sm text-gray-700 truncate">{attachmentFile?.name || existingAttachment?.name}</span>
                        </div>
                        <button
                            type="button"
                            onClick={removeAttachment}
                            disabled={isUploading}
                            className="text-sm font-medium text-red-600 hover:text-red-800 ml-2 disabled:opacity-50"
                        >
                            Buang
                        </button>
                    </div>
                )}
            </div>

            {/* Recurrence - hanya untuk booking baru */}
            {!bookingToEdit && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isRecurring"
                            name="isRecurring"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="isRecurring" className="ml-2 block text-sm font-medium text-gray-900">Jadikan booking berulang</label>
                    </div>

                    {isRecurring && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Kekerapan</label>
                                <select
                                    id="frequency"
                                    name="frequency"
                                    value={recurrence.frequency}
                                    onChange={(e) => setRecurrence(prev => ({ ...prev, frequency: e.target.value as typeof recurrence.frequency }))}
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="weekly">Mingguan</option>
                                    <option value="bi-weekly">Dwi-mingguan</option>
                                    <option value="monthly">Bulanan</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Tarikh Tamat</label>
                                <input
                                    type="date"
                                    id="endDate"
                                    name="endDate"
                                    value={recurrence.endDate}
                                    onChange={(e) => setRecurrence(prev => ({ ...prev, endDate: e.target.value }))}
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="pt-4 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isUploading}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Batal
                </button>
                <button
                    type="submit"
                    disabled={isUploading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md disabled:bg-indigo-400 flex items-center justify-center space-x-2"
                >
                    {isUploading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Memuat Naik...</span>
                        </>
                    ) : (
                        <span>{bookingToEdit ? 'Simpan Perubahan' : 'Hantar Booking'}</span>
                    )}
                </button>
            </div>
        </form>
      </div>
    </div>
    )}
    <BookingResultModal
      isOpen={!!submissionResult}
      result={submissionResult}
      onClose={() => {
        setSubmissionResult(null);
        onClose();
        resetForm();
      }}
    />
  </>
  );
};

export default BookingForm;
