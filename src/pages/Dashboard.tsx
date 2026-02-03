import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Users, MessageSquare, CheckCircle, TrendingUp, Target } from "lucide-react";
import { getListings, getConversionStats } from "../services/listings";
import { getLeads } from "../services/leads";
import { getConversations } from "../services/conversations";
import { getQualifiedLeads } from "../services/qualifiedLeads";

type Stats = {
  anuncios: number;
  anunciosActivos: number;
  anunciosCerrados: number;
  leads: number;
  conversaciones: number;
  conversacionesActivas: number;
  cualificados: number;
  tasaCualificacion: number;
  // Métricas de conversión
  conversionRate: number; // % de cualificados que resultaron en venta/alquiler
  vendidosACualificados: number;
  alquiladosACualificados: number;
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    anuncios: 0,
    anunciosActivos: 0,
    anunciosCerrados: 0,
    leads: 0,
    conversaciones: 0,
    conversacionesActivas: 0,
    cualificados: 0,
    tasaCualificacion: 0,
    conversionRate: 0,
    vendidosACualificados: 0,
    alquiladosACualificados: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [listings, leads, conversations, qualifiedLeads, conversionStats] = await Promise.all([
          getListings(),
          getLeads(),
          getConversations(),
          getQualifiedLeads(),
          getConversionStats(),
        ]);

        const anunciosActivos = listings.filter(l => l.isActive !== false).length;
        const anunciosCerrados = listings.filter(l => l.isActive === false).length;
        
        const conversacionesActivas = conversations.filter((c) => !c.isFinished).length;
        const tasaCualificacion =
          conversations.length > 0
            ? Math.round((qualifiedLeads.length / conversations.length) * 100)
            : 0;

        // Calcular conversion rate: de los leads cualificados, cuántos resultaron en venta/alquiler
        const totalConversionesToQualified = conversionStats.soldToQualified + conversionStats.rentedToQualified;
        const conversionRate = qualifiedLeads.length > 0
          ? Math.round((totalConversionesToQualified / qualifiedLeads.length) * 100)
          : 0;

        setStats({
          anuncios: listings.length,
          anunciosActivos,
          anunciosCerrados,
          leads: leads.length,
          conversaciones: conversations.length,
          conversacionesActivas,
          cualificados: qualifiedLeads.length,
          tasaCualificacion,
          conversionRate,
          vendidosACualificados: conversionStats.soldToQualified,
          alquiladosACualificados: conversionStats.rentedToQualified,
        });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        
        {/* KPIs Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-32 mb-3"></div>
                  <div className="h-12 bg-gray-300 rounded w-24"></div>
                </div>
                <div className="w-16 h-16 bg-gray-200 rounded-xl"></div>
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mt-4 pt-4 border-t border-gray-100"></div>
            </div>
          ))}
        </div>

        {/* Primary Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-300 rounded w-16"></div>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-3"></div>
              <div className="h-3 bg-gray-100 rounded w-20"></div>
            </div>
          ))}
        </div>

        {/* Bottom Section Skeleton */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-100 rounded"></div>
              <div className="h-16 bg-gray-100 rounded"></div>
            </div>
          </div>
          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="space-y-3">
              <div className="h-6 bg-gray-100 rounded"></div>
              <div className="h-6 bg-gray-100 rounded"></div>
              <div className="h-6 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Métricas principales del negocio
  const primaryMetrics = [
    {
      title: "Anuncios",
      value: stats.anuncios,
      subtitle: `${stats.anunciosActivos} activos, ${stats.anunciosCerrados} cerrados`,
      icon: <Megaphone className="text-primary-600" size={32} />,
      href: "/anuncios",
      color: "bg-primary-50",
      iconColor: "text-primary-600",
    },
    {
      title: "Leads",
      value: stats.leads,
      icon: <Users className="text-green-600" size={32} />,
      href: "/leads",
      color: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Conversaciones",
      value: stats.conversaciones,
      subtitle: `${stats.conversacionesActivas} activas`,
      icon: <MessageSquare className="text-purple-600" size={32} />,
      href: "/conversaciones",
      color: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      title: "Cualificados",
      value: stats.cualificados,
      icon: <CheckCircle className="text-emerald-600" size={32} />,
      href: "/cualificados",
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  // KPIs principales
  const kpiMetrics = [
    {
      title: "Tasa de Cualificación",
      value: `${stats.tasaCualificacion}%`,
      subtitle: `${stats.cualificados} cualificados de ${stats.conversaciones} conversaciones`,
      icon: <TrendingUp size={40} />,
      color: "bg-orange-50",
      iconColor: "text-orange-600",
      valueColor: "text-orange-600",
    },
    {
      title: "Tasa de Conversión",
      value: `${stats.conversionRate}%`,
      subtitle: `${stats.vendidosACualificados} ventas + ${stats.alquiladosACualificados} alquileres`,
      icon: <Target size={40} />,
      color: "bg-pink-50",
      iconColor: "text-pink-600",
      valueColor: "text-pink-600",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Dashboard</h1>

      {/* KPIs Destacados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {kpiMetrics.map((metric) => (
          <div key={metric.title} className="card p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">
                  {metric.title}
                </p>
                <p className={`text-3xl sm:text-5xl font-bold ${metric.valueColor}`}>
                  {metric.value}
                </p>
              </div>
              <div className={`p-3 sm:p-4 rounded-xl ${metric.color} flex-shrink-0`}>
                <div className={`${metric.iconColor} [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-10 sm:[&>svg]:h-10`}>{metric.icon}</div>
              </div>
            </div>
            {metric.subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 mt-2 pt-3 sm:pt-4 border-t border-gray-100">
                {metric.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {primaryMetrics.map((card) => (
          <div key={card.title} className="card p-3 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className={`p-2 sm:p-3 rounded-lg ${card.color} w-fit`}>{card.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">{card.title}</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
            {card.subtitle && (
              <p className="text-xs text-gray-500 mb-2 sm:mb-3 line-clamp-2">{card.subtitle}</p>
            )}
            {card.href && (
              <Link
                to={card.href}
                className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center"
              >
                Ver detalles →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Acciones Rápidas</h2>
          <div className="space-y-2">
            <Link
              to="/anuncios"
              className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <Megaphone className="text-primary-600" size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 text-sm sm:text-base">Añadir nuevo anuncio</p>
                <p className="text-xs sm:text-sm text-gray-500 truncate">Crear un nuevo anuncio inmobiliario</p>
              </div>
            </Link>
            <Link
              to="/configuracion"
              className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-purple-50 rounded-lg">
                <MessageSquare className="text-purple-600" size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 text-sm sm:text-base">Configurar estilo del bot</p>
                <p className="text-xs sm:text-sm text-gray-500 truncate">Personalizar el tono de las respuestas</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Resumen</h2>
          <div className="space-y-2 sm:space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Anuncios activos</span>
              <span className="font-semibold text-primary-600">{stats.anunciosActivos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Conversaciones activas</span>
              <span className="font-semibold text-purple-600">{stats.conversacionesActivas}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Leads cualificados</span>
              <span className="font-semibold text-emerald-600">{stats.cualificados}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasa de cualificación</span>
              <span className="font-semibold text-orange-600">{stats.tasaCualificacion}%</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-gray-600">Tasa de conversión</span>
              <span className="font-semibold text-pink-600">{stats.conversionRate}%</span>
            </div>
            <div className="text-xs text-gray-500">
              {stats.vendidosACualificados} ventas + {stats.alquiladosACualificados} alquileres a leads cualificados
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
