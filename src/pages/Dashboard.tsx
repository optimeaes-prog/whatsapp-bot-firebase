import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Users, MessageSquare, CheckCircle, TrendingUp } from "lucide-react";
import { getAnuncios } from "../services/anuncios";
import { getLeads } from "../services/leads";
import { getConversaciones } from "../services/conversaciones";
import { getCualificados } from "../services/cualificados";

type Stats = {
  anuncios: number;
  leads: number;
  conversaciones: number;
  conversacionesActivas: number;
  cualificados: number;
  tasaCualificacion: number;
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    anuncios: 0,
    leads: 0,
    conversaciones: 0,
    conversacionesActivas: 0,
    cualificados: 0,
    tasaCualificacion: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [anuncios, leads, conversaciones, cualificados] = await Promise.all([
          getAnuncios(),
          getLeads(),
          getConversaciones(),
          getCualificados(),
        ]);

        const conversacionesActivas = conversaciones.filter((c) => !c.isFinished).length;
        const tasaCualificacion =
          conversaciones.length > 0
            ? Math.round((cualificados.length / conversaciones.length) * 100)
            : 0;

        setStats({
          anuncios: anuncios.length,
          leads: leads.length,
          conversaciones: conversaciones.length,
          conversacionesActivas,
          cualificados: cualificados.length,
          tasaCualificacion,
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-6 bg-gray-300 rounded w-12"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
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

  const statCards = [
    {
      title: "Anuncios",
      value: stats.anuncios,
      icon: <Megaphone className="text-blue-600" size={24} />,
      href: "/anuncios",
      color: "bg-blue-50",
    },
    {
      title: "Leads",
      value: stats.leads,
      icon: <Users className="text-green-600" size={24} />,
      href: "/leads",
      color: "bg-green-50",
    },
    {
      title: "Conversaciones",
      value: stats.conversaciones,
      subtitle: `${stats.conversacionesActivas} activas`,
      icon: <MessageSquare className="text-purple-600" size={24} />,
      href: "/conversaciones",
      color: "bg-purple-50",
    },
    {
      title: "Cualificados",
      value: stats.cualificados,
      icon: <CheckCircle className="text-emerald-600" size={24} />,
      href: "/cualificados",
      color: "bg-emerald-50",
    },
    {
      title: "Tasa de Cualificación",
      value: `${stats.tasaCualificacion}%`,
      icon: <TrendingUp className="text-orange-600" size={24} />,
      color: "bg-orange-50",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="card">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.color}`}>{card.icon}</div>
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-gray-400">{card.subtitle}</p>
                )}
              </div>
            </div>
            {card.href && (
              <Link
                to={card.href}
                className="mt-4 block text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Ver detalles →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="space-y-2">
            <Link
              to="/anuncios"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-blue-50 rounded-lg">
                <Megaphone className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Añadir nuevo anuncio</p>
                <p className="text-sm text-gray-500">Crear un nuevo anuncio inmobiliario</p>
              </div>
            </Link>
            <Link
              to="/configuracion"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-purple-50 rounded-lg">
                <MessageSquare className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Configurar estilo del bot</p>
                <p className="text-sm text-gray-500">Personalizar el tono de las respuestas</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Conversaciones activas</span>
              <span className="font-semibold text-gray-900">{stats.conversacionesActivas}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Leads cualificados</span>
              <span className="font-semibold text-emerald-600">{stats.cualificados}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasa de conversión</span>
              <span className="font-semibold text-orange-600">{stats.tasaCualificacion}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
