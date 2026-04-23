import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-medium ring-offset-background transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1FF]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[#4FD1FF]/16 bg-[linear-gradient(180deg,#243040_0%,#1A2230_100%)] text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] hover:border-[#4FD1FF]/28 hover:-translate-y-0.5",
        destructive:
          "border border-red-500/18 bg-[linear-gradient(180deg,#322028_0%,#28171D_100%)] text-[#FFB8B8] shadow-[0_12px_30px_rgba(0,0,0,0.24)] hover:border-red-400/28 hover:-translate-y-0.5",
        outline:
          "border border-white/10 bg-[#171B22] text-[#DCE4EE] hover:border-[#4FD1FF]/22 hover:bg-[#1B212B] hover:-translate-y-0.5",
        secondary:
          "border border-white/8 bg-[#1A1F27] text-[#E7ECF3] shadow-[0_10px_24px_rgba(0,0,0,0.22)] hover:bg-[#202631] hover:-translate-y-0.5",
        ghost: "text-[#8D9AAF] hover:bg-white/[0.04] hover:text-[#E7ECF3]",
        link: "text-[#4FD1FF] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm sm:text-base min-h-[44px]",
        sm: "h-9 rounded-[12px] px-3 text-sm min-h-[36px]",
        lg: "h-12 sm:h-11 rounded-[12px] px-6 sm:px-8 text-base sm:text-lg min-h-[48px]",
        xl: "h-14 rounded-[16px] px-8 text-lg min-h-[56px]",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px]",
        mobile: "h-12 px-6 text-base min-w-[120px] min-h-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
