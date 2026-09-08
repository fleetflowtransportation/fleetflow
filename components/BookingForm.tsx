import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking, PassengerCount } from '../types';
import { DEPARTMENTS, PICKUP_POINTS } from '../types';
import { XIcon, PaperClipIcon } from './icons/Icons';

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
  serviceType: '' as '' | 'Perlu Driver' | 'Self-Drive',
  vehiclePreference: FREE_VEHICLE_CHOICE,
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

const BookingForm: React.FC<BookingFormProps> = ({ isOpen, onClose, bookingToEdit }) => {
  const { addBooking, updateBooking, vehicles } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{ name: string; url: string } | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState({
    frequency: 'weekly' as 'weekly' | 'bi-weekly' | 'monthly',
    endDate: ''
  });

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
        serviceType: bookingToEdit.serviceType || '',
        vehiclePreference: bookingToEdit.vehiclePreference || FREE_VEHICLE_CHOICE,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const passengers: PassengerCount[] = [];
    if (Number(formData.staffCount) > 0) passengers.push({ category: 'Staff', count: Number(formData.staffCount) });
    if (Number(formData.kidsCount) > 0) passengers.push({ category: 'Kids', count: Number(formData.kidsCount) });
    if (passengers.length === 0) {
        alert('Sila isi bilangan penumpang (Staff dan/atau Kanak-kanak/Remaja).');
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

    const dateTime = new Date(`${formData.bookingDate}T${formData.startTime}`).toISOString();
    const finishDateTime = formData.endTime
        ? new Date(`${formData.bookingDate}T${formData.endTime}`).toISOString()
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
        escort: '',
        shouldWait: false,
        returnTrip: false,
        remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
        recurrence: isRecurring ? recurrence : undefined,
    };

    if (attachmentFile) {
        if (bookingToEdit?.attachmentUrl) URL.revokeObjectURL(bookingToEdit.attachmentUrl);
        processedData.attachmentName = attachmentFile.name;
        processedData.attachmentUrl = URL.createObjectURL(attachmentFile);
    } else if (existingAttachment) {
        processedData.attachmentName = existingAttachment.name;
        processedData.attachmentUrl = existingAttachment.url;
    } else {
        if (bookingToEdit?.attachmentUrl) URL.revokeObjectURL(bookingToEdit.attachmentUrl);
        processedData.attachmentName = undefined;
        processedData.attachmentUrl = undefined;
    }

    if (bookingToEdit) {
        updateBooking(bookingToEdit.id, processedData);
    } else {
        const newBooking: Omit<Booking, 'id'> = {
            ...(processedData as Omit<Booking, 'id' | 'status' | 'driverId' | 'vehicleId'>),
            status: 'Pending',
            driverId: null,
            vehicleId: null,
        };
        addBooking(newBooking);
    }
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
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

            {/* 10 & 11: Bilangan Penumpang */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Bilangan Staff</label>
                    <input type="number" min="0" name="staffCount" value={formData.staffCount} onChange={handleChange} className={inputClass}/>
                </div>
                <div>
                    <label className={labelClass}>Bilangan Kanak-kanak / Remaja</label>
                    <input type="number" min="0" name="kidsCount" value={formData.kidsCount} onChange={handleChange} className={inputClass}/>
                </div>
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
                        <option value={FREE_VEHICLE_CHOICE}>Bebas (Sistem/Driver akan tentukan)</option>
                        {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
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
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={3} className={inputClass} placeholder="cth: driver perlu menunggu, ambil barang di lokasi, dll."></textarea>
            </div>

            <div>
                <label className={labelClass}>Lampiran (Jika Ada)</label>
                {!attachmentFile && !existingAttachment ? (
                    <div className="mt-1">
                        <input id="attachment-input" type="file" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"/>
                    </div>
                ) : (
                    <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-gray-50">
                        <div className="flex items-center space-x-2 truncate">
                            <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                            <span className="text-sm text-gray-700 truncate">{attachmentFile?.name || existingAttachment?.name}</span>
                        </div>
                        <button type="button" onClick={removeAttachment} className="text-sm font-medium text-red-600 hover:text-red-800 ml-2">Buang</button>
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
              <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">{bookingToEdit ? 'Simpan Perubahan' : 'Hantar Booking'}</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
