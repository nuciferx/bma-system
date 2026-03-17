/**
 * Thai text normalization for flexible search
 * lib/utils/thaiNormalize.ts
 */

export function normalize(text: string): string {
  if (!text) return ''

  let result = text.toLowerCase().trim()

  // บริษัท / ห้างหุ้นส่วน
  result = result.replace(/บจก/g, 'บริษัท จำกัด')
  result = result.replace(/หจก/g, 'ห้างหุ้นส่วนจำกัด')
  result = result.replace(/บ\.จ\.ก\./g, 'บริษัท จำกัด')
  result = result.replace(/หจ\.ก\./g, 'ห้างหุ้นส่วนจำกัด')

  // BE year shorthand: "13/67" → "13/2567"
  result = result.replace(/(\d+)\/(\d{2})(?!\d)/g, (match, num1, year) => {
    const yearNum = parseInt(year, 10)
    if (yearNum < 100) return `${num1}/${yearNum + 2500}`
    return match
  })

  result = result.replace(/\s+/g, ' ')
  return result
}

export function searchMatch(query: string, target: string): boolean {
  if (!query || !target) return false
  return normalize(target).includes(normalize(query))
}
