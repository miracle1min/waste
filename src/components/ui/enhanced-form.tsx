import { useCallback, useMemo } from "react";
import { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'datetime-local';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  disabled?: boolean;
  rows?: number; // for textarea
  min?: number; // for number inputs
  max?: number; // for number inputs
  step?: string; // for number inputs
  description?: string;
}

interface EnhancedFormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  fields: FormFieldConfig[];
  onSubmit: (data: T) => void | Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitSuccess?: boolean;
  submitError?: string;
  resetButton?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function EnhancedForm<T extends FieldValues>({
  form,
  fields,
  onSubmit,
  submitLabel = "Submit",
  isSubmitting = false,
  submitSuccess = false,
  submitError,
  resetButton = true,
  className = "",
  children
}: EnhancedFormProps<T>) {

  const handleSubmit = useCallback(async (data: T) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [onSubmit]);

  const handleReset = useCallback(() => {
    form.reset();
  }, [form]);

  // Memoized field components for performance
  const formFields = useMemo(() => {
    return fields.map((field) => (
      <FormField
        key={field.name}
        control={form.control}
        name={field.name as Path<T>}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormControl>
              {field.type === 'select' ? (
                <Select 
                  value={formField.value || ''} 
                  onValueChange={formField.onChange}
                  disabled={field.disabled || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'textarea' ? (
                <Textarea
                  {...formField}
                  placeholder={field.placeholder}
                  disabled={field.disabled || isSubmitting}
                  rows={field.rows || 3}
                />
              ) : (
                <Input
                  {...formField}
                  type={field.type}
                  placeholder={field.placeholder}
                  disabled={field.disabled || isSubmitting}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={formField.value || ''}
                />
              )}
            </FormControl>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    ));
  }, [fields, form.control, isSubmitting]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={`space-y-4 ${className}`}>
        
        {/* Success Alert */}
        {submitSuccess && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Data berhasil disimpan!
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {formFields}
        </div>

        {/* Additional Children */}
        {children}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              submitLabel
            )}
          </Button>
          
          {resetButton && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSubmitting}
            >
              Reset
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

// Performance optimized memo wrapper
export const MemoizedEnhancedForm = <T extends FieldValues>(props: EnhancedFormProps<T>) => {
  const MemoizedForm = useMemo(() => {
    return function MemoForm() {
      return <EnhancedForm {...props} />;
    };
  }, [props.fields, props.isSubmitting, props.submitSuccess, props.submitError]);

  return <MemoizedForm />;
};