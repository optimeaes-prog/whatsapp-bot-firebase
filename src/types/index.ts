import { Timestamp } from "firebase/firestore";

export type TipoOperacion = "Venta" | "Alquiler";

export type Anuncio = {
  id: string;
  descripcion: string;
  anuncio: string;
  enlace: string;
  tipoOperacion: TipoOperacion;
  caracteristicas: string;
  informeRentabilidadDisponible: boolean;
  informeRentabilidad: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Lead = {
  id: string;
  telefono: string;
  anuncio: string;
  chatId: string;
  tipoOperacion: TipoOperacion;
  createdAt: Timestamp;
};

export type HistoryItem = {
  role: "assistant" | "user";
  text: string;
  timestamp: number;
};

export type Conversacion = {
  id: string;
  telefono: string;
  chatId: string;
  anuncio: string;
  history: HistoryItem[];
  numeroMensajes: number;
  ultimoMensaje: Timestamp;
  nombre: string;
  cualificado: boolean | null;
  isFinished: boolean;
};

export type Cualificado = {
  id: string;
  telefono: string;
  chatId: string;
  anuncio: string;
  resumenConversacion: string;
  nombre: string;
  cualificado: boolean;
  createdAt: Timestamp;
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

// Form types for creating/editing
export type AnuncioFormData = Omit<Anuncio, 'id' | 'createdAt' | 'updatedAt'>;
export type LeadFormData = Omit<Lead, 'id' | 'createdAt'>;
