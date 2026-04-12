import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Carrier Operation code mapping ────────────────────────────────────────────
const CARRIER_OP_CODE_MAP: Record<string, string> = {
  'A': 'Interstate',
  'B': 'Intrastate Only (HM)',
  'C': 'Intrastate Only (Non-HM)',
};

const CARRIER_OP_DISPLAY_TO_CODE: Record<string, string> = {
  'Interstate': 'A',
  'Intrastate Only (HM)': 'B',
  'Intrastate Only (Non-HM)': 'C',
};

// ── Helper: clean phone numbers (remove trailing ".0") ────────────────────────
const cleanPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  return phone.replace(/\.0$/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
};

// ── Helper: compose address from Census parts ────────────────────────────────
const composeAddress = (
  street: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
): string => {
  const parts = [street, city, state].filter(Boolean);
  let addr = parts.join(', ');
  if (zip) addr += ` ${zip}`;
  return addr || '';
};

// ── Helper: extract MC number from dockets JSONB array ────────────────────────
const extractMcNumber = (dockets: any, temp: any): string => {
  if (Array.isArray(dockets) && dockets.length > 0) {
    // dockets is like ["MC143680"] - extract first MC-prefixed entry
    const mcDocket = dockets.find((d: string) => typeof d === 'string' && d.startsWith('MC'));
    if (mcDocket) return mcDocket.replace(/^MC/, '');
  }
  if (temp !== null && temp !== undefined) return String(temp);
  return '';
};

// ── Helper: extract cargo list from JSONB object ──────────────────────────────
const extractCargoList = (cargo: any): string[] => {
  if (!cargo || typeof cargo !== 'object') return [];
  return Object.keys(cargo).filter(k => !k.startsWith('crgo_') && cargo[k] === 'X');
};

// ── Helper: parse classdef to operation classifications ───────────────────────
const parseClassdef = (classdef: string | null): string[] => {
  if (!classdef) return [];
  return classdef.split(';').map(s => s.trim()).filter(Boolean);
};

// ── Helper: format Census insurance entry ─────────────────────────────────────
const formatInsuranceEntry = (entry: any) => {
  const covAmount = entry.max_cov_amount;
  let coverageStr = 'N/A';
  if (covAmount !== null && covAmount !== undefined && !isNaN(Number(covAmount))) {
    const num = Number(covAmount);
    coverageStr = num < 10000 && num > 0
      ? `$${(num * 1000).toLocaleString()}`
      : `$${num.toLocaleString()}`;
  }

  const hasCancellation = entry.cancl_effective_date &&
    entry.cancl_effective_date !== '' &&
    entry.cancl_effective_date !== 'null' &&
    entry.cancl_effective_date !== null;

  return {
    policyNumber: entry.policy_no || 'N/A',
    carrier: entry.name_company || 'N/A',
    type: entry.ins_type_desc || 'N/A',
    formCode: entry.ins_form_code || 'N/A',
    coverageAmount: coverageStr,
    effectiveDate: entry.effective_date || 'N/A',
    cancellationDate: hasCancellation ? entry.cancl_effective_date : null,
    docketNumber: entry.docket_number || 'N/A',
    status: hasCancellation ? 'Cancelled' : 'Active',
  };
};

// ── Helper: parse years from add_date (YYYYMMDD format) ──────────────────────
const parseYearsFromAddDate = (addDate: string | null): number | null => {
  if (!addDate || addDate.length < 8) return null;
  try {
    const year = parseInt(addDate.substring(0, 4));
    const month = parseInt(addDate.substring(4, 6));
    const day = parseInt(addDate.substring(6, 8));
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  } catch {
    return null;
  }
};

// ── Helper: safely parse varchar to number ────────────────────────────────────
const safeParseInt = (val: string | null | undefined): number | null => {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.floor(num);
};

