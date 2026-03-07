/**
 * Timezone utility functions for GMT+7 Jakarta (WIB)
 * 
 * IMPORTANT: Business date cutoff is at 05:00 WIB.
 * Before 05:00, the business date is still the previous day (Midnight shift).
 * Example: 2026-03-08 02:46 WIB → business date = 2026-03-07
 */

const BUSINESS_DAY_CUTOFF_HOUR = 5; // 05:00 WIB

/**
 * Get current WIB time parts using Intl
 */
function getWIBParts(date?: Date): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  const target = date || new Date();
  const wibFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = wibFormatter.formatToParts(target);
  return {
    year: parts.find(p => p.type === 'year')?.value || '',
    month: parts.find(p => p.type === 'month')?.value || '',
    day: parts.find(p => p.type === 'day')?.value || '',
    hour: parts.find(p => p.type === 'hour')?.value || '',
    minute: parts.find(p => p.type === 'minute')?.value || '',
    second: parts.find(p => p.type === 'second')?.value || '',
  };
}

/**
 * Get the business date in WIB (accounts for 05:00 cutoff).
 * Before 05:00 WIB, returns yesterday's date.
 */
export function getBusinessDateWIB(): Date {
  const p = getWIBParts();
  const wibDate = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`);
  if (parseInt(p.hour) < BUSINESS_DAY_CUTOFF_HOUR) {
    wibDate.setDate(wibDate.getDate() - 1);
  }
  return wibDate;
}

/**
 * Get current date and time in GMT+7 (WIB) timezone
 */
export function getCurrentWIBDate(): Date {
  const now = new Date();
  // Use Intl.DateTimeFormat to get WIB time components
  const wibFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const parts = wibFormatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const second = parts.find(p => p.type === 'second')?.value || '';
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

/**
 * Convert any date to GMT+7 (WIB) timezone
 */
export function toWIBDate(date: Date | string): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  // Use Intl.DateTimeFormat to get WIB time components
  const wibFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const parts = wibFormatter.formatToParts(inputDate);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const second = parts.find(p => p.type === 'second')?.value || '';
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

/**
 * Format date in WIB for HTML datetime-local input (YYYY-MM-DDTHH:mm)
 * Always returns current WIB time
 */
export function formatWIBForInput(date?: Date | string): string {
  // Use business date (before 05:00 = still yesterday) + current WIB time
  const bizDate = getBusinessDateWIB();
  const p = getWIBParts(); // current actual WIB time
  const y = bizDate.getFullYear();
  const m = (bizDate.getMonth() + 1).toString().padStart(2, '0');
  const d = bizDate.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}T${p.hour}:${p.minute}`;
}

/**
 * Format WIB time for display (DD/MM/YYYY HH:mm)
 */
export function formatWIBForDisplay(date?: Date | string): string {
  let targetDate: Date;
  
  if (date) {
    // If date is provided, use it
    if (typeof date === 'string') {
      targetDate = new Date(date);
    } else {
      targetDate = date;
    }
  } else {
    // Fallback to current WIB time
    targetDate = getCurrentWIBDate();
  }
  
  const day = targetDate.getDate().toString().padStart(2, '0');
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  const year = targetDate.getFullYear();
  const hours = targetDate.getHours().toString().padStart(2, '0');
  const minutes = targetDate.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format WIB date for Google Sheets tab name (DD/MM/YY)
 */
export function formatWIBForSheetTab(date?: Date | string): string {
  let targetDate: Date;
  
  if (date) {
    // If date is provided, use it (usually from user selection)
    if (typeof date === 'string') {
      targetDate = new Date(date);
    } else {
      targetDate = date;
    }
  } else {
    // Fallback to current WIB time
    targetDate = getCurrentWIBDate();
  }
  
  const day = targetDate.getDate().toString().padStart(2, '0');
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  const year = targetDate.getFullYear().toString().slice(-2);
  
  return `${day}/${month}/${year}`;
}

/**
 * Get current date in WIB for date input (YYYY-MM-DD)
 */
export function getCurrentWIBDateString(): string {
  const bizDate = getBusinessDateWIB();
  const y = bizDate.getFullYear();
  const m = (bizDate.getMonth() + 1).toString().padStart(2, '0');
  const d = bizDate.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format WIB time for Indonesian locale display
 */
export function formatWIBIndonesian(date?: Date | string): string {
  let targetDate: Date;
  
  if (date) {
    // If date is provided, use it
    if (typeof date === 'string') {
      targetDate = new Date(date);
    } else {
      targetDate = date;
    }
  } else {
    // Fallback to current WIB time
    targetDate = getCurrentWIBDate();
  }
  
  return targetDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Convert WIB date to string format compatible with database storage
 */
export function wibDateToString(date: Date): string {
  return toWIBDate(date).toISOString();
}