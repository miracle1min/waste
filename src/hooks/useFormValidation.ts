import { useCallback } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

/**
 * Enhanced form validation hook with better error handling and validation rules
 */

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | boolean;
}

export interface ValidationRules {
  [fieldName: string]: ValidationRule;
}

export function useFormValidation<T extends Record<string, any>>(
  form: UseFormReturn<T>,
  rules?: ValidationRules
) {
  
  const validateField = useCallback((fieldName: string, value: any): string | null => {
    if (!rules || !rules[fieldName]) return null;
    
    const rule = rules[fieldName];
    
    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${fieldName} wajib diisi`;
    }
    
    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }
    
    // Min length/value validation
    if (rule.min !== undefined) {
      if (typeof value === 'string' && value.length < rule.min) {
        return `${fieldName} minimal ${rule.min} karakter`;
      }
      if (typeof value === 'number' && value < rule.min) {
        return `${fieldName} minimal ${rule.min}`;
      }
    }
    
    // Max length/value validation
    if (rule.max !== undefined) {
      if (typeof value === 'string' && value.length > rule.max) {
        return `${fieldName} maksimal ${rule.max} karakter`;
      }
      if (typeof value === 'number' && value > rule.max) {
        return `${fieldName} maksimal ${rule.max}`;
      }
    }
    
    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return `${fieldName} format tidak valid`;
    }
    
    // Custom validation
    if (rule.custom) {
      const result = rule.custom(value);
      if (typeof result === 'string') {
        return result;
      }
      if (result === false) {
        return `${fieldName} tidak valid`;
      }
    }
    
    return null;
  }, [rules]);
  
  const validateForm = useCallback((): boolean => {
    if (!rules) return true;
    
    const formValues = form.getValues();
    let hasErrors = false;
    
    Object.keys(rules).forEach(fieldName => {
      const value = formValues[fieldName as keyof T];
      const error = validateField(fieldName, value);
      
      if (error) {
        form.setError(fieldName as any, { 
          type: 'manual', 
          message: error 
        });
        hasErrors = true;
      } else {
        form.clearErrors(fieldName as any);
      }
    });
    
    return !hasErrors;
  }, [form, rules, validateField]);
  
  const validateSingleField = useCallback((fieldName: string) => {
    const value = form.getValues(fieldName as any);
    const error = validateField(fieldName, value);
    
    if (error) {
      form.setError(fieldName as any, { 
        type: 'manual', 
        message: error 
      });
      return false;
    } else {
      form.clearErrors(fieldName as any);
      return true;
    }
  }, [form, validateField]);
  
  return {
    validateForm,
    validateField: validateSingleField,
    hasErrors: () => Object.keys(form.formState.errors).length > 0
  };
}