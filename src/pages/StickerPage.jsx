import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Printer, Search, RotateCcw, Tag, Package,
  Bookmark as BookmarkIcon, Save as SaveIcon,
  Eye, EyeOff, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import QRCode from 'qrcode'
import { fetchAssets, getAssetSelectCols } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import defaultLogo from '../assets/logo.png'

// ─── QR Cache ────────────────────────────────────────────────
const QR_CACHE = {}
async function getOrMakeQR(assetCode, assetId) {
  if (QR_CACHE[assetCode]) return QR_CACHE[assetCode]
  // Evict oldest 100 entries when cache exceeds 500
  const keys = Object.keys(QR_CACHE)
  if (keys.length > 500) keys.slice(0, 100).forEach(k => delete QR_CACHE[k])
  try {
    const url = `${window.location.origin}/#/scan/${assetId}`
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
    QR_CACHE[assetCode] = dataUrl
    return dataUrl
  } catch (err) {
    console.error('QR generation failed for', assetCode, err)
    return null
  }
}

const MM = 3.7795275591

const FONTS         = ['Oswald', 'Roboto Condensed', 'Inter', 'Montserrat', 'DM Sans']
const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double']

const FIELD_LABELS = {
  asset_name: 'Asset Name', make: 'Make',         model_no: 'Model No',
  serial_no:  'Serial No',  capacity: 'Capacity',  site: 'Location',
  purchase_order_no: 'PO No', category: 'Category', purchase_date: 'Purchase Date',
  status: 'Status', type_code: 'Type',
}

const SIZE_PRESETS = [
  { key: 'A6',     label: 'A6',     sub: '105×74mm',  w: 105, h: 74  },
  { key: 'A8',     label: 'A8',     sub: '74×105mm',  w: 74,  h: 105 },
  { key: 'Custom', label: 'Custom', sub: 'free size',  w: null, h: null },
]

const COLOR_THEMES = [
  { key: 'navy',    label: 'Navy',    c: '#1e3a8a', ac: '#1d4ed8', body: '#ffffff', fc: '#111827', lc: '#374151' },
  { key: 'dark',    label: 'Dark',    c: '#0f172a', ac: '#818cf8', body: '#1e293b', fc: '#e2e8f0', lc: '#94a3b8' },
  { key: 'green',   label: 'Green',   c: '#14532d', ac: '#16a34a', body: '#ffffff', fc: '#111827', lc: '#374151' },
  { key: 'red',     label: 'Red',     c: '#7f1d1d', ac: '#dc2626', body: '#ffffff', fc: '#111827', lc: '#374151' },
  { key: 'orange',  label: 'Orange',  c: '#7c2d12', ac: '#ea580c', body: '#ffffff', fc: '#111827', lc: '#374151' },
  { key: 'minimal', label: 'Minimal', c: '#e2e8f0', ac: '#475569', body: '#ffffff', fc: '#0f172a', lc: '#64748b' },
]

