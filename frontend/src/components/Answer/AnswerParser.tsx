import { cloneDeep } from 'lodash'

import { AskResponse, Citation } from '../../api'

export type ParsedAnswer = {
  citations: Citation[]
  cleanText: string,
  citedText: string | null,
  generated_chart: string | null
} | null

const citationPattern = /\[(doc\d\d?\d?)]/g

const stripCitationMarkers = (answerText: string) => {
  return answerText
    .replace(/\s*\[(doc\d\d?\d?)]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const enumerateCitations = (citations: Citation[]) => {
  const filepathMap = new Map()
  for (const citation of citations) {
    const { filepath } = citation
    let part_i = 1
    if (filepathMap.has(filepath)) {
      part_i = filepathMap.get(filepath) + 1
    }
    filepathMap.set(filepath, part_i)
    citation.part_index = part_i
  }
  return citations
}

export function parseAnswer(answer: AskResponse): ParsedAnswer {
  const legacyAnswer = typeof answer.answer === 'string' ? answer.answer : ''
  const citedText = answer.answer_cited ?? legacyAnswer
  const cleanText = stripCitationMarkers(answer.answer_clean ?? legacyAnswer)

  if (!cleanText && !citedText) return null

  const citationLinks = citedText.match(citationPattern)

  const lengthDocN = '[doc'.length

  let filteredCitations = [] as Citation[]
  let citationReindex = 0
  citationLinks?.forEach(link => {
    const citationIndex = link.slice(lengthDocN, link.length - 1)
    const citation = cloneDeep(answer.citations[Number(citationIndex) - 1]) as Citation
    if (citation && !filteredCitations.find(c => c.id === citationIndex)) {
      citation.id = citationIndex // original doc index to de-dupe
      citation.reindex_id = (++citationReindex).toString()
      filteredCitations.push(citation)
    }
  })

  if (!filteredCitations.length && answer.citations.length > 0) {
    filteredCitations = cloneDeep(answer.citations)
  }

  filteredCitations = enumerateCitations(filteredCitations)

  return {
    citations: filteredCitations,
    cleanText,
    citedText: citedText || null,
    generated_chart: answer.generated_chart
  }
}
