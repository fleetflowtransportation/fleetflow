import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { XIcon, CheckCircleIcon, DocumentDownloadIcon, TrashIcon, ExclamationIcon } from './icons/Icons';
import type { Vehicle, VehicleRenewal, ComplianceType } from '../types';
import { COMPLIANCE_TYPES } from '../types';

interface VehicleRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  defaultComplianceType?: ComplianceType;
  onSuccess?: (renewal: VehicleRenewal, updatedVehicle: Vehicle) => void;
}

const PROVIDER_SUGGESTIONS: Record<ComplianceType, string[]> = {
  'Insurance': ['Etiqa Takaful', 'Allianz General', 'Takaful Malaysia', 'Zurich Insurance', 'Kurnia Insurance', 'Tokio Marine', 'Tune Protect'],
  'Road Tax': ['MyEG Services', 'JPJ Counter / Portal', 'Pos Malaysia', 'Direct Insurance Package'],
  'PUSPAKOM': ['PUSPAKOM Inspection Centre', 'PUSPAKOM Premier Mobile Unit', 'PUSPAKOM Online Portal'],
  'Permit': ['APAD (Land Public Transport Agency)', 'LPPB (Sabah / Sarawak)', 'JPJ Commercial Permit Division'],
};

export const VehicleRenewalModal: React.FC<VehicleRenewalModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  defaultComplianceType = 'Insurance',
  onSuccess,
}) => {
  const { renewVehicleCompliance, vehicleRenewals, deleteVehicleRenewal, currentUser } = useAppContext();

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [complianceType, setComplianceType] = useState<ComplianceType>(defaultComplianceType);
  const [oldExpiryDate, setOldExpiryDate] = useState<string>('');
  const [renewalDate, setRenewalDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');
  const [costAmount, setCostAmount] = useState<string>('');
  const [providerAgentName, setProviderAgentName] = useState<string>('');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to extract existing expiry date from vehicle
  const getExistingExpiry = (v: Vehicle | null, type: ComplianceType): string => {
    if (!v) return '';
    if (type === 'Insurance') return v.insuranceExpiry || '';
    if (type === 'Road Tax') return v.roadTaxExpiry || '';
    if (type === 'PUSPAKOM') return v.puspakomExpiry || '';
    if (type === 'Permit') return v.permitExpiry || '';
    return '';
  };

  // Helper to suggest +1 year date
  const calculateDefaultNewExpiry = (baseDateStr: string): string => {
    if (!baseDateStr) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
    const d = new Date(baseDateStr);
    if (isNaN(d.getTime())) {
      const today = new Date();
      today.setFullYear(today.getFullYear() + 1);
      return today.toISOString().split('T')[0];
    }
    // If old expiry is in the past, add 1 year to today. Otherwise, add 1 year to existing expiry
    const today = new Date();
    if (d.getTime() < today.getTime()) {
      today.setFullYear(today.getFullYear() + 1);
      return today.toISOString().split('T')[0];
    } else {
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
  };

  const prevIsOpenRef = useRef(false);
  const prevVehicleIdRef = useRef<string | null | undefined>(undefined);
  const prevTypeRef = useRef<string | undefined>(undefined);

  // Sync state whenever modal opens or vehicle/defaultComplianceType changes
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const vehicleChanged = isOpen && (vehicle ? vehicle.id : null) !== prevVehicleIdRef.current;
    const typeChanged = isOpen && defaultComplianceType !== prevTypeRef.current;

    prevIsOpenRef.current = isOpen;
    prevVehicleIdRef.current = vehicle ? vehicle.id : null;
    prevTypeRef.current = defaultComplianceType;

    if (!isOpen) return;

    if (justOpened || vehicleChanged || typeChanged) {
      if (vehicle) {
        const targetType = (defaultComplianceType || 'Insurance') as ComplianceType;
        setComplianceType(targetType);
        const existing = getExistingExpiry(vehicle, targetType);
        setOldExpiryDate(existing);
        setRenewalDate(new Date().toISOString().split('T')[0]);
        setNewExpiryDate(calculateDefaultNewExpiry(existing));
        setCostAmount('');
        setProviderAgentName('');
        setDocumentUrl('');
        setDocumentName('');
        setRemarks('');
        setFormErrors({});
        setSuccessBanner(null);
        setActiveTab('form');
      }
    }
  }, [isOpen, vehicle, defaultComplianceType]);

  // When compliance type changes in form, update oldExpiryDate and suggested newExpiryDate
  const handleComplianceTypeChange = (newType: ComplianceType) => {
    setComplianceType(newType);
    const existing = getExistingExpiry(vehicle, newType);
    setOldExpiryDate(existing);
    setNewExpiryDate(calculateDefaultNewExpiry(existing));
  };

  // Quick 1-Year or 6-Months duration helper buttons
  const handleQuickAddDuration = (months: number) => {
    let base = renewalDate ? new Date(renewalDate) : new Date();
    if (oldExpiryDate && new Date(oldExpiryDate).getTime() > new Date().getTime()) {
      base = new Date(oldExpiryDate);
    }
    base.setMonth(base.getMonth() + months);
    setNewExpiryDate(base.toISOString().split('T')[0]);
  };

  // File upload handler (Convert to base64 for persistent storage & viewing)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('File size exceeds the 8MB limit. Please upload a smaller document.');
      return;
    }

    setDocumentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDocumentUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setDocumentUrl('');
    setDocumentName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Vehicle renewals history for this vehicle
  const historyForVehicle = useMemo(() => {
    if (!vehicle) return [];
    return vehicleRenewals
      .filter(r => r.vehicleId === vehicle.id)
      .sort((a, b) => new Date(b.renewalDate).getTime() - new Date(a.renewalDate).getTime());
  }, [vehicleRenewals, vehicle]);

  // Total cost spent on renewals for this vehicle
  const totalCost = useMemo(() => {
    return historyForVehicle.reduce((sum, item) => sum + (Number(item.costAmount) || 0), 0);
  }, [historyForVehicle]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    const errors: { [key: string]: string } = {};

    if (!newExpiryDate) {
      errors.newExpiryDate = 'New expiry date is required.';
    }
    if (!renewalDate) {
      errors.renewalDate = 'Renewal date is required.';
    }
    if (costAmount === '' || isNaN(Number(costAmount)) || Number(costAmount) < 0) {
      errors.costAmount = 'Please enter a valid cost in RM (e.g. 350.00).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const result = await renewVehicleCompliance(vehicle.id, {
        vehicleId: vehicle.id,
        complianceType,
        oldExpiryDate: oldExpiryDate || undefined,
        newExpiryDate,
        renewalDate,
        costAmount: parseFloat(costAmount) || 0,
        providerAgentName: providerAgentName.trim() || undefined,
        receiptPolicyDocumentUrl: documentUrl || undefined,
        receiptPolicyDocumentName: documentName || undefined,
        remarks: remarks.trim() || undefined,
        createdBy: currentUser?.name || 'Administrator',
      });

      if (result.success) {
        setSuccessBanner(`${complianceType} renewed successfully! New expiry date set to ${newExpiryDate}.`);
        if (onSuccess) {
          onSuccess(result.renewal, result.updatedVehicle);
        }
        // Brief timeout then switch to history or stay informed
        setTimeout(() => {
          setActiveTab('history');
          setSuccessBanner(null);
        }, 1200);
      }
    } catch (err: any) {
      alert(`Renewal failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHistoryItem = async (renewalId: string) => {
    if (window.confirm('Are you sure you want to delete this renewal record?')) {
      await deleteVehicleRenewal(renewalId);
    }
  };

  if (!isOpen || !vehicle) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md text-xl border border-white/20">
              🔄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight">Compliance Renewal</h3>
                <span className="text-[11px] font-mono uppercase bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                  {vehicle.plateNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {vehicle.name} {vehicle.vehicleType ? `• ${vehicle.vehicleType}` : ''}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('form'); setSuccessBanner(null); }}
            className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
              activeTab === 'form'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ✍️ Record New Renewal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-4 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>📋 Renewal History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {historyForVehicle.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-grow space-y-5">
          {successBanner && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold animate-in fade-in">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successBanner}</span>
            </div>
          )}

          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Compliance Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Compliance Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COMPLIANCE_TYPES.map(type => {
                    const isSelected = complianceType === type;
                    const existingExp = getExistingExpiry(vehicle, type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleComplianceTypeChange(type)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 ring-2 ring-indigo-500/20 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold">{type}</span>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 truncate">
                          {existingExp ? `Exp: ${existingExp}` : 'Not set'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Old Expiry Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Previous Expiry Date
                  </label>
                  <input
                    type="date"
                    value={oldExpiryDate}
                    onChange={e => setOldExpiryDate(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 p-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Auto-populated from vehicle</p>
                </div>

                {/* Renewal Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Renewal Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={renewalDate}
                    onChange={e => setRenewalDate(e.target.value)}
                    required
                    className={`w-full text-xs rounded-lg border p-2 focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.renewalDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.renewalDate && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.renewalDate}</p>
                  )}
                </div>

                {/* New Expiry Date */}
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1">
                    New Expiry Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                    required
                    className={`w-full text-xs rounded-lg border font-semibold p-2 focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.newExpiryDate ? 'border-rose-400 bg-rose-50/30' : 'border-indigo-300 bg-indigo-50/30 text-indigo-950'
                    }`}
                  />
                  {formErrors.newExpiryDate && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.newExpiryDate}</p>
                  )}
                </div>
              </div>

              {/* Quick Preset Duration Buttons */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAddDuration(6)}
                  className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                >
                  +6 Months
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddDuration(12)}
                  className="px-2.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition"
                >
                  +1 Year (Standard)
                </button>
              </div>

              {/* Cost & Provider Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Cost in RM */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cost Amount (RM) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">
                      RM
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={costAmount}
                      onChange={e => setCostAmount(e.target.value)}
                      required
                      className={`w-full pl-10 pr-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 ${
                        formErrors.costAmount ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {formErrors.costAmount && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.costAmount}</p>
                  )}
                </div>

                {/* Provider / Agent Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Provider / Agent / Underwriter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Etiqa, Allianz, MyEG, JPJ"
                    value={providerAgentName}
                    onChange={e => setProviderAgentName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-indigo-500"
                  />
                  {/* Suggestions Chips */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {PROVIDER_SUGGESTIONS[complianceType]?.slice(0, 4).map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setProviderAgentName(sug)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Document Upload (Receipt / Policy) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt / Policy Document <span className="text-slate-400 font-normal">(Optional - PDF / Image, max 8MB)</span>
                </label>
                {!documentUrl ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:border-indigo-400 transition bg-slate-50/50">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="policy-file-upload"
                    />
                    <label htmlFor="policy-file-upload" className="cursor-pointer block">
                      <div className="text-xl mb-1">📄</div>
                      <p className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                        Click to upload receipt, cover note, or policy document
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG accepted</p>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">📎</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{documentName || 'Document Uploaded'}</p>
                        <span className="text-[10px] text-emerald-700 font-semibold">Ready to save</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={documentUrl}
                        download={documentName || 'renewal_document'}
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-medium rounded hover:bg-indigo-100 transition"
                        title="Download / Preview"
                      >
                        Preview
                      </a>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-100 transition"
                        title="Remove file"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks / Policy Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Policy Number / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Policy #MY-2026-99812, Comprehensive with windscreen endorsement..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm hover:shadow transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Renewal...</span>
                    </>
                  ) : (
                    <>
                      <span>Apply & Update {complianceType}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-4">
              {/* Summary Stats Header */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Total Renewals Logged</p>
                  <p className="text-base font-bold text-slate-900">{historyForVehicle.length} record(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 font-medium">Total Spent on Compliance</p>
                  <p className="text-base font-bold text-indigo-700">RM {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {historyForVehicle.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {historyForVehicle.map(item => (
                    <div key={item.id} className="p-3.5 hover:bg-slate-50/70 transition space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                            item.complianceType === 'Insurance' ? 'bg-blue-100 text-blue-800' :
                            item.complianceType === 'Road Tax' ? 'bg-amber-100 text-amber-800' :
                            item.complianceType === 'PUSPAKOM' ? 'bg-purple-100 text-purple-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.complianceType}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            RM {Number(item.costAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">
                            Renewed: <strong>{item.renewalDate}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition"
                            title="Delete renewal log"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span>Period:</span>
                          <span className="text-slate-500 font-mono">{item.oldExpiryDate || 'Initial'}</span>
                          <span>→</span>
                          <span className="font-bold text-emerald-700 font-mono">{item.newExpiryDate}</span>
                        </div>
                        {item.providerAgentName && (
                          <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                            🏢 {item.providerAgentName}
                          </span>
                        )}
                      </div>

                      {item.remarks && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">
                          {item.remarks}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                        <span>Recorded by: {item.createdBy || 'Admin'}</span>
                        {item.receiptPolicyDocumentUrl && (
                          <a
                            href={item.receiptPolicyDocumentUrl}
                            download={item.receiptPolicyDocumentName || `receipt_${item.complianceType}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            <DocumentDownloadIcon className="w-3.5 h-3.5" />
                            <span>Download Receipt</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">No renewal records logged yet for this vehicle.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    + Record First Renewal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleRenewalModal;
