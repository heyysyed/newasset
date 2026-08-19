/**
 * validatePersonPhoto
 * Two-stage face check:
 *   1. Native FaceDetector API (Chrome/Edge) — fastest
 *   2. Skin-tone pixel analysis — universal fallback, covers all browsers
 *
 * Throws a user-facing Error if no person is detected.
 */
export async function validatePersonPhoto(file) {
  // Stage 1 — try native FaceDetector
  if ('FaceDetector' in window) {
    let bitmap
    try {
      bitmap = await createImageBitmap(file)
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
      const faces = await detector.detect(bitmap)
      if (faces.length > 0) return   // confirmed face, done
      // 0 faces from API → fall through to skin-tone check
    } catch {
      // API unavailable or errored → fall through
    } finally {
      bitmap?.close()
    }
  }

  // Stage 2 — skin-tone pixel analysis (works in every browser)
  const pixels = await samplePixels(file, 220)
  const { total, skin } = pixels

  if (skin / total < 0.05) {
    throw new Error(
      'No person detected. Please upload a clear photo of your face ' +
      '(front-facing, good lighting).'
    )
  }
}

/**
 * validateSignatureImage
 * Pixel analysis that a valid signature must pass:
 *   ✔ ≥ 50 % near-white background  (light paper)
 *   ✔ ≥ 1 % dark pixels             (visible ink)
 *   ✔ < 12 % saturated/colourful px (not a colourful photo)
 *   ✔ < 5 % skin-tone pixels        (not a selfie/portrait)
 *
 * Throws a user-facing Error if any check fails.
 */
export async function validateSignatureImage(file) {
  const { total, light, dark, colorful, skin } = await samplePixels(file, 300)

  if (skin / total > 0.05) {
    throw new Error(
      'This looks like a photo, not a signature. ' +
      'Please upload a scanned or photographed signature on white paper.'
    )
  }
  if (light / total < 0.50) {
    throw new Error(
      'Signature image must have a white/light background (≥ 50 % white). ' +
      'Please scan your signature on plain white paper.'
    )
  }
  if (colorful / total > 0.12) {
    throw new Error(
      'Too many colours detected. ' +
      'Please upload a black or blue ink signature on a plain white background.'
    )
  }
  if (dark / total < 0.01) {
    throw new Error(
      'No signature marks found. ' +
      'Please make sure your signature is clearly visible in the image.'
    )
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Draws the file onto a small canvas (max `size` px on longest side)
 * and counts pixel categories.
 */
function samplePixels(file, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = ev => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read image file.'))
      img.onload = () => {
        const scale  = Math.min(1, size / Math.max(img.width, img.height, 1))
        const w      = Math.max(1, Math.floor(img.width  * scale))
        const h      = Math.max(1, Math.floor(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx    = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)

        const { data } = ctx.getImageData(0, 0, w, h)
        const total = w * h
        let light = 0, dark = 0, colorful = 0, skin = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const luma = (r * 299 + g * 587 + b * 114) / 1000
          const max  = Math.max(r, g, b)
          const sat  = max === 0 ? 0 : (max - Math.min(r, g, b)) / max

          if (luma > 200 && sat < 0.15)              light++
          if (luma < 80)                              dark++
          if (sat > 0.30 && luma > 50 && luma < 220) colorful++
          if (isSkinPixel(r, g, b))                  skin++
        }

        resolve({ total, light, dark, colorful, skin })
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Skin-tone classifier covering Fitzpatrick scale types 1–6.
 * Returns true if the RGB triplet is plausibly human skin.
 */
function isSkinPixel(r, g, b) {
  // Reject near-black and near-white
  if (r < 20 || g < 10 || b < 5)           return false
  if (r > 250 && g > 250 && b > 250)        return false
  // Red must be the dominant channel (warm skin bias)
  if (r <= g || r <= b)                     return false

  // Light skin (Fitzpatrick 1–2)
  if (r > 195 && g > 145 && b > 95 && (r - g) < 55 && (r - g) > 4)  return true
  // Medium skin (Fitzpatrick 3–4)
  if (r > 115 && g > 65  && b > 25  && (r - g) > 10 && (r - b) > 15 && r < 225) return true
  // Dark skin (Fitzpatrick 5–6)
  if (r > 55  && g > 25  && b > 8   && (r - g) > 7  && (r - b) > 10 && r < 150) return true

  return false
}
