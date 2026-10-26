import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

export const tasksApi = {
  list: () => client.get('/tasks/').then((r) => r.data),
  create: (task) => client.post('/tasks/', task).then((r) => r.data),
  update: (id, task) => client.put(`/tasks/${id}/`, task).then((r) => r.data),
  toggle: (id) => client.patch(`/tasks/${id}/`, {}).then((r) => r.data),
  remove: (id) => client.delete(`/tasks/${id}/`),
}

// Turn an Axios error into one readable line for the UI.
export function errorMessage(err) {
  if (!err.response) {
    return 'Cannot reach the API. Is the Django server running on port 8000?'
  }
  const data = err.response.data
  if (data && typeof data === 'object') {
    if (data.detail) return data.detail
    const first = Object.entries(data)[0]
    if (first) {
      const [field, msgs] = first
      return `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`
    }
  }
  return `Request failed (${err.response.status}).`
}
