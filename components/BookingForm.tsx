import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking, PassengerCount } from '../types';
import { DEPARTMENTS, PICKUP_POINTS } from '../types';
import { XIcon, PaperClipIcon, ClockIcon } from './icons/Icons';
import { BookingResultModal } from './BookingResultModal';
import { normalizeDate, normalizeTime, type AutoAssignResult } from '../services/bookingEngine';
import { isOtherPickup } from '../utils';

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  bookingToEdit?: Booking | null;
}

const OTHER_PICKUP = 'Other Location (Please Specify)';
const FREE_VEHICLE_CHOICE = 'Any / No Preference';

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

// Split ISO/local datetime string into { date, time } without timezone shift
const splitIso = (iso?: string) => {
  if (!iso) return { date: '', time: '' };
  return {
    date: normalizeDate(iso),
    time: normalizeTime(iso),
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
  const { addBooking, updateBooking, vehicles, users } = useAppContext();
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

      const existingVehicle = vehicles.find(v => v.id === bookingToEdit.vehicleId);
      const initialVehiclePref = bookingToEdit.vehiclePreference || existingVehicle?.name || FREE_VEHICLE_CHOICE;

      setFormData({
        requesterName: bookingToEdit.requesterName || '',
        requesterEmail: bookingToEdit.requesterEmail || '',
        department: bookingToEdit.department || '',
        purpose: bookingToEdit.purpose || '',
        bookingDate: date,
        startTime,
        endTime,
        destination: bookingToEdit.destination || '',
        pickupPoint: isOtherPickup(bookingToEdit.pickupPoint) ? OTHER_PICKUP : (bookingToEdit.pickupPoint || ''),
        address: (isOtherPickup(bookingToEdit.pickupPoint) || (bookingToEdit.address && bookingToEdit.address !== bookingToEdit.destination)) ? (bookingToEdit.address || '') : '',
        staffCount: staffCount === '' ? '' : String(staffCount),
        kidsCount: kidsCount === '' ? '' : String(kidsCount),
        teenagersCount: teenagersCount === '' ? '' : String(teenagersCount),
        serviceType: bookingToEdit.serviceType || '',
        vehiclePreference: initialVehiclePref,
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
      setIsRecurring(false);
    } else if (isOpen && !bookingToEdit) {
      resetForm();
    }
  }, [isOpen, bookingToEdit, resetForm, vehicles]);

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
        alert('Please specify the passenger count (Staff, Kids, or Teenagers).');
        return;
    }

    if (!formData.serviceType) {
        alert('Please select a Service Type.');
        return;
    }

    if (isOtherPickup(formData.pickupPoint) && !formData.address.trim()) {
        alert('Please enter the specific pickup address.');
        return;
    }

    if (formData.serviceType === 'Self-Drive' && !formData.icNumber.trim()) {
        alert('Please provide an IC/ID number for driving license verification.');
        return;
    }

    if (isRecurring && !recurrence.endDate) {
        alert('Please select an end date for the recurring booking.');
        return;
    }

    const dateTime = `${formData.bookingDate}T${formData.startTime}:00`;
    const finishDateTime = formData.endTime
        ? `${formData.bookingDate}T${formData.endTime}:00`
        : undefined;

    const processedData: Partial<Booking> = {
        requesterName: formData.requesterName.trim(),
        requesterEmail: formData.requesterEmail.trim(),
        department: formData.department,
        purpose: formData.purpose.trim(),
        dateTime,
        finishDateTime,
        destination: formData.destination.trim(),
        pickupPoint: formData.pickupPoint,
        address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
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
                    throw new Error("Invalid response format from Google Apps Script endpoint.");
                }

                if (resJson && resJson.success && resJson.url) {
                    processedData.attachmentUrl = resJson.url;
                } else {
                    throw new Error(resJson?.error || 'File upload to Google Drive failed.');
                }
            } catch (error: any) {
                console.error("Google Drive Upload Error:", error);
                const confirmFallback = window.confirm(
                    `Failed to upload attachment to Google Drive: ${error.message || 'Please verify your Apps Script URL'}.\n\nWould you like to proceed with local attachment storage instead?`
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
        const driverName = bookingToEdit.driverId
            ? (users.find(u => u.id === bookingToEdit.driverId)?.name || '')
            : (formData.serviceType === 'Self-Drive' ? 'Self-Drive' : '');
        const deptStr = formData.department ? ` (${formData.department})` : '';
        const updatedTitle = driverName
            ? `(${driverName}) ${formData.requesterName.trim()}${deptStr} → ${formData.destination.trim()}`
            : `${formData.requesterName.trim()}${deptStr} → ${formData.destination.trim()}`;
        processedData.calendarEventTitle = updatedTitle;

        if (formData.serviceType === 'Self-Drive') {
            const alza = vehicles.find(v => v.name.toLowerCase().includes('alza'));
            if (alza) processedData.vehicleId = alza.id;
        } else if (formData.vehiclePreference && formData.vehiclePreference !== FREE_VEHICLE_CHOICE) {
            const matchedVehicle = vehicles.find(v => v.name.toLowerCase() === formData.vehiclePreference.toLowerCase());
            if (matchedVehicle) {
                processedData.vehicleId = matchedVehicle.id;
            }
        }

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

  const inputClass = "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm";
  const labelClass = "block text-xs font-bold text-gray-700 uppercase tracking-wider";

  return (
    <>
      {isOpen && !submissionResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/70">
              <h2 className="text-lg font-bold text-gray-800">{bookingToEdit ? 'Edit Vehicle Booking' : 'New Vehicle Booking'}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"><XIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">

            {/* 1 & 2: Requester Name & Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Requester Name *</label>
                    <input type="text" name="requesterName" value={formData.requesterName} onChange={handleChange} required className={inputClass} placeholder="Full Name"/>
                </div>
                <div>
                    <label className={labelClass}>Department *</label>
                    <select name="department" value={formData.department} onChange={handleChange} required className={inputClass}>
                        <option value="" disabled>Select Department</option>
                        {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className={labelClass}>Requester Email *</label>
                <input type="email" name="requesterEmail" value={formData.requesterEmail} onChange={handleChange} required className={inputClass} placeholder="name@organization.org"/>
            </div>

            {/* 3, 4, 5: Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className={labelClass}>Usage Date *</label>
                    <input type="date" name="bookingDate" value={formData.bookingDate} onChange={handleChange} required className={inputClass}/>
                </div>
                <div>
                    <label className={labelClass}>Start Time *</label>
                    <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required className={inputClass}/>
                </div>
                <div>
                    <label className={labelClass}>End Time *</label>
                    <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required className={inputClass}/>
                </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <ClockIcon className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>Driver Official Break Hours Policy</span>
              </div>
              <div className="text-xs text-amber-950 leading-relaxed space-y-1 pl-6">
                <p>• <b>Monday – Thursday & Sunday:</b> 12:00 PM – 1:00 PM</p>
                <p>• <b>Friday:</b> 12:30 PM – 2:30 PM</p>
                <div className="pt-2 border-t border-amber-200 mt-1 text-amber-900 font-medium flex items-start space-x-1">
                  <span>💡</span>
                  <span><i>Bookings starting <b>DURING</b> driver break hours will be automatically declined to safeguard driver rest requirements.</i></span>
                </div>
              </div>
            </div>

            {/* 6: Purpose */}
            <div>
                <label className={labelClass}>Trip Purpose *</label>
                <input type="text" name="purpose" value={formData.purpose} onChange={handleChange} required className={inputClass} placeholder="e.g. Official meetings, program logistics, patient visits"/>
            </div>

            {/* 7: Destination */}
            <div>
                <label className={labelClass}>Destination Address *</label>
                <textarea name="destination" value={formData.destination} onChange={handleChange} required rows={2} className={inputClass} placeholder="Full address or venue name"></textarea>
            </div>

            {/* 8 & 9: Pickup Point & Custom Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Pickup Point *</label>
                    <select name="pickupPoint" value={formData.pickupPoint} onChange={handleChange} required className={inputClass}>
                        <option value="" disabled>Select Location</option>
                        {PICKUP_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                {isOtherPickup(formData.pickupPoint) && (
                    <div>
                        <label className={labelClass}>Custom Pickup Address *</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} required className={inputClass} placeholder="e.g. 16, Lorong Tiong Nam 5, Chow Kit"/>
                    </div>
                )}
            </div>

            {/* Passenger Count: Staff, Kids, Teenagers */}
            <div>
                <label className={labelClass}>Passenger Count *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                    <div>
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Staff</span>
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
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Kids</span>
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
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Teenagers</span>
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

            {/* Driver Standby Option (shouldWait) */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
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
                            ⏳ Driver Standby Required at Destination?
                        </span>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                            Check this if the driver is required to wait on-site during the event to return passengers afterwards.
                        </p>
                    </div>
                </label>
            </div>

            {/* Service Type */}
            <div>
                <label className={labelClass}>Service Type *</label>
                <select name="serviceType" value={formData.serviceType} onChange={handleChange} required className={inputClass}>
                    <option value="" disabled>Select Service Type</option>
                    <option value="Perlu Driver">Driver Required</option>
                    <option value="Self-Drive">Self-Drive</option>
                </select>
            </div>

            {/* Driver Required -> Vehicle preference */}
            {formData.serviceType === 'Perlu Driver' && (
                <div>
                    <label className={labelClass}>Vehicle Preference</label>
                    <select name="vehiclePreference" value={formData.vehiclePreference} onChange={handleChange} className={inputClass}>
                        <option value={FREE_VEHICLE_CHOICE}>Any / No Preference (Assigned automatically based on driver selection)</option>
                        {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                </div>
            )}

            {/* Self-Drive -> IC number */}
            {formData.serviceType === 'Self-Drive' && (
                <div>
                    <label className={labelClass}>Driver IC / ID Number (for license verification) *</label>
                    <input type="text" name="icNumber" value={formData.icNumber} onChange={handleChange} required className={inputClass} placeholder="e.g. 990101-14-5566"/>
                    <p className="mt-1 text-xs text-gray-500">Vehicle will be reserved automatically for self-drive bookings.</p>
                </div>
            )}

            {/* Additional Remarks */}
            <div>
                <label className={labelClass}>Additional Notes (Optional)</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows={2} className={inputClass} placeholder="Special instructions, route notes, or equipment details..."></textarea>
            </div>

            <div>
                <label className={labelClass}>File Attachment (Optional)</label>
                
                {/* Cloud Drive Status indicator */}
                <div className="mt-1 mb-2.5 flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <div className="flex items-center space-x-1.5 text-slate-700">
                        <span>☁️</span>
                        <span className="font-semibold text-slate-800">Attachment Storage:</span>
                        {import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Cloud Drive Connected
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Local Storage Mode
                            </span>
                        )}
                    </div>
                    
                    {!import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL && (
                        <button
                            type="button"
                            onClick={() => setShowDriveSetup(!showDriveSetup)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline focus:outline-none"
                        >
                            {showDriveSetup ? "Hide Setup Instructions" : "Google Drive Setup Guide"}
                        </button>
                    )}
                </div>

                {/* Google Drive Setup Instructions Panel */}
                {showDriveSetup && !import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL && (
                    <div className="mb-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-1">
                            <span>🛠️</span>
                            <span>Direct Google Drive Attachment Storage Setup</span>
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            This fleet system can automatically store booking document attachments directly into your organization's Google Drive via a <b>Google Apps Script Web App</b>.
                        </p>
                        
                        <div className="text-xs text-slate-700 space-y-2">
                            <p><b>Step 1:</b> Open <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">script.google.com</a> and create a new project.</p>
                            <p><b>Step 2:</b> Paste and save the Google Apps Script Web App script handler.</p>
                            <p><b>Step 3:</b> Deploy as a <b>Web app</b> with access set to <b>Anyone</b>.</p>
                            <p><b>Step 4:</b> Set the web app URL into <code className="bg-slate-200 px-1 rounded font-mono font-bold text-slate-800">VITE_GOOGLE_SCRIPT_UPLOAD_URL</code> in your environment settings.</p>
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
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 disabled:opacity-50"
                        />
                    </div>
                ) : (
                    <div className="mt-2 flex items-center justify-between p-2.5 pl-3 border border-slate-200 rounded-xl bg-gray-50">
                        <div className="flex items-center space-x-2 truncate">
                            <PaperClipIcon className="h-4 w-4 text-gray-500 flex-shrink-0"/>
                            <span className="text-xs font-medium text-gray-700 truncate">{attachmentFile?.name || existingAttachment?.name}</span>
                        </div>
                        <button
                            type="button"
                            onClick={removeAttachment}
                            disabled={isUploading}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 ml-2 disabled:opacity-50"
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>

            {/* Recurrence - new booking only */}
            {!bookingToEdit && (
                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isRecurring"
                            name="isRecurring"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="isRecurring" className="ml-2 block text-xs font-bold text-gray-800 cursor-pointer uppercase tracking-wider">Set as recurring booking</label>
                    </div>

                    {isRecurring && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="frequency" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Frequency</label>
                                <select
                                    id="frequency"
                                    name="frequency"
                                    value={recurrence.frequency}
                                    onChange={(e) => setRecurrence(prev => ({ ...prev, frequency: e.target.value as typeof recurrence.frequency }))}
                                    className="mt-1 block w-full border-gray-300 rounded-xl shadow-xs focus:ring-indigo-500 focus:border-indigo-500 text-xs p-2.5 bg-white"
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="bi-weekly">Bi-weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Recurrence End Date</label>
                                <input
                                    type="date"
                                    id="endDate"
                                    name="endDate"
                                    value={recurrence.endDate}
                                    onChange={(e) => setRecurrence(prev => ({ ...prev, endDate: e.target.value }))}
                                    required
                                    className="mt-1 block w-full border-gray-300 rounded-xl shadow-xs focus:ring-indigo-500 focus:border-indigo-500 text-xs p-2.5 bg-white"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isUploading}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-xl shadow-xs text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isUploading}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm disabled:bg-slate-400 flex items-center justify-center space-x-2 text-xs transition"
                >
                    {isUploading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Uploading...</span>
                        </>
                    ) : (
                        <span>{bookingToEdit ? 'Save Changes' : 'Submit Booking'}</span>
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
