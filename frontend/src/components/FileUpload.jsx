import { useEffect, useRef, useState } from 'react'
import { ImagePlus, FileImage, X, Upload } from 'lucide-react'

export default function FileUpload({ name, label, help, file, onChange, error, maxBytes, disabled, required = true, existingImage }) {
  const previewRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (previewRef.current) previewRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  function choose(selected) {
    if (!selected) return
    if (!['image/jpeg', 'image/png'].includes(selected.type)) return onChange(null, 'Choose a JPG or PNG image.')
    if (selected.size > maxBytes) return onChange(null, `The image must be ${maxBytes / 1024 / 1024} MB or smaller.`)
    onChange(selected, '')
  }
  const Icon = name === 'passport' ? ImagePlus : FileImage
  return <div className="upload-field"><label htmlFor={name}>{label} {required ? <span className="required">*</span> : <span className="optional-label">(optional)</span>}</label><p className="field-help" id={`${name}-help`}>{help}</p>
    <div className={`upload-box ${file ? 'has-file' : ''} ${dragging ? 'dragging' : ''} ${error ? 'invalid' : ''}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) choose(event.dataTransfer.files[0]) }}>
      {!file && existingImage && <div className="saved-upload">{existingImage}<span>Saved image · Click to replace</span></div>}
      {file ? <><img ref={previewRef} alt={`${label} preview`} /><div className="uploaded-info"><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · Ready to upload</span></div><button className="remove-file" disabled={disabled} type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange(null, '')}><X size={16} /></button></> : <><span className="upload-icon"><Icon size={23} strokeWidth={1.5} /></span><strong><span>Click to upload</span> or drag and drop</strong><small>JPG or PNG · Max {maxBytes / 1024 / 1024} MB</small><Upload className="upload-arrow" size={16} /></>}
      <input id={name} name={name} type="file" accept="image/jpeg,image/png" disabled={disabled} aria-required={required} aria-invalid={Boolean(error)} aria-describedby={`${name}-help ${name}-error`} onChange={event => { choose(event.target.files[0]); event.target.value = '' }} />
    </div><span id={`${name}-error`} className="field-error">{error}</span>{!required && error && <button className="text-button" type="button" disabled={disabled} onClick={() => onChange(null, '')}>Continue without this certificate</button>}
  </div>
}

