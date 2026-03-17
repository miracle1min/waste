import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4FD1FF]/30 focus:ring-offset-2 focus:ring-offset-[#1A1C22]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#4FD1FF]/15 text-[#4FD1FF] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:bg-[#4FD1FF]/20",
        secondary:
          "border-transparent bg-[#9F7AEA]/15 text-[#9F7AEA] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:bg-[#9F7AEA]/20",
        destructive:
          "border-transparent bg-[#F87171]/15 text-[#F87171] shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:bg-[#F87171]/20",
        outline: "text-[#E5E7EB] border-[rgba(79,209,255,0.08)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
