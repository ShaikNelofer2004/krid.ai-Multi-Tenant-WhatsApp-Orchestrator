import axios from 'axios'

// In production, Render injects VITE_API_URL. Locally, we use Vite's proxy ('/api')
const baseURL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: baseURL,
  headers: { 'Content-Type': 'application/json' },
})

export const getTenants = () => api.get('/tenants')
export const getSessions = (tenantId) => api.get(`/sessions?tenant_id=${tenantId}`)
export const getMessages = (sessionId) => api.get(`/messages?session_id=${sessionId}`)
export const getStats = (tenantId) => api.get(`/stats?tenant_id=${tenantId}`)
export const sendBroadcast = (data) => api.post('/broadcast', data)
export const generateBroadcast = (data) => api.post('/generate-broadcast', data)

export default api
