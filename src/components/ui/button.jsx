import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-55 aria-disabled:opacity-55 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.1em]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-navy-deep",
        accent: "bg-teal text-white hover:bg-teal-strong",
        outline:
          "border-input bg-surface text-foreground hover:bg-navy-tint hover:border-primary/60 aria-expanded:bg-navy-tint",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[#dbe5ef] aria-expanded:bg-[#dbe5ef]",
        ghost:
          "text-foreground hover:bg-navy-tint aria-expanded:bg-navy-tint",
        destructive:
          "border-destructive/40 bg-surface text-destructive hover:bg-blocked-bg",
        "destructive-solid":
          "bg-destructive text-white hover:bg-[#912018]",
        link: "h-auto px-0 text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary",
      },
      size: {
        default: "h-10 gap-2 px-4 text-sm",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs",
        sm: "h-9 gap-1.5 px-3 text-sm",
        lg: "h-11 gap-2 px-5 text-base",
        icon: "size-10",
        "icon-xs": "size-7 rounded-sm",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
