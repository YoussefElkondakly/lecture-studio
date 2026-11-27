import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function PageHeader({ title, description, actions, breadcrumbs, className, titleId }) {
  return (
    <header className={cn('flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((b, i) => (
                <li key={b.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight aria-hidden className="size-3.5" />}
                  {b.to ? <Link className="rounded-sm underline-offset-4 hover:text-foreground hover:underline" to={b.to}>{b.label}</Link> : <span aria-current="page">{b.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 id={titleId} className="font-serif text-2xl font-semibold tracking-[-0.01em] text-foreground md:text-[2rem] md:leading-[2.5rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[68ch] text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Bordered work surface. Not a decorative card — used where content needs a boundary. */
export function Panel({ title, description, actions, children, className, bodyClassName, as: As = 'section', headingLevel = 2, id }) {
  const H = `h${headingLevel}`
  const hid = useId()
  return (
    <As className={cn('rounded-xl border bg-surface', className)} aria-labelledby={title ? hid : undefined} id={id}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title && <H id={hid} className="text-lg font-semibold text-foreground">{title}</H>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </As>
  )
}

export function NativeSelect({ className, children, invalid, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-invalid={invalid || undefined}
        className="h-10 w-full appearance-none rounded-md border border-input bg-surface py-1 pr-10 pl-3 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive"
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, destructive, children }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive-solid' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <Empty className={cn('rounded-xl border border-dashed bg-surface/60 py-10', className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon aria-hidden />
          </EmptyMedia>
        )}
        <EmptyTitle className="font-serif text-lg">{title}</EmptyTitle>
        {description && <EmptyDescription className="text-sm">{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

/** Field label + control + help/error, wired with ids for screen readers. */
export function FormRow({ label, htmlFor, help, error, required, children, className, optional }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-invalid={error ? true : undefined}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="sr-only"> (required)</span>}
        {optional && <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>}
      </label>
      {children}
      {help && !error && <p id={`${htmlFor}-help`} className="text-sm text-muted-foreground">{help}</p>}
      {error && <p id={`${htmlFor}-error`} className="text-sm font-medium text-destructive" role="alert">{error}</p>}
    </div>
  )
}

export function describedBy(id, { help, error }) {
  return [help && !error ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
}

export function Disclosure({ summary, children, defaultOpen = false, className }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={className}>
      <Button type="button" variant="ghost" className="-ml-2 px-2" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <ChevronRight aria-hidden className={cn('transition-transform', open && 'rotate-90')} />
        {summary}
      </Button>
      <div id={id} hidden={!open} className="pt-2">{children}</div>
    </div>
  )
}

export function KeyValue({ items, className }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-2 text-sm', className)}>
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DemoTag({ children = 'Simulated', className }) {
  return (
    <span className={cn('inline-flex items-center rounded-sm border border-dashed border-[#7c8ea3] px-1.5 py-0.5 text-xs font-semibold text-muted-foreground', className)}>
      {children}
    </span>
  )
}
