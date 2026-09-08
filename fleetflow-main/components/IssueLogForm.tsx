import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { IssueLog } from '../types';
import { XIcon, PaperClipIcon } from './icons/Icons';

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
  const { addIssueLog, vehicles } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setPhotoFile(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.odometer || !formData.issueTitle || !formData.issueDescription) {
        alert("Please fill in all required fields.");
        return;
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
        photoName: photoFile?.name,
        photoUrl: photoFile ? URL.createObjectURL(photoFile) : undefined,
    };
    
    addIssueLog(newLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Report New Vehicle Issue</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 max-h-[80vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                    <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                        <option value="">Select Vehicle</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Odometer (km)</label>
                    <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="Current reading"/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Issue Title</label>
                <input type="text" name="issueTitle" value={formData.issueTitle} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g., Engine making rattling noise"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Detailed Description</label>
                <textarea name="issueDescription" value={formData.issueDescription} onChange={handleChange} required rows={4} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="Provide as much detail as possible. When did it start? Under what conditions?"></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Photo (Optional)</label>
                    {!photoFile ? (
                        <div className="mt-1">
                            <input id="issue-photo-input" type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"/>
                        </div>
                    ) : (
                        <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-gray-50">
                            <div className="flex items-center space-x-2 truncate">
                                <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                                <span className="text-sm text-gray-700 truncate">{photoFile?.name}</span>
                            </div>
                            <button type="button" onClick={removePhoto} className="text-sm font-medium text-red-600 hover:text-red-800 ml-2">Remove</button>
                        </div>
                    )}
                 </div>
            </div>
            
            <div className="flex items-start">
                <div className="flex items-center h-5">
                    <input id="out-of-service" name="isVehicleOutOfService" type="checkbox" checked={formData.isVehicleOutOfService} onChange={handleChange} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="out-of-service" className="font-medium text-gray-700">Mark vehicle as Out of Service</label>
                    <p className="text-gray-500">Check this if the vehicle is unsafe or unusable due to this issue.</p>
                </div>
            </div>

            <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Submit Report</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default IssueLogForm;
