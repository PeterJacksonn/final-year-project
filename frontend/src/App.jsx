import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import EntityManager from './pages/EntityManager'
import MapView from './pages/MapView'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/entities" element={<EntityManager />} />
                <Route path="/map" element={<MapView />} />
            </Routes>
        </BrowserRouter>
    )
}
