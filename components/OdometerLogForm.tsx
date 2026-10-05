import React from 'react';
import OdometerLogEditForm from './OdometerLogEditForm';

interface OdometerLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  defaultBookingId?: string;
  defaultBookingIds?: string[];
  defaultVehicleId?: string;
}

const OdometerLogForm: React.FC<OdometerLogFormProps> = ({ 
  isOpen, 
  onClose, 
  driverId, 
  defaultBookingId,
  defaultBookingIds,
  defaultVehicleId
}) => {
  return (
    <OdometerLogEditForm
      isOpen={isOpen}
      onClose={onClose}
      initialDriverId={driverId}
      initialVehicleId={defaultVehicleId}
      defaultBookingId={defaultBookingId}
      defaultBookingIds={defaultBookingIds}
    />
  );
};

export default OdometerLogForm;
