export default function CertificateCropControls({ kind, value, onChange }) {
  const second = kind === 'certificate2'
  const prefix = second ? 'Second certificate ' : ''
  const update = changes => onChange({ ...value, ...changes })
  return <section className="crop-controls no-print" aria-label={`${second ? 'Second certificate' : 'Certificate'} crop settings`}>
    <div><h3>{second ? 'Crop second certificate' : 'Crop certificate'}</h3><p>Adjust the preview to keep the certificate text visible. Your original image stays unchanged.</p></div>
    <div className="crop-sliders">
      <label>{prefix}Zoom <input type="range" min="1" max="2.5" step="0.05" value={value.zoom} onChange={event => update({ zoom: Number(event.target.value) })} /></label>
      <label>{prefix}Horizontal position <input type="range" min="0" max="100" value={value.horizontal} onChange={event => update({ horizontal: Number(event.target.value) })} /></label>
      <label>{prefix}Vertical position <input type="range" min="0" max="100" value={value.vertical} onChange={event => update({ vertical: Number(event.target.value) })} /></label>
    </div>
    <label className="print-option"><input type="checkbox" checked={value.fitFull} onChange={event => update({ fitFull: event.target.checked, zoom: 1 })} />{second ? 'Fit the full second certificate inside the crop area' : 'Fit the full certificate inside the crop area'}</label>
  </section>
}
