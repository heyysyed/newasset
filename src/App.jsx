import React, { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { supabase } from './lib/supabase'
import { Toaster } from 'react-hot-toast'
import { ImportProvider } from './context/ImportContext'
import Layout from './components/Layout'
import SkeletonLoader from './components/SkeletonLoader'
import QAAuditRunner from './pages/QAAuditRunner'
import ConnectionStatus from './components/ConnectionStatus'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AssetList = lazy(() => import('./pages/AssetList'))
const AssetForm = lazy(() => import('./pages/AssetForm'))
const AssetDetail = lazy(() => import('./pages/AssetDetail'))
const ComponentDetail = lazy(() => import('./pages/ComponentDetail'))
const StickerPage = lazy(() => import('./pages/StickerPage'))
const ExcelImport = lazy(() => import('./pages/ExcelImport'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const PublicAssetView = lazy(() => import('./pages/PublicAssetView'))
const MaintenanceCommandCenter = lazy(() => import('./pages/maintenance/MaintenanceCommandCenter'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const AuditModulePage = lazy(() => import('./pages/AuditModulePage'))
const SitesPage = lazy(() => import('./pages/SitesPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const MobileFieldView = lazy(() => import('./pages/MobileFieldView'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const Phase1Verification = lazy(() => import('./pages/Phase1Verification'))
const ScanPage = lazy(() => import('./pages/ScanPage'))
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes before refetch
      refetchOnWindowFocus: false,     // don't spam API on tab switch
      retry: 1,
    },
  },
})

// React Error Boundary to catch render errors gracefully instead of showing a blank screen
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--bg-2)', borderRadius: 16, border: '1px solid var(--border)', margin: '20px auto', maxWidth: 600, boxShadow: 'var(--clay-shadow)' }}>
          <h2 style={{ color: 'var(--status-danger)', margin: '0 0 10px' }}>SOMETHING WENT WRONG</h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>
            {import.meta.env.DEV && this.state.error?.message
              ? this.state.error.message
              : 'An unexpected error occurred. Please reload the page and try again.'}
          </p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }} className="btn-primary" style={{ padding: '8px 20px', gap: 6 }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Guard({ children, require: req }) {
  const { user, profile, loading, authError } = useAuth()
  const deactivated = profile && profile.is_active === false

  // Side-effect: sign out deactivated users (must not run during render)
  React.useEffect(() => {
    if (deactivated) supabase.auth.signOut()
  }, [deactivated])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-0)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color:'var(--text-2)', }}>Loading…</p>
      </div>
    </div>
  )
  if (authError || (user && !profile)) return (
    <div role="alert" className="card" style={{ padding: 24, maxWidth: 520, margin: '40px auto' }}>
      <h2>We couldn’t load your account</h2><p>{authError || 'Your account permissions are unavailable.'}</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
      <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (deactivated) return <Navigate to="/login?deactivated=1" replace />
  if (req === 'admin' && profile?.role !== 'admin' && profile?.role !== 'super_admin') return <Navigate to="/" replace />
  return children
}

// Route-level permission guard - redirects normal users to checklists
function PermGuard({ check, children, fallback = '/field' }) {
  const auth = useAuth()
  if (auth.loading) return null
  if (!check(auth)) return <div role="alert" className="card" style={{ padding: 24 }}>
    <h2>Access restricted</h2><p>Your current permissions do not include this page. Contact your administrator if you need access.</p>
    <a className="btn-primary" href={`#${fallback}`}>Return to an available page</a>
  </div>
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        {/* Public QR scan view - no login needed */}
        <Route path="/scan/:id" element={<PublicAssetView />} />
        <Route path="/" element={<Guard><Layout /></Guard>}>
          <Route index element={
            <PermGuard check={({ isAdmin, isMod }) => isAdmin || isMod} fallback="/field">
              <Dashboard />
            </PermGuard>
          } />
          <Route path="field" element={<MobileFieldView />} />
          <Route path="assets" element={
            <PermGuard check={({ isAdmin, isMod }) => isAdmin || isMod}>
              <AssetList />
            </PermGuard>
          } />
          <Route path="sites" element={
            <PermGuard check={({ isAdmin, isMod }) => isAdmin || isMod}>
              <SitesPage />
            </PermGuard>
          } />
          <Route path="scan" element={<ScanPage />} />
          <Route path="assets/new" element={
            <PermGuard check={({ can }) => can('add')} fallback="/assets">
              <AssetForm />
            </PermGuard>
          } />
          <Route path="assets/:id" element={<AssetDetail />} />
          <Route path="assets/:id/edit" element={
            <PermGuard check={({ can }) => can('edit') || can('edit_location') || can('edit_status')} fallback="/assets">
              <AssetForm />
            </PermGuard>
          } />
          <Route path="categories" element={<Guard require="admin"><CategoriesPage /></Guard>} />
          <Route path="stickers" element={<PermGuard check={({ can }) => can('print_stickers')}><StickerPage /></PermGuard>} />
          <Route path="qa-audit" element={<Guard require="admin"><QAAuditRunner /></Guard>} />
          <Route path="import" element={<PermGuard check={({ can }) => can('import')}><ExcelImport /></PermGuard>} />
          <Route path="audit" element={<PermGuard check={({ can }) => can('audit') || can('checklists')} fallback="/field"><AuditModulePage /></PermGuard>} />
          <Route path="maintenance/*" element={<PermGuard check={({ can }) => can('maintenance')} fallback="/field"><MaintenanceCommandCenter /></PermGuard>} />
          <Route path="inventory" element={<PermGuard check={({ can }) => can('inventory')} fallback="/field"><InventoryPage /></PermGuard>} />
          <Route path="inventory/components/:id" element={<PermGuard check={({ can }) => can('inventory')}><ComponentDetail /></PermGuard>} />
          <Route path="reports" element={<PermGuard check={({ can }) => can('export')}><ReportsPage /></PermGuard>} />
          <Route path="reports/:reportId" element={<PermGuard check={({ can }) => can('export')}><ReportsPage /></PermGuard>} />
          <Route path="phase1-verify" element={<Guard require="admin"><Phase1Verification /></Guard>} />
          <Route path="admin"   element={<Guard require="admin"><ErrorBoundary><AdminPage /></ErrorBoundary></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <NotificationProvider>
            <ImportProvider>
              <ErrorBoundary>
                <ConnectionStatus />
                <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-2)', color: 'var(--text-1)', borderRadius: '12px', border: '1px solid var(--border)' } }} />
                <AppRoutes />
              </ErrorBoundary>
            </ImportProvider>
          </NotificationProvider>
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  )
}
