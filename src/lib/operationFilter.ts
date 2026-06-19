import type { OperationType, ProspectOperationType } from "../types";
import { PROSPECT_OPERATION_TYPES } from "./prospectMeta";

// Fuente única del filtro de "Operación" (Venta/Alquiler/Traspaso), compartida
// entre Leads y Tareas para que el nombre y las opciones no se dupliquen.

/** Etiqueta unificada del filtro. */
export const OPERATION_FILTER_LABEL = "Operación";

/** Valor del filtro: "all" (todas) o un tipo de operación concreto. */
export type OperationFilterValue = "all" | ProspectOperationType;

export type OperationFilterOption = { value: OperationFilterValue; label: string };

/** Construye las opciones del desplegable a partir de los tipos válidos ("Todas" primero). */
export function buildOperationFilterOptions(
  types: readonly (OperationType | ProspectOperationType)[]
): OperationFilterOption[] {
  return [{ value: "all", label: "Todas" }, ...types.map((t) => ({ value: t, label: t }))];
}

/** Opciones para anuncios/leads: solo Venta y Alquiler (no existe Traspaso en anuncios). */
export const LISTING_OPERATION_FILTER_OPTIONS = buildOperationFilterOptions(["Venta", "Alquiler"]);

/** Opciones para captaciones/tareas: incluye Traspaso. */
export const PROSPECT_OPERATION_FILTER_OPTIONS = buildOperationFilterOptions(PROSPECT_OPERATION_TYPES);
