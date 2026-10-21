import { useEffect, useRef } from 'react'

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export default function CertificateCropControls({ enabled, kind, value, onChange, children }) {
  const areaRef = useRef(null)
  const pointers = useRef(new Map())
  const label = kind === 'certificate2' ? 'Second certificate' : 'Certificate'

  function bounded(next) {
    const area = areaRef.current
    const image = area?.querySelector('img')
    if (!image?.naturalWidth) return next
    const { width, height } = area.getBoundingClientRect()
    const fit = next.fitFull ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : Math.max(width / image.naturalWidth, height / image.naturalHeight)
    const limitX = Math.abs(image.naturalWidth * fit * next.zoom / width - 1) / 2
    const limitY = Math.abs(image.naturalHeight * fit * next.zoom / height - 1) / 2
    return { ...next, x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) }
  }

  function zoom(factor) {
    onChange(bounded({ ...value, zoom: clamp(value.zoom * factor, 1, 4) }))
  }

  useEffect(() => {
    if (!enabled) return
    const area = areaRef.current
    function wheel(event) {
      event.preventDefault()
      zoom(Math.exp(-event.deltaY * 0.002))
    }
    area.addEventListener('wheel', wheel, { passive: false })
    return () => area.removeEventListener('wheel', wheel)
  })

  function move(event) {
    if (!pointers.current.has(event.pointerId)) return
    const before = [...pointers.current.values()]
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const after = [...pointers.current.values()]
    const center = points => ({ x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length })
    const previous = center(before)
    const next = center(after)
    const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    const factor = before.length === 2 && distance(before) > 0 ? distance(after) / distance(before) : 1
    const bounds = areaRef.current.getBoundingClientRect()
    onChange(bounded({ ...value, zoom: clamp(value.zoom * factor, 1, 4), x: value.x + (next.x - previous.x) / bounds.width, y: value.y + (next.y - previous.y) / bounds.height }))
  }

  if (!enabled) return <div>{children}</div>
  return <>
    <section className="certificate-adjustments no-print" aria-label={`${label} crop settings`}>
      <p>Drag to position. Pinch or scroll to zoom. Your original image stays unchanged.</p>
      <div className="certificate-zoom-buttons">
        <button type="button" className="secondary-button" aria-label={`Zoom out ${label.toLowerCase()}`} disabled={value.zoom <= 1} onClick={() => zoom(1 / 1.2)}>?</button>
        <span>{Math.round(value.zoom * 100)}%</span>
        <button type="button" className="secondary-button" aria-label={`Zoom in ${label.toLowerCase()}`} disabled={value.zoom >= 4} onClick={() => zoom(1.2)}>+</button>
        <button type="button" className="text-button" onClick={() => onChange({ zoom: 1, x: 0, y: 0, fitFull: true })}>Reset</button>
      </div>
      <label className="print-option"><input type="checkbox" checked={value.fitFull} onChange={event => onChange({ zoom: 1, x: 0, y: 0, fitFull: event.target.checked })} />Fit the full {label.toLowerCase()} inside the crop area</label>
    </section>
    <div ref={areaRef} className="certificate-crop interactive-certificate" tabIndex={0} role="group" aria-label={`${label} crop area. Drag or use arrow keys to position.`}
      style={{ '--certificate-zoom': value.zoom, '--certificate-pan-x': `${value.x * 100}%`, '--certificate-pan-y': `${value.y * 100}%`, '--certificate-fit': value.fitFull ? 'contain' : 'cover' }}
      onPointerDown={event => {
        if (event.button !== 0 || pointers.current.size >= 2) return
        event.currentTarget.setPointerCapture(event.pointerId)
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }}
      onPointerMove={move}
      onPointerUp={event => pointers.current.delete(event.pointerId)}
      onPointerCancel={event => pointers.current.delete(event.pointerId)}
      onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      onDragStart={event => event.preventDefault()}
      onKeyDown={event => {
        const offsets = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }
        if (!offsets[event.key]) return
        event.preventDefault()
        const [x, y] = offsets[event.key]
        onChange(bounded({ ...value, x: value.x + x, y: value.y + y }))
      }}
    >{children}</div>
  </>
}
