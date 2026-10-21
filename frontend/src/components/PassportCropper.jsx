import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
function constrain(crop, image) {
  const zoom = clamp(crop.zoom, 1, 4)
  const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom
  return { zoom, x: clamp(crop.x, 0, image.naturalWidth - side), y: clamp(crop.y, 0, image.naturalHeight - side) }
}
function zoomAround(crop, factor, point, image) {
  const side = Math.min(image.naturalWidth, image.naturalHeight) / crop.zoom
  const zoom = clamp(crop.zoom * factor, 1, 4)
  const nextSide = Math.min(image.naturalWidth, image.naturalHeight) / zoom
  return constrain({ zoom, x: crop.x + point.x * (side - nextSide), y: crop.y + point.y * (side - nextSide) }, image)
}

export default function PassportCropper({ file, maxBytes, onSave, onCancel }) {
  const dialogRef = useRef(null)
  const canvasRef = useRef(null)
  const [image, setImage] = useState(null)
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 })
  const pointers = useRef(new Map())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const activeRef = useRef(false)

  useEffect(() => {
    activeRef.current = true
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    dialog.showModal()
    const url = URL.createObjectURL(file)
    const source = new Image()
    let active = true
    source.onload = () => {
      if (!active) return
      const side = Math.min(source.naturalWidth, source.naturalHeight)
      setCrop({ zoom: 1, x: (source.naturalWidth - side) / 2, y: (source.naturalHeight - side) / 2 })
      setImage(source)
    }
    source.onerror = () => { if (active) setError('This image could not be opened. Choose another JPG or PNG photo.') }
    source.src = url
    return () => {
      active = false
      activeRef.current = false
      URL.revokeObjectURL(url)
      dialog.close()
      previousFocus?.focus()
    }
  }, [file])

  useEffect(() => {
    if (!image) return
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const side = Math.min(image.naturalWidth, image.naturalHeight) / crop.zoom
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, crop.x, crop.y, side, side, 0, 0, canvas.width, canvas.height)
  }, [image, crop])

  useEffect(() => {
    const canvas = canvasRef.current
    function wheel(event) {
      event.preventDefault()
      if (!image || savingRef.current) return
      const bounds = canvas.getBoundingClientRect()
      const point = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height }
      setCrop(old => zoomAround(old, Math.exp(-event.deltaY * 0.002), point, image))
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => canvas.removeEventListener('wheel', wheel)
  }, [image])

  function move(event) {
    if (!image || savingRef.current || !pointers.current.has(event.pointerId)) return
    const before = [...pointers.current.values()]
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const after = [...pointers.current.values()]
    const center = points => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length })
    const previous = center(before)
    const next = center(after)
    const bounds = event.currentTarget.getBoundingClientRect()
    const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    const factor = before.length === 2 && distance(before) > 0 ? distance(after) / distance(before) : 1
    setCrop(old => {
      const scaled = zoomAround(old, factor, { x: (previous.x - bounds.left) / bounds.width, y: (previous.y - bounds.top) / bounds.height }, image)
      const side = Math.min(image.naturalWidth, image.naturalHeight) / scaled.zoom
      return constrain({ ...scaled, x: scaled.x - (next.x - previous.x) * side / bounds.width, y: scaled.y - (next.y - previous.y) * side / bounds.height }, image)
    })
  }

  function keyboard(event) {
    if (!image || savingRef.current) return
    const offsets = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
    if (!offsets[event.key]) return
    event.preventDefault()
    const [x, y] = offsets[event.key]
    setCrop(old => constrain({ ...old, x: old.x + x * 10, y: old.y + y * 10 }, image))
  }

  function save() {
    if (!image || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    canvasRef.current.toBlob(blob => {
      if (!activeRef.current) return
      savingRef.current = false
      setSaving(false)
      if (!blob || blob.size > maxBytes) {
        setError('The cropped photo could not be saved. Try another photo.')
        return
      }
      onSave(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return createPortal(
    <dialog ref={dialogRef} className="passport-crop-dialog" aria-labelledby="passport-crop-title" aria-describedby="passport-crop-help" onCancel={event => { event.preventDefault(); if (!savingRef.current) onCancel() }}>
      <h2 id="passport-crop-title">Position your passport photo</h2>
      <p id="passport-crop-help">Drag your photo to position it. Pinch or scroll to zoom. Only the square area below will be uploaded.</p>
      <canvas ref={canvasRef} width="600" height="600" className="passport-crop-preview" tabIndex={0} role="img" aria-label="Passport crop preview. Drag or use arrow keys to position the photo." aria-describedby="passport-crop-help"
        onPointerDown={event => {
          if (!image || savingRef.current || event.button !== 0 || pointers.current.size >= 2) return
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }}
        onPointerMove={move}
        onPointerUp={event => pointers.current.delete(event.pointerId)}
        onPointerCancel={event => pointers.current.delete(event.pointerId)}
        onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
        onKeyDown={keyboard}
      />
      {!image && !error && <p role="status">Loading photo…</p>}
      <div className="passport-crop-zoom">
        <button type="button" className="secondary-button" aria-label="Zoom out" disabled={!image || saving || crop.zoom <= 1} onClick={() => setCrop(old => zoomAround(old, 1 / 1.2, { x: 0.5, y: 0.5 }, image))}>−</button>
        <span>{Math.round(crop.zoom * 100)}%</span>
        <button type="button" className="secondary-button" aria-label="Zoom in" disabled={!image || saving || crop.zoom >= 4} onClick={() => setCrop(old => zoomAround(old, 1.2, { x: 0.5, y: 0.5 }, image))}>+</button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="passport-crop-actions">
        <button type="button" className="secondary-button" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-button" disabled={!image || saving} onClick={save}>{saving ? 'Saving…' : 'Use this photo'}</button>
      </div>
    </dialog>, document.body,
  )
}
