import DOMPurify from 'dompurify'

// Database strings enter several legacy HTML print templates. Sanitize at the
// final sink, including event handlers, links, embedded frames, and scripts.
export function writePrintDocument(target, html) {
  if (!target) return
  target.opener = null
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'base', 'meta'],
    FORBID_ATTR: ['srcdoc'],
  })
  target.document.write(clean)
}
