import React, { useState } from 'react';
import { FuelLog, Vehicle, User } from '../types';
import {
  FuelIcon,
  XIcon,
  CalendarIcon,
  UserCircleIcon,
  GaugeIcon,
  PaperClipIcon,
  DocumentDownloadIcon,
  EditIcon,
  RefreshIcon
} from './icons/Icons';

interface FuelLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fuelLog: FuelLog | null;
  vehicles: Vehicle[];
  users: User[];
  onEdit?: (log: FuelLog) => void;
}

/**
 * Normalizes different Google Drive / remote URL formats into a directly viewable image URL.
 */
export function getDirectReceiptImageUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();

  // If already a Data URL, Blob, or Google UserContent direct image link
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.includes('lh3.googleusercontent.com')
  ) {
    return trimmed;
  }

  // Google Drive view link: https://drive.google.com/file/d/{FILE_ID}/view...
  const matchDrive = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchDrive && matchDrive[1]) {
    return `https://lh3.googleusercontent.com/d/${matchDrive[1]}`;
  }

  // Google Drive id param: https://drive.google.com/...?...id={FILE_ID}
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
  }

  // Default to the provided URL
  return trimmed;
}

export const FuelLogDetailModal: React.FC<FuelLogDetailModalProps> = ({
  isOpen,
  onClose,
  fuelLog,
  vehicles,
  users,
  onEdit
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Reset image view transforms on modal open / log change
  React.useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen, fuelLog?.id]);

  if (!isOpen || !fuelLog) return null;

  const vehicle = vehicles.find(v => v.id === fuelLog.vehicleId);
  const driver = users.find(u => u.id === fuelLog.driverId);
  const driverName = driver?.name || 'Driver / Staf';
  const rawImageUrl = fuelLog.receiptAttachmentUrl;
  const directImageUrl = getDirectReceiptImageUrl(rawImageUrl);
  const fileName = fuelLog.receiptAttachmentName || 'Receipt_Attachment.jpg';

  const formattedDate = fuelLog.date
    ? new Date(fuelLog.date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : '-';

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.3, 0.6));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetTransform = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleDownload = async () => {
    if (!directImageUrl) return;
    setIsDownloading(true);
    try {
      // Attempt in-memory blob download to prevent about:blank#blocked in iframe
      const response = await fetch(directImageUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = fileName;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      // Fallback: trigger standard browser download anchor
      const tempLink = document.createElement('a');
      tempLink.href = directImageUrl;
      tempLink.download = fileName;
      tempLink.target = '_self';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <FuelIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Fuel Log & Receipt Details
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono">
                  {vehicle?.plateNumber || 'No Plate'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Comprehensive refill metrics, odometer log, and verified receipt attachment
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* TOP METRICS SUMMARY BANNER */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Cost */}
            <div className="bg-linear-to-br from-amber-500 to-amber-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-amber-100 block">
                Total Refuel Cost
              </span>
              <div className="text-xl sm:text-2xl font-black mt-1 tracking-tight">
                RM {fuelLog.cost ? fuelLog.cost.toFixed(2) : '0.00'}
              </div>
            </div>

            {/* Liters */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 sm:p-4 rounded-2xl">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                Volume
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
                {fuelLog.liters ? fuelLog.liters.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-bold text-slate-400">Liters</span>
              </div>
            </div>

            {/* Price / Liter */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 sm:p-4 rounded-2xl">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                Price / Liter
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
                RM {fuelLog.pricePerLiter ? fuelLog.pricePerLiter.toFixed(2) : (fuelLog.cost && fuelLog.liters ? (fuelLog.cost / fuelLog.liters).toFixed(2) : '0.00')}
              </div>
            </div>

            {/* Odometer */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 sm:p-4 rounded-2xl">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                Odometer
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1 font-mono">
                {fuelLog.odometer ? fuelLog.odometer.toLocaleString() : '-'}{' '}
                <span className="text-xs font-bold text-slate-400">km</span>
              </div>
            </div>
          </div>

          {/* TWO COLUMN DETAILS & RECEIPT VIEWER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: DETAILS LIST (5 COLS) */}
            <div className="lg:col-span-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
                Log Details
              </h4>

              <div className="space-y-3 text-xs">
                {/* Vehicle */}
                <div className="flex items-start justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">Vehicle:</span>
                  <div className="text-right">
                    <div className="font-extrabold text-slate-900">{vehicle?.name || 'Assigned Vehicle'}</div>
                    <div className="font-mono text-[11px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      {vehicle?.plateNumber || '-'}
                    </div>
                  </div>
                </div>

                {/* Driver */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <UserCircleIcon className="w-4 h-4 text-slate-400" />
                    Driver / Staff:
                  </span>
                  <span className="font-bold text-slate-900">{driverName}</span>
                </div>

                {/* Date */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    Transaction Date:
                  </span>
                  <span className="font-bold text-slate-900">{formattedDate}</span>
                </div>

                {/* Odometer */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <GaugeIcon className="w-4 h-4 text-slate-400" />
                    Odometer Reading:
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {fuelLog.odometer ? `${fuelLog.odometer.toLocaleString()} km` : 'Not recorded'}
                  </span>
                </div>

                {/* Receipt Document Name */}
                <div className="flex items-start justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5 shrink-0">
                    <PaperClipIcon className="w-4 h-4 text-slate-400" />
                    Receipt Status:
                  </span>
                  <span className="text-right">
                    {rawImageUrl ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        Attachment Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-600">
                        No Attachment
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: RECEIPT IMAGE PREVIEW (7 COLS) */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Receipt Photo Preview
                  </h4>
                  {rawImageUrl && (
                    <span className="text-[10px] font-mono font-bold text-slate-400 truncate max-w-[160px] sm:max-w-[220px]" title={fileName}>
                      {fileName}
                    </span>
                  )}
                </div>

                {rawImageUrl && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      title="Zoom Out"
                    >
                      -
                    </button>
                    <span className="text-[11px] font-mono text-slate-500 px-1 min-w-[36px] text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition ml-1"
                      title="Rotate 90°"
                    >
                      <RefreshIcon className="w-3.5 h-3.5" />
                    </button>
                    {(zoomLevel !== 1 || rotation !== 0) && (
                      <button
                        type="button"
                        onClick={handleResetTransform}
                        className="text-[10px] font-bold text-indigo-600 hover:underline px-1.5"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* IMAGE CONTAINER */}
              <div className="relative flex-1 min-h-[300px] sm:min-h-[380px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center p-3 border border-slate-800 shadow-inner">
                {rawImageUrl ? (
                  <>
                    {!imageLoaded && !imageError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-medium">Loading receipt preview...</span>
                      </div>
                    )}

                    {imageError ? (
                      <div className="p-6 text-center text-slate-300 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center mx-auto">
                          <PaperClipIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Attachment Preview Unavailable</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                            The receipt file is hosted externally or restricted. You can save or download the file directly below.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                          <DocumentDownloadIcon className="w-4 h-4" />
                          Download Attached File
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center overflow-hidden">
                        <img
                          src={directImageUrl}
                          alt={`Receipt ${fileName}`}
                          onLoad={() => setImageLoaded(true)}
                          onError={() => setImageError(true)}
                          style={{
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: 'transform 0.15s ease-out'
                          }}
                          className={`max-w-full max-h-[380px] sm:max-h-[460px] object-contain rounded-lg shadow-lg select-none ${
                            !imageLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'
                          }`}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-8 text-slate-500 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-600 flex items-center justify-center mx-auto">
                      <PaperClipIcon className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-extrabold text-slate-400">No Receipt Attachment</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      This fuel log was submitted without an attached receipt photo or invoice.
                    </p>
                  </div>
                )}
              </div>

              {/* DOWNLOAD ACTION BELOW PREVIEW */}
              {rawImageUrl && !imageError && (
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">
                    Use toolbar above to zoom or rotate the photo.
                  </span>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition cursor-pointer"
                  >
                    <DocumentDownloadIcon className="w-3.5 h-3.5" />
                    {isDownloading ? 'Downloading...' : 'Save / Download Receipt'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <div>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(fuelLog);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
              >
                <EditIcon className="w-3.5 h-3.5" />
                Edit Fuel Record
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FuelLogDetailModal;