// ── Map a Census DB row to the frontend CarrierData shape ─────────────────────
const mapCensusRecord = (record: any) => {
  const insuranceRaw = record.insurance;
  const insuranceArray = Array.isArray(insuranceRaw) ? insuranceRaw : [];

  return {
    mcNumber: extractMcNumber(record.dockets, record.temp),
    dotNumber: record.dot_number || '',
    legalName: record.legal_name || '',
    dbaName: record.dba_name || '',
    status: record.status_code === 'A' ? 'AUTHORIZED' : 'NOT AUTHORIZED',
    statusCode: record.status_code || '',
    email: (record.email_address || '').toLowerCase(),
    phone: cleanPhone(record.phone),
    powerUnits: record.power_units || '0',
    drivers: record.total_drivers || '0',
    totalCdl: record.total_cdl || '0',
    truckUnits: record.truck_units || '0',
    physicalAddress: composeAddress(
      record.phy_street, record.phy_city, record.phy_state, record.phy_zip
    ),
    mailingAddress: composeAddress(
      record.carrier_mailing_street, record.carrier_mailing_city,
      record.carrier_mailing_state, record.carrier_mailing_zip
    ),
    phyState: record.phy_state || '',
    phyCity: record.phy_city || '',
    addDate: record.add_date || '',
    mcs150Date: record.mcs150_date || '',
    mcs150Mileage: record.mcs150_mileage || '',
    mcs150MileageYear: record.mcs150_mileage_year || '',
    operationClassification: parseClassdef(record.classdef),
    carrierOperation: record.carrier_operation
      ? [CARRIER_OP_CODE_MAP[record.carrier_operation] || record.carrier_operation]
      : [],
    cargoCarried: extractCargoList(record.cargo),
    dunsNumber: record.dun_bradstreet_no || '',
    companyRep: [record.company_officer_1, record.company_officer_2]
      .filter(Boolean).join(', '),
    hmInd: record.hm_ind || 'N',
    insuranceHistoryFilings: insuranceArray.map(formatInsuranceEntry),
    // Safety fields are only present if enriched via scraper
    safetyRating: record.safety_rating || undefined,
    safetyRatingDate: record.safety_rating_date || undefined,
    basicScores: record.basic_scores || undefined,
    oosRates: record.oos_rates || undefined,
    inspections: record.inspections || undefined,
    crashes: record.crashes || undefined,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// CARRIER FILTERS INTERFACE
// ══════════════════════════════════════════════════════════════════════════════

export interface CarrierFilters {
  // Identification
  mcNumber?: string;
  dotNumber?: string;
  legalName?: string;
  dunsNumber?: string;
  // Status & Location
  active?: string;           // 'true' | 'false' | ''
  state?: string;            // pipe-delimited: 'CA|TX|NY'
  hasEmail?: string;         // 'true' | 'false' | ''
  hasCompanyRep?: string;    // 'true' | 'false' | ''
  // Years in business
  yearsInBusinessMin?: number;
  yearsInBusinessMax?: number;
  // Carrier Operation
  classification?: string[];
  carrierOperation?: string[];
  hazmat?: string;           // 'true' | 'false' | ''
  powerUnitsMin?: number;
  powerUnitsMax?: number;
  driversMin?: number;
  driversMax?: number;
  cargo?: string[];
  // Insurance
  insuranceRequired?: string[];
  bipdMin?: number;
  bipdMax?: number;
  bipdOnFile?: string;       // '1' | '0' | ''
  cargoOnFile?: string;      // '1' | '0' | ''
  bondOnFile?: string;       // '1' | '0' | ''
  insuranceCompany?: string[];
  // Pagination
  limit?: number;
  offset?: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// FETCH CARRIERS — Main search function for Census data
// ══════════════════════════════════════════════════════════════════════════════

export const fetchCarriersFromSupabase = async (filters: CarrierFilters = {}): Promise<any[]> => {
  try {
    let query = supabase.from('carriers').select('*');

    const isFiltered = Object.keys(filters).some(k => {
      const key = k as keyof CarrierFilters;
      const val = filters[key];
      if (key === 'limit' || key === 'offset') return false;
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== '';
    });

    // Track if we need client-side filtering (for numeric ranges on varchar columns)
    let needsClientFiltering = false;

    // ── MC Number: search temp (bigint) ───────────────────────────────────────
    if (filters.mcNumber) {
      const mc = filters.mcNumber.replace(/[^0-9]/g, '');
      if (mc) {
        const mcNum = parseInt(mc);
        if (!isNaN(mcNum) && mc === filters.mcNumber.replace(/[^0-9]/g, '')) {
          // Try exact match on temp for full MC numbers, partial ILIKE for partials
          if (mc.length >= 4) {
            // Use or to search both temp as text and dockets as text
            query = query.or(`temp.eq.${mcNum}`);
          } else {
            query = query.eq('temp', mcNum);
          }
        }
      }
    }

    // ── DOT Number ────────────────────────────────────────────────────────────
    if (filters.dotNumber) {
      query = query.ilike('dot_number', `%${filters.dotNumber}%`);
    }

    // ── Legal Name ────────────────────────────────────────────────────────────
    if (filters.legalName) {
      query = query.ilike('legal_name', `%${filters.legalName}%`);
    }

    // ── DUNS Number ───────────────────────────────────────────────────────────
    if (filters.dunsNumber) {
      query = query.ilike('dun_bradstreet_no', `%${filters.dunsNumber}%`);
    }

    // ── Active Status ─────────────────────────────────────────────────────────
    if (filters.active === 'true') {
      query = query.eq('status_code', 'A');
    } else if (filters.active === 'false') {
      query = query.neq('status_code', 'A');
    }

    // ── State (direct column match — fast with index) ─────────────────────────
    if (filters.state) {
      const states = filters.state.split('|').filter(Boolean);
      if (states.length === 1) {
        query = query.eq('phy_state', states[0]);
      } else if (states.length > 1) {
        query = query.in('phy_state', states);
      }
    }

    // ── Has Email ─────────────────────────────────────────────────────────────
    if (filters.hasEmail === 'true') {
      query = query.not('email_address', 'is', null).neq('email_address', '');
    } else if (filters.hasEmail === 'false') {
      query = query.or('email_address.is.null,email_address.eq.');
    }

    // ── Has Company Rep ───────────────────────────────────────────────────────
    if (filters.hasCompanyRep === 'true') {
      query = query.not('company_officer_1', 'is', null).neq('company_officer_1', '');
    } else if (filters.hasCompanyRep === 'false') {
      query = query.or('company_officer_1.is.null,company_officer_1.eq.');
    }

    // ── Hazmat Indicator ──────────────────────────────────────────────────────
    if (filters.hazmat === 'true') {
      query = query.eq('hm_ind', 'Y');
    } else if (filters.hazmat === 'false') {
      query = query.or('hm_ind.eq.N,hm_ind.is.null');
    }

    // ── Carrier Operation (single char code: A/B/C) ───────────────────────────
    if (filters.carrierOperation && filters.carrierOperation.length > 0) {
      const codes = filters.carrierOperation
        .map(op => CARRIER_OP_DISPLAY_TO_CODE[op])
        .filter(Boolean);
      if (codes.length === 1) {
        query = query.eq('carrier_operation', codes[0]);
      } else if (codes.length > 1) {
        query = query.in('carrier_operation', codes);
      }
    }

    // ── Classification (classdef is semicolon-separated varchar) ──────────────
    if (filters.classification && filters.classification.length > 0) {
      // Map display names to Census classdef substrings
      const classMap: Record<string, string> = {
        'Auth. For Hire': 'AUTHORIZED FOR HIRE',
        'Exempt For Hire': 'EXEMPT FOR HIRE',
        'Private(Property)': 'PRIVATE(PROPERTY)',
        'Private(Passenger)': 'PRIVATE(PASSENGER)',
        'Migrant': 'MIGRANT',
        'U.S. Mail': 'U.S. MAIL',
        'Federal Government': 'FEDERAL GOVERNMENT',
        'State Government': 'STATE GOVERNMENT',
        'Local Government': 'LOCAL GOVERNMENT',
        'Indian Tribe': 'INDIAN TRIBE',
      };
      const orClauses = filters.classification
        .map(c => {
          const censusVal = classMap[c] || c;
          return `classdef.ilike.%${censusVal}%`;
        })
        .join(',');
      query = query.or(orClauses);
    }

    // ── Cargo Carried (JSONB object: keys are cargo names, values are "X") ───
    if (filters.cargo && filters.cargo.length > 0) {
      // Use @> (contains) to check each cargo key exists with value "X"
      const cargoClauses = filters.cargo
        .map(c => `cargo.cs.{"${c}":"X"}`)
        .join(',');
      query = query.or(cargoClauses);
    }

    // ── Insurance On-File filters ─────────────────────────────────────────────
    if (filters.bipdOnFile === '1' || filters.cargoOnFile === '1' || filters.bondOnFile === '1') {
      // At minimum, insurance must not be null
      query = query.not('insurance', 'is', null);
      // Specific type checks happen client-side since PostgREST can't easily
      // filter within JSONB array elements with OR conditions
      needsClientFiltering = true;
    }
    if (filters.bipdOnFile === '0' || filters.cargoOnFile === '0' || filters.bondOnFile === '0') {
      needsClientFiltering = true;
    }

    // ── Numeric range filters need client-side processing ─────────────────────
    if (
      filters.powerUnitsMin !== undefined || filters.powerUnitsMax !== undefined ||
      filters.driversMin !== undefined || filters.driversMax !== undefined ||
      filters.yearsInBusinessMin !== undefined || filters.yearsInBusinessMax !== undefined ||
      filters.bipdMin !== undefined || filters.bipdMax !== undefined ||
      (filters.insuranceRequired && filters.insuranceRequired.length > 0) ||
      (filters.insuranceCompany && filters.insuranceCompany.length > 0)
    ) {
      needsClientFiltering = true;
    }

    // ── Ordering & Limit ──────────────────────────────────────────────────────
    query = query.order('temp', { ascending: false, nullsFirst: false });

    if (!isFiltered) {
      query = query.limit(200);
    } else if (needsClientFiltering) {
      // Pull more records when client-side filtering is needed
      query = query.limit(filters.limit || 2000);
    } else {
      query = query.limit(filters.limit || 500);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 500) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase fetch error:', error);
      return [];
    }

    // ── Map Census rows to CarrierData ────────────────────────────────────────
    let results = (data || []).map(mapCensusRecord);

    // ── Client-Side Filtering ─────────────────────────────────────────────────

    // Power Units range
    if (filters.powerUnitsMin !== undefined || filters.powerUnitsMax !== undefined) {
      results = results.filter(c => {
        const val = safeParseInt(c.powerUnits);
        if (val === null) return false;
        if (filters.powerUnitsMin !== undefined && val < filters.powerUnitsMin) return false;
        if (filters.powerUnitsMax !== undefined && val > filters.powerUnitsMax) return false;
        return true;
      });
    }

    // Drivers range
    if (filters.driversMin !== undefined || filters.driversMax !== undefined) {
      results = results.filter(c => {
        const val = safeParseInt(c.drivers);
        if (val === null) return false;
        if (filters.driversMin !== undefined && val < filters.driversMin) return false;
        if (filters.driversMax !== undefined && val > filters.driversMax) return false;
        return true;
      });
    }

    // Years in Business (from add_date YYYYMMDD)
    if (filters.yearsInBusinessMin !== undefined || filters.yearsInBusinessMax !== undefined) {
      results = results.filter(c => {
        const years = parseYearsFromAddDate(c.addDate);
        if (years === null) return false;
        if (filters.yearsInBusinessMin !== undefined && years < filters.yearsInBusinessMin) return false;
        if (filters.yearsInBusinessMax !== undefined && years > filters.yearsInBusinessMax) return false;
        return true;
      });
    }

    // Insurance type on-file checks
    if (filters.bipdOnFile === '1') {
      results = results.filter(c =>
        c.insuranceHistoryFilings.some((f: any) =>
          f.type?.toLowerCase().includes('bipd') && f.status === 'Active'
        )
      );
    } else if (filters.bipdOnFile === '0') {
      results = results.filter(c =>
        !c.insuranceHistoryFilings.some((f: any) =>
          f.type?.toLowerCase().includes('bipd') && f.status === 'Active'
        )
      );
    }

    if (filters.cargoOnFile === '1') {
      results = results.filter(c =>
        c.insuranceHistoryFilings.some((f: any) =>
          f.type?.toLowerCase().includes('cargo') && f.status === 'Active'
        )
      );
    } else if (filters.cargoOnFile === '0') {
      results = results.filter(c =>
        !c.insuranceHistoryFilings.some((f: any) =>
          f.type?.toLowerCase().includes('cargo') && f.status === 'Active'
        )
      );
    }

    if (filters.bondOnFile === '1') {
      results = results.filter(c =>
        c.insuranceHistoryFilings.some((f: any) =>
          (f.type?.toLowerCase().includes('bond') || f.type?.toLowerCase().includes('surety')) &&
          f.status === 'Active'
        )
      );
    } else if (filters.bondOnFile === '0') {
      results = results.filter(c =>
        !c.insuranceHistoryFilings.some((f: any) =>
          (f.type?.toLowerCase().includes('bond') || f.type?.toLowerCase().includes('surety')) &&
          f.status === 'Active'
        )
      );
    }

    // Insurance required types
    if (filters.insuranceRequired && filters.insuranceRequired.length > 0) {
      results = results.filter(c => {
        return filters.insuranceRequired!.some(reqType => {
          const search = reqType.toLowerCase();
          return c.insuranceHistoryFilings.some((f: any) =>
            f.type?.toLowerCase().includes(search) && f.status === 'Active'
          );
        });
      });
    }

    // BIPD coverage amount range
    if (filters.bipdMin !== undefined || filters.bipdMax !== undefined) {
      results = results.filter(c => {
        const bipdFilings = c.insuranceHistoryFilings.filter((f: any) =>
          f.type?.toLowerCase().includes('bipd') && f.status === 'Active'
        );
        if (bipdFilings.length === 0) return false;
        const maxCov = Math.max(...bipdFilings.map((f: any) => {
          const amt = f.coverageAmount?.replace(/[$,]/g, '');
          return parseInt(amt) || 0;
        }));
        const covInThousands = maxCov / 1000;
        if (filters.bipdMin !== undefined && covInThousands < filters.bipdMin) return false;
        if (filters.bipdMax !== undefined && covInThousands > filters.bipdMax) return false;
        return true;
      });
    }

    // Insurance company filter
    if (filters.insuranceCompany && filters.insuranceCompany.length > 0) {
      results = results.filter(c => {
        return c.insuranceHistoryFilings.some((f: any) =>
          filters.insuranceCompany!.some(company =>
            f.carrier?.toUpperCase().includes(company.toUpperCase())
          )
        );
      });
    }

    return results;
  } catch (err) {
    console.error('Exception fetching from Supabase:', err);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE CARRIER
// ══════════════════════════════════════════════════════════════════════════════

export const deleteCarrier = async (
  dotNumber: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('carriers')
      .delete()
      .eq('dot_number', dotNumber);

    if (error) {
      console.error('Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exception deleting carrier:', err);
    return { success: false, error: err.message };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET CARRIER COUNT
// ══════════════════════════════════════════════════════════════════════════════

export const getCarrierCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('carriers')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error getting carrier count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Exception getting carrier count:', err);
    return 0;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET CARRIERS BY MC RANGE (uses temp bigint column)
// ══════════════════════════════════════════════════════════════════════════════

export const getCarriersByMCRange = async (start: string, end: string): Promise<any[]> => {
  try {
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    if (isNaN(startNum) || isNaN(endNum)) return [];

    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .gte('temp', startNum)
      .lte('temp', endNum)
      .order('temp', { ascending: true });

    if (error) throw error;

    return (data || []).map(mapCensusRecord);
  } catch (err) {
    console.error('Error fetching MC range:', err);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE CARRIER INSURANCE (for enrichment pipeline compatibility)
// ══════════════════════════════════════════════════════════════════════════════

export const updateCarrierInsurance = async (
  dotNumber: string,
  insuranceData: any
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('carriers')
      .update({ insurance: insuranceData.policies })
      .eq('dot_number', dotNumber);

    if (error) {
      console.error('Supabase update error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exception updating insurance:', err);
    return { success: false, error: err.message };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE CARRIER SAFETY (for enrichment pipeline compatibility)
// ══════════════════════════════════════════════════════════════════════════════

export const updateCarrierSafety = async (
  dotNumber: string,
  safetyData: any
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('carriers')
      .update({
        safety_rating: safetyData.rating,
        safety_rating_date: safetyData.ratingDate,
        basic_scores: safetyData.basicScores,
        oos_rates: safetyData.oosRates,
      })
      .eq('dot_number', dotNumber);

    if (error) {
      console.error('Supabase safety update error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exception updating safety data:', err);
    return { success: false, error: err.message };
  }
};
