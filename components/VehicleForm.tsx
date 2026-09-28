import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Vehicle, 
  VehicleType, 
  VEHICLE_TYPES, 
  VehicleOwnershipType, 
  VEHICLE_OWNERSHIP_TYPES, 
  VehicleOperationalStatus, 
  VEHICLE_OPERATIONAL_STATUSES, 
  FuelType, 
  FUEL_TYPES 
} from '../types';
import { XIcon, TruckIcon, CheckCircleIcon } from './icons/Icons';
import { uploadToGoogleDrive, getDriveDirectImageUrl, GoogleDriveUploadResult } from '../services/googleDrive';

interface VehicleFormProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleToEdit?: Vehicle | null;
}

interface FormState {
  // Section 1: Basic Information
  name: string;
  plateNumber: string;
  vinChassisNumber: string;
  engineNumber: string;
  vehicleType: VehicleType;
  brandMake: string;
  manufactureYear: string;
  photoUrl?: string;
  photoName?: string;

  // Section 2: Operational & Ownership Status
  ownershipType: VehicleOwnershipType;
  vehicleStatus: VehicleOperationalStatus;
  assignedBranch: string;
  assignedDriverId: string;

  // Section 3: Technical & Fuel Specs
  fuelType: FuelType;
  fuelCardNumber: string;
  currentOdometer: string;
  maxPayloadCapacityKg: string;
  engineCapacityCc: string;

  // Section 4: Initial Compliance & Expiry Dates
  roadTaxExpiry: string;
  insuranceExpiry: string;
  puspakomExpiry: string;
  permitExpiry: string;
  grantAttachmentUrl?: string;
  grantAttachmentName?: string;
  specifications: string;
}

const defaultFormState: FormState = {
  name: '',
  plateNumber: '',
  vinChassisNumber: '',
  engineNumber: '',
  vehicleType: 'Van',
  brandMake: '',
  manufactureYear: new Date().getFullYear().toString(),
  photoUrl: undefined,
  photoName: undefined,

  ownershipType: 'Owned',
  vehicleStatus: 'Active',
  assignedBranch: '',
  assignedDriverId: '',

  fuelType: 'Diesel',
  fuelCardNumber: '',
  currentOdometer: '0',
  maxPayloadCapacityKg: '',
  engineCapacityCc: '',

  roadTaxExpiry: '',
  insuranceExpiry: '',
  puspakomExpiry: '',
  permitExpiry: '',
  grantAttachmentUrl: undefined,
  grantAttachmentName: undefined,
  specifications: '',
};

const COMMON_BRANDS = ['Toyota', 'Perodua', 'Isuzu', 'Nissan', 'Ford', 'Honda', 'Proton', 'Hino', 'Mitsubishi', 'Daihatsu'];
const COMMON_BRANCHES = ['HQ Kuala Lumpur', 'PJBA Center', 'Central Depot', 'Northern Branch', 'Southern Branch'];

