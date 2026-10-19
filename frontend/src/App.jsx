import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AuthProvider, { useAuth } from './components/AuthProvider'
import Layout from './components/Layout'
import CandidateForm from './pages/CandidateForm'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import CandidateDetails from './pages/CandidateDetails'
import CandidatePrint from './pages/CandidatePrint'
import './App.css'

function ProtectedRoute() {
  const { admin, loading, error, refresh } = useAuth()
  if (loading) return <div className="page-wrap empty-state" role="status">Checking your session…</div>
  if (error) return <div className="page-wrap empty-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={refresh}>Try again</button></div>
  return admin ? <Outlet /> : <Navigate to="/admin/login" replace />
}
export default function App() {
  return <BrowserRouter><AuthProvider><Routes><Route element={<Layout />}><Route index element={<CandidateForm />} /><Route path="admin/login" element={<AdminLogin />} /><Route element={<ProtectedRoute />}><Route path="admin" element={<AdminDashboard />} /><Route path="admin/candidates/:id" element={<CandidateDetails />} /><Route path="admin/candidates/:id/print" element={<CandidatePrint />} /></Route><Route path="*" element={<div className="page-wrap empty-state"><h1>Page not found</h1><p>This page doesn’t exist.</p><Link to="/" className="primary-button">Go to registration</Link></div>} /></Route></Routes></AuthProvider></BrowserRouter>
}

