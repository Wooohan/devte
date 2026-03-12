import { CarrierData, User, InsurancePolicy, BasicScore, OosRate, BlockedIP } from '../types';

// ============================================================
// CONSTANTS
// ============================================================
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// ============================================================
// INSURANCE DATA — calls the dedicated backend insurance service
// The frontend calls this one-by-one per DOT for real-time UI updates.
// ============================================================
export const fetchInsuranceData = async (dot: string): Promise<{
  policies: InsurancePolicy[];
  raw: any;
}> => {
  if (!dot) return { policies: [], raw: null };

  try {
    const res = await fetch(`${BACKEND_URL}/api/insurance/${dot}`, {
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const result = await res.json();
      return {
        policies: result.policies || [],
        raw: result.raw || null
      };
    }
  } catch (e) {
    console.error('Insurance fetch error:', e);
  }
  return { policies: [], raw: null };
};

// ============================================================
// CSV EXPORT
// ============================================================
export const downloadCSV = (data: CarrierData[]) => {
  const headers = [
    'Date', 'MC', 'Email', 'Entity Type', 'Operating Authority Status', 'Out of Service Date',
    'Legal_Name', 'DBA Name', 'Physical Address', 'Phone', 'Mailing Address', 'USDOT Number',
    'State Carrier ID Number', 'Power Units', 'Drivers', 'DUNS Number',
    'MCS-150 Form Date', 'MCS-150 Mileage (Year)', 'Operation Classification',
    'Carrier Operation', 'Cargo Carried', 'Safety Rating', 'Rating Date',
    'BASIC Scores', 'OOS Rates', 'Inspections'
  ];

  const esc = (val: string | number | undefined) => {
    if (!val) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const csvRows = data.map(row => [
    esc(row.dateScraped), row.mcNumber, esc(row.email),
    esc(row.entityType), esc(row.status), esc(row.outOfServiceDate),
    esc(row.legalName), esc(row.dbaName), esc(row.physicalAddress),
    esc(row.phone), esc(row.mailingAddress), esc(row.dotNumber),
    esc(row.stateCarrierId), esc(row.powerUnits), esc(row.drivers),
    esc(row.dunsNumber), esc(row.mcs150Date), esc(row.mcs150Mileage),
    esc(row.operationClassification.join(', ')),
    esc(row.carrierOperation.join(', ')),
    esc(row.cargoCarried.join(', ')),
    esc(row.safetyRating), esc(row.safetyRatingDate),
    esc(row.basicScores?.map((s: BasicScore) => `${s.category}: ${s.measure}`).join(' | ')),
    esc(row.oosRates?.map((r: OosRate) => `${r.type}: ${r.rate} (Avg: ${r.nationalAvg})`).join(' | ')),
    esc(row.inspections?.map((i: any) => `Report ${i.reportNumber}: ${i.oosViolations} OOS, ${i.driverViolations} Driver, ${i.vehicleViolations} Vehicle, ${i.hazmatViolations} Hazmat`).join(' | '))
  ]);

  const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `fmcsa_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================
// MOCK DATA (used by App.tsx for default admin user)
// ============================================================
export const MOCK_USERS: User[] = [
  {
    id: '1', name: 'Admin User', email: 'wooohan3@gmail.com', role: 'admin', plan: 'Enterprise',
    dailyLimit: 100000, recordsExtractedToday: 450, lastActive: 'Now', ipAddress: '192.168.1.1',
    isOnline: true, isBlocked: false
  }
];

export const BLOCKED_IPS: BlockedIP[] = [];
