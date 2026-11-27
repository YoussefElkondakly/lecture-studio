import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Segmented single choice built on native radios (fieldset + legend), so arrow keys,
 * screen readers and mobile behave natively. Options: [{ value, label, help? }]
 */
export function ChoiceGroup({ legend, name, value, onChange, options, error, help, className, columns }) {
  const id = useId()
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', className)} aria-describedby={error ? `${id}-err` : help ? `${id}-help` : undefined}>
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className={cn('grid gap-2', columns || (options.length <= 3 ? 'grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]'))}>
        {options.map((o) => {
          const checked = value === o.value
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal',
                checked ? 'border-navy bg-navy-tint' : 'border-input bg-surface hover:bg-subtle',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="mt-0.5 size-4 shrink-0 accent-[#153C63] focus-visible:outline-none"
              />
              <span className="flex flex-col">
                <span className={cn('font-semibold', checked ? 'text-navy' : 'text-foreground')}>{o.label}</span>
                {o.help && <span className="text-muted-foreground">{o.help}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {help && !error && <p id={`${id}-help`} className="text-sm text-muted-foreground">{help}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </fieldset>
  )
}
