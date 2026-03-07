import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepWizardProps {
  steps: {
    id: string;
    title: string;
    description?: string;
  }[];
  currentStep: string;
  completedSteps: string[];
  className?: string;
}

export function StepWizard({ steps, currentStep, completedSteps, className }: StepWizardProps) {
  return (
    <div className={cn("w-full max-w-4xl mx-auto mb-6 sm:mb-8", className)}>
      {/* Mobile: Show only current step */}
      <div className="block sm:hidden">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;

          // Only show current step on mobile
          if (!isCurrent) return null;

          return (
            <div key={step.id} className="flex items-center space-x-3 justify-center">
              <div
                className={cn(
                  "step-indicator flex-shrink-0",
                  isCompleted && "completed",
                  isCurrent && "active",
                  !isCompleted && !isCurrent && "inactive"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-sm font-medium",
                  isCurrent ? "text-primary" : isCompleted ? "text-success" : "text-muted-foreground"
                )}>
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Show only active and completed steps */}
      <div className="hidden sm:flex items-center justify-center w-full">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isLast = index === steps.length - 1;

          // Only show completed or current steps on desktop
          if (!isCompleted && !isCurrent) return null;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "step-indicator",
                    isCompleted && "completed",
                    isCurrent && "active",
                    !isCompleted && !isCurrent && "inactive"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-xs font-medium",
                    isCurrent ? "text-primary" : isCompleted ? "text-success" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[80px] leading-tight">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && !isCurrent && isCompleted && (
                <div
                  className={cn(
                    "h-px mx-4 w-8 transition-colors duration-200",
                    "bg-success"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}