// ─── Built-in preset templates ───────────────────────────────
const PRESET_TEMPLATES = [
  {
    name: 'Corporate Navy',
    desc: 'Clean professional - navy header, white body, Inter font',
    badge: '🏢',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#1e3a8a', accentColor: '#1d4ed8', bodyBg: '#ffffff', fieldColor: '#111827', labelColor: '#374151',
      codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7, qrSize: 112, cornerRadius: 3,
      borderStyle: 'solid', borderWidth: 1, logoSize: 1.0, logoColor: 'white', fontFamily: 'Inter',
      watermarkOpacity: 0.025, watermarkSource: 'code', watermarkText: '', watermarkSize: 9, watermarkAngle: -28,
      footerText: 'PROPERTY OF STRONGBUILT',
      footerBg: '#1e3a8a', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#dc2626',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'capacity', 'site'],
    },
  },
  {
    name: 'Dark Industrial',
    desc: 'Dark body, indigo accent - premium look for workshop floors',
    badge: '🔧',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#0f172a', accentColor: '#818cf8', bodyBg: '#1e293b', fieldColor: '#e2e8f0', labelColor: '#94a3b8',
      codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7, qrSize: 112, cornerRadius: 4,
      borderStyle: 'solid', borderWidth: 1, logoSize: 1.0, logoColor: 'white', fontFamily: 'Inter',
      watermarkOpacity: 0.04, watermarkSource: 'code', watermarkText: '', watermarkSize: 10, watermarkAngle: -28,
      footerText: 'STRONGBUILT',
      footerBg: '#0f172a', footerColor: '#e2e8f0',
      codeColor: '#e2e8f0', dnrColor: '#f87171',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'site'],
    },
  },
  {
    name: 'Safety Green',
    desc: 'High-visibility green - ideal for safety & PPE equipment',
    badge: '🦺',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#14532d', accentColor: '#16a34a', bodyBg: '#f0fdf4', fieldColor: '#14532d', labelColor: '#166534',
      codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7, qrSize: 112, cornerRadius: 3,
      borderStyle: 'solid', borderWidth: 2, logoSize: 1.0, logoColor: 'white', fontFamily: 'Montserrat',
      watermarkOpacity: 0.03, watermarkSource: 'code', watermarkText: '', watermarkSize: 9, watermarkAngle: -30,
      footerText: 'SAFETY EQUIPMENT - INSPECT BEFORE USE',
      footerBg: '#14532d', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#fbbf24',
      visibleFields: ['asset_name', 'category', 'serial_no', 'site', 'purchase_date'],
    },
  },
  {
    name: 'Heavy Machinery',
    desc: 'Bold orange - Plant & Machinery, high-contrast readability',
    badge: '🏗️',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 5,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#7c2d12', accentColor: '#ea580c', bodyBg: '#fff7ed', fieldColor: '#1c1917', labelColor: '#9a3412',
      codeFontSize: 17, fieldFontSize: 12, labelFontSize: 7, qrSize: 114, cornerRadius: 2,
      borderStyle: 'solid', borderWidth: 2, logoSize: 1.0, logoColor: 'white',
      watermarkOpacity: 0.04, watermarkSource: 'custom', watermarkText: 'STRONGBUILT', watermarkSize: 11, watermarkAngle: -25,
      footerText: 'PLANT & MACHINERY - DO NOT REMOVE THIS TAG',
      footerBg: '#7c2d12', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#fbbf24',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'capacity', 'site'],
    },
  },
  {
    name: 'Compact Portrait',
    desc: 'A8 portrait - small QR tag for tools & handheld equipment',
    badge: '🏷️',
    config: {
      sizePreset: 'A8', copies: 1, printGap: 3,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#1e3a8a', accentColor: '#3b82f6', bodyBg: '#ffffff', fieldColor: '#111827', labelColor: '#6b7280',
      codeFontSize: 13, fieldFontSize: 10, labelFontSize: 6.5, qrSize: 150, cornerRadius: 3,
      borderStyle: 'solid', borderWidth: 1, logoSize: 0.85, logoColor: 'white', fontFamily: 'Inter',
      watermarkOpacity: 0.025, watermarkSource: 'code', watermarkText: '', watermarkSize: 8, watermarkAngle: -28,
      footerText: 'STRONGBUILT',
      footerBg: '#1e3a8a', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#dc2626',
      visibleFields: ['asset_name', 'serial_no', 'site', 'category'],
    },
  },
  {
    name: 'Minimal Clean',
    desc: 'No coloured header - ultra-clean white label, light borders',
    badge: '⬜',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: false, showFooter: true,
      headerBg: '#e2e8f0', accentColor: '#475569', bodyBg: '#ffffff', fieldColor: '#0f172a', labelColor: '#64748b',
      codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7, qrSize: 112, cornerRadius: 5,
      borderStyle: 'solid', borderWidth: 1, logoSize: 1.0, logoColor: 'original',
      watermarkOpacity: 0, watermarkSource: 'code', watermarkText: '', watermarkSize: 9, watermarkAngle: -28,
      footerText: 'PROPERTY OF STRONGBUILT',
      footerBg: '#e2e8f0', footerColor: '#0f172a',
      codeColor: '#0f172a', dnrColor: '#dc2626',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'capacity', 'site'],
    },
  },
  {
    name: 'Stealth Black',
    desc: 'All-black with cyan accent - striking, premium finish',
    badge: '⚫',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#000000', accentColor: '#06b6d4', bodyBg: '#0a0a0a', fieldColor: '#f1f5f9', labelColor: '#64748b',
      codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7, qrSize: 112, cornerRadius: 4,
      borderStyle: 'solid', borderWidth: 1, logoSize: 1.0, logoColor: 'white',
      watermarkOpacity: 0.06, watermarkSource: 'code', watermarkText: '', watermarkSize: 10, watermarkAngle: -28,
      footerText: 'STRONGBUILT',
      footerBg: '#000000', footerColor: '#f1f5f9',
      codeColor: '#06b6d4', dnrColor: '#f87171',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'capacity', 'site'],
    },
  },
  {
    name: 'IT & Electronics',
    desc: 'Purple accent, serial & model focus - for electronics/IT assets',
    badge: '💻',
    config: {
      sizePreset: 'A6', copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#4c1d95', accentColor: '#7c3aed', bodyBg: '#ffffff', fieldColor: '#1e1b4b', labelColor: '#5b21b6',
      codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7, qrSize: 112, cornerRadius: 4,
      borderStyle: 'solid', borderWidth: 1, logoSize: 1.0, logoColor: 'white', fontFamily: 'Inter',
      watermarkOpacity: 0.03, watermarkSource: 'code', watermarkText: '', watermarkSize: 9, watermarkAngle: -28,
      footerText: 'IT ASSET - REPORT ISSUES TO HELPDESK',
      footerBg: '#4c1d95', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#dc2626',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'purchase_order_no', 'site'],
    },
  },
  {
    name: 'Multi-Copy Sheet',
    desc: 'A8 × 3 copies - print a sheet of the same tag at once',
    badge: '📋',
    config: {
      sizePreset: 'A8', copies: 3, printGap: 3,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: false,
      headerBg: '#1e3a8a', accentColor: '#2563eb', bodyBg: '#ffffff', fieldColor: '#111827', labelColor: '#374151',
      codeFontSize: 13, fieldFontSize: 10, labelFontSize: 6.5, qrSize: 150, cornerRadius: 3,
      borderStyle: 'dashed', borderWidth: 1, logoSize: 0.85, logoColor: 'white', fontFamily: 'Inter',
      watermarkOpacity: 0, watermarkSource: 'code', watermarkText: '', watermarkSize: 9, watermarkAngle: -28,
      footerText: '',
      footerBg: '#1e3a8a', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#dc2626',
      visibleFields: ['asset_name', 'serial_no', 'site'],
    },
  },
  {
    name: 'Vehicle Tag',
    desc: 'Custom 90×55mm - credit-card size, bold code, vehicle fields',
    badge: '🚗',
    config: {
      sizePreset: 'Custom', customWidthMm: 90, customHeightMm: 55, copies: 1, printGap: 4,
      showLogo: true, showQr: true, showBorder: true, showHeaderBar: true, showFooter: true,
      headerBg: '#1a1a2e', accentColor: '#e94560', bodyBg: '#ffffff', fieldColor: '#1a1a2e', labelColor: '#555577',
      codeFontSize: 14, fieldFontSize: 10, labelFontSize: 6.5, qrSize: 90, cornerRadius: 5,
      borderStyle: 'solid', borderWidth: 2, logoSize: 0.9, logoColor: 'white',
      watermarkOpacity: 0.03, watermarkSource: 'custom', watermarkText: 'VEHICLE', watermarkSize: 14, watermarkAngle: -20,
      footerText: 'VEHICLES - DO NOT REMOVE',
      footerBg: '#1a1a2e', footerColor: '#ffffff',
      codeColor: '#ffffff', dnrColor: '#e94560',
      visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'site'],
    },
  },
]

const DEFAULT_CONFIG = {
  sizePreset: 'A6', customWidthMm: 90, customHeightMm: 60,
  copies: 1, printGap: 4,
  showLogo: true, showQr: true, showBorder: true, showHeaderBar: true,
  showFooter: true,
  headerBg: '#1e3a8a', accentColor: '#1d4ed8',
  bodyBg: '#ffffff', fieldColor: '#111827', labelColor: '#374151',
  codeFontSize: 16, fieldFontSize: 11, labelFontSize: 7,
  qrSize: 110, cornerRadius: 3, borderStyle: 'solid', borderWidth: 1,
  visibleFields: ['asset_name', 'make', 'model_no', 'serial_no', 'capacity', 'site'],
  customLogo: defaultLogo, logoSize: 1.0, logoColor: 'white', logoAlign: 'center',
  fontFamily: 'Inter',
  watermarkOpacity: 0.03, watermarkSource: 'code', watermarkText: '',
  watermarkSize: 9, watermarkAngle: -28,
  footerText: 'PROPERTY OF STRONGBUILT',
  footerBg: '#1e3a8a', footerColor: '#ffffff',
  codeColor: '#ffffff', dnrColor: '#dc2626',
}