export const VehicleForm: React.FC<VehicleFormProps> = ({ isOpen, onClose, vehicleToEdit }) => {
  const { addVehicle, updateVehicle, vehicles, users, activeTenant } = useAppContext();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState<FormState>(defaultFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [grantFile, setGrantFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Drive upload states (folder: 'vehicle')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadResult, setPhotoUploadResult] = useState<GoogleDriveUploadResult | null>(null);
  const [isUploadingGrant, setIsUploadingGrant] = useState(false);
  const [grantUploadResult, setGrantUploadResult] = useState<GoogleDriveUploadResult | null>(null);

  // Available drivers from user list
  const drivers = useMemo(() => {
    return users.filter(u => u.role === 'driver' && u.status === 'active');
  }, [users]);

  // Reset or initialize form
  const initForm = useCallback(() => {
    setActiveStep(1);
    setFormErrors({});
    setPhotoFile(null);
    setGrantFile(null);
    setIsUploadingPhoto(false);
    setPhotoUploadResult(null);
    setIsUploadingGrant(false);
    setGrantUploadResult(null);

    if (vehicleToEdit) {
      setFormData({
        name: vehicleToEdit.name || '',
        plateNumber: vehicleToEdit.plateNumber || '',
        vinChassisNumber: vehicleToEdit.vinChassisNumber || '',
        engineNumber: vehicleToEdit.engineNumber || '',
        vehicleType: vehicleToEdit.vehicleType || 'Van',
        brandMake: vehicleToEdit.brandMake || '',
        manufactureYear: vehicleToEdit.manufactureYear ? vehicleToEdit.manufactureYear.toString() : '',
        photoUrl: vehicleToEdit.photoUrl,
        photoName: vehicleToEdit.photoName,

        ownershipType: vehicleToEdit.ownershipType || 'Owned',
        vehicleStatus: vehicleToEdit.vehicleStatus || 'Active',
        assignedBranch: vehicleToEdit.assignedBranch || '',
        assignedDriverId: vehicleToEdit.assignedDriverId || '',

        fuelType: vehicleToEdit.fuelType || 'Diesel',
        fuelCardNumber: vehicleToEdit.fuelCardNumber || '',
        currentOdometer: vehicleToEdit.currentOdometer !== undefined ? vehicleToEdit.currentOdometer.toString() : '0',
        maxPayloadCapacityKg: vehicleToEdit.maxPayloadCapacityKg ? vehicleToEdit.maxPayloadCapacityKg.toString() : '',
        engineCapacityCc: vehicleToEdit.engineCapacityCc ? vehicleToEdit.engineCapacityCc.toString() : '',

        roadTaxExpiry: vehicleToEdit.roadTaxExpiry || '',
        insuranceExpiry: vehicleToEdit.insuranceExpiry || '',
        puspakomExpiry: vehicleToEdit.puspakomExpiry || '',
        permitExpiry: vehicleToEdit.permitExpiry || '',
        grantAttachmentUrl: vehicleToEdit.grantAttachmentUrl,
        grantAttachmentName: vehicleToEdit.grantAttachmentName,
        specifications: vehicleToEdit.specifications || '',
      });
    } else {
      setFormData(defaultFormState);
    }
  }, [vehicleToEdit]);

  useEffect(() => {
    if (isOpen) {
      initForm();
    }
  }, [isOpen, initForm]);

  // Field change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for that field
    if (formErrors[name]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Image file handler with Google Drive 'vehicle' folder upload
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      // Immediate local preview while upload proceeds
      const tempPreviewUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        photoUrl: tempPreviewUrl,
        photoName: file.name
      }));

      // Upload to Google Drive under dedicated 'vehicle' folder
      setIsUploadingPhoto(true);
      try {
        const res = await uploadToGoogleDrive(file, {
          folderName: 'vehicle',
          tenant: activeTenant,
        });
        setPhotoUploadResult(res);
        if (res.success && res.url) {
          URL.revokeObjectURL(tempPreviewUrl);
          setFormData(prev => ({
            ...prev,
            photoUrl: res.url,
            photoName: res.name,
          }));
        }
      } catch (err: any) {
        console.warn('Error uploading vehicle photo to Google Drive:', err.message);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const removePhoto = () => {
    if (photoFile && formData.photoUrl && formData.photoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(formData.photoUrl);
    }
    setPhotoFile(null);
    setPhotoUploadResult(null);
    setFormData(prev => ({ ...prev, photoUrl: undefined, photoName: undefined }));
    const input = document.getElementById('vehicle-photo-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Grant Document handler (PDF / Image) with Google Drive 'vehicle' folder upload
  const handleGrantChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setGrantFile(file);
      const tempPreviewUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        grantAttachmentUrl: tempPreviewUrl,
        grantAttachmentName: file.name
      }));

      // Upload to Google Drive under dedicated 'vehicle' folder
      setIsUploadingGrant(true);
      try {
        const res = await uploadToGoogleDrive(file, {
          folderName: 'vehicle',
          tenant: activeTenant,
        });
        setGrantUploadResult(res);
        if (res.success && res.url) {
          URL.revokeObjectURL(tempPreviewUrl);
          setFormData(prev => ({
            ...prev,
            grantAttachmentUrl: res.url,
            grantAttachmentName: res.name,
          }));
        }
      } catch (err: any) {
        console.warn('Error uploading grant to Google Drive:', err.message);
      } finally {
        setIsUploadingGrant(false);
      }
    }
  };

  const removeGrant = () => {
    if (grantFile && formData.grantAttachmentUrl && formData.grantAttachmentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(formData.grantAttachmentUrl);
    }
    setGrantFile(null);
    setGrantUploadResult(null);
    setFormData(prev => ({ ...prev, grantAttachmentUrl: undefined, grantAttachmentName: undefined }));
    const input = document.getElementById('grant-doc-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Step Validation logic
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) {
        errors.name = 'Vehicle Name is required.';
      }
      if (!formData.plateNumber.trim()) {
        errors.plateNumber = 'Plate Number is required.';
      } else {
        // Unique check
        const normalizedPlate = formData.plateNumber.trim().toUpperCase().replace(/\s+/g, '');
        const duplicate = vehicles.find(v => {
          if (vehicleToEdit && v.id === vehicleToEdit.id) return false;
          return v.plateNumber.trim().toUpperCase().replace(/\s+/g, '') === normalizedPlate;
        });
        if (duplicate) {
          errors.plateNumber = `Plate number "${formData.plateNumber.trim().toUpperCase()}" is already registered for another vehicle.`;
        }
      }
      if (!formData.brandMake.trim()) {
        errors.brandMake = 'Brand / Make is required.';
      }
      if (!formData.vehicleType) {
        errors.vehicleType = 'Vehicle Type is required.';
      }
    }

    if (step === 2) {
      if (!formData.ownershipType) {
        errors.ownershipType = 'Ownership Type is required.';
      }
      if (!formData.vehicleStatus) {
        errors.vehicleStatus = 'Vehicle Status is required.';
      }
    }

    if (step === 3) {
      if (!formData.fuelType) {
        errors.fuelType = 'Fuel Type is required.';
      }
      if (formData.currentOdometer === '' || isNaN(Number(formData.currentOdometer)) || Number(formData.currentOdometer) < 0) {
        errors.currentOdometer = 'A valid Current Odometer reading in KM (0 or greater) is required.';
      }
    }

    if (step === 4) {
      if (!formData.roadTaxExpiry) {
        errors.roadTaxExpiry = 'Road Tax Expiry Date is required.';
      }
      if (!formData.insuranceExpiry) {
        errors.insuranceExpiry = 'Insurance Expiry Date is required.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(activeStep)) {
      if (activeStep < 4) {
        setActiveStep((prev) => (prev + 1) as any);
      }
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      setActiveStep((prev) => (prev - 1) as any);
    }
  };

  const handleJumpStep = (targetStep: 1 | 2 | 3 | 4) => {
    // If jumping forward, validate current step first
    if (targetStep > activeStep) {
      if (!validateStep(activeStep)) return;
    }
    setActiveStep(targetStep);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all 4 steps
    const step1Valid = validateStep(1);
    if (!step1Valid) {
      setActiveStep(1);
      return;
    }
    const step2Valid = validateStep(2);
    if (!step2Valid) {
      setActiveStep(2);
      return;
    }
    const step3Valid = validateStep(3);
    if (!step3Valid) {
      setActiveStep(3);
      return;
    }
    const step4Valid = validateStep(4);
    if (!step4Valid) {
      setActiveStep(4);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Omit<Vehicle, 'id'> = {
        name: formData.name.trim(),
        plateNumber: formData.plateNumber.trim().toUpperCase(),
        vinChassisNumber: formData.vinChassisNumber.trim() ? formData.vinChassisNumber.trim().toUpperCase() : undefined,
        engineNumber: formData.engineNumber.trim() ? formData.engineNumber.trim().toUpperCase() : undefined,
        photoUrl: formData.photoUrl,
        photoName: formData.photoName,
        vehicleType: formData.vehicleType,
        brandMake: formData.brandMake.trim(),
        manufactureYear: formData.manufactureYear ? parseInt(formData.manufactureYear, 10) : undefined,

        ownershipType: formData.ownershipType,
        vehicleStatus: formData.vehicleStatus,
        assignedBranch: formData.assignedBranch.trim() ? formData.assignedBranch.trim() : undefined,
        assignedDriverId: formData.assignedDriverId ? formData.assignedDriverId : undefined,

        fuelType: formData.fuelType,
        fuelCardNumber: formData.fuelCardNumber.trim() ? formData.fuelCardNumber.trim() : undefined,
        currentOdometer: Number(formData.currentOdometer) || 0,
        maxPayloadCapacityKg: formData.maxPayloadCapacityKg ? parseFloat(formData.maxPayloadCapacityKg) : undefined,
        engineCapacityCc: formData.engineCapacityCc ? parseInt(formData.engineCapacityCc, 10) : undefined,

        roadTaxExpiry: formData.roadTaxExpiry,
        insuranceExpiry: formData.insuranceExpiry,
        puspakomExpiry: formData.puspakomExpiry ? formData.puspakomExpiry : undefined,
        permitExpiry: formData.permitExpiry ? formData.permitExpiry : undefined,
        grantAttachmentUrl: formData.grantAttachmentUrl,
        grantAttachmentName: formData.grantAttachmentName,
        specifications: formData.specifications.trim() ? formData.specifications.trim() : undefined,
      };

      if (vehicleToEdit) {
        updateVehicle(vehicleToEdit.id, payload);
      } else {
        addVehicle(payload);
      }

      onClose();
    } catch (err: any) {
      alert('Error saving vehicle: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden border border-slate-200 my-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <TruckIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {vehicleToEdit ? 'Edit Vehicle Specifications' : 'Add New Vehicle'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure fleet asset identity, ownership, technical specifications, and legal compliance.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Step Progression Bar */}
        <div className="bg-white px-6 pt-4 pb-2 border-b border-slate-100">
          <div className="grid grid-cols-4 gap-2">
            {[
              { step: 1, title: 'Basic Info', subtitle: 'Identity & Make' },
              { step: 2, title: 'Operations', subtitle: 'Ownership & Driver' },
              { step: 3, title: 'Specs & Fuel', subtitle: 'Capacity & Odo' },
              { step: 4, title: 'Compliance', subtitle: 'Permits & Expiry' },
            ].map((s) => {
              const isActive = activeStep === s.step;
              const isPast = activeStep > s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => handleJumpStep(s.step as any)}
                  className={`text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs' 
                      : isPast
                        ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isActive ? 'text-indigo-600' : isPast ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      Step {s.step}
                    </span>
                    {isPast && (
                      <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className={`text-xs font-bold truncate mt-0.5 ${
                    isActive ? 'text-slate-900' : isPast ? 'text-slate-800' : 'text-slate-600'
                  }`}>
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate hidden sm:block">
                    {s.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {Object.keys(formErrors).length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>Please complete all required fields correctly to proceed.</span>
          </div>
        )}

        {/* Form Body with Multi-Step Wizard */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[65vh] space-y-6">
          {/* ================= STEP 1: BASIC INFORMATION ================= */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">1</span>
                  Basic Information
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Core identity details, plate registration number, and photographic asset.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Vehicle Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vehicle Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Toyota Alphard 2.5 / Perodua Alza"
                    className={`w-full text-sm border rounded-xl p-2.5 outline-none transition ${
                      formErrors.name 
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.name}</p>
                  )}
                </div>

                {/* Plate Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Plate Number (Unique) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="plateNumber"
                    value={formData.plateNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. VAA 1234 / WXY 8821"
                    className={`w-full text-sm font-mono uppercase border rounded-xl p-2.5 outline-none transition ${
                      formErrors.plateNumber 
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                  {formErrors.plateNumber && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.plateNumber}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Vehicle Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vehicle Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>

                {/* Brand / Make */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Brand / Make <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="brandMake"
                    value={formData.brandMake}
                    onChange={handleInputChange}
                    list="brand-suggestions"
                    placeholder="e.g. Toyota, Perodua, Isuzu"
                    className={`w-full text-sm border rounded-xl p-2.5 outline-none transition ${
                      formErrors.brandMake 
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                  <datalist id="brand-suggestions">
                    {COMMON_BRANDS.map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                  {formErrors.brandMake && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.brandMake}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Manufacture Year */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Manufacture Year <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    name="manufactureYear"
                    min="1990"
                    max="2035"
                    value={formData.manufactureYear}
                    onChange={handleInputChange}
                    placeholder="e.g. 2023"
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* VIN / Chassis Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    VIN / Chassis No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="vinChassisNumber"
                    value={formData.vinChassisNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. PM2M550000123456"
                    className="w-full text-sm font-mono border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Engine Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Engine No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="engineNumber"
                    value={formData.engineNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. 2NR-VE1234567"
                    className="w-full text-sm font-mono border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Vehicle Photo Upload */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Vehicle Photo <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/></svg>
                    Google Drive: /vehicle
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  {formData.photoUrl ? (
                    <div className="relative group flex-shrink-0">
                      <img 
                        src={getDriveDirectImageUrl(formData.photoUrl)} 
                        alt="Vehicle preview" 
                        className="h-20 w-24 rounded-xl object-cover border border-slate-200 shadow-xs" 
                        onError={(e) => {
                          // Fallback to placeholder if link fails
                          (e.currentTarget as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>';
                        }}
                      />
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition"
                        title="Remove photo"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-24 rounded-xl bg-slate-200/70 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 flex-shrink-0">
                      <TruckIcon className="h-8 w-8 mb-0.5" />
                      <span className="text-[10px] font-semibold">No Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <input
                      id="vehicle-photo-upload"
                      type="file"
                      accept="image/*"
                      disabled={isUploadingPhoto}
                      onChange={handlePhotoChange}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer disabled:opacity-50"
                    />

                    {isUploadingPhoto && (
                      <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium py-1 animate-pulse">
                        <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Uploading photo directly to Google Drive (folder: vehicle)...</span>
                      </div>
                    )}

                    {!isUploadingPhoto && photoUploadResult && (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
                        <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Saved to Drive folder <strong>vehicle</strong></span>
                        {photoUploadResult.webViewLink && (
                          <a 
                            href={photoUploadResult.webViewLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-indigo-600 hover:underline inline-flex items-center ml-1"
                          >
                            Open in Drive ↗
                          </a>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400">
                      Vehicle images are stored in the dedicated <strong>vehicle</strong> folder so they remain separated from fuel log receipts and booking attachments.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: OPERATIONAL & OWNERSHIP STATUS ================= */}
          {activeStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">2</span>
                  Operational & Ownership Status
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Asset tenure type, operational availability, base location branch, and assigned personnel.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ownership Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ownership Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="ownershipType"
                    value={formData.ownershipType}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {VEHICLE_OWNERSHIP_TYPES.map(ot => (
                      <option key={ot} value={ot}>{ot}</option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Operational Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="vehicleStatus"
                    value={formData.vehicleStatus}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {VEHICLE_OPERATIONAL_STATUSES.map(vs => (
                      <option key={vs} value={vs}>{vs}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assigned Branch */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Branch / Location <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="assignedBranch"
                    value={formData.assignedBranch}
                    onChange={handleInputChange}
                    list="branch-suggestions"
                    placeholder="e.g. HQ Kuala Lumpur / PJBA Center"
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="branch-suggestions">
                    {COMMON_BRANCHES.map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                {/* Assigned Driver ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Dedicated Assigned Driver <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    name="assignedDriverId"
                    value={formData.assignedDriverId}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None (Pool / Unassigned Fleet Vehicle)</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} {driver.phone ? `(${driver.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: TECHNICAL & FUEL SPECS ================= */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">3</span>
                  Technical & Fuel Specifications
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Engine displacement, payload constraints, initial odometer reading, and fuel payment card details.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fuel Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fuel Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="fuelType"
                    value={formData.fuelType}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {FUEL_TYPES.map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>

                {/* Fuel Card Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fuel Card Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="fuelCardNumber"
                    value={formData.fuelCardNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. PETRONAS-7082-1102"
                    className="w-full text-sm font-mono border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Current Odometer */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Current Odometer (KM) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="currentOdometer"
                    min="0"
                    step="1"
                    value={formData.currentOdometer}
                    onChange={handleInputChange}
                    placeholder="e.g. 45000"
                    className={`w-full text-sm font-mono border rounded-xl p-2.5 outline-none transition ${
                      formErrors.currentOdometer 
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                  {formErrors.currentOdometer && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.currentOdometer}</p>
                  )}
                </div>

                {/* Max Payload Capacity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Max Payload (KG) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    name="maxPayloadCapacityKg"
                    min="0"
                    step="50"
                    value={formData.maxPayloadCapacityKg}
                    onChange={handleInputChange}
                    placeholder="e.g. 1000 / 3000"
                    className="w-full text-sm font-mono border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Engine Capacity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Engine Capacity (CC) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    name="engineCapacityCc"
                    min="0"
                    step="50"
                    value={formData.engineCapacityCc}
                    onChange={handleInputChange}
                    placeholder="e.g. 1496 / 2494"
                    className="w-full text-sm font-mono border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: INITIAL COMPLIANCE & EXPIRY DATES ================= */}
          {activeStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">4</span>
                  Initial Compliance & Expiry Dates
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Road tax, motor insurance policy renewals, commercial inspections (PUSPAKOM), permits, and registration grant.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Road Tax Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Road Tax Expiry <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="roadTaxExpiry"
                    value={formData.roadTaxExpiry}
                    onChange={handleInputChange}
                    className={`w-full text-sm border rounded-xl p-2.5 outline-none transition ${
                      formErrors.roadTaxExpiry 
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                  {formErrors.roadTaxExpiry && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.roadTaxExpiry}</p>
                  )}
                </div>

                {/* Insurance Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Insurance Expiry <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="insuranceExpiry"
                    value={formData.insuranceExpiry}
                    onChange={handleInputChange}
                    className={`w-full text-sm border rounded-xl p-2.5 outline-none transition ${
                      formErrors.insuranceExpiry 
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                  {formErrors.insuranceExpiry && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.insuranceExpiry}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PUSPAKOM Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    PUSPAKOM Expiry <span className="text-slate-400 font-normal">(Commercial Vehicles)</span>
                  </label>
                  <input
                    type="date"
                    name="puspakomExpiry"
                    value={formData.puspakomExpiry}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Permit Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Permit Expiry (APAD / LPPB) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    name="permitExpiry"
                    value={formData.permitExpiry}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Grant Document Upload */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Vehicle Grant / Registration Card (VOC) <span className="text-slate-400 font-normal">(Optional PDF/Image)</span>
                  </label>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/></svg>
                    Google Drive: /vehicle
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  {formData.grantAttachmentUrl ? (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 flex-1 shadow-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-indigo-600 font-bold text-xs uppercase px-2 py-0.5 bg-indigo-50 rounded">VOC Document</span>
                        <a 
                          href={formData.grantAttachmentUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs text-indigo-700 hover:underline truncate font-medium flex items-center gap-1"
                        >
                          {formData.grantAttachmentName || 'Vehicle_Grant_Document.pdf'}
                          <span className="text-[10px] text-indigo-500">↗</span>
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={removeGrant}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded-md hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-1.5">
                      <input
                        id="grant-doc-upload"
                        type="file"
                        accept=".pdf,image/*"
                        disabled={isUploadingGrant}
                        onChange={handleGrantChange}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200/70 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer disabled:opacity-50"
                      />

                      {isUploadingGrant && (
                        <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium py-1 animate-pulse">
                          <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>Uploading grant document to Google Drive (folder: vehicle)...</span>
                        </div>
                      )}

                      {!isUploadingGrant && grantUploadResult && (
                        <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Saved to Drive folder <strong>vehicle</strong></span>
                          {grantUploadResult.webViewLink && (
                            <a 
                              href={grantUploadResult.webViewLink} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-indigo-600 hover:underline inline-flex items-center ml-1"
                            >
                              Open in Drive ↗
                            </a>
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400">
                        Registration grant (VOC) is safely uploaded directly to your Google Drive <strong>vehicle</strong> folder.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Specifications / Special Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Additional Equipment & Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  name="specifications"
                  value={formData.specifications}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="e.g. Equipped with dashcam, fire extinguisher, first aid kit, GPS tracking unit..."
                  className="w-full text-sm border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {activeStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  ← Back
                </button>
              )}

              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition active:scale-95 cursor-pointer"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : vehicleToEdit ? 'Save Changes' : 'Confirm & Register Vehicle'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleForm;