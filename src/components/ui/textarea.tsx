import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[12px] border border-[rgba(79,209,255,0.06)] bg-[#1A1C22] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] px-3 py-2 text-base text-[#E5E7EB] placeholder:text-[#9CA3AF] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1FF]/20 focus-visible:border-[#4FD1FF]/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm uppercase",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
