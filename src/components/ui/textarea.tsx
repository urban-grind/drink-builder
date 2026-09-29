import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-2xl border border-[#d5d1c9] bg-white px-4 py-3 text-base text-[#274b3a] transition-colors outline-none placeholder:text-[#3f5d4e] focus-visible:border-[#274b3a] focus-visible:ring-3 focus-visible:ring-[#274b3a]/30 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
