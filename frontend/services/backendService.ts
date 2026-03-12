import { CarrierData, InsurancePolicy, BasicScore, OosRate } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const fetchCarrierFromBackend = async (mcNumber: string): Promise<CarrierData | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/scrape/carrier/${mcNumber}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Backend carrier fetch error:', error);
    return null;
  }
};

export const fetchSafetyFromBackend = async (dotNumber: string): Promise<{
  rating: string;
  ratingDate: string;
  basicScores: BasicScore[];
  oosRates: OosRate[];
} | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/scrape/safety/${dotNumber}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Backend safety fetch error:', error);
    return null;
  }
};

export const fetchInsuranceFromBackend = async (dotNumber: string): Promise<{
  policies: InsurancePolicy[];
  raw: any;
} | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/scrape/insurance/${dotNumber}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Backend insurance fetch error:', error);
    return null;
  }
};

// ─── Persistent Background Task API ─────────────────────────────────────────

export interface TaskStatus {
  id: string;
  type: string;
  status: 'running' | 'stopping' | 'completed' | 'stopped';
  progress: number;
  completed: number;
  total: number;
  extracted?: number;
  dbSaved: number;
  failed: number;
  logs: string[];
  scrapedCount?: number;
  insFound?: number;
  startedAt: string;
  stoppedAt: string | null;
}

export const startScraperTask = async (config: {
  startPoint: string;
  recordCount: number;
  includeCarriers: boolean;
  includeBrokers: boolean;
  onlyAuthorized: boolean;
}): Promise<{ task_id: string; status: string }> => {
  const response = await fetch(`${BACKEND_URL}/api/tasks/scraper/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  return await response.json();
};

export const stopScraperTask = async (taskId: string): Promise<void> => {
  await fetch(`${BACKEND_URL}/api/tasks/scraper/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  });
};

export const getScraperStatus = async (taskId: string): Promise<TaskStatus> => {
  const response = await fetch(`${BACKEND_URL}/api/tasks/scraper/status?task_id=${taskId}`);
  return await response.json();
};

export const startInsuranceTask = async (config: {
  dotNumbers: string[];
}): Promise<{ task_id: string; status: string }> => {
  const response = await fetch(`${BACKEND_URL}/api/tasks/insurance/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  return await response.json();
};

export const stopInsuranceTask = async (taskId: string): Promise<void> => {
  await fetch(`${BACKEND_URL}/api/tasks/insurance/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  });
};

export const getInsuranceStatus = async (taskId: string): Promise<TaskStatus> => {
  const response = await fetch(`${BACKEND_URL}/api/tasks/insurance/status?task_id=${taskId}`);
  return await response.json();
};

export const listAllTasks = async (): Promise<any[]> => {
  const response = await fetch(`${BACKEND_URL}/api/tasks`);
  return await response.json();
};
