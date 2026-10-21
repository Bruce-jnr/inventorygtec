import multer from 'multer'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

export const MAX_SAVED_IMAGE_BYTES = 3 * 1024 * 1024

export function uploadMiddleware(maxBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 3, fields: 8, fieldSize: 1024, parts: 11 },
    fileFilter(req, file, callback) {
      if (!['image/jpeg', 'image/png'].includes(file.mimetype)) return callback(Object.assign(new Error('Only JPEG and PNG images are supported.'), { status: 415 }))
      callback(null, true)
    },
  }).fields([{ name: 'passport', maxCount: 1 }, { name: 'certificate', maxCount: 1 }, { name: 'certificate2', maxCount: 1 }])
}

export async function normalizeImage(file) {
  const bytes = file.buffer
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if ((!isPng && !isJpeg) || (isPng && file.mimetype !== 'image/png') || (isJpeg && file.mimetype !== 'image/jpeg')) {
    throw Object.assign(new Error('The uploaded file is not a valid JPEG or PNG image.'), { status: 415 })
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' }).rotate()
    for (const { size, quality } of [
      { size: 2400, quality: 90 },
      { size: 2400, quality: 80 },
      { size: 2400, quality: 70 },
      { size: 2000, quality: 70 },
      { size: 1600, quality: 70 },
    ]) {
      const buffer = await image.clone()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#fff' })
        .jpeg({ quality }).toBuffer()
      if (buffer.length <= MAX_SAVED_IMAGE_BYTES) return buffer
    }
  } catch {
    throw Object.assign(new Error('This image could not be read. Choose a valid JPEG or PNG image.'), { status: 415 })
  }
  throw Object.assign(new Error('This image could not be compressed below 3 MB. Choose a smaller image.'), { status: 413 })
}

export async function saveImages(files, directory) {
  const paths = []
  try {
    const buffers = await Promise.all(['passport', 'certificate', 'certificate2'].filter(kind => files?.[kind]?.[0]).map(kind => normalizeImage(files[kind][0])))
    for (const buffer of buffers) {
      const filename = `${randomUUID()}.jpg`
      const fullPath = path.join(directory, filename)
      await writeFile(fullPath, buffer, { flag: 'wx', mode: 0o600 })
      paths.push(fullPath)
    }
    return paths.map(filename => path.basename(filename))
  } catch (error) {
    await Promise.all(paths.map(filename => unlink(filename).catch(() => {})))
    throw error
  }
}
