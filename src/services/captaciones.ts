/**
 * Captaciones = el MISMO registro que los "prospects" (Seguimiento), presentado como la
 * cartera rica de inmuebles + propietarios. Este módulo solo re-exporta el servicio de
 * prospects con nombres de captación para que el código de la sección se lea natural.
 * No hay lógica nueva ni una segunda fuente de verdad: misma colección
 * `organizations/{orgId}/prospects`.
 */
export {
  getProspects as getCaptaciones,
  getProspectsForAgent as getCaptacionesForAgent,
  getProspectById as getCaptacionById,
  createProspect as createCaptacion,
  updateProspect as updateCaptacion,
  updateProspectStage as updateCaptacionStage,
  deleteProspect as deleteCaptacion,
  deleteProspects as deleteCaptaciones,
  bulkUpdateProspectsStage as bulkUpdateCaptacionesStage,
  bulkAssignProspects as bulkAssignCaptaciones,
  addProspectActivity as addCaptacionActivity,
  setProspectNextAction as setCaptacionNextAction,
  findCaptacionByPhoneOrEmail,
  linkProspectToListing,
  isDueToday,
  prospectsByStage,
} from "./prospects";
