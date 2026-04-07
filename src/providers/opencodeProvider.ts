// Opencode API Provider
// This is a minimal scaffold to customize Opencode API calls.
// It provides a small HTTP client with baseURL, apiKey auth, timeout and simple retry logic.
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpencodeProviderConfig {
  baseURL: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
  defaultHeaders?: Record<string, string>;
  // Optional default chat/model endpoint for Opencode GPT-5.4 integration
  defaultChatEndpoint?: string;
}

export class OpencodeApiProvider {
  private config: OpencodeProviderConfig;
  private fetchFn: typeof fetch;
  private defaultChatEndpoint?: string;

  constructor(config: OpencodeProviderConfig) {
    this.config = { ...config };
    this.defaultChatEndpoint = config.defaultChatEndpoint ?? '/cx/gpt-5.4/chat';
    // Use global fetch if available; otherwise throw when used in non-browser env
    const gFetch = (globalThis as any).fetch;
    this.fetchFn = gFetch ? gFetch.bind(globalThis) : (async () => { throw new Error('Fetch is not available in this environment'); }) as any;
  }

  private buildHeaders(additional?: Record<string, string>): any {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.defaultHeaders ?? {}),
      ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
    };
    return { ...headers, ...(additional ?? {}) };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    data?: any,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(path, this.config.baseURL);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
    }

    const options: any = {
      method,
      headers: this.buildHeaders(),
    };
    if (data != null && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000);
    options.signal = controller.signal;

    let attempt = 0;
    const maxRetries = this.config.retries ?? 2;
    while (true) {
      try {
        const res = await this.fetchFn(url.toString(), options);
        clearTimeout(timeout);
        if (res.ok) {
          const contentType = res.headers.get?.('content-type') ?? '';
          if (contentType.includes('application/json')) {
            return (await res.json()) as T;
          }
          // Fallback to text
          const text = await res.text();
          return text as unknown as T;
        } else {
          const errBody = await res.text();
          const err = new Error(`HTTP ${res.status} ${res.statusText}: ${errBody}`);
          (err as any).status = res.status;
          throw err;
        }
      } catch (err) {
        // Retry on network errors or 5xx
        const shouldRetry = attempt < maxRetries && (err as any).status >= 500;
        if (shouldRetry) {
          attempt++;
          const backoff = Math.pow(2, attempt) * 100;
          await this.sleep(backoff);
          continue;
        }
        throw err;
      }
    }
  }

  // Public helpers
  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('GET', path, undefined, params as any);
  }

  async post<T>(path: string, data?: any): Promise<T> {
    return this.request<T>('POST', path, data);
  }

  async put<T>(path: string, data?: any): Promise<T> {
    return this.request<T>('PUT', path, data);
  }

  async patch<T>(path: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', path, data);
  }

  async delete<T>(path: string, data?: any): Promise<T> {
    return this.request<T>('DELETE', path, data);
  }

  // Convenience method for Opencode GPT-5.4 chat endpoint
  async chat<T>(payload: any, endpoint?: string): Promise<T> {
    const path = endpoint ?? this.defaultChatEndpoint ?? '/cx/gpt-5.4/chat';
    return this.post<T>(path, payload);
  }
}

// Simple alias for external usage
export type OpencodeConfig = OpencodeProviderConfig;
