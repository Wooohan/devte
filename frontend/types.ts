export interface InsurancePolicy {
  dot: string;
  carrier: string;
  policyNumber: string;
  effectiveDate: string;
  coverageAmount: string;
  type: string;
  class: string;
}

export interface BasicScore {
  category: string;
  measure: string;
}

export interface OosRate {
  type: string;
  rate: string;
  nationalAvg: string;
}

export interface InspectionViolation {
  label: string;
  description: string;
  weight: string;
}

export interface Inspection {
  reportNumber: string;
  location: string;
  date: string;
  oosViolations: number;
  driverViolations: number;
  vehicleViolations: number;
  hazmatViolations: number;
  violationList: InspectionViolation[];
}

export interface Crash {
  date: string;
  number: string;
  state: string;
  plateNumber: string;
  plateState: string;
  fatal: string;
  injuries: string;
}

export interface InsuranceHistoryFiling {
  policyNumber: string;
  carrier: string;
  type: string;
  formCode: string;
  coverageAmount: string;
  effectiveDate: string;
  cancellationDate: string | null;
  docketNumber: string;
  status: string;
}

export interface CarrierData {
  mcNumber: string;
  dotNumber: string;
  legalName: string;
  dbaName: string;
  status: string;
  statusCode: string;
  email: string;
  phone: string;
  powerUnits: string;
  drivers: string;
  totalCdl: string;
  truckUnits: string;
  physicalAddress: string;
  mailingAddress: string;
  phyState: string;
  phyCity: string;
  // Census fields
  addDate: string;
  mcs150Date: string;
  mcs150Mileage: string;
  mcs150MileageYear: string;
  operationClassification: string[];
  carrierOperation: string[];
  cargoCarried: string[];
  dunsNumber: string;
  companyRep: string;
  hmInd: string;
  // Insurance (embedded Census JSONB)
  insuranceHistoryFilings: InsuranceHistoryFiling[];
  insurancePolicies?: InsurancePolicy[];
  // Safety (from scraper enrichment, not Census)
  safetyRating?: string;
  safetyRatingDate?: string;
  basicScores?: BasicScore[];
  oosRates?: OosRate[];
  inspections?: Inspection[];
  crashes?: Crash[];
}

export interface ScraperConfig {
  startPoint: string;
  recordCount: number;
  includeCarriers: boolean;
  includeBrokers: boolean;
  onlyAuthorized: boolean;
  useMockData: boolean;
  useProxy: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
}

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: 'Free' | 'Starter' | 'Pro' | 'Enterprise';
  dailyLimit: number;
  recordsExtractedToday: number;
  lastActive: string;
  ipAddress: string;
  isOnline: boolean;
  isBlocked?: boolean;
}

export interface BlockedIP {
  ip: string;
  blockedAt: string;
  reason: string;
}

export type ViewState = 'dashboard' | 'scraper' | 'carrier-search' | 'insurance-scraper' | 'subscription' | 'settings' | 'admin' | 'fmcsa-register';

export interface FMCSARegisterEntry {
  number: string;
  title: string;
  decided: string;
  category: string;
}
