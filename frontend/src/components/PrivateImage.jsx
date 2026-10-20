import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { fetchImage } from '../api/client'

export default function PrivateImage({ candidateId, kind, alt, onReady, student = false }) {
  const [source, setSource] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl
    fetchImage(student ? `/api/student/me/${kind}` : `/api/admin/candidates/${candidateId}/${kind}`, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [candidateId, kind, student])
  if (error) return <div className="image-error" role="alert"><ImageOff size={24} /><span>{error}</span></div>
  if (!source) return <div className="image-loading" role="status">Loading {kind}…</div>
  return <img className={`private-image ${kind}`} src={source} alt={alt} onLoad={onReady} onError={() => setError('The image could not be displayed.')} />
}
