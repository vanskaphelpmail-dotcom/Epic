export const REQUEST_TYPES = [
  { id: 'JOINING_LETTER', label: 'Joining Letter' },
  { id: 'HOLIDAY_LETTER', label: 'Holiday Request Letter' },
  { id: 'PAYSLIP', label: 'Payslip' },
  { id: 'EMPLOYEE_LETTER', label: 'Employee Letter' },
  { id: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
  { id: 'EMPLOYMENT_VERIFICATION', label: 'Employment Verification Letter' },
  { id: 'SALARY_CERTIFICATE', label: 'Salary Certificate' },
  { id: 'NOC', label: 'No Objection Certificate (NOC)' },
  { id: 'LEAVE_APPROVAL', label: 'Leave Approval Letter' },
  { id: 'PROMOTION_LETTER', label: 'Promotion Letter' },
  { id: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
  { id: 'WARNING_LETTER', label: 'Warning Letter' },
  { id: 'RELIEVING_LETTER', label: 'Relieving Letter' },
  { id: 'RECOMMENDATION_LETTER', label: 'Recommendation Letter' },
  { id: 'OTHER', label: 'Other Document' }
];

export const REQUEST_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEED_INFORMATION',
  'APPROVED',
  'READY',
  'REJECTED',
  'COMPLETED',
  'CANCELLED'
];

export function requestTypeLabel(id) {
  return REQUEST_TYPES.find((t) => t.id === id)?.label || String(id || '').replace(/_/g, ' ');
}

export function statusLabel(status) {
  return String(status || '').replace(/_/g, ' ');
}
