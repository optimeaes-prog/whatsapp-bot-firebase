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

/** ¿Caen las dos marcas de tiempo en el mismo día natural (hora local)? */
export function isSameCalendarDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * ¿Toca separador de día antes de este mensaje? Sí en el primero con fecha y
 * siempre que cambie el día respecto al mensaje anterior.
 */
export function shouldShowDayDivider(
  timestamp: number | undefined,
  previousTimestamp: number | undefined
): timestamp is number {
  if (!timestamp) return false;
  if (!previousTimestamp) return true;
  return !isSameCalendarDay(previousTimestamp, timestamp);
}

/**
 * Etiqueta del separador de día en el chat: "Hoy", "Ayer" o la fecha completa.
 * Sin ella, un mensaje de las 20:17 y otro de las 09:18 parecen del mismo día.
 */
export function formatMessageDay(timestamp: number): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const d = new Date(timestamp);
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (daysAgo === 0) return 'Hoy';
  if (daysAgo === 1) return 'Ayer';
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
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

/**
 * Normaliza un teléfono a una clave canónica para detectar duplicados.
 * Quita todo lo que no sea dígito, normaliza prefijos 00/34 y devuelve los últimos
 * 9 dígitos (el número nacional español). Así "+34 600 111 222", "0034600111222",
 * "34600111222" y "600 111 222" colisionan en "600111222".
 * Devuelve "" si no hay dígitos.
 */
export function normalizePhoneForMatch(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('34') && digits.length === 11) digits = digits.slice(2);
  return digits.length >= 9 ? digits.slice(-9) : digits;
}
