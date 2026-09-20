import { appConfig } from '@/constants/config';
import type { ApiError, ApiResponse } from '@/types/api';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  if (!appConfig.apiBaseUrl) {
    throw { message: 'The API is not configured. Set EXPO_PUBLIC_API_BASE_URL before connecting a backend.' } satisfies ApiError;
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  });

  if (!response.ok) {
    throw { message: 'Unable to complete the request.', status: response.status } satisfies ApiError;
  }

  return response.json() as Promise<ApiResponse<T>>;
}
