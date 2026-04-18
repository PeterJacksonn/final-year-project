import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getWaterBody   = ()              => api.get('/waterbody')
export const getStations    = ()              => api.get('/stations')
export const getLatest      = (stationId)     => api.get(`/stations/${stationId}/latest`)
export const getHistory     = (stationId, param, hours = 24) => api.get(`/stations/${stationId}/history/${param}`, { params: { hours } })
export const uploadCSV      = (file)          => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/ingest/upload', form)
}
