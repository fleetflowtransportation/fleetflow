/**
 * Vehicle Renewal API Service & Business Logic
 * Endpoint specification: POST /api/vehicles/:id/renew
 */

import type { VehicleRenewal, ComplianceType, Vehicle } from '../types';
import { storageService } from './storage';

export interface VehicleRenewRequestBody {
  compliance_type?: ComplianceType;
  complianceType?: ComplianceType;
  old_expiry_date?: string;
  oldExpiryDate?: string;
  new_expiry_date?: string;
  newExpiryDate?: string;
  renewal_date?: string;
  renewalDate?: string;
  cost_amount?: number;
  costAmount?: number;
  provider_agent_name?: string;
  providerAgentName?: string;
  receipt_policy_document_url?: string;
  receiptPolicyDocumentUrl?: string;
  receipt_policy_document_name?: string;
  receiptPolicyDocumentName?: string;
  remarks?: string;
  created_by?: string;
  createdBy?: string;
  tenant_id?: string;
  tenantId?: string;
}

export interface VehicleRenewApiResponse {
  success: boolean;
  message: string;
  data: {
    renewal: VehicleRenewal;
    vehicle: Vehicle;
  };
}

/**
 * Executes the Renewal Business Logic:
 * a) Create a new record in vehicle_renewals table to log history and cost.
 * b) Update the main vehicles table's corresponding expiry date field with new_expiry_date.
 * c) Return a success response and updated records.
 */
export async function executeVehicleRenewal(
  vehicleId: string,
  payload: VehicleRenewRequestBody
): Promise<VehicleRenewApiResponse> {
  const complianceType = (payload.compliance_type || payload.complianceType) as ComplianceType;
  if (!complianceType) {
    throw new Error('Compliance type is required (Insurance, Road Tax, PUSPAKOM, or Permit).');
  }

  const newExpiryDate = payload.new_expiry_date || payload.newExpiryDate;
  if (!newExpiryDate) {
    throw new Error('New expiry date is required.');
  }

  const renewalDate = payload.renewal_date || payload.renewalDate || new Date().toISOString().split('T')[0];
  const costAmount = Number(payload.cost_amount !== undefined ? payload.cost_amount : (payload.costAmount || 0));

  const renewalData: Omit<VehicleRenewal, 'id' | 'createdAt' | 'updatedAt'> = {
    vehicleId,
    complianceType,
    oldExpiryDate: payload.old_expiry_date || payload.oldExpiryDate || undefined,
    newExpiryDate,
    renewalDate,
    costAmount,
    providerAgentName: payload.provider_agent_name || payload.providerAgentName || undefined,
    receiptPolicyDocumentUrl: payload.receipt_policy_document_url || payload.receiptPolicyDocumentUrl || undefined,
    receiptPolicyDocumentName: payload.receipt_policy_document_name || payload.receiptPolicyDocumentName || undefined,
    remarks: payload.remarks || undefined,
    createdBy: payload.created_by || payload.createdBy || undefined,
    tenantId: payload.tenant_id || payload.tenantId || storageService.getTenantId(),
  };

  const result = await storageService.renewVehicle(vehicleId, renewalData);

  return {
    success: true,
    message: `${complianceType} for vehicle renewed successfully until ${newExpiryDate}.`,
    data: {
      renewal: result.renewal,
      vehicle: result.updatedVehicle,
    },
  };
}

/**
 * Client caller for POST /api/vehicles/:id/renew
 * Calls the API route if available, or falls back seamlessly to the direct storage business logic.
 */
export async function postVehicleRenew(
  vehicleId: string,
  payload: VehicleRenewRequestBody
): Promise<VehicleRenewApiResponse> {
  try {
    const res = await fetch(`/api/vehicles/${vehicleId}/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success) {
        return json;
      }
    }
  } catch (err) {
    // In dev SPA without standalone node server, execute the authoritative business logic directly
    console.debug('[RenewalApi] Invoking direct engine for POST /api/vehicles/:id/renew:', err);
  }

  return executeVehicleRenewal(vehicleId, payload);
}
