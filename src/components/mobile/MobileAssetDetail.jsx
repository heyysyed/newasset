import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MoreVertical, Edit2, ArrowRightLeft, Camera, MapPin, 
  Upload, ShieldCheck, AlertTriangle, Wrench, Package, Info, FileText,
  Printer, Download, ShieldAlert, Calendar, Map as MapIcon, ChevronRight, IndianRupee, Trash2
} from 'lucide-react'
import MobileActionSheet from './MobileActionSheet'
import MobileEmptyState from './MobileEmptyState'
import { buildAsset360 } from '../../lib/intelligence/assetIntelligence'
import { formatCurrency } from '../../lib/depreciation'
import { generateAssetDossierPDF } from '../../lib/exportDossier'
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet'

export default function MobileAssetDetail({
  asset,
  loading,
  can,
  handleDelete,
  setShowTransfer,
  assigneeLabel,
  photos = [],
  setPhotoUploading,
  maintenance = { tickets: [], schedules: [], logs: [] },
  movements = [],
  documents = [],
  childAssets = [],
  parentAsset,
}) {
  const navigate = useNavigate()
  const [showActions, setShowActions] = useState(false)
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)

  const intel = useMemo(() => {
    if (!asset) return null;
    return buildAsset360(asset, maintenance, { hasFinancialAccess: can('view_financials') });
  }, [asset, maintenance, can]);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center pt-24 pb-16">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-text-3 text-body-medium text-small">Loading intelligence...</p>
      </div>
    )
  }

  if (!asset || !intel) {
    return (
      <div className="pt-10">
        <MobileEmptyState icon={Package} title="Asset Not Found" description="This asset may have been deleted or moved." />
      </div>
    )
  }

  const handleExportDossier = () => {
    generateAssetDossierPDF(asset, intel)
    setShowActions(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-0 pb-36 -mx-4 -mt-4 lg:m-0 animate-fade-in">
      
      {/* ── Top Mobile Bar ── */}
      <div className="sticky top-0 z-30 bg-bg-1 border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate('/assets')}
            className="p-1.5 -ml-1 text-text-1 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors active:bg-bg-3"
            aria-label="Back to assets"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-small text-text-0 truncate leading-tight">{intel.identity.data.name}</h2>
            <div className="font-mono text-[10px] text-text-3 truncate">{intel.identity.data.code}</div>
          </div>
        </div>

        <button 
          onClick={() => setShowActions(true)} 
          className="p-2 -mr-1 text-text-2 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors active:bg-bg-3"
          aria-label="Actions"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* ── HERO PHOTO ── */}
      <div className="w-full bg-bg-1 border-b border-border relative">
        <div className="aspect-[16/10] w-full bg-bg-2 flex items-center justify-center overflow-hidden relative">
          {photos.length > 0 ? (
            <img 
              src={photos[0].url} 
              alt={intel.identity.data.name} 
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setShowPhotoViewer(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-bg-3 text-text-3 flex items-center justify-center">
                <Camera size={24} />
              </div>
              <div>
                <p className="text-caption text-text-1 m-0">No Asset Photo</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT SECTIONS ── */}
      <div className="p-4 flex flex-col gap-4">

        {/* 1. Header & Status */}
        <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${intel.identity.data.status === 'Active' ? 'bg-green' : intel.identity.data.status === 'Under Repair' ? 'bg-amber' : 'bg-text-3'}`} />
          <div className="pl-2">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] uppercase  px-1.5 py-0.5 rounded ${intel.identity.data.status === 'Active' ? 'bg-green-dim text-green border border-green/20' : 'bg-bg-2 text-text-2 border border-border'}`}>
                {intel.identity.data.status}
              </span>
              <span className="text-[10px] text-text-3 uppercase">{intel.identity.data.category}</span>
            </div>
            <h1 className="text-section-title text-text-0 mb-1 leading-tight">{intel.identity.data.name}</h1>
            <div className="text-caption text-text-2">
              {[asset.make, asset.model_no].filter(Boolean).join(' ') || 'No Make/Model Specified'}
            </div>
          </div>
        </div>

        {/* 2. Today's Attention */}
        {intel.attention.length > 0 && (
          <div className="bg-amber-dim border border-amber/30 rounded-xl p-4">
            <h3 className="text-caption text-amber uppercase flex items-center gap-1.5 mb-3">
              <AlertTriangle size={14} /> Attention Required
            </h3>
            <div className="space-y-2">
              {intel.attention.map((att, i) => (
                <div key={i} className="bg-bg-0 border border-amber/10 rounded-lg p-3">
                  <div className="text-[11px] text-text-0 flex items-center justify-between">
                    {att.title}
                    <span className="text-[9px] uppercase text-amber px-1 rounded bg-amber/10">{att.severity}</span>
                  </div>
                  <div className="text-[10px] text-text-2 mt-1 leading-snug">{att.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Health & Risk Assessment */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <h3 className="text-[10px] text-text-3 uppercase mb-1 flex items-center gap-1">
              <ShieldCheck size={12} className={intel.health.data.score > 70 ? 'text-green' : 'text-amber'} /> Health
            </h3>
            <div className={`text-page-title  ${intel.health.data.score > 70 ? 'text-green' : 'text-amber'}`}>
              {intel.health.data.score}%
            </div>
            <div className="text-[10px] text-text-2">{intel.health.data.grade}</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <h3 className="text-[10px] text-text-3 uppercase mb-1 flex items-center gap-1">
              <ShieldAlert size={12} className={intel.risk.data.score > 70 ? 'text-red' : 'text-green'} /> Risk
            </h3>
            <div className={`text-page-title  ${intel.risk.data.score > 70 ? 'text-red' : 'text-green'}`}>
              {intel.risk.data.score}%
            </div>
            <div className="text-[10px] text-text-2">{intel.risk.data.grade}</div>
          </div>
        </div>

        {/* 4. Age & Lifecycle */}
        <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
          <h3 className="text-caption text-text-3 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={14} className="text-purple-500" /> Lifecycle
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[10px] text-text-3 uppercase">Age</div>
              <div className="text-small text-text-0">{intel.age.data.ageYears} years</div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-text-3 uppercase">State</div>
              <div className="text-small text-text-0">{intel.age.data.lifecycleState}</div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-text-3 uppercase">Expected EOL</div>
              <div className="text-small text-text-0">{intel.age.data.expectedEndOfLife || '-'}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[9px] uppercase text-text-3 mb-1">
              <span>Consumed Life</span>
              <span>{intel.age.data.consumedLifePercent}%</span>
            </div>
            <div className="w-full bg-bg-2 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full ${intel.age.data.consumedLifePercent > 85 ? 'bg-red' : 'bg-purple-500'}`} 
                style={{ width: `${Math.min(100, intel.age.data.consumedLifePercent)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* 5. Location Intelligence */}
        <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-caption text-text-3 uppercase flex items-center gap-1.5">
              <MapPin size={14} className="text-cyan" /> Location
            </h3>
            <span className={`text-[9px] uppercase  px-1.5 py-0.5 rounded ${intel.location.data.precision === 'EXACT GPS' ? 'bg-green-dim text-green' : 'bg-amber-dim text-amber'}`}>
              {intel.location.data.precision}
            </span>
          </div>
          <div className="text-small text-text-0 mb-3">{intel.location.data.siteName}</div>
          
          {(intel.location.data.latitude && intel.location.data.longitude) ? (
            <div className="h-32 rounded-lg overflow-hidden border border-border relative z-0">
              <MapContainer 
                center={[intel.location.data.latitude, intel.location.data.longitude]} 
                zoom={15} 
                style={{ height: '100%', width: '100%' }} 
                zoomControl={false} dragging={false} scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <Marker position={[intel.location.data.latitude, intel.location.data.longitude]} />
                {intel.location.data.precision === 'SITE-LEVEL' && site?.radius_meters && (
                  <Circle center={[intel.location.data.latitude, intel.location.data.longitude]} radius={site.radius_meters} pathOptions={{ color: '#3b82f6', fillOpacity: 0.1 }} />
                )}
              </MapContainer>
            </div>
          ) : (
             <div className="h-20 rounded-lg border border-dashed border-border flex items-center justify-center text-caption text-text-3">
               LOCATION UNAVAILABLE
             </div>
          )}
        </div>

        {/* 6. Financial Exposure */}
        <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
          <h3 className="text-caption text-text-3 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <IndianRupee size={14} className="text-green" /> Financial Intelligence
          </h3>
          
          {intel.financial.status === 'INSUFFICIENT_DATA' ? (
            <div className="text-caption text-amber italic bg-amber-dim p-3 rounded-lg border border-amber/10">
              {intel.financial.methodology}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-4 gap-x-2">
              <div>
                <div className="text-[10px] text-text-3 uppercase">Purchase Value</div>
                <div className="text-small font-mono text-text-0 mt-0.5">{formatCurrency(intel.financial.data.purchaseValue)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-3 uppercase">Net Book Value</div>
                <div className="text-small font-mono text-accent mt-0.5">{formatCurrency(intel.financial.data.currentBookValue)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-3 uppercase">Depreciation</div>
                <div className="text-small font-mono text-text-0 mt-0.5">{formatCurrency(intel.financial.data.accumulatedDepreciation)}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-3 uppercase">Exposure State</div>
                <div className={`text-[11px]  mt-1 uppercase ${intel.financial.data.isAtRiskCapital ? 'text-red' : (intel.financial.data.isIdleCapital ? 'text-amber' : 'text-green')}`}>
                  {intel.financial.data.isAtRiskCapital ? 'AT-RISK CAPITAL' : (intel.financial.data.isIdleCapital ? 'IDLE CAPITAL' : 'ACTIVE CAPITAL')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. Strategic Recommendations */}
        {intel.recommendations.length > 0 && (
          <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
            <h3 className="text-caption text-accent uppercase mb-2">Recommendations</h3>
            <ul className="text-[11px] text-text-0 space-y-1.5 pl-4 list-disc marker:text-accent/50">
              {intel.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

      </div>

      {/* ── ACTION SHEET ── */}
      <MobileActionSheet
        isOpen={showActions}
        onClose={() => setShowActions(false)}
        title="Asset Options"
        groups={[
          {
            items: [
              { icon: FileText, label: 'Export Dossier (PDF)', onClick: handleExportDossier },
            ]
          },
          {
            items: [
              { icon: Edit2, label: 'Edit Asset Details', onClick: () => { setShowActions(false); navigate(`/assets/${asset.id}/edit`) }, disabled: !can('edit') },
              { icon: ArrowRightLeft, label: 'Transfer to New Site', onClick: () => { setShowActions(false); setShowTransfer(true) }, disabled: !can('edit') }
            ]
          },
          {
            destructive: true,
            items: [
              { icon: Trash2, label: 'Delete Asset', danger: true, onClick: () => { setShowActions(false); handleDelete(asset.id, asset.asset_name) }, disabled: !can('delete') },
            ]
          }
        ]}
      />

    </div>
  )
}


