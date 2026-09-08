import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Vehicle } from '../types';
import { XIcon, TruckIcon } from './icons/Icons';

interface VehicleFormProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleToEdit?: Vehicle | null;
}

const emptyFormData = {
  name: '',
  plateNumber: '',
  specifications: '',
};

type FormData = typeof emptyFormData;

const VehicleForm: React.FC<VehicleFormProps> = ({ isOpen, onClose, vehicleToEdit }) => {
  const { addVehicle, updateVehicle } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setPhotoFile(null);
    setExistingPhotoUrl(null);
  }, []);

  useEffect(() => {
    if (isOpen && vehicleToEdit) {
      setFormData({
        name: vehicleToEdit.name,
        plateNumber: vehicleToEdit.plateNumber,
        specifications: vehicleToEdit.specifications || '',
      });
      setExistingPhotoUrl(vehicleToEdit.photoUrl || null);
      setPhotoFile(null);
    } else if (isOpen && !vehicleToEdit) {
      resetForm();
    }
  }, [isOpen, vehicleToEdit, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setPhotoFile(e.target.files[0]);
        setExistingPhotoUrl(null);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setExistingPhotoUrl(null);
    const fileInput = document.getElementById('photo-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.plateNumber) {
        alert("Please fill in the vehicle name and plate number.");
        return;
    }

    const processedData: Partial<Vehicle> = {
        ...formData,
        specifications: formData.specifications.trim() ? formData.specifications.trim() : undefined,
    };

    if (photoFile) {
        if (vehicleToEdit?.photoUrl) URL.revokeObjectURL(vehicleToEdit.photoUrl);
        processedData.photoUrl = URL.createObjectURL(photoFile);
    } else if (existingPhotoUrl) {
        processedData.photoUrl = existingPhotoUrl;
    } else {
        if (vehicleToEdit?.photoUrl) URL.revokeObjectURL(vehicleToEdit.photoUrl);
        processedData.photoUrl = undefined;
    }


    if (vehicleToEdit) {
        updateVehicle(vehicleToEdit.id, processedData);
    } else {
        addVehicle(processedData as Omit<Vehicle, 'id'>);
    }
    onClose();
  };

  if (!isOpen) return null;

  const photoPreviewUrl = photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{vehicleToEdit ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. Toyota Hiace"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Plate Number</label>
                    <input type="text" name="plateNumber" value={formData.plateNumber} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. WXY 1234"/>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Vehicle Photo</label>
                <div className="mt-2 flex items-center gap-4">
                    {photoPreviewUrl ? (
                         <img src={photoPreviewUrl} alt="Vehicle preview" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                            <TruckIcon className="h-8 w-8 text-gray-400" />
                        </div>
                    )}
                    <div className="flex-grow">
                        <input id="photo-input" type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"/>
                        {photoPreviewUrl && (
                             <button type="button" onClick={removePhoto} className="mt-2 text-xs text-red-600 hover:text-red-800">Remove photo</button>
                        )}
                    </div>
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Specifications (Optional)</label>
                <textarea name="specifications" value={formData.specifications} onChange={handleChange} rows={4} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g., 10-seater, GPS enabled, Wheelchair accessible..."></textarea>
            </div>
            <div className="pt-4 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">{vehicleToEdit ? 'Save Changes' : 'Add Vehicle'}</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleForm;