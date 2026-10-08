export function csvReport(rows, columns) {
  const cell = value => {
    let text=String(value??'')
    // Prevent spreadsheet formula execution, including whitespace-prefixed formulas.
    if (/^[\s]*[=+@-]/.test(text)) text="'"+text
    return '"'+text.replaceAll('"','""')+'"'
  }
  return [columns.map(cell).join(','), ...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')
}
export function validateRecipients(recipients) {
  if (!Array.isArray(recipients) || recipients.length<1 || recipients.length>20 || recipients.some(email=>typeof email!=='string'||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(email))) throw new Error('Enter between 1 and 20 valid email addresses.')
  return [...new Set(recipients)]
}
