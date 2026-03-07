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
                  "text-sm font-semibold tracking-wide",
                  isCurrent ? "text-cyan-400" : isCompleted ? "text-emerald-400" : "text-muted-foreground"
                )}>
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-slate-500">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Show active and completed steps */}
      <div className="hidden sm:flex items-center justify-center w-full">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;

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
                    "text-xs font-semibold tracking-wide",
                    isCurrent ? "text-cyan-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
                  )}>
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[80px] leading-tight">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              {!isLast(index, steps, currentStep, completedSteps) && isCompleted && (
                <div className="h-px mx-4 w-8 bg-gradient-to-r from-emerald-500/50 to-emerald-500/20" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isLast(index: number, steps: { id: string }[], currentStep: string, completedSteps: string[]) {
  const isCurrent = currentStep === steps[index].id;
  if (isCurrent) return true;
  // Check if this is the last visible step
  const remaining = steps.slice(index + 1);
  return !remaining.some(s => completedSteps.includes(s.id) || s.id === currentStep);
}
