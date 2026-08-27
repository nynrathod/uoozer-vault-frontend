import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '@lib/constants'
import { setupInterceptors } from './interceptors'

/** Pre-configured Axios instance with JSON headers and auth interceptors. */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

setupInterceptors(apiClient)

/** Marks a request config to skip automatic token refresh on 401. */
export function skipAuthRefresh(config: AxiosRequestConfig): AxiosRequestConfig {
  return { ...config, _skipAuthRefresh: true } as AxiosRequestConfig
}
