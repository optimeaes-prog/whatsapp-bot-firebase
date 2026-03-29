import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Users, MessageSquare, CheckCircle, TrendingUp, Filter, Calendar, MessageCircle, User, Phone, ArrowRight, ChevronDown, CheckSquare, Square } from "lucide-react";
import { getListings } from "../services/listings";
import { getLeads } from "../services/leads";
import { getConversations } from "../services/conversations";
import { getQualifiedLeads } from "../services/qualifiedLeads";
import { formatDate, formatPhone, cn } from "../lib/utils";
import type { Listing, Lead, Conversation, QualifiedLead } from "../types";
import { PageHeader } from "../components/ui";
import { QualificationBadge, OperationTypeBadge } from "../components/StatusBadges";
export function Dashboard() {
  const [dateFilter, setDateFilter] = useState("last_30");
  const [listingFilter, setListingFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<{
    listings: Listing[];
    leads: Lead[];
    conversations: Conversation[];
    qualifiedLeads: QualifiedLead[];
  } | null>(null);

  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isListingDropdownOpen, setIsListingDropdownOpen] = useState(false);
  useEffect(() => {
    async function loadStats() {
      try {
        const [listings, leads, conversations, qualifiedLeads] = await Promise.all([
          getListings(),
          getLeads(),
          getConversations(),
          getQualifiedLeads(),
        ]);
        setRawData({ listings, leads, conversations, qualifiedLeads });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const recentLeads = useMemo(() => {
    if (!rawData) return [];
    
    let filteredLeads = [...rawData.leads];

    if (listingFilter !== "all") {
      filteredLeads = filteredLeads.filter(l => l.listingCode === listingFilter);
    }

    const getStartOfDay = (date: Date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
    const getEndOfDay = (date: Date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; };
    
    let range: {start: Date, end: Date} | null = null;
    const now = new Date();
    
    if (dateFilter === "today") range = { start: getStartOfDay(now), end: getEndOfDay(now) };
    else if (dateFilter === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); range = { start: getStartOfDay(y), end: getEndOfDay(y) }; }
    else if (dateFilter === "last_7") { const p = new Date(now); p.setDate(p.getDate() - 7); range = { start: getStartOfDay(p), end: getEndOfDay(now) }; }
    else if (dateFilter === "last_30") { const p = new Date(now); p.setDate(p.getDate() - 30); range = { start: getStartOfDay(p), end: getEndOfDay(now) }; }

    const isWithinRange = (ts: any, r: {start: Date, end: Date} | null) => {
      if (!r) return true;
      if (!ts) return false;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date >= r.start && date <= r.end;
    };

    if (range) {
      filteredLeads = filteredLeads.filter(l => isWithinRange(l.createdAt, range));
    }

    return filteredLeads
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, 6);
  }, [rawData, dateFilter, listingFilter]);

  const stats = useMemo(() => {
    if (!rawData) return {
      anuncios: 0, anunciosActivos: 0, anunciosCerrados: 0, leads: 0, conversaciones: 0,
      conversacionesActivas: 0, cualificados: 0, tasaCualificacion: 0, conversionRate: 0,
      vendidosACualificados: 0, alquiladosACualificados: 0, respondidos: 0, tasaRespuesta: 0,
      totalMensajes: 0
    };

    let { listings, leads, conversations, qualifiedLeads } = rawData;

    // Filter by Ad (Listing Code)
    if (listingFilter !== "all") {
      listings = listings.filter(l => l.listingCode === listingFilter);
      leads = leads.filter(l => l.listingCode === listingFilter);
      conversations = conversations.filter(c => c.listingCode === listingFilter);
      qualifiedLeads = qualifiedLeads.filter(q => q.listingCode === listingFilter);
    }

    // Filter by Date Range
    const getStartOfDay = (date: Date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
    const getEndOfDay = (date: Date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; };
    
    let range: {start: Date, end: Date} | null = null;
    const now = new Date();
    
    if (dateFilter === "today") range = { start: getStartOfDay(now), end: getEndOfDay(now) };
    else if (dateFilter === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); range = { start: getStartOfDay(y), end: getEndOfDay(y) }; }
    else if (dateFilter === "last_7") { const p = new Date(now); p.setDate(p.getDate() - 7); range = { start: getStartOfDay(p), end: getEndOfDay(now) }; }
    else if (dateFilter === "last_30") { const p = new Date(now); p.setDate(p.getDate() - 30); range = { start: getStartOfDay(p), end: getEndOfDay(now) }; }

    const isWithinRange = (ts: any, r: {start: Date, end: Date} | null) => {
      if (!r) return true;
      if (!ts) return false;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date >= r.start && date <= r.end;
    };

    if (range) {
      leads = leads.filter(l => isWithinRange(l.createdAt, range));
      conversations = conversations.filter(c => isWithinRange(c.lastMessage, range));
      qualifiedLeads = qualifiedLeads.filter(q => isWithinRange(q.createdAt, range));
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

    const respondidos = conversations.filter(c => c.history?.some(msg => msg.role === "user")).length;
    const tasaRespuesta = leads.length > 0 ? Math.round((respondidos / leads.length) * 100) : 0;
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
  }, [rawData, dateFilter, listingFilter]);

  const uniqueListings = useMemo(() => {
    if (!rawData) return [];
    return Array.from(new Set(rawData.listings.map(l => l.listingCode).filter(Boolean)));
  }, [rawData]);

  if (loading) {
    return (
      <div>
        <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">Dashboard</h1>
        
        {/* Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-[220px] flex flex-col items-center justify-center">
                <div className="h-3 bg-gray-200 rounded w-24 mb-6"></div>
                <div className="h-12 bg-gray-300 rounded w-40"></div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 card animate-pulse h-full flex flex-col items-center p-8">
            <div className="h-6 bg-gray-200 rounded w-48 mb-12"></div>
            <div className="space-y-4 w-full px-12">
              <div className="h-16 bg-gray-100 rounded-2xl w-full"></div>
              <div className="h-16 bg-gray-100 rounded-2xl w-[75%] mx-auto"></div>
              <div className="h-16 bg-gray-100 rounded-2xl w-[50%] mx-auto"></div>
              <div className="h-16 bg-gray-100 rounded-2xl w-[25%] mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }



  const funnelData = [
    { label: "Leads", count: stats.leads, color: "bg-slate-100", textColor: "text-slate-700", icon: <Users size={18} /> },
    { label: "Conversaciones", count: stats.conversaciones, color: "bg-indigo-50", textColor: "text-indigo-700", icon: <MessageSquare size={18} /> },
    { label: "Respondidas", count: stats.respondidos, color: "bg-sky-50", textColor: "text-sky-700", icon: <MessageCircle size={18} /> },
    { label: "Cualificados", count: stats.cualificados, color: "bg-emerald-50", textColor: "text-emerald-700", icon: <CheckCircle size={18} /> },
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
                <span className="text-xs font-semibold text-gray-600">Fecha:</span>
                <div className="flex items-center gap-1">
                  {dateFilter === "today" ? "Hoy" : 
                   dateFilter === "yesterday" ? "Ayer" : 
                   dateFilter === "last_7" ? "Últimas 7 días" : 
                   dateFilter === "last_30" ? "Últimas 30 días" : "Todos"}
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
                    { value: "all", label: "Todos" }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setDateFilter(option.value);
                        setIsDateDropdownOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                    >
                      {dateFilter === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                      <span className="text-xs text-gray-700 font-medium">{option.label}</span>
                    </button>
                  ))}
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
                <span className="text-xs font-semibold text-gray-600">Anuncio:</span>
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



      {/* Columna Izquierda: KPIs y Mensajes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
        <div className="lg:col-span-1 grid grid-cols-1 gap-6">
          {/* Tasa de Cualificación */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2">Tasa de cualificación</p>
              <div className="relative inline-block">
                <p className="text-4xl sm:text-5xl font-bold text-violet-600">{stats.tasaCualificacion}%</p>
              </div>
            </div>
          </div>

          {/* Tasa de Respuesta */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2">Tasa de respuesta</p>
              <div className="relative inline-block">
                <p className="text-4xl sm:text-5xl font-bold text-sky-600">{stats.tasaRespuesta}%</p>
              </div>
            </div>
          </div>

          {/* Mensajes Totales */}
          <div className="card p-6 h-full hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="text-center z-10 w-full">
              <p className="text-xs font-bold text-gray-500 tracking-wider mb-2">Mensajes totales</p>
              <div className="relative inline-block">
                <p className="text-4xl sm:text-5xl font-bold text-emerald-600">{stats.totalMensajes}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 card p-8 flex flex-col items-center justify-between border-t-4 border-primary-500 bg-gradient-to-b from-white to-slate-50/30">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 w-full text-center">Embudo de conversión</h2>
            <p className="text-xs text-gray-400 text-center mb-12 font-medium tracking-wider">Flujo de interacción total</p>
            
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
                          <TrendingUp size={12} className="text-indigo-500" />
                          <span className="text-indigo-600">{conversionRate}%</span>
                        </div>
                      </div>
                    )}
                    <div 
                      className={cn(
                        "relative h-16 transition-all duration-1000 ease-out flex items-center justify-center",
                        step.color,
                        step.textColor,
                        "rounded-2xl border-2 border-slate-50"
                      )}
                      style={{ width: `${width}%` }}
                    >
                      <div className="flex flex-col items-center justify-center text-center px-4 z-10 w-full space-y-0">
                        <span className="font-bold text-3xl leading-none">{step.count}</span>
                        <span className="font-bold tracking-wide text-gray-500/80 text-[11px] leading-tight whitespace-nowrap">{step.label.charAt(0).toUpperCase() + step.label.slice(1).toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 pt-8 border-t-2 border-dashed border-gray-100 w-full">
            <div className="flex justify-between items-end mb-3 px-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400">Eficiencia final</span>
                <span className="text-2xl font-bold text-emerald-600 leading-none">
                  {funnelData[0].count > 0 ? Math.round((funnelData[3].count / funnelData[0].count) * 100) : 0}%
                </span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 pb-1">Total leads vs cualificados</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-gray-50">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1500 ease-out" 
                style={{ width: `${funnelData[0].count > 0 ? (funnelData[3].count / funnelData[0].count) * 100 : 0}%` }}
              ></div>
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
