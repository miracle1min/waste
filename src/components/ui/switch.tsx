import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)] transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1FF]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1C22] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#4FD1FF]/20 data-[state=unchecked]:bg-[#1A1C22]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full ring-0 transition-all duration-200 ease-in-out data-[state=unchecked]:bg-gradient-to-br data-[state=unchecked]:from-[#3A3D47] data-[state=unchecked]:to-[#2A2D37] data-[state=unchecked]:shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-[#4FD1FF] data-[state=checked]:to-[#3BB8E0] data-[state=checked]:shadow-[0_0_8px_rgba(79,209,255,0.3),4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
