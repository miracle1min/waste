import * as React from "react"

import { cn } from "@/lib/utils"

// Text input types that should display in UPPERCASE
const TEXT_TYPES = new Set(['text', 'search', 'tel', 'url', undefined]);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const isTextInput = TEXT_TYPES.has(type as string | undefined);
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[12px] bg-[#1A1C22] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] border border-[rgba(79,209,255,0.06)] px-3 py-2 text-base text-[#E5E7EB] ring-offset-[#1A1C22] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#E5E7EB] placeholder:text-[#6B7280] transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1FF]/20 focus-visible:border-[#4FD1FF]/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isTextInput && "uppercase",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
