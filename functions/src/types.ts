export type Role = "assistant" | "user";

export type HistoryItem = {
  role: Role;
  text: string;
  timestamp: number;
};

export type PendingItem = {
  text: string;
  timestamp: number;
};

export type TipoOperacion = "Venta" | "Alquiler";

export type ConversationState = {
  telefono: string;
  anuncio: string;
  chatId: string;
  tipoOperacion: TipoOperacion;
  nombre?: string;
  descripcion: string;
  enlace: string;
  caracteristicas: string;
  informeRentabilidadDisponible: boolean;
  informeRentabilidad?: string;
  history: HistoryItem[];
  pendingUserMessages: PendingItem[];
  isFinished: boolean;
  qualificationStatus?: boolean;
};

export type LeadSummary = {
  nombre?: string;
  personas?: string;
  ingresos?: string;
  mascotas?: string;
  formaPago?: string;
  fechas?: string;
  disponibilidadVisita?: string;
  notas?: string;
};

export type LeadRow = {
  telefono: string;
  anuncio: string;
  chatId: string;
  tipoOperacion: TipoOperacion;
};

export type AnuncioRow = {
  descripcion: string;
  anuncio: string;
  enlace: string;
  tipoOperacion: TipoOperacion;
  caracteristicas: string;
  informeRentabilidadDisponible: boolean;
  informeRentabilidad: string;
};

export type BotStyle = {
  id: string;
  name: string;
  description: string;
  promptModifier: string;
};

export type BotConfig = {
  activeStyleId: string;
  styles: BotStyle[];
};

export type InboundMessage = {
  chatId: string;
  telefono: string;
  text: string;
  timestamp: number;
};
