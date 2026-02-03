import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatMessageTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  // Format Spanish phone numbers
  if (phone.startsWith('34') && phone.length === 11) {
    return `+34 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

// Format phone number like WhatsApp Web does (with + prefix)
export function formatPhoneWhatsApp(phone: string): string {
  if (!phone) return '';
  
  // Remove any non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If it's a Spanish number with 11 digits starting with 34
  if (digitsOnly.startsWith('34') && digitsOnly.length === 11) {
    return `+${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 5)} ${digitsOnly.slice(5, 8)} ${digitsOnly.slice(8)}`;
  }
  
  // If it's a 9-digit Spanish local number (6, 7, 8, 9)
  if (digitsOnly.length === 9 && /^[6-9]/.test(digitsOnly)) {
    return `+34 ${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6)}`;
  }
  
  // For other formats, add + if not present and format generically
  if (!phone.startsWith('+')) {
    return `+${digitsOnly}`;
  }
  
  return phone;
}
