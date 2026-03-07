/**
 * Enhanced error handling utilities for better user experience
 */

export interface ApiError {
  success: boolean;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  debug?: any;
}

export class FormSubmissionError extends Error {
  public readonly fieldErrors: Record<string, string>;
  
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'FormSubmissionError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Parse API error response and extract meaningful error information
 */
export function parseApiError(error: any): {
  message: string;
  fieldErrors: Record<string, string>;
  isValidationError: boolean;
} {
  const defaultMessage = 'Terjadi kesalahan yang tidak terduga';
  
  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
      fieldErrors: {},
      isValidationError: false
    };
  }
  
  // Handle our custom FormSubmissionError
  if (error instanceof FormSubmissionError) {
    return {
      message: error.message,
      fieldErrors: error.fieldErrors,
      isValidationError: Object.keys(error.fieldErrors).length > 0
    };
  }
  
  // Try to parse as JSON error response
  try {
    const errorData = typeof error === 'string' ? JSON.parse(error) : error;
    
    if (errorData && typeof errorData === 'object') {
      const fieldErrors: Record<string, string> = {};
      
      // Extract field errors from validation response
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorData.errors.forEach((err: any) => {
          if (err.field && err.message) {
            fieldErrors[err.field] = err.message;
          }
        });
      }
      
      return {
        message: errorData.message || defaultMessage,
        fieldErrors,
        isValidationError: Object.keys(fieldErrors).length > 0
      };
    }
  } catch {
    // Not a JSON error, continue with default handling
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return {
      message: error.message || defaultMessage,
      fieldErrors: {},
      isValidationError: false
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error || defaultMessage,
      fieldErrors: {},
      isValidationError: false
    };
  }
  
  // Fallback for unknown error types
  return {
    message: defaultMessage,
    fieldErrors: {},
    isValidationError: false
  };
}

/**
 * Create user-friendly error messages for different error types
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const { message, isValidationError } = parseApiError(error);
  
  if (isValidationError) {
    return 'Terdapat kesalahan pada data yang diisi. Silakan periksa dan coba lagi.';
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Koneksi terputus. Periksa internet Anda dan coba lagi.';
  }
  
  if (message.includes('timeout')) {
    return 'Permintaan terlalu lama. Silakan coba lagi.';
  }
  
  if (message.includes('server') || message.includes('500')) {
    return 'Terjadi masalah pada server. Tim teknis sedang menangani.';
  }
  
  return message;
}

/**
 * Retry mechanism for failed requests
 */
export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry validation errors or client errors
      const { isValidationError } = parseApiError(error);
      if (isValidationError) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
}