// ─── Unified Sticker ────────────────────────────────────────
function Sticker({ asset, qrUrl, config }) {
  const {
    sizePreset = 'A6', customWidthMm = 90, customHeightMm = 60,
    showLogo = true, showQr = true, showBorder = true, showHeaderBar = true,
    showFooter = true,
    headerBg = '#1e3a8a', bodyBg = '#ffffff', fieldColor = '#111827',
    labelColor = '#374151', accentColor = '#1d4ed8',
    codeFontSize = 16, fieldFontSize = 11, labelFontSize = 7,
    qrSize = 110, cornerRadius = 3, borderStyle = 'solid', borderWidth = 1,
    customLogo = defaultLogo, logoSize = 1.0, logoColor = 'white', logoAlign = 'center',
    fontFamily = 'Inter',
    watermarkOpacity = 0.03, watermarkSource = 'code',
    watermarkText = '', watermarkSize = 9, watermarkAngle = -28,
    footerText = '', footerBg = '#1e3a8a', footerColor = '#ffffff',
    codeColor = '#ffffff', dnrColor = '#dc2626',
    visibleFields = [],
  } = config

  const preset = SIZE_PRESETS.find(p => p.key === sizePreset)
  const wMm  = (sizePreset === 'Custom' ? customWidthMm  : preset?.w) ?? 105
  const hMm  = (sizePreset === 'Custom' ? customHeightMm : preset?.h) ?? 74
  const W    = Math.round(wMm * MM)
  const H    = Math.round(hMm * MM)
  const land = wMm >= hMm

  const fields = visibleFields.filter(k => asset[k])
  const wmText = (watermarkSource === 'custom' && watermarkText) ? watermarkText : asset.asset_code
  const logoFlt = logoColor === 'white' ? 'brightness(0) invert(1)' : logoColor === 'black' ? 'brightness(0)' : 'none'

  return (
    <div style={{
      width: W, height: H, background: bodyBg,
      borderRadius: `${cornerRadius}mm`, overflow: 'hidden',
      border: showBorder ? `${borderWidth}px ${borderStyle} ${labelColor}40` : 'none',
      display: 'flex', flexDirection: 'column',
      fontFamily: `'${fontFamily}', sans-serif`,
      pageBreakInside: 'avoid', boxSizing: 'border-box', flexShrink: 0,
      position: 'relative', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    }}>

      {/* Watermark */}
      {watermarkOpacity > 0 && (
        <div style={{
          position: 'absolute', inset: 0, opacity: watermarkOpacity,
          pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
          display: 'flex', flexWrap: 'wrap', gap: 12, padding: 8, alignContent: 'flex-start',
        }}>
          {[...Array(land ? 30 : 20)].map((_, i) => (
            <div key={i} style={{ fontSize: watermarkSize, fontWeight: 700, transform: `rotate(${watermarkAngle}deg)`, whiteSpace: 'nowrap', color: fieldColor }}>
              {wmText}
            </div>
          ))}
        </div>
      )}

      {/* Header - compact, no wasted vertical space */}
      <div style={{
        background: showHeaderBar ? headerBg : 'transparent',
        borderBottom: !showHeaderBar ? `2px solid ${accentColor}` : 'none',
        padding: land ? '5px 10px' : '6px 10px',
        display: 'flex', flexDirection: land ? 'row' : 'column',
        alignItems: land ? 'center' : (logoAlign === 'left' ? 'flex-start' : logoAlign === 'right' ? 'flex-end' : 'center'),
        justifyContent: land ? (logoAlign === 'left' ? 'flex-start' : logoAlign === 'right' ? 'flex-end' : 'space-between') : (logoAlign === 'left' ? 'flex-start' : logoAlign === 'right' ? 'flex-end' : 'center'),
        gap: land ? 8 : 3, zIndex: 1, flexShrink: 0,
      }}>
        {showLogo && (
          <img src={customLogo || defaultLogo} alt="Logo" style={{
            width:  Math.round((land ? 88 : 72) * logoSize),
            height: Math.round((land ? 28 : 22) * logoSize),
            objectFit: 'contain',
            objectPosition: logoAlign,
            filter: showHeaderBar ? logoFlt : 'none',
            maxWidth: land ? '52%' : '78%',
          }} />
        )}
        <div style={{
          fontWeight: 800, fontSize: codeFontSize,
          color: codeColor,
          fontFamily: "var(--font-mono)", letterSpacing: '0.04em',
          textAlign: land ? (logoAlign === 'left' ? 'right' : logoAlign === 'right' ? 'left' : 'right') : logoAlign,
          flexShrink: 0, marginLeft: land && logoAlign === 'left' ? 'auto' : undefined,
          paddingLeft: land ? 6 : 0,
          borderTop: (!land && showLogo) ? `1px solid ${showHeaderBar ? 'rgba(255,255,255,0.25)' : `${accentColor}30`}` : 'none',
          paddingTop: (!land && showLogo) ? 3 : 0,
          width: !land ? '100%' : undefined,
        }}>
          {asset.asset_code}
        </div>
      </div>

      {/* Body - fills all remaining space */}
      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden', zIndex: 1,
        padding: land ? '6px 8px 5px 10px' : '5px 8px 4px',
        gap: land ? 8 : 0,
        flexDirection: land ? 'row' : 'column',
      }}>

        {/* Portrait: QR centered, full-width */}
        {!land && showQr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 5, flexShrink: 0 }}>
            <div style={{ padding: 3, background: '#fff', border: `1.5px solid ${accentColor}30`, borderRadius: 5, display: 'inline-flex' }}>
              {qrUrl
                ? <img src={qrUrl} alt="QR" width={qrSize} height={qrSize} style={{ display: 'block' }} />
                : <div style={{ width: qrSize, height: qrSize, background: '#f3f4f6' }} />}
            </div>
            <div style={{ fontSize: labelFontSize * 0.9, fontWeight: 700, color: fieldColor, fontFamily: "var(--font-mono)", letterSpacing: '0.03em', marginTop: 2, textAlign: 'center' }}>
              {asset.asset_code}
            </div>
          </div>
        )}

        {/* Fields */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: land ? 4 : 3, minWidth: 0 }}>
          {fields.slice(0, land ? 7 : 5).map(fk => (
            <div key={fk}>
              <div style={{ fontWeight: 700, fontSize: labelFontSize, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                {FIELD_LABELS[fk] || fk}
              </div>
              <div style={{ fontWeight: 700, fontSize: fieldFontSize, color: fieldColor, lineHeight: 1.2, wordBreak: 'break-word' }}>
                {asset[fk]}
              </div>
            </div>
          ))}
        </div>

        {/* Landscape: QR right column - stretches full body height */}
        {land && showQr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'stretch' }}>
            <div style={{ padding: 3, background: '#fff', border: `1.5px solid ${accentColor}30`, borderRadius: 5, display: 'flex', alignItems: 'center' }}>
              {qrUrl
                ? <img src={qrUrl} alt="QR" width={qrSize} height={qrSize} style={{ display: 'block' }} />
                : <div style={{ width: qrSize, height: qrSize, background: '#f3f4f6' }} />}
            </div>
            <div style={{ fontSize: labelFontSize * 0.9, fontWeight: 700, color: fieldColor, fontFamily: "var(--font-mono)", letterSpacing: '0.03em', marginTop: 2, textAlign: 'center' }}>
              {asset.asset_code}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {showFooter && footerText && (
        <div style={{
          padding: '2.5px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
          background: footerBg, zIndex: 1, flexShrink: 0,
          borderRadius: `0 0 ${Math.max(0, cornerRadius - 0.5)}mm ${Math.max(0, cornerRadius - 0.5)}mm`,
        }}>
          <div style={{ fontSize: labelFontSize * 0.82, fontWeight: 700, color: footerColor, textTransform: 'uppercase', letterSpacing: '0.02em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {footerText}
          </div>
          <div style={{ fontSize: labelFontSize * 0.78, fontWeight: 800, color: dnrColor, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
            DO NOT REMOVE
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mobile detection hook ──────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return mobile
}

// ─── Debounce hook ───────────────────────────────────────────
function useDebounced(value, delay = 280) {
  const [dbv, setDbv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDbv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dbv
}

const PANEL_SECTIONS = [
  { id: 'size',       icon: '⊡', title: 'Size & Print'    },
  { id: 'layout',     icon: '▤', title: 'Layout'          },
  { id: 'colors',     icon: '◑', title: 'Colors'          },
  { id: 'logo',       icon: '⊞', title: 'Logo'            },
  { id: 'typography', icon: 'T', title: 'Typography'      },
  { id: 'branding',   icon: '≋', title: 'Branding'        },
  { id: 'fields',     icon: '☰', title: 'Visible Fields'  },
]

function Sec({ id, open, toggle, children }) {
  const s = PANEL_SECTIONS.find(x => x.id === id)
  const isOpen = open === id
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => toggle(id)} style={{
        width: '100%', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        background: isOpen ? 'var(--accent-glow)' : 'none',
        border: 'none', cursor: 'pointer', transition: 'background 0.15s',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: isOpen ? 'var(--accent)' : 'var(--bg-4)',
          color: isOpen ? '#fff' : 'var(--text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.15s',
        }}>{s.icon}</span>
        <span style={{
          flex: 1, textAlign: 'left', fontWeight: 600, fontSize: '0.82rem',
          color: isOpen ? 'var(--accent-light)' : 'var(--text-1)',
          letterSpacing: '0.01em',
        }}>{s.title}</span>
        <span style={{ color: isOpen ? 'var(--accent-light)' : 'var(--text-3)', fontSize: '0.7rem' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-1)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Stable sub-components (outside ControlPanel to avoid remount) ────
function Slider({ label, k, min, max, step = 1, unit = '', fmt, config, onChange }) {
  const value = config[k]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 500 }}>{label}</label>
        <span style={{ fontSize: '0.72rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', background: 'var(--accent-glow)', padding: '1px 6px', borderRadius: 4 }}>
          {fmt ? fmt(value) : `${value}${unit}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(k, Number(e.target.value))}
        className="sticker-slider" />
    </div>
  )
}

function Color({ label, k, config, onChange }) {
  const value = config[k]
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 500 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{value}</span>
        <div style={{ position: 'relative', width: 34, height: 26 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: value, border: '2px solid var(--border)', pointerEvents: 'none', transition: 'background 0.15s' }}/>
          <input type="color" value={value} onChange={e => onChange(k, e.target.value)}
            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, k, config, onChange }) {
  const value = config[k]
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 500 }}>{label}</label>
      <button onClick={() => onChange(k, !value)} style={{
        width: 38, height: 21, borderRadius: 11, border: 'none', cursor: 'pointer',
        transition: 'background 0.25s ease, box-shadow 0.25s ease', position: 'relative', flexShrink: 0,
        background: value ? 'var(--accent)' : 'var(--bg-4)',
        boxShadow: value ? '0 0 8px var(--accent)40' : 'none',
      }}>
        <div style={{
          width: 15, height: 15, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3, left: value ? 20 : 3,
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  )
}

// ─── Control Panel ───────────────────────────────────────────
function ControlPanel({ config, onChange, onBatch }) {
  const [open, setOpen] = useState('size')
  const [localFooter, setLocalFooter] = useState(config.footerText)
  const [localWmText, setLocalWmText] = useState(config.watermarkText || '')

  useEffect(() => { setLocalFooter(config.footerText) }, [config.footerText])
  useEffect(() => { setLocalWmText(config.watermarkText || '') }, [config.watermarkText])
  const dFooter = useDebounced(localFooter)
  const dWmText = useDebounced(localWmText)
  useEffect(() => { onChange('footerText', dFooter) }, [dFooter])
  useEffect(() => { onChange('watermarkText', dWmText) }, [dWmText])

  const toggle = id => setOpen(o => o === id ? '' : id)

  const TOGGLEABLE_FIELDS = [
    { key: 'asset_name', label: 'Asset Name' }, { key: 'make', label: 'Make' },
    { key: 'model_no', label: 'Model No' },     { key: 'serial_no', label: 'Serial No' },
    { key: 'capacity', label: 'Capacity' },     { key: 'site', label: 'Location' },
    { key: 'purchase_order_no', label: 'PO No' }, { key: 'category', label: 'Category' },
    { key: 'purchase_date', label: 'Purchase Date' }, { key: 'type_code', label: 'Type Code' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      <Sec id="size" open={open} toggle={toggle}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Label Size</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {SIZE_PRESETS.map(p => (
              <button key={p.key} onClick={() => onChange('sizePreset', p.key)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 8, border: '1.5px solid',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                borderColor: config.sizePreset === p.key ? 'var(--accent)' : 'var(--border)',
                background: config.sizePreset === p.key ? 'var(--accent-glow)' : 'var(--bg-3)',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: config.sizePreset === p.key ? 'var(--accent-light)' : 'var(--text-1)' }}>{p.label}</div>
                <div style={{ fontSize: '0.58rem', opacity: 0.6, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{p.sub}</div>
              </button>
            ))}
          </div>
        </div>
        {config.sizePreset === 'Custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Slider label="Width" k="customWidthMm" min={40} max={210} unit="mm" config={config} onChange={onChange}/>
            <Slider label="Height" k="customHeightMm" min={30} max={297} unit="mm" config={config} onChange={onChange}/>
          </div>
        )}
        <Slider label="Copies per Asset" k="copies" min={1} max={10} unit="×" config={config} onChange={onChange}/>
        <Slider label="Print Gap" k="printGap" min={0} max={12} unit="mm" config={config} onChange={onChange}/>
      </Sec>

      <Sec id="layout" open={open} toggle={toggle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <Toggle label="Logo"           k="showLogo" config={config} onChange={onChange}/>
          <Toggle label="QR Code"        k="showQr" config={config} onChange={onChange}/>
          <Toggle label="Border"         k="showBorder" config={config} onChange={onChange}/>
          <Toggle label="Header Bar"     k="showHeaderBar" config={config} onChange={onChange}/>
          <Toggle label="Footer"         k="showFooter" config={config} onChange={onChange}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Border Style</label>
            <select value={config.borderStyle || 'solid'} onChange={e => onChange('borderStyle', e.target.value)} className="sel" style={{ fontSize: '0.78rem' }}>
              {BORDER_STYLES.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
            </select>
          </div>
          <Slider label="Border Width" k="borderWidth" min={1} max={5} unit="px" config={config} onChange={onChange}/>
        </div>
        <Slider label="Corner Radius" k="cornerRadius" min={0} max={8} unit="mm" config={config} onChange={onChange}/>
      </Sec>

      <Sec id="colors" open={open} toggle={toggle}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Quick Themes</label>
          <div style={{ display: 'flex', gap: 7 }}>
            {COLOR_THEMES.map(t => (
              <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <button title={t.label} onClick={() => onBatch({ headerBg: t.c, accentColor: t.ac, bodyBg: t.body, fieldColor: t.fc, labelColor: t.lc })} style={{
                  width: 30, height: 30, borderRadius: 8, border: '2.5px solid',
                  borderColor: config.headerBg === t.c ? 'var(--accent)' : 'transparent',
                  background: `linear-gradient(135deg, ${t.c} 50%, ${t.ac} 100%)`,
                  cursor: 'pointer', boxShadow: config.headerBg === t.c ? `0 0 0 2px var(--accent)` : '0 1px 4px rgba(0,0,0,0.3)',
                  transition: 'all 0.15s',
                }}/>
                <span style={{ fontSize: '0.56rem', color: 'var(--text-3)' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Color label="Header BG"     k="headerBg" config={config} onChange={onChange}/>
          <Color label="Asset Code"   k="codeColor" config={config} onChange={onChange}/>
          <Color label="Accent"       k="accentColor" config={config} onChange={onChange}/>
          <Color label="Body BG"      k="bodyBg" config={config} onChange={onChange}/>
          <Color label="Field Labels" k="labelColor" config={config} onChange={onChange}/>
          <Color label="Field Values" k="fieldColor" config={config} onChange={onChange}/>
          <Color label="Footer BG"    k="footerBg" config={config} onChange={onChange}/>
          <Color label="Footer Text"  k="footerColor" config={config} onChange={onChange}/>
          <Color label="Do Not Remove" k="dnrColor" config={config} onChange={onChange}/>
        </div>
      </Sec>

      <Sec id="logo" open={open} toggle={toggle}>
        {config.customLogo && (
          <div style={{ position: 'relative', background: 'var(--bg-3)', padding: '8px', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
            <img src={config.customLogo} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: 44, objectFit: 'contain' }} />
            <button onClick={() => onChange('customLogo', defaultLogo)} style={{
              position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%',
              background: 'var(--red)', color: 'white', border: '2px solid var(--bg-2)',
              cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        )}
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px',
          background: 'var(--bg-3)', border: '1.5px dashed var(--border)', borderRadius: 8,
          cursor: 'pointer', color: 'var(--text-2)', fontSize: '0.78rem',
          transition: 'border-color 0.15s',
        }}>
          ↑ Upload Logo
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
            const f = e.target.files[0]; if (!f) return
            const r = new FileReader(); r.onload = ev => onChange('customLogo', ev.target.result); r.readAsDataURL(f)
          }} />
        </label>
        <Slider label="Logo Size" k="logoSize" min={0.4} max={2.5} step={0.05} unit="×" config={config} onChange={onChange}/>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Logo Alignment</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {[['left','Left'],['center','Center'],['right','Right']].map(([v,l]) => (
              <button key={v} onClick={() => onChange('logoAlign', v)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 7, border: '1.5px solid',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                borderColor: config.logoAlign === v ? 'var(--accent)' : 'var(--border)',
                background: config.logoAlign === v ? 'var(--accent-glow)' : 'var(--bg-3)',
                color: config.logoAlign === v ? 'var(--accent)' : 'var(--text-3)',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Logo Tint</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {[['white','White'],['original','Original'],['black','Black']].map(([v,l]) => (
              <button key={v} onClick={() => onChange('logoColor', v)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 7, border: '1.5px solid',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                borderColor: config.logoColor === v ? 'var(--accent)' : 'var(--border)',
                background: config.logoColor === v ? 'var(--accent-glow)' : 'var(--bg-3)',
                color: config.logoColor === v ? 'var(--accent-light)' : 'var(--text-2)',
              }}>{l}</button>
            ))}
          </div>
        </div>
      </Sec>

      <Sec id="typography" open={open} toggle={toggle}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Font Family</label>
          <select value={config.fontFamily} onChange={e => onChange('fontFamily', e.target.value)} className="sel" style={{ fontSize: '0.8rem' }}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <Slider label="Code Size"  k="codeFontSize"  min={8}  max={28}  unit="pt" config={config} onChange={onChange}/>
        <Slider label="Field Size" k="fieldFontSize" min={5}  max={18}  unit="pt" config={config} onChange={onChange}/>
        <Slider label="Label Size" k="labelFontSize" min={4}  max={12}  unit="pt" config={config} onChange={onChange}/>
        <Slider label="QR Size"    k="qrSize"        min={60} max={180} unit="px" config={config} onChange={onChange}/>
      </Sec>

      <Sec id="branding" open={open} toggle={toggle}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Watermark</label>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {[['code','Asset Code'],['custom','Custom Text']].map(([v,l]) => (
              <button key={v} onClick={() => onChange('watermarkSource', v)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 7, border: '1.5px solid',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                borderColor: (config.watermarkSource || 'code') === v ? 'var(--accent)' : 'var(--border)',
                background: (config.watermarkSource || 'code') === v ? 'var(--accent-glow)' : 'var(--bg-3)',
                color: (config.watermarkSource || 'code') === v ? 'var(--accent-light)' : 'var(--text-2)',
              }}>{l}</button>
            ))}
          </div>
        </div>
        {(config.watermarkSource || 'code') === 'custom' && (
          <input value={localWmText} onChange={e => setLocalWmText(e.target.value)}
            className="inp" placeholder="Watermark text…" style={{ fontSize: '0.78rem' }} />
        )}
        <Slider label="Opacity"  k="watermarkOpacity" min={0}   max={0.15} step={0.004} fmt={v => Math.round(v * 1000) + '‰'} config={config} onChange={onChange}/>
        <Slider label="Size"     k="watermarkSize"    min={6}   max={20}   unit="pt" config={config} onChange={onChange}/>
        <Slider label="Rotation" k="watermarkAngle"   min={-60} max={0}    unit="°" config={config} onChange={onChange}/>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Footer Text</label>
          <input value={localFooter} onChange={e => setLocalFooter(e.target.value)}
            className="inp" style={{ fontSize: '0.78rem' }} />
        </div>
      </Sec>

      <Sec id="fields" open={open} toggle={toggle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TOGGLEABLE_FIELDS.map(f => {
            const on = (config.visibleFields || []).includes(f.key)
            return (
              <button key={f.key} onClick={() => {
                const vf = config.visibleFields || []
                onChange('visibleFields', on ? vf.filter(k => k !== f.key) : [...vf, f.key])
              }} style={{
                padding: '4px 10px', borderRadius: 20, border: '1.5px solid',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                transition: 'all 0.15s',
                borderColor: on ? 'var(--accent)' : 'var(--border)',
                background: on ? 'var(--accent-glow)' : 'var(--bg-3)',
                color: on ? 'var(--accent-light)' : 'var(--text-3)',
              }}>
                {on ? '✓ ' : ''}{f.label}
              </button>
            )
          })}
        </div>
      </Sec>

    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function StickerPage() {
  const { currentCompany, can } = useAuth()
  const cc = currentCompany?.id
  const [searchParams] = useSearchParams()
  const preIds = searchParams.get('ids')?.split(',').filter(Boolean) || []

  const [assets,   setAssets]   = useState([])
  const [selected, setSelected] = useState(new Set(preIds))
  const [qrMap,    setQrMap]    = useState({})
  const [config,   setConfig]   = useState(DEFAULT_CONFIG)
  const [search,   setSearch]   = useState('')
  const [loading,        setLoading]        = useState(true)
  const [genning,        setGenning]        = useState(false)
  const [tab,            setTab]            = useState('design')
  const [filterSite,     setFilterSite]     = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterStatus,   setFilterStatus]   = useState('All')
  const [previewIdx, setPreviewIdx] = useState(0)
  const isMobile = useIsMobile()

  // Templates
  const TPLKEY   = 'sticker_templates_v2'
  const loadTpls = () => {
    try {
      const raw = localStorage.getItem(TPLKEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(t => t && typeof t.name === 'string' && t.config && typeof t.config === 'object')
    } catch { return [] }
  }
  const [templates,     setTemplates]     = useState(loadTpls)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showTplPanel,  setShowTplPanel]  = useState(false)
  const [tplTab,        setTplTab]        = useState('presets')
  const [tplName,       setTplName]       = useState('')
  const tplPanelRef = useRef(null)
  const qrGenId     = useRef(0)

  useEffect(() => {
    if (!showTplPanel) return
    const h = e => { if (tplPanelRef.current && !tplPanelRef.current.contains(e.target)) setShowTplPanel(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showTplPanel])

  function saveTemplate() {
    const name = tplName.trim(); if (!name) return
    const tpl = {
      name,
      config: { ...config, customLogo: config.customLogo === defaultLogo ? '__default__' : config.customLogo },
      createdAt: new Date().toISOString(),
    }
    const updated = [...templates.filter(t => t.name !== name), tpl]
    localStorage.setItem(TPLKEY, JSON.stringify(updated))
    setTemplates(updated); setShowSaveModal(false); setTplName('')
  }

  function loadTemplate(tpl) {
    const cfg = { ...DEFAULT_CONFIG, ...tpl.config }
    if (cfg.customLogo === '__default__') cfg.customLogo = defaultLogo
    setConfig(cfg); setShowTplPanel(false)
  }

  function deleteTemplate(name, e) {
    e.stopPropagation()
    const updated = templates.filter(t => t.name !== name)
    localStorage.setItem(TPLKEY, JSON.stringify(updated)); setTemplates(updated)
  }

  useEffect(() => { fetchAssets({}, cc, getAssetSelectCols(can('view_financials'))).then(d => { setAssets(d); setLoading(false) }) }, [cc])

  useEffect(() => {
    const todo = assets.filter(a => selected.has(a.id) && !qrMap[a.asset_code])
    if (!todo.length) { setGenning(false); return }
    const genId = ++qrGenId.current
    setGenning(true)
    Promise.all(todo.map(a => getOrMakeQR(a.asset_code, a.id).then(url => [a.asset_code, url])))
      .then(pairs => {
        if (genId !== qrGenId.current) return // stale - a newer generation is running
        const valid = pairs.filter(Boolean)
        if (valid.length) setQrMap(prev => { const n = { ...prev }; valid.forEach(([k, v]) => { n[k] = v }); return n })
        setGenning(false)
      })
  }, [selected, assets])

  function setConf(k, v) { setConfig(c => ({ ...c, [k]: v })) }
  function setBatch(updates) { setConfig(c => ({ ...c, ...updates })) }
  function toggleSelect(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  const siteOptions     = useMemo(() => ['All', ...[...new Set(assets.map(a => a.site).filter(Boolean))].sort()], [assets])
  const categoryOptions = useMemo(() => ['All', ...[...new Set(assets.map(a => a.category).filter(Boolean))].sort()], [assets])
  const statusOptions   = useMemo(() => ['All', ...[...new Set(assets.map(a => a.status).filter(Boolean))].sort()], [assets])

  const filtered = useMemo(() => assets.filter(a => {
    if (filterSite     !== 'All' && a.site     !== filterSite)     return false
    if (filterCategory !== 'All' && a.category !== filterCategory) return false
    if (filterStatus   !== 'All' && a.status   !== filterStatus)   return false
    if (search) {
      const q = search.toLowerCase()
      return a.asset_code?.toLowerCase().includes(q) || a.asset_name?.toLowerCase().includes(q)
    }
    return true
  }), [assets, filterSite, filterCategory, filterStatus, search])
  const selectedAssets = assets.filter(a => selected.has(a.id))
  const copies         = Math.max(1, config.copies || 1)
  const printAssets    = selectedAssets.flatMap(a => Array(copies).fill(a))
  const gap            = config.printGap ?? 4

  // Clamp preview index when selection changes
  useEffect(() => {
    if (previewIdx >= selectedAssets.length) setPreviewIdx(Math.max(0, selectedAssets.length - 1))
  }, [selectedAssets.length])

  // Mobile sticker scaling
  const mobilePreviewAsset = selectedAssets[previewIdx] || null
  const presetInfo = SIZE_PRESETS.find(p => p.key === config.sizePreset)
  const stickerWMm = (config.sizePreset === 'Custom' ? config.customWidthMm : presetInfo?.w) ?? 105
  const stickerHMm = (config.sizePreset === 'Custom' ? config.customHeightMm : presetInfo?.h) ?? 74
  const stickerPxW = Math.round(stickerWMm * MM)
  const stickerPxH = Math.round(stickerHMm * MM)

  const sizeLabel = config.sizePreset === 'Custom'
    ? `${config.customWidthMm}×${config.customHeightMm}mm`
    : config.sizePreset

  function handlePrint() {
    const el = document.getElementById('sticker-print-area')
    if (!el) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Print Stickers</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&family=Montserrat:wght@400;600;700&family=Roboto+Condensed:wght@400;700&display=swap" rel="stylesheet"/>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        .wrap { display: flex; flex-wrap: wrap; gap: ${gap}mm; padding: ${gap}mm; align-items: flex-start; }
        .wrap > div { page-break-inside: avoid; break-inside: avoid; }
        @page { margin: ${gap}mm; size: auto; }
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      </style>
    </head><body><div class="wrap">${el.innerHTML}</div></body></html>`)
    w.document.close()
    // Use Font Loading API to print as soon as fonts are ready; fall back to 800ms
    const doPrint = () => { w.focus(); w.print() }
    if (w.document.fonts?.ready) {
      w.document.fonts.ready.then(doPrint).catch(doPrint)
    } else {
      setTimeout(doPrint, 800)
    }
  }

  return (
    <>
      {/* ── Save Template Modal ── */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowSaveModal(false)}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 32px', width: 360, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent)30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SaveIcon size={16} style={{ color: 'var(--accent)' }}/>
              </div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em', color: 'var(--text-0)', margin: 0 }}>SAVE TEMPLATE</h3>
                <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', margin: 0 }}>Reuse this design anytime</p>
              </div>
            </div>
            <label className="lbl">Template Name</label>
            <input autoFocus value={tplName} onChange={e => setTplName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTemplate()}
              placeholder="e.g. Workshop A6, Vehicle Tags…" className="inp" style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} className="btn-ghost" style={{ fontSize: '0.82rem' }}>Cancel</button>
              <button onClick={saveTemplate} className="btn-primary" style={{ fontSize: '0.82rem' }} disabled={!tplName.trim()}>
                <SaveIcon size={13}/> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="sticker-header" style={{
        background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)',
        border: '1px solid var(--border)', borderRadius: 16, padding: '14px 18px',
        marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
      }}>
        {/* Left: title + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div className="sticker-header-icon" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent)40', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={17} style={{ color: 'var(--accent)' }}/>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="text-page-title m-0 tracking-wide uppercase" style={{ lineHeight: 1.1 }}>
              STICKER <span className="text-accent">DESIGNER</span>
            </h1>
            <div className="sticker-status-pills" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: genning ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${genning ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 20, padding: '2px 8px 2px 5px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: genning ? 'var(--amber)' : 'var(--green)', animation: genning ? 'none' : 'pulse2 2s infinite' }}/>
                  <span style={{ fontSize: '0.72rem', color: genning ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>
                    {genning ? 'Generating QR…' : 'Live'}
                  </span>
                </div>
                {selectedAssets.length > 0 && (
                  <>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>·</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      <strong style={{ color: 'var(--accent-light)' }}>{selectedAssets.length}</strong> asset{selectedAssets.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>·</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      <strong style={{ color: 'var(--text-0)' }}>{printAssets.length}</strong> label{printAssets.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', background: 'var(--bg-4)', padding: '1px 6px', borderRadius: 4 }}>{sizeLabel}</span>
                    {copies > 1 && <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>{copies}× copies</span>}
                  </>
                )}
              </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="sticker-actions" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Templates dropdown */}
          <div style={{ position: 'relative' }} ref={tplPanelRef}>
            <button onClick={() => setShowTplPanel(o => !o)} className="btn-ghost"
              style={{ fontSize: '0.82rem', padding: '8px 14px', background: showTplPanel ? 'var(--accent-glow)' : undefined, borderColor: showTplPanel ? 'var(--accent)' : undefined, color: showTplPanel ? 'var(--accent-light)' : undefined, gap: 6 }}>
              <BookmarkIcon size={14}/>
              <span className="sticker-btn-label">Templates</span>
              <span style={{ background: showTplPanel ? 'var(--accent)' : 'var(--bg-4)', color: showTplPanel ? 'white' : 'var(--text-3)', borderRadius: 8, padding: '1px 6px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                {PRESET_TEMPLATES.length + templates.length}
              </span>
            </button>

            {showTplPanel && (
              <div className="sticker-tpl-dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 500, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, width: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                  {[{ id: 'presets', label: `Presets`, count: PRESET_TEMPLATES.length }, { id: 'saved', label: 'My Saved', count: templates.length }].map(t => (
                    <button key={t.id} onClick={() => setTplTab(t.id)} style={{
                      flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', background: 'none',
                      color: tplTab === t.id ? 'var(--accent-light)' : 'var(--text-3)',
                      borderBottom: tplTab === t.id ? '2px solid var(--accent)' : '2px solid transparent', fontWeight: 600, fontSize: '0.8rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      {t.label}
                      <span style={{ fontSize: '0.65rem', background: tplTab === t.id ? 'var(--accent)' : 'var(--bg-4)', color: tplTab === t.id ? 'white' : 'var(--text-3)', borderRadius: 8, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{t.count}</span>
                    </button>
                  ))}
                </div>

                {/* Presets */}
                {tplTab === 'presets' && (
                  <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                    {PRESET_TEMPLATES.map(tpl => (
                      <div key={tpl.name} onClick={() => loadTemplate(tpl)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                          <div style={{ height: '60%', background: tpl.config.headerBg }}/>
                          <div style={{ height: '40%', background: tpl.config.bodyBg, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                            <div style={{ width: 10, height: 2, borderRadius: 1, background: tpl.config.accentColor, opacity: 0.7 }}/>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-0)' }}>{tpl.name}</span>
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', background: 'var(--accent-glow)', padding: '1px 5px', borderRadius: 4 }}>
                              {tpl.config.sizePreset === 'Custom' ? `${tpl.config.customWidthMm}×${tpl.config.customHeightMm}mm` : tpl.config.sizePreset}
                            </span>
                            {tpl.config.copies > 1 && <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: 4 }}>{tpl.config.copies}×</span>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* My Saved */}
                {tplTab === 'saved' && (
                  <>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowTplPanel(false); setShowSaveModal(true) }}
                        style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-light)', background: 'var(--accent-glow)', border: '1px solid rgba(43,127,255,0.25)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <SaveIcon size={11}/> Save Current Design
                      </button>
                    </div>
                    {templates.length === 0 ? (
                      <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                        <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', fontWeight: 600 }}>No saved templates yet</p>
                        <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: 4 }}>Customise a design then save it</p>
                      </div>
                    ) : (
                      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {[...templates].reverse().map(tpl => (
                          <div key={tpl.name} onClick={() => loadTemplate(tpl)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-0)' }}>{tpl.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(tpl.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                            <button onClick={e => deleteTemplate(tpl.name, e)}
                              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <button onClick={() => { setShowSaveModal(true); setTplName('') }} className="btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 14px', gap: 6 }}>
            <SaveIcon size={14}/> <span className="sticker-btn-label">Save</span>
          </button>
          <button onClick={() => setConfig(DEFAULT_CONFIG)} className="btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 12px', gap: 6 }}>
            <RotateCcw size={14}/>
          </button>
          <button onClick={handlePrint}
            disabled={selectedAssets.length === 0 || genning}
            className="btn-primary sticker-print-btn-desktop"
            style={{ fontSize: '0.85rem', padding: '9px 20px', gap: 7, opacity: selectedAssets.length === 0 ? 0.45 : 1, cursor: selectedAssets.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            <Printer size={15}/>
            {selectedAssets.length > 0 ? `Print ${printAssets.length} Label${printAssets.length !== 1 ? 's' : ''}` : 'Print'}
          </button>
        </div>
      </div>

      {/* ── MOBILE: Sticky sticker preview (outside grid so sticky works) ── */}
      <div className="sticker-mobile-preview">
            {mobilePreviewAsset ? (
              <div style={{
                background: 'var(--bg-1)',
                borderRadius: 10, border: '1px solid var(--border)',
                padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}>
                {/* Sticker - scaled to fit container width */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: stickerPxW, transformOrigin: 'top center', transform: `scale(var(--sticker-scale, 1))` }} ref={el => {
                    if (el) {
                      const containerW = el.parentElement?.offsetWidth || 300
                      const scale = Math.min(1, containerW / stickerPxW)
                      el.style.setProperty('--sticker-scale', String(scale))
                      el.style.height = `${stickerPxH * scale}px`
                    }
                  }}>
                    <Sticker asset={mobilePreviewAsset} qrUrl={qrMap[mobilePreviewAsset.asset_code]} config={config}/>
                  </div>
                </div>
                {/* Navigation - only show when 2+ assets */}
                {selectedAssets.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '4px 0 2px' }}>
                    <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: previewIdx === 0 ? 'var(--text-3)' : 'var(--accent)', opacity: previewIdx === 0 ? 0.3 : 1 }}>
                      <ChevronLeft size={16}/>
                    </button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {previewIdx + 1} / {selectedAssets.length}
                    </span>
                    <button onClick={() => setPreviewIdx(i => Math.min(selectedAssets.length - 1, i + 1))} disabled={previewIdx >= selectedAssets.length - 1}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: previewIdx >= selectedAssets.length - 1 ? 'var(--text-3)' : 'var(--accent)', opacity: previewIdx >= selectedAssets.length - 1 ? 0.3 : 1 }}>
                      <ChevronRight size={16}/>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: '20px 16px', textAlign: 'center',
                background: 'var(--bg-2)', border: '2px dashed var(--border)', borderRadius: 10,
              }}>
                <Tag size={22} style={{ color: 'var(--accent)', opacity: 0.5, marginBottom: 6 }}/>
                <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', margin: 0 }}>
                  Select assets from <strong style={{ color: 'var(--accent-light)' }}>Assets</strong> tab below
                </p>
              </div>
            )}
          </div>

      {/* ── Main body ── */}
      <div className="sticker-layout" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '290px 1fr', gap: isMobile ? 12 : 18, alignItems: 'start' }}>

        {/* ── LEFT PANEL (tabs + content) ── */}
        <div className="sticker-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 16 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, gap: 2 }}>
            {[{ id: 'design', label: '⚙ Customise' }, { id: 'assets', label: `☰ Assets${selected.size ? ` (${selected.size})` : ''}` }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', borderRadius: 9,
                background: tab === t.id ? 'var(--accent)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--text-2)', fontWeight: 700, fontSize: '0.78rem',
                transition: 'all 0.2s',
                boxShadow: tab === t.id ? '0 2px 8px var(--accent)40' : 'none',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="sticker-panel-content" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>

              {tab === 'design' ? (
                <ControlPanel config={config} onChange={setConf} onBatch={setBatch}/>
              ) : (
                <div>
                  {/* Search + filters + select */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 5 }}>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 7 }}>
                      <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}/>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" className="inp"
                        style={{ paddingLeft: 30, fontSize: '0.8rem', height: 34 }}/>
                    </div>
                    {/* Filters */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {/* Row 1: Site + Category */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                          <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Site</label>
                          <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="sel"
                            style={{ fontSize: '0.75rem', width: '100%', fontWeight: filterSite !== 'All' ? 600 : 400, color: filterSite !== 'All' ? 'var(--accent-light)' : undefined }}>
                            {siteOptions.map(o => <option key={o} value={o}>{o === 'All' ? 'All Sites' : o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Category</label>
                          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="sel"
                            style={{ fontSize: '0.75rem', width: '100%', fontWeight: filterCategory !== 'All' ? 600 : 400, color: filterCategory !== 'All' ? 'var(--accent-light)' : undefined }}>
                            {categoryOptions.map(o => <option key={o} value={o}>{o === 'All' ? 'All Categories' : o}</option>)}
                          </select>
                        </div>
                      </div>
                      {/* Row 2: Status (full width) */}
                      <div>
                        <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Status</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="sel"
                          style={{ fontSize: '0.75rem', width: '100%', fontWeight: filterStatus !== 'All' ? 600 : 400, color: filterStatus !== 'All' ? 'var(--accent-light)' : undefined }}>
                          {statusOptions.map(o => <option key={o} value={o}>{o === 'All' ? 'All Statuses' : o}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Filter summary + reset */}
                    {(filterSite !== 'All' || filterCategory !== 'All' || filterStatus !== 'All') && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, padding: '5px 8px', background: 'var(--accent-glow)', borderRadius: 7, border: '1px solid rgba(79,126,255,0.15)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                          {filtered.length} / {assets.length} assets
                        </span>
                        <button onClick={() => { setFilterSite('All'); setFilterCategory('All'); setFilterStatus('All') }}
                          style={{ fontSize: '0.68rem', color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                          ✕ Clear
                        </button>
                      </div>
                    )}
                    {/* Select all / clear */}
                    <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                      <button onClick={() => setSelected(s => { const n = new Set(s); filtered.forEach(a => n.add(a.id)); return n })}
                        style={{ flex: 1, fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-light)', background: 'var(--accent-glow)', border: '1px solid rgba(43,127,255,0.2)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        + Select All{filterSite !== 'All' || filterCategory !== 'All' || filterStatus !== 'All' ? ' Filtered' : ''}
                      </button>
                      <button onClick={() => setSelected(new Set())}
                        style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>
                        Clear
                      </button>
                    </div>
                  </div>

                  {loading ? [...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ margin: '10px 12px', height: 38, borderRadius: 8 }}/>
                  )) : filtered.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.82rem' }}>No assets match</div>
                  ) : filtered.map(asset => (
                    <label key={asset.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: selected.has(asset.id) ? 'var(--accent-glow)' : 'transparent',
                      transition: 'background 0.12s',
                    }}>
                      <input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleSelect(asset.id)}
                        style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}/>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-light)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{asset.asset_code}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{asset.asset_name}</div>
                      </div>
                      {selected.has(asset.id) && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}/>
                      )}
                    </label>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── RIGHT: CANVAS (desktop only) ── */}
        <div className="sticker-desktop-canvas" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Canvas toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eye size={14} style={{ color: 'var(--accent)' }}/>
                <span style={{ fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', fontWeight: 600 }}>Live Canvas</span>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 7px', borderRadius: 5 }}>{sizeLabel}</span>
              </div>
              {selectedAssets.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  {printAssets.length} label{printAssets.length !== 1 ? 's' : ''} ready
                </span>
              )}
            </div>

            {/* Canvas area */}
            {selectedAssets.length === 0 ? (
              <div style={{
                minHeight: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'repeating-conic-gradient(var(--bg-3) 0% 25%, var(--bg-2) 0% 50%) 0 0 / 20px 20px',
                borderRadius: 14, border: '2px dashed var(--border)', padding: 40,
              }}>
                <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  <Tag size={32} style={{ color: 'var(--accent)', opacity: 0.6 }}/>
                </div>
                <h3 style={{ color: 'var(--text-1)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>NO LABELS SELECTED</h3>
                <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', maxWidth: 280, textAlign: 'center', lineHeight: 1.7, marginBottom: 20 }}>
                  Switch to the <strong style={{ color: 'var(--accent-light)' }}>Assets</strong> tab in the left panel, then select the assets you want to print.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setTab('assets')} className="btn-primary" style={{ fontSize: '0.82rem' }}>
                    <Package size={13}/> Browse Assets
                  </button>
                  <button onClick={() => { setShowTplPanel(true); setTplTab('presets') }} className="btn-ghost" style={{ fontSize: '0.82rem' }}>
                    <BookmarkIcon size={13}/> Browse Templates
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                gap: `${Math.round(gap * MM)}px`,
                alignItems: 'flex-start', padding: 24,
                background: 'repeating-conic-gradient(var(--bg-3) 0% 25%, var(--bg-2) 0% 50%) 0 0 / 20px 20px',
                borderRadius: 14, border: '1px solid var(--border)',
                minHeight: 200,
              }}>
                {printAssets.map((asset, i) => (
                  <Sticker key={`${asset.id}-${i}`} asset={asset} qrUrl={qrMap[asset.asset_code]} config={config}/>
                ))}
              </div>
            )}

            {/* Print hint */}
            {selectedAssets.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Printer size={14} style={{ color: 'var(--accent)' }}/>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-0)' }}>Printing tip:</strong> Set page margins to <strong>None</strong> and enable <strong>Background graphics</strong> in your browser print dialog for accurate colours.
                </p>
              </div>
            )}
          </div>

      </div>

      {/* ── Print area (always in DOM, off-screen, visible only during print) ── */}
      {selectedAssets.length > 0 && (
        <div className="sticker-print-only">
          <div id="sticker-print-area" style={{
            display: 'flex', flexWrap: 'wrap',
            gap: `${Math.round(gap * MM)}px`,
            alignItems: 'flex-start', padding: 24,
          }}>
            {printAssets.map((asset, i) => (
              <Sticker key={`print-${asset.id}-${i}`} asset={asset} qrUrl={qrMap[asset.asset_code]} config={config}/>
            ))}
          </div>
        </div>
      )}

      {/* ── MOBILE: Floating print button ── */}
      {selectedAssets.length > 0 && (
        <button onClick={handlePrint} disabled={genning}
          className="sticker-mobile-fab"
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 100,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent) 0%, #6b96ff 100%)',
            color: 'white', border: 'none',
            boxShadow: '0 4px 20px rgba(79,126,255,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <Printer size={22}/>
        </button>
      )}

    </>
  )
}


