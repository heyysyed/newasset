import React, { useCallback, useState } from 'react'
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ImageUpload({ onFilesChange, maxFiles = 3, existingUrls = [] }) {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState(existingUrls)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (files.length >= maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed.`)
      return
    }

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    )
    
    if (droppedFiles.length === 0) {
      toast.error('Only images and PDFs are supported.')
      return
    }

    processFiles(droppedFiles)
  }, [files, maxFiles])

  const handleFileInput = (e) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files))
    }
  }

  const processFiles = (newFiles) => {
    const validFiles = newFiles.slice(0, maxFiles - files.length)
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))
    
    setFiles(prev => {
      const updated = [...prev, ...validFiles]
      onFilesChange && onFilesChange(updated)
      return updated
    })
    
    setPreviews(prev => [...prev, ...newPreviews])
    toast.success(`Added ${validFiles.length} file(s)`)
  }

  const removeFile = (index) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index)
      onFilesChange && onFilesChange(updated)
      return updated
    })
    setPreviews(prev => {
      // Revoke object URL to prevent memory leaks if it's a local file
      if (prev[index] && prev[index].startsWith('blob:')) {
        URL.revokeObjectURL(prev[index])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  return (
    <div className="w-full">
      {previews.length < maxFiles && (
        <label 
          className={`
            w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer
            ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-bg-1/50 hover:bg-bg-2'}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileInput} />
          <div className="p-3 bg-bg-2 rounded-full shadow-sm border border-border">
            <UploadCloud size={24} className={isDragging ? 'text-accent' : 'text-text-3'} />
          </div>
          <div className="text-center">
            <p className="text-small text-text-1 font-medium m-0 mb-1">Click to browse or drag & drop</p>
            <p className="text-[11px] text-text-3 m-0 uppercase tracking-wide">PNG, JPG, PDF up to 10MB ({files.length}/{maxFiles})</p>
          </div>
        </label>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {previews.map((src, idx) => (
            <div key={idx} className="relative aspect-square rounded-lg border border-border overflow-hidden bg-bg-2 group">
              {src.endsWith('.pdf') ? (
                 <div className="w-full h-full flex items-center justify-center bg-bg-2 text-text-3">PDF</div>
              ) : (
                <img src={src} alt="Preview" className="w-full h-full object-cover" />
              )}
              <button 
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
