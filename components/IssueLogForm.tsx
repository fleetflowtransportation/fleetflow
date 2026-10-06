import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { IssueLog } from '../types';
import { XIcon, PaperClipIcon } from './icons/Icons';
import { uploadToGoogleDrive } from '../services/googleDrive';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface IssueLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  reporterId: string;
}

const emptyFormData = {
  vehicleId: '',
  odometer: '',
  issueTitle: '',
  issueDescription: '',
  priority: 'Low' as 'Low' | 'Medium' | 'High',
  isVehicleOutOfService: false,
};

type FormData = typeof emptyFormData;

const IssueLogForm: React.FC<IssueLogFormProps> = ({ isOpen, onClose, reporterId }) => {
  const { addIssueLog, vehicles, activeTenant } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prevIsOpenRef = React.useRef(false);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setPhotoFile(null);
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      resetForm();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setPhotoFile(e.target.files[0]);
    }
  };
  
  const removePhoto = () => {
    setPhotoFile(null);
    const fileInput = document.getElementById('issue-photo-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.vehicleId || !formData.odometer || !formData.issueTitle || !formData.issueDescription) {
        alert("Please fill in all required fields.");
        return;
    }

    setIsSubmitting(true);

    let attachmentUrl: string | undefined = undefined;
    let attachmentName: string | undefined = undefined;

    if (photoFile) {
      const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
      const plateNumber = (selectedVehicle?.plateNumber || 'VEHICLE').trim().toUpperCase();
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const cleanTitle = formData.issueTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      const todayDateStr = new Date().toISOString().split('T')[0].split('-').reverse().join('-');
      const customFileName = `${todayDateStr}_${cleanTitle}.${ext}`;

      try {
        const uploadRes = await uploadToGoogleDrive(photoFile, {
          folderName: 'maintenance_issues',
          folderPath: ['File Induk', 'Maintenance', 'Issue', plateNumber],
          fileName: customFileName,
          tenant: activeTenant,
        });

        if (uploadRes.success && uploadRes.url) {
          attachmentUrl = uploadRes.url;
          attachmentName = uploadRes.name || customFileName;
        } else {
          attachmentUrl = URL.createObjectURL(photoFile);
          attachmentName = customFileName;
        }
      } catch (err: any) {
        console.warn('[IssueLogForm] Google Drive upload warning, fallback to local URL:', err);
        attachmentUrl = URL.createObjectURL(photoFile);
        attachmentName = customFileName;
      }
    }

    const newLog: Omit<IssueLog, 'id'> = {
        vehicleId: formData.vehicleId,
        odometer: Number(formData.odometer),
        issueTitle: formData.issueTitle,
        issueDescription: formData.issueDescription,
        reportedDate: new Date().toISOString(),
        reportedById: reporterId,
        priority: formData.priority,
        isVehicleOutOfService: formData.isVehicleOutOfService,
        status: 'Open',
        photoName: attachmentName || photoFile?.name,
        photoUrl: attachmentUrl || (photoFile ? URL.createObjectURL(photoFile) : undefined),
    };
    
    addIssueLog(newLog);
    setIsSubmitting(false);
    onClose();
  };

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-2 sm:p-4 backdrop-blur-xs overscroll-contain animate-in fade-in duration-150"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] overscroll-contain animate-in zoom-in-95 duration-150">
        <div className="shrink-0 flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Report New Vehicle Issue</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Submit maintenance issue and save photo to Google Drive</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition cursor-pointer"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Vehicle *</label>
                    <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">Select Vehicle</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Odometer (km) *</label>
                    <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="Current reading"/>
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Issue Title *</label>
                <input type="text" name="issueTitle" value={formData.issueTitle} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., Engine making rattling noise"/>
            </div>
            <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Detailed Description *</label>
                <textarea name="issueDescription" value={formData.issueDescription} onChange={handleChange} required rows={3} className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="Provide as much detail as possible. When did it start? Under what conditions?"></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleChange} className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Photo Attachment (Optional)</label>
                    {!photoFile ? (
                        <div>
                            <input id="issue-photo-input" type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"/>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-2.5 border rounded-xl bg-slate-50">
                            <div className="flex items-center space-x-2 truncate">
                                <PaperClipIcon className="h-4 w-4 text-slate-500 flex-shrink-0"/>
                                <span className="text-xs text-slate-700 truncate">{photoFile?.name}</span>
                            </div>
                            <button type="button" onClick={removePhoto} className="text-xs font-bold text-red-600 hover:text-red-800 ml-2 cursor-pointer">Remove</button>
                        </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">Saved to Google Drive under: File Induk &gt; Maintenance &gt; Issue &gt; [Plate Number]</p>
                 </div>
            </div>
            
            <div className="flex items-start bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                <div className="flex items-center h-5">
                    <input id="out-of-service" name="isVehicleOutOfService" type="checkbox" checked={formData.isVehicleOutOfService} onChange={handleChange} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded cursor-pointer" />
                </div>
                <div className="ml-3 text-xs">
                    <label htmlFor="out-of-service" className="font-extrabold text-amber-950">Mark vehicle as Out of Service</label>
                    <p className="text-amber-900/70 text-[11px]">Check this if the vehicle is unsafe or unusable due to this issue.</p>
                </div>
            </div>

            <div className="pt-4 flex justify-end space-x-3 border-t">
                <button type="button" onClick={onClose} disabled={isSubmitting} className="bg-white py-2.5 px-4 border border-gray-300 rounded-xl shadow-xs text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving to Drive...</span>
                    </>
                  ) : (
                    <span>Submit Report</span>
                  )}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default IssueLogForm;
