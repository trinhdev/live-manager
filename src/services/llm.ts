// Lightweight LLM API integration helper

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

// Default example values (can be overridden by user via UI)
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: 'http://36.50.26.108:20128/v1',
  model: 'cx/gpt-5.4',
  apiKey: '',
};

// Basic health / connectivity test for the configured LLM API
export async function testConnection(config: LlmConfig): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Try a lightweight health check endpoint if available
    const healthUrl = `${config.baseUrl.replace(/\/$/, '')}/health`;
    const res = await fetch(healthUrl, { method: 'GET', headers });
    if (res.ok) return true;

    // Fallback to a simple request to the root of the API
    const rootUrl = config.baseUrl.replace(/\/$/, '');
    const res2 = await fetch(rootUrl, { method: 'GET', headers });
    return res2.ok;
  } catch {
    return false;
  }
}
