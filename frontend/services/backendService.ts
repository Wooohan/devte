const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface TaskStatus {
  task_id: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  progress: number;
  logs: string[];
  extracted?: number;
  completed?: number;
  dbSaved?: number;
  insFound?: number;
  recentData?: any[];
}

// ─── Scraper Task (used by Scraper.tsx) ─────────────────────────────────────
export const startScraperTask = async (config: any): Promise<{ task_id: string }> => {
  const resp = await fetch(`${BACKEND_URL}/api/tasks/scraper/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
};

export const stopScraperTask = async (taskId: string): Promise<void> => {
  await fetch(`${BACKEND_URL}/api/tasks/scraper/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  });
};

export const getScraperStatus = async (taskId: string): Promise<TaskStatus> => {
  const resp = await fetch(`${BACKEND_URL}/api/tasks/scraper/status?task_id=${taskId}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
};

// ─── Insurance Task (legacy, kept for compatibility) ────────────────────────
export const startInsuranceTask = async (config: any): Promise<{ task_id: string }> => {
  const resp = await fetch(`${BACKEND_URL}/api/tasks/insurance/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
};

export const stopInsuranceTask = async (taskId: string): Promise<void> => {
  await fetch(`${BACKEND_URL}/api/tasks/insurance/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  });
};

export const getInsuranceStatus = async (taskId: string): Promise<TaskStatus> => {
  const resp = await fetch(`${BACKEND_URL}/api/tasks/insurance/status?task_id=${taskId}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
};
