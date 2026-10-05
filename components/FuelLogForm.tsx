import React from 'react';
import FuelLogModal from './FuelLogModal';
import type { FuelLog } from '../types';

interface FuelLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverId?: string;
  logToEdit?: FuelLog | null;
  initialVehicleId?: string;
}

const FuelLogForm: React.FC<FuelLogFormProps> = ({ 
  isOpen, 
  onClose, 
  driverId, 
  logToEdit, 
  initialVehicleId 
}) => {
  return (
    <FuelLogModal
      isOpen={isOpen}
      onClose={onClose}
      logToEdit={logToEdit}
      initialDriverId={driverId}
      initialVehicleId={initialVehicleId}
    />
  );
};

export default FuelLogForm;
