// Real, downloadable text exports of synthetic artifacts (Markdown, transcripts, manifest).
import { last } from '@/engine/util.js'

export function storyboardMarkdown(project, sb) {
  const lines = [`# Storyboard — ${project.title}`, '', `Version v${sb.version} · synthetic demonstration content`, '', '| Scene | Heading | Seconds | On-screen text | Visual |', '| --- | --- | --- | --- | --- |']
  sb.scenes.forEach((s) => lines.push(`| ${s.id} | ${s.heading} | ${s.seconds} | ${s.onScreen} | ${s.visual}${s.notes ? ` (${s.notes})` : ''} |`))
  return lines.join('\n')
}

export function transcriptsText(project) {
  return project.plan.chunks.map((c) => {
    const t = last(project.artifacts.transcripts[c.id] || [])
    return `=== transcript_${c.id}.txt (v${t?.version ?? '—'}, ${c.window}, target ${c.targetSeconds}s) ===\n${t?.text ?? '(not generated)'}`
  }).join('\n\n')
}

export function chunkManifest(project) {
  return JSON.stringify({
    project: project.id,
    title: project.title,
    narrator_mode: project.prefs.speakerMode,
    language: project.prefs.language,
    synthetic: true,
    chunks: project.plan.chunks.map((c) => {
      const t = last(project.artifacts.transcripts[c.id] || [])
      const a = last(project.artifacts.audio[c.id] || [])
      return {
        id: c.id, start: c.window.split('–')[0], end: c.window.split('–')[1], target_seconds: c.targetSeconds,
        transcript_file: c.transcriptFile, transcript_version: t?.version ?? null,
        audio_file: c.audioFile, audio_version: a?.version ?? null, measured_seconds: a?.measuredSeconds ?? null,
        final_short_chunk_exception: c.finalShortException,
      }
    }),
  }, null, 2)
}

export function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'lecture'
}
