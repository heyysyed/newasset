import React, { useState, useEffect } from 'react'
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function VoiceAuditInput({ items, onVoiceMatch }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [lastMatch, setLastMatch] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let currentText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentText += event.results[i][0].transcript
      }
      setTranscript(currentText)
      parseVoiceCommand(currentText)
    }

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e)
      setIsListening(false)
      setErrorMsg('Voice input error. Please try again.')
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    if (isListening) {
      try {
        recognition.start()
      } catch (err) {
        console.warn('Recognition start error:', err)
      }
    } else {
      try {
        recognition.stop()
      } catch {}
    }

    return () => {
      try { recognition.stop() } catch {}
    }
  }, [isListening])

  const parseVoiceCommand = (text) => {
    if (!text || !items || items.length === 0) return
    const cleanText = text.toLowerCase().trim()

    // Map condition keywords
    let matchedCondition = null
    if (cleanText.includes('operational') || cleanText.includes('good') || cleanText.includes('fine') || cleanText.includes('pass')) {
      matchedCondition = 'operational'
    } else if (cleanText.includes('damaged') || cleanText.includes('broken')) {
      matchedCondition = 'damaged'
    } else if (cleanText.includes('needs repair') || cleanText.includes('repair') || cleanText.includes('service')) {
      matchedCondition = 'needs_repair'
    } else if (cleanText.includes('not working') || cleanText.includes('dead') || cleanText.includes('non functional')) {
      matchedCondition = 'non_functional'
    } else if (cleanText.includes('missing') || cleanText.includes('lost')) {
      matchedCondition = 'missing'
    }

    if (!matchedCondition) return

    // Find matching asset by asset code or name
    const matchedItem = items.find(item => {
      const code = (item.asset?.asset_code || '').toLowerCase()
      const name = (item.asset?.asset_name || '').toLowerCase()
      const codeDigits = code.split('/').pop() || code
      return cleanText.includes(code.toLowerCase()) ||
        (codeDigits.length >= 2 && cleanText.includes(codeDigits.toLowerCase())) ||
        (name.length >= 3 && cleanText.includes(name.toLowerCase()))
    })

    if (matchedItem) {
      setLastMatch({ code: matchedItem.asset?.asset_code, condition: matchedCondition })
      onVoiceMatch(matchedItem, matchedCondition)
    }
  }

  const hasSpeechSupport = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window

  if (!hasSpeechSupport) return null

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12, background: isListening ? 'rgba(14,165,233,0.08)' : 'var(--bg-1)',
      border: `1px solid ${isListening ? 'var(--accent)' : 'var(--border)'}`,
      marginBottom: 16, transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setErrorMsg(''); setIsListening(!isListening); }}
            style={{
              padding: 10, borderRadius: '50%', border: 'none',
              background: isListening ? 'var(--status-danger)' : 'var(--accent)',
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isListening ? '0 0 16px var(--status-danger-soft)' : '0 2px 8px rgba(14,165,233,0.3)',
              transition: 'all 0.2s ease'
            }}
            title={isListening ? 'Stop Listening' : 'Start Voice Audit Assistant'}
          >
            {isListening ? <MicOff size={18} className="spin-pulse" /> : <Mic size={18} />}
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-0)' }}>
                Voice Audit Assistant
              </span>
              {isListening && (
                <span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--status-danger-soft)', color: 'var(--status-danger)', }}>
                  ● Listening...
                </span>
              )}
            </div>
            <span style={{ color: 'var(--text-3)', }}>
              Say asset code & condition (e.g. "VMD 002 Operational" or "Laptop Damaged")
            </span>
          </div>
        </div>

        {lastMatch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <CheckCircle2 size={14} color="#059669" />
            <span style={{ color: '#059669', }}>
              Matched: {lastMatch.code} → {lastMatch.condition}
            </span>
          </div>
        )}
      </div>

      {isListening && transcript && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--text-1)' }}>
          <Volume2 size={12} style={{ display: 'inline', marginRight: 6, color: 'var(--accent)' }} />
          "{transcript}"
        </div>
      )}

      {errorMsg && (
        <div style={{ marginTop: 6, color: 'var(--red)', }}>
          {errorMsg}
        </div>
      )}
    </div>
  )
}
