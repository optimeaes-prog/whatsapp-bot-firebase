import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Filter, Calendar, User, Phone, ArrowRight, ChevronDown, CheckSquare, Square } from "lucide-react";
import { getListings, getListingsForAgent } from "../services/listings";
import {
  getLeads,
  getLeadsForAgent,
  filterQualifiedLeads,
  qualifiedLeadMetricTimestamp,
} from "../services/leads";
import { getConversations, getConversationsForAgent } from "../services/conversations";
import { formatDate, formatPhone, cn } from "../lib/utils";
import { metricTheme } from "../lib/metricTheme";
import type { Listing, Lead, Conversation } from "../types";
import { PageHeader } from "../components/ui";
import { QualificationBadge, OperationTypeBadge } from "../components/StatusBadges";
import { getCheckoutIntent, clearCheckoutIntent } from "../lib/checkoutStorage";
import { createSubscriptionCheckout } from "../services/subscription";
import { analytics } from "../lib/analytics";
import { toast } from "sonner";
import { PageLoading } from "../components/ui/PageLoading";
import { useAuth } from "../contexts/AuthContext";

export function Dashboard() {
  const { organizationId, effectiveRole, effectiveUid, isImpersonationReadOnly } = useAuth();
  const [dateFilter, setDateFilter] = useState("last_30");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [listingFilter, setListingFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<{
    listings: Listing[];
    leads: Lead[];
    conversations: Conversation[];
  } | null>(null);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);

  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isListingDropdownOpen, setIsListingDropdownOpen] = useState(false);

  const getLeadMetricTimestamp = (lead: Lead) =>
    lead.createdAt ?? lead.firstMessageDate ?? lead.lastMessageDate;

  const getStartOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getEndOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const parseDateInput = (value: string) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const getDateRange = () => {
    const now = new Date();

    if (dateFilter === "today") return { start: getStartOfDay(now), end: getEndOfDay(now) };
    if (dateFilter === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: getStartOfDay(y), end: getEndOfDay(y) };
    }
    if (dateFilter === "last_7") {
      const p = new Date(now);
      p.setDate(p.getDate() - 7);
      return { start: getStartOfDay(p), end: getEndOfDay(now) };
    }
    if (dateFilter === "last_30") {
      const p = new Date(now);
      p.setDate(p.getDate() - 30);
      return { start: getStartOfDay(p), end: getEndOfDay(now) };
    }
    if (dateFilter === "custom") {
      const startDate = parseDateInput(customStartDate);
      const endDate = parseDateInput(customEndDate);
      if (!startDate || !endDate) return null;
      if (startDate <= endDate) {
        return { start: getStartOfDay(startDate), end: getEndOfDay(endDate) };
      }
      return { start: getStartOfDay(endDate), end: getEndOfDay(startDate) };
    }

    return null;
  };

  const formatShortDate = (date: Date) =>
    date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const hasUserResponseAfterFirstAssistant = (conversation: Conversation) => {
    const history = conversation.history || [];
    const firstAssistant = history.find((msg) => msg.role === "assistant");
    if (!firstAssistant) return false;
    const assistantTs = Number(firstAssistant.timestamp || 0);
    return history.some(
      (msg) => msg.role === "user" && Number(msg.timestamp || 0) > assistantTs
    );
  };
  useEffect(() => {
    async function loadStats() {
      if (!organizationId) return;
      if (!effectiveRole) return;
      if (effectiveRole === "agent" && !effectiveUid) return;

      setLoading(true);
      try {
        const [listings, leads, conversations] = await Promise.all([
          effectiveRole === "agent" ? getListingsForAgent(effectiveUid) : getListings(),
          effectiveRole === "agent" ? getLeadsForAgent(effectiveUid) : getLeads(),
          effectiveRole === "agent" ? getConversationsForAgent(effectiveUid) : getConversations(),
        ]);
        setRawData({ listings, leads, conversations });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [organizationId, effectiveRole, effectiveUid]);

  useEffect(() => {
    const fn = async () => {
      if (isImpersonationReadOnly) return;
      const intent = getCheckoutIntent();
      if (intent) {
        analytics.trackCheckoutIntentResumed(intent.planId);
        setRedirectingToCheckout(true);
        clearCheckoutIntent();
        try {
          const checkoutUrl = await createSubscriptionCheckout(
            intent.planId,
            intent.billingInterval,
            intent.extraBlocks,
            "/onboarding"
          );
          window.location.href = checkoutUrl;
        } catch (error) {
          console.error("Error creating checkout from intent:", error);
          toast.error("Ocurrió un error preparando tu pago. Por favor, intenta de nuevo desde la sección de configuración.");
          setRedirectingToCheckout(false);
        }
      }
    };
    fn();
  }, [isImpersonationReadOnly]);

  const recentLeads = useMemo(() => {
    if (!rawData) return [];
    
    let filteredLeads = [...rawData.leads];

    if (listingFilter !== "all") {
      filteredLeads = filteredLeads.filter(l => l.listingCode === listingFilter);
    }

    const range = getDateRange();

    const isWithinRange = (ts: any, r: {start: Date, end: Date} | null) => {
      if (!r) return true;
      if (!ts) return false;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date >= r.start && date <= r.end;
    };

    if (range) {
      filteredLeads = filteredLeads.filter(l => isWithinRange(getLeadMetricTimestamp(l), range));
    }

    return filteredLeads
      .sort((a, b) => {
        const aMs = getLeadMetricTimestamp(a)?.toMillis?.() || 0;
        const bMs = getLeadMetricTimestamp(b)?.toMillis?.() || 0;
        return bMs - aMs;
      })
      .slice(0, 6);
  }, [rawData, dateFilter, listingFilter, customStartDate, customEndDate]);

  const stats = useMemo(() => {
    if (!rawData) return {
      anuncios: 0, anunciosActivos: 0, anunciosCerrados: 0, leads: 0, conversaciones: 0,
      conversacionesActivas: 0, cualificados: 0, tasaCualificacion: 0, conversionRate: 0,
      vendidosACualificados: 0, alquiladosACualificados: 0, respondidos: 0, tasaRespuesta: 0,
      totalMensajes: 0
    };

    let { listings, leads, conversations } = rawData;

    // Filter by Ad (Listing Code)
    if (listingFilter !== "all") {
      listings = listings.filter(l => l.listingCode === listingFilter);
      leads = leads.filter(l => l.listingCode === listingFilter);
      conversations = conversations.filter(c => c.listingCode === listingFilter);
    }

    const leadsAfterListingFilter = leads;

    // Filter by Date Range
    const range = getDateRange();

    const isWithinRange = (ts: any, r: {start: Date, end: Date} | null) => {
      if (!r) return true;
      if (!ts) return false;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date >= r.start && date <= r.end;
    };

    if (range) {
      leads = leads.filter(l => isWithinRange(getLeadMetricTimestamp(l), range));
      conversations = conversations.filter(c => isWithinRange(c.lastMessage, range));
    }

    let qualifiedLeads = filterQualifiedLeads(leadsAfterListingFilter);
    if (range) {
      qualifiedLeads = qualifiedLeads.filter((q) =>
        isWithinRange(qualifiedLeadMetricTimestamp(q), range)
      );
    }

    const anunciosActivos = listings.filter(l => l.isActive !== false).length;
    // Apply date filter to closed listings so we only count conversions in the selected period
    const closedListings = listings.filter(l => l.isActive === false && isWithinRange(l.closureInfo?.closedAt || l.createdAt, range));
    const anunciosCerrados = closedListings.length;
    
    const conversacionesActivas = conversations.filter((c) => !c.isFinished).length;
    const tasaCualificacion = conversations.length > 0 ? Math.round((qualifiedLeads.length / conversations.length) * 100) : 0;

    const vendidosACualificados = closedListings.filter(l => l.closureInfo?.reason === "sold_to_qualified").length;
    const alquiladosACualificados = closedListings.filter(l => l.closureInfo?.reason === "rented_to_qualified").length;
    const totalConversionesToQualified = vendidosACualificados + alquiladosACualificados;
    const conversionRate = qualifiedLeads.length > 0 ? Math.round((totalConversionesToQualified / qualifiedLeads.length) * 100) : 0;

    const respondidos = conversations.filter(hasUserResponseAfterFirstAssistant).length;
    const tasaRespuesta = conversations.length > 0 ? Math.round((respondidos / conversations.length) * 100) : 0;
    const totalMensajes = conversations.reduce((acc, c) => acc + (c.messageCount || 0), 0);

    return {
      anuncios: listings.length,
      anunciosActivos,
      anunciosCerrados,
      leads: leads.length,
      conversaciones: conversations.length,
      conversacionesActivas,
      cualificados: qualifiedLeads.length,
      tasaCualificacion,
      conversionRate,
      vendidosACualificados,
      alquiladosACualificados,
      respondidos,
      tasaRespuesta,
      totalMensajes,
    };
  }, [rawData, dateFilter, listingFilter, customStartDate, customEndDate]);

  const uniqueListings = useMemo(() => {
    if (!rawData) return [];
    return Array.from(new Set(rawData.listings.map(l => l.listingCode).filter(Boolean)));
  }, [rawData]);

  const selectedDateRangeLabel = useMemo(() => {
    if (dateFilter === "all") return "Todas las fechas";
    if (dateFilter === "today") return "Hoy";
    if (dateFilter === "yesterday") return "Ayer";
    if (dateFilter === "last_7") return "Últimos 7 días";
    if (dateFilter === "last_30") return "Últimos 30 días";

    const range = getDateRange();
    if (!range) return "Rango personalizado (pendiente de seleccionar)";
    return `${formatShortDate(range.start)} - ${formatShortDate(range.end)}`;
  }, [dateFilter, customStartDate, customEndDate]);

  if (loading || redirectingToCheckout) {
    if (redirectingToCheckout) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <PageLoading />
          <p className="mt-4 text-gray-500 font-medium">Preparando pago seguro...</p>
        </div>
      );
    }
    return (
      <div>
        <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl font-heading">Dashboard</h1>
        
        {/* Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 grid grid-cols-1 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-[220px] flex flex-col items-center justify-center">
                <div className="h-3 bg-gray-200 rounded w-24 mb-6"></div>
                <div className="h-12 bg-gray-300 rounded w-40"></div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 card animate-pulse h-full flex flex-col items-center p-8">
            <div className="h-6 bg-gray-200 rounded w-48 mb-12"></div>
            <div className="space-y-4 w-full px-12">
              <div className="h-24 bg-gray-100 rounded-xl w-full"></div>
              <div className="h-24 bg-gray-100 rounded-xl w-[75%] mx-auto"></div>
              <div className="h-24 bg-gray-100 rounded-xl w-[50%] mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }



  /** Embudo sin Leads (el total de leads va en la tarjeta lateral) */
  const funnelData = [
    { label: "Conversaciones", count: stats.conversaciones, color: metricTheme.conversations.funnelBg, textColor: metricTheme.conversations.funnelText, fontClass: "font-heading" },
    { label: "Respondidas", count: stats.respondidos, color: metricTheme.responded.funnelBg, textColor: metricTheme.responded.funnelText, fontClass: "font-heading" },
    { label: "Cualificados", count: stats.cualificados, color: metricTheme.qualified.funnelBg, textColor: metricTheme.qualified.funnelText, fontClass: "font-heading" },
  ];



  return (
    <div>
      <PageHeader
        className="mb-6 sm:mb-8"
        title="Dashboard"
        actions={
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <div className="relative">
            <div 
              className="flex items-center gap-2 bg-white px-3 py-2 rounded-btn border shadow-sm cursor-pointer min-w-[150px]" 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            >
              <Calendar size={18} className="text-gray-500 flex-shrink-0" />
              <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gray-600 font-heading uppercase tracking-wider">Fecha:</span>
                <div className="flex items-center gap-1">
                  {dateFilter === "today" ? "Hoy" : 
                   dateFilter === "yesterday" ? "Ayer" : 
                   dateFilter === "last_7" ? "Últimas 7 días" : 
                   dateFilter === "last_30" ? "Últimas 30 días" :
                   dateFilter === "custom" ? "Rango personalizado" : "Todos"}
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isDateDropdownOpen && "rotate-180")} />
                </div>
              </div>
            </div>
            {isDateDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDateDropdownOpen(false)} />
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                  {[
                    { value: "today", label: "Hoy" },
                    { value: "yesterday", label: "Ayer" },
                    { value: "last_7", label: "Últimos 7 días" },
                    { value: "last_30", label: "Últimos 30 días" },
                    { value: "custom", label: "Rango personalizado" },
                    { value: "all", label: "Todos" }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setDateFilter(option.value);
                        analytics.trackDateFilterChanged(option.value);
                        setIsDateDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                    >
                      {dateFilter === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                      <span className="text-xs text-gray-700 font-medium">{option.label}</span>
                    </button>
                  ))}
                  {dateFilter === "custom" && (
                    <div className="mt-2 border-t border-gray-100 pt-2 space-y-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-gray-500">Desde</span>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-gray-500">Hasta</span>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-primary-500 focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <div 
              className="flex items-center gap-2 bg-white px-3 py-2 rounded-btn border shadow-sm cursor-pointer min-w-[180px] max-w-[250px]" 
              onClick={() => setIsListingDropdownOpen(!isListingDropdownOpen)}
            >
              <Filter size={18} className="text-gray-500 flex-shrink-0" />
              <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 truncate">
                <span className="text-xs font-semibold text-gray-600 font-heading uppercase tracking-wider">Anuncio:</span>
                <div className="flex items-center gap-1 flex-1 overflow-hidden">
                  <span className="truncate">{listingFilter === "all" ? "Todos" : listingFilter}</span>
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1 shrink-0", isListingDropdownOpen && "rotate-180")} />
                </div>
              </div>
            </div>
            {isListingDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsListingDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 max-h-[300px] overflow-y-auto">
                  <button
                    onClick={() => {
                      setListingFilter("all");
                      analytics.trackListingFilterChanged("all");
                      setIsListingDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left mb-1"
                  >
                    {listingFilter === "all" ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                    <span className="text-xs text-gray-700 font-medium">Todos los anuncios</span>
                  </button>
                  <div className="h-px bg-gray-100 my-1" />
                  {uniqueListings.map(code => (
                    <button
                      key={code}
                      onClick={() => {
                        setListingFilter(code);
                        analytics.trackListingFilterChanged(code);
                        setIsListingDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                    >
                      {listingFilter === code ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                      <span className="text-xs text-gray-700 font-medium truncate">{code}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        }
      />
      <div className="mb-4 -mt-3 sm:mb-6">
        <p className="text-xs font-semibold text-gray-500">
          Rango seleccionado: <span className="text-gray-700">{selectedDateRangeLabel}</span>
        </p>
      </div>



      {/* Columna izquierda: KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
        <div className="lg:col-span-1 grid grid-cols-1 gap-6">
          {/* Tasa de Cualificación */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2 font-heading uppercase">Tasa de cualificación</p>
              <div className="relative inline-block">
                <p className={cn("text-4xl sm:text-5xl font-bold", metricTheme.qualificationRate.value)}>{stats.tasaCualificacion}%</p>
              </div>
            </div>
          </div>

          {/* Tasa de Respuesta */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2 font-heading uppercase">Tasa de respuesta</p>
              <div className="relative inline-block">
                <p className={cn("text-4xl sm:text-5xl font-bold", metricTheme.responded.value)}>{stats.tasaRespuesta}%</p>
              </div>
            </div>
          </div>

          {/* Leads */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2 font-heading uppercase">Leads</p>
              <div className="relative inline-block">
                <p className={cn("text-4xl sm:text-5xl font-bold", metricTheme.messages.kpiLeads)}>{stats.leads}</p>
              </div>
            </div>
          </div>

          {/* Mensajes Totales */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2 font-heading uppercase">Mensajes totales</p>
              <div className="relative inline-block">
                <p className={cn("text-4xl sm:text-5xl font-bold", metricTheme.messages.kpiValue)}>{stats.totalMensajes}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 card p-8 flex flex-col items-center border-t-4 border-primary-500 bg-gradient-to-b from-white to-slate-50/30">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-1.5 w-full text-center font-heading">Embudo de conversión</h2>
            <p className="text-xs text-gray-400 text-center mb-7 font-medium tracking-wider">Flujo de interacción total</p>
            
            <div className="flex flex-col gap-3 w-full max-w-[800px] mx-auto">
              {funnelData.map((step, i) => {
                const counts = funnelData.map(d => d.count);
                const maxCount = Math.max(...counts, 1);
                // Reduced base to 20% since we have more space
                const width = 20 + (step.count / maxCount) * 80;
                const prevStep = funnelData[i - 1];
                const conversionRate = prevStep && prevStep.count > 0 
                  ? Math.round((step.count / prevStep.count) * 100) 
                  : null;
                
                return (
                  <div key={step.label} className="relative flex flex-col items-center group w-full">
                    {conversionRate !== null && (
                      <div className="h-10 flex items-center justify-center -my-3 z-20">
                        <div className="text-[11px] font-bold bg-white border-2 border-slate-100 text-slate-500 px-3 py-1 rounded-full flex items-center gap-1.5 transition-transform">
                          <TrendingUp size={12} className={metricTheme.conversion.icon} />
                          <span className={metricTheme.conversion.text}>{conversionRate}%</span>
                        </div>
                      </div>
                    )}
                    <div 
                      className={cn(
                        "relative h-24 sm:h-28 transition-all duration-1000 ease-out flex items-center justify-center",
                        step.color,
                        step.textColor,
                        "rounded-xl border-2 border-slate-50"
                      )}
                      style={{ width: `${width}%` }}
                    >
                      <div className="flex flex-col items-center justify-center text-center px-4 z-10 w-full space-y-0">
                        <span className="font-bold text-3xl sm:text-4xl leading-none">{step.count}</span>
                        <span className="font-bold tracking-widest text-gray-500/80 text-[10px] sm:text-[11px] leading-tight whitespace-nowrap font-heading uppercase">{step.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>



      {/* Leads Recientes */}
      <div className="mt-6 sm:mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Leads más recientes</h2>
          <Link to="/leads" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
            Ver todos <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentLeads.map((lead) => (
            <Link
              key={lead.id}
              to={`/leads?search=${lead.phone.replace('+', '%2B')}`}
              className="card p-4 hover:shadow-md transition-shadow relative block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <User size={18} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {lead.name || "Sin nombre"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Phone size={12} />
                      <span>{formatPhone(lead.phone)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <QualificationBadge status={lead.qualificationStatus} />
                <OperationTypeBadge type={lead.operationType} />
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 border border-gray-200 shadow-sm w-fit">
                  <span className="text-gray-400 font-medium">ID</span>
                  <span>{lead.listingCode}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span>
                  {lead.createdAt ? formatDate(lead.createdAt.toDate()) : "—"}
                </span>
                <span className="text-primary-600 font-medium hover:underline">
                  Ver detalles →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
