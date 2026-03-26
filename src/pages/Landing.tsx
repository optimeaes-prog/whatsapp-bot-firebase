import { Link } from "react-router-dom";
import {
    MessageSquare,
    Phone,
    Clock,
    TrendingUp,
    Users,
    ArrowRight,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

import heroImg from "../assets/landing/hero.png";
import dashboardImg from "../assets/landing/dashboard.png";
import whatsappImg from "../assets/landing/whatsapp.png";
import voiceImg from "../assets/landing/voice.png";

export function Landing() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/20">P</div>
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">Proplead</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                        <a href="#dolores" className="hover:text-primary-600 transition-colors">Problemas</a>
                        <a href="#solucion" className="hover:text-primary-600 transition-colors">Solución</a>
                        <a href="#demo" className="hover:text-primary-600 transition-colors">Demostración</a>
                    </div>
                    <Link
                        to="/login"
                        className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-full text-sm font-semibold transition-all hover:shadow-lg active:scale-95"
                    >
                        Iniciar sesión
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative overflow-hidden pt-20 pb-16 lg:pt-32 lg:pb-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold uppercase tracking-wider mb-6 border border-primary-100">
                                <TrendingUp size={14} />
                                Automatización Inteligente para Inmobiliarias
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-8 tracking-tight">
                                No pierdas ni un solo lead más <span className="text-primary-500">por falta de tiempo.</span>
                            </h1>
                            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl">
                                Proplead es la plataforma definitiva que utiliza IA para calificar leads 24/7 vía WhatsApp y llamadas de voz, permitiéndote cerrar más ventas mientras te enfocas en lo que importa.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                                <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-primary-500/25 flex items-center justify-center gap-2 group">
                                    Empezar ahora <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <a href="#demo" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg transition-all">
                                    Ver demostración
                                </a>
                            </div>
                            <div className="mt-12 flex items-center justify-center lg:justify-start gap-6 opacity-60 grayscale">
                                <span className="text-sm font-semibold">Integraciones:</span>
                                <span className="font-bold flex items-center gap-1"><MessageSquare size={16} /> WhatsApp</span>
                                <span className="font-bold flex items-center gap-1"><Phone size={16} /> Vapi</span>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-primary-500/10 to-transparent rounded-full blur-3xl"></div>
                            <img
                                src={heroImg}
                                alt="Proplead Hero"
                                className="relative z-10 rounded-3xl shadow-2xl border border-white/20 transform hover:scale-[1.02] transition-transform duration-500"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Pain Points Section */}
            <section id="dolores" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-5xl font-bold mb-4 tracking-tight">El costo de la gestión manual es demasiado alto</h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">La mayoría de los agentes inmobiliarios pierden el 70% de sus leads por estas razones:</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-3xl bg-red-50 border border-red-100 group hover:scale-105 transition-all">
                            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-6 group-hover:bg-red-200 transition-colors">
                                <Clock size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-red-900">Respuesta tardía</h3>
                            <p className="text-red-700/80 leading-relaxed">Si no respondes en los primeros 5 minutos, la probabilidad de conversión cae un 400%. La vida real no permite estar 24/7 pegado al teléfono.</p>
                        </div>
                        <div className="p-8 rounded-3xl bg-orange-50 border border-orange-100 group hover:scale-105 transition-all">
                            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:bg-orange-200 transition-colors">
                                <AlertCircle size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-orange-900">Falta de filtros</h3>
                            <p className="text-orange-700/80 leading-relaxed">Pierdes horas en llamadas con curiosos que no tienen presupuesto o interés real, descuidando a los leads altamente cualificados.</p>
                        </div>
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 group hover:scale-105 transition-all">
                            <div className="w-14 h-14 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-600 mb-6 group-hover:bg-slate-300 transition-colors">
                                <Users size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-slate-900">Seguimiento olvidado</h3>
                            <p className="text-slate-700/80 leading-relaxed">Muchos leads mueren en la bandeja de entrada porque el seguimiento manual es insostenible cuando manejas decenas de anuncios.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Solution Section */}
            <section id="solucion" className="py-24 bg-slate-900 text-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="order-2 lg:order-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="mt-8 space-y-4">
                                    <img src={whatsappImg} alt="WhatsApp Automation" className="rounded-2xl shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-500" />
                                    <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl">
                                        <CheckCircle2 className="text-primary-500 mb-2" />
                                        <p className="text-sm font-medium">Calificación Automática 24/7</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl">
                                        <CheckCircle2 className="text-primary-500 mb-2" />
                                        <p className="text-sm font-medium">Llamadas de Voz con IA</p>
                                    </div>
                                    <img src={voiceImg} alt="Voice AI" className="rounded-2xl shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-500" />
                                </div>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <h2 className="text-3xl lg:text-5xl font-bold mb-8 leading-tight">Proplead trabaja por ti, <span className="text-primary-500 text-4xl lg:text-6xl block mt-2">mientras tú cierras tratos.</span></h2>
                            <ul className="space-y-6">
                                {[
                                    { title: "Chatbot de WhatsApp Líder", desc: "Nuestra IA no solo responde, conversa. Entiende el contexto, pregunta por presupuestos y filtra por intereses reales." },
                                    { title: "Asistente de Voz Inteligente", desc: "Si el lead es cualificado, nuestra IA puede llamarle instantáneamente para confirmar datos o agendar visitas." },
                                    { title: "Dashboard Centralizado", desc: "Visualiza en tiempo real el estado de cada conversación y anuncio. Toma el control total de tu embudo de ventas." }
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-slate-900">
                                            <CheckCircle2 size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold mb-1">{item.title}</h4>
                                            <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demo Section */}
            <section id="demo" className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-5xl font-bold mb-4 tracking-tight">Control total en la palma de tu mano</h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">Interfáz diseñada para la velocidad y la toma de decisiones basada en datos reales.</p>
                    </div>
                    <div className="bg-white p-4 lg:p-8 rounded-[40px] shadow-2xl border border-slate-200">
                        <img
                            src={dashboardImg}
                            alt="Proplead Dashboard"
                            className="rounded-[32px] w-full"
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary-500/5"></div>
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="bg-slate-900 rounded-[48px] p-12 lg:p-20 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8">¿Listo para escalar tus operaciones?</h2>
                        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">Únete a cientos de inmobiliarias que ya están ahorrando miles de horas al mes con automatización inteligente.</p>
                        <Link to="/login" className="inline-flex items-center gap-2 px-10 py-5 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl font-bold text-xl transition-all shadow-xl shadow-primary-500/20 active:scale-95">
                            Empieza ahora gratis <ArrowRight />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold tracking-tighter">P</div>
                            <span className="text-xl font-bold text-slate-900 tracking-tight">Proplead</span>
                        </div>
                        <div className="flex gap-8 text-sm font-medium text-slate-500">
                            <a href="#" className="hover:text-primary-600 transition-colors">Términos</a>
                            <a href="#" className="hover:text-primary-600 transition-colors">Privacidad</a>
                            <a href="#" className="hover:text-primary-600 transition-colors">Contacto</a>
                        </div>
                        <p className="text-sm text-slate-400 underline underline-offset-4">© 2026 Proplead. Todos los derechos reservados.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
