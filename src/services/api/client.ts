import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '@lib/constants'
import { setupInterceptors } from './interceptors'

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

setupInterceptors(apiClient)

export function skipAuthRefresh(config: AxiosRequestConfig): AxiosRequestConfig {
  return { ...config, _skipAuthRefresh: true } as AxiosRequestConfig
}
