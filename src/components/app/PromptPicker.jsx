import { Link } from 'react-router-dom'
import { useStore } from '@/state/store.jsx'
import { compatiblePrompts } from '@/engine/workflow.js'
import { PROMPT_STAGES } from '@/engine/constants.js'
import { Disclosure, NativeSelect } from './common.jsx'

/** Stage-filtered master prompt selector: only prompts whose active category maps to `stage`. */
export function PromptPicker({ stage, value, onChange, id, label, help, error, showDefaultHint = true }) {
  const { state } = useStore()
  const prompts = compatiblePrompts(state, stage)
  const byCat = new Map()
  for (const p of prompts) {
    const cat = state.categories.find((c) => c.id === p.categoryId)
    if (!byCat.has(cat.id)) byCat.set(cat.id, { cat, prompts: [] })
    byCat.get(cat.id).prompts.push(p)
  }
  const selected = prompts.find((p) => p.id === value)
  const version = selected && state.promptVersions.find((v) => v.id === selected.activeVersionId)
  const isDefault = selected && state.profile.stageDefaults[stage] === selected.id
  const stageLabel = PROMPT_STAGES.find((s) => s.id === stage)?.label
  const helpId = `${id}-help`
  const errId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label || `Prompt for ${stageLabel}`}</label>
      {prompts.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          No active prompts are mapped to {stageLabel}. <Link className="font-semibold text-navy underline" to="/prompts">Add or map one in Master prompts</Link>.
        </p>
      ) : (
        <NativeSelect
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          invalid={Boolean(error)}
          aria-describedby={[help ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined}
        >
          {!value && <option value="">Choose a prompt…</option>}
          {[...byCat.values()].map(({ cat, prompts: ps }) => (
            <optgroup key={cat.id} label={cat.name}>
              {ps.map((p) => {
                const v = state.promptVersions.find((x) => x.id === p.activeVersionId)
                return (
                  <option key={p.id} value={p.id}>
                    {p.title} — v{v.version}{state.profile.stageDefaults[stage] === p.id ? ' (default)' : ''}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </NativeSelect>
      )}
      {help && !error && <p id={helpId} className="text-sm text-muted-foreground">{help}</p>}
      {error && <p id={errId} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      {selected && version && (
        <div className="rounded-md bg-subtle px-3 py-2">
          <p className="text-sm">
            <span className="font-semibold">{version.title}</span>
            <span className="text-muted-foreground"> · version {version.version} · {state.categories.find((c) => c.id === selected.categoryId)?.name}</span>
            {showDefaultHint && isDefault && <span className="text-muted-foreground"> · your saved default</span>}
          </p>
          <Disclosure summary="Preview prompt text" className="mt-1">
            <pre className="max-h-56 overflow-auto rounded-md border bg-surface p-3 font-sans text-sm whitespace-pre-wrap text-foreground">{version.body}</pre>
            <p className="mt-2 text-sm text-muted-foreground">This exact version is saved with the lecture. Later edits to the prompt create new versions and never change this lecture.</p>
          </Disclosure>
        </div>
      )}
    </div>
  )
}
