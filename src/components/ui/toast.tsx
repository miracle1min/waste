import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle2, AlertTriangle, Info, XCircle, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[16px] border p-4 pr-8 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default:
          "bg-[#23262F]/95 border-[rgba(79,209,255,0.15)] text-[#E5E7EB] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(79,209,255,0.05),inset_0_1px_0_rgba(255,255,255,0.05)]",
        destructive:
          "destructive bg-[#1A1C22]/95 border-[#F87171]/25 text-[#F87171] shadow-[0_8px_32px_rgba(248,113,113,0.15),0_0_0_1px_rgba(248,113,113,0.1),inset_0_1px_0_rgba(255,255,255,0.03)]",
        success:
          "success bg-[#1A1C22]/95 border-[#34D399]/25 text-[#34D399] shadow-[0_8px_32px_rgba(52,211,153,0.15),0_0_0_1px_rgba(52,211,153,0.1),inset_0_1px_0_rgba(255,255,255,0.03)]",
        warning:
          "warning bg-[#1A1C22]/95 border-[#FBBF24]/25 text-[#FBBF24] shadow-[0_8px_32px_rgba(251,191,36,0.15),0_0_0_1px_rgba(251,191,36,0.1),inset_0_1px_0_rgba(255,255,255,0.03)]",
        info:
          "info bg-[#1A1C22]/95 border-[#4FD1FF]/25 text-[#4FD1FF] shadow-[0_8px_32px_rgba(79,209,255,0.15),0_0_0_1px_rgba(79,209,255,0.1),inset_0_1px_0_rgba(255,255,255,0.03)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const glowColors: Record<string, string> = {
  default: "from-[#4FD1FF] via-[#A78BFA] to-[#4FD1FF]",
  destructive: "from-[#F87171] via-[#FB923C] to-[#F87171]",
  success: "from-[#34D399] via-[#6EE7B7] to-[#34D399]",
  warning: "from-[#FBBF24] via-[#FDE68A] to-[#FBBF24]",
  info: "from-[#4FD1FF] via-[#818CF8] to-[#4FD1FF]",
}

const variantIcons: Record<string, React.ReactNode> = {
  default: <Sparkles className="h-5 w-5 text-[#4FD1FF] shrink-0 mt-0.5" />,
  destructive: <XCircle className="h-5 w-5 text-[#F87171] shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="h-5 w-5 text-[#34D399] shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-5 w-5 text-[#FBBF24] shrink-0 mt-0.5" />,
  info: <Info className="h-5 w-5 text-[#4FD1FF] shrink-0 mt-0.5" />,
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & { icon?: React.ReactNode; showProgress?: boolean }
>(({ className, variant, icon, showProgress = true, duration = 5000, children, ...props }, ref) => {
  const v = (variant ?? "default") as string
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      duration={duration}
      {...props}
    >
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-80",
        glowColors[v] || glowColors.default
      )} />

      {icon !== null && (icon || variantIcons[v])}

      <div className="flex-1 min-w-0">
        {children}
      </div>

      {showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/20 overflow-hidden">
          <div
            className={cn(
              "h-full bg-gradient-to-r opacity-60 animate-toast-progress",
              glowColors[v] || glowColors.default
            )}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(79,209,255,0.15)] bg-[rgba(79,209,255,0.05)] px-3 text-sm font-medium text-[#4FD1FF] transition-all hover:bg-[rgba(79,209,255,0.1)] hover:shadow-[0_0_12px_rgba(79,209,255,0.2)] focus:outline-none focus:ring-2 focus:ring-[#4FD1FF]/30 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-[#F87171]/30 group-[.destructive]:text-[#F87171] group-[.destructive]:hover:bg-[#F87171]/10 group-[.success]:border-[#34D399]/30 group-[.success]:text-[#34D399] group-[.success]:hover:bg-[#34D399]/10",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-[8px] p-1 text-[#9CA3AF] opacity-0 transition-all hover:text-[#E5E7EB] hover:bg-white/5 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#4FD1FF]/30 group-hover:opacity-100 group-[.destructive]:text-[#F87171]/70 group-[.destructive]:hover:text-[#F87171] group-[.success]:text-[#34D399]/70 group-[.success]:hover:text-[#34D399]",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-bold tracking-wide", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm text-[#9CA3AF] leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
