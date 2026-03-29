import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
    MessageSquare,
    Phone,
    TrendingUp,
    ArrowRight
} from "lucide-react";

import dashboardImg from "../assets/landing/dashboard.png";
import marcosImg from "../assets/landing/marcos.png";
import idealistaImg from "../assets/landing/idealista_anuncio.png";
import whatsappBubbleIcon from "../assets/landing/whatsapp_bubble_icon.webp";

const WHATSAPP_DURATION = 14000; // 14s for whatsapp phase
const VOICE_DURATION = 14000;    // 14s for voice phase

// SVG circular progress dot — the ring IS the border of the dot
function ProgressRing({ active, completed, color, duration, inactive }: { active: boolean; completed: boolean; color: string; duration: number; inactive?: boolean }) {
    const size = 36;
    const r = 14;
    const circ = 2 * Math.PI * r;
    
    // If completed it stays full (offset 0), otherwise it starts empty (offset circ)
    const baseOffset = completed ? 0 : circ;

    return (
        <svg
            width={size} height={size}
            style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
            <style>
                {`
                    @keyframes ringFill {
                        from { stroke-dashoffset: ${circ}; }
                        to { stroke-dashoffset: 0; }
                    }
                `}
            </style>
            {/* Track */}
            <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke={inactive ? '#e2e8f0' : `${color}30`} strokeWidth="3" />
            {/* Progress arc */}
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={inactive ? '#e2e8f0' : color}
                strokeWidth="3"
                strokeDasharray={circ}
                strokeDashoffset={baseOffset}
                strokeLinecap="round"
                style={
                    active 
                        ? { animation: `ringFill ${duration}ms linear forwards` } 
                        : { transition: 'stroke-dashoffset 0.3s ease' }
                }
            />
            {/* Inner filled dot */}
            <circle
                cx={size / 2} cy={size / 2} r={6}
                fill={inactive ? '#cbd5e1' : color}
                style={{ transition: 'fill 0.4s ease' }}
            />
        </svg>
    );
}

// Messages rendered with key-based restart + staggered opacity-only CSS delays
function WhatsAppBubbles({ whatsappBubbleIcon }: { whatsappBubbleIcon: string }) {
    return (
        <div className="w-full flex flex-col gap-3 land-float-bob">
            {/* Marcos Msg 1 */}
            <div className="land-msg land-msg-1 self-start bg-white p-3 rounded-2xl rounded-tl-none shadow-xl border border-emerald-50 max-w-[95%]">
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-50">
                    <div className="w-5 h-5 flex-shrink-0">
                        <img src={whatsappBubbleIcon} alt="WhatsApp" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Marcos</span>
                </div>
                <div className="text-[10.5px] font-medium text-slate-700 leading-tight space-y-1">
                    <p>Hola, soy Marcos, el asistente virtual de Paco Granados.</p>
                    <p>Te has interesado en: <span className="text-primary-600 underline">idealista/110974426</span></p>
                    <ul className="pl-2 border-l-2 border-emerald-100 text-[9.5px] opacity-70">
                        <li>· Temporada hasta Agosto.</li>
                        <li>· Suministros aparte.</li>
                    </ul>
                </div>
            </div>

            {/* User Response */}
            <div className="land-msg land-msg-2 self-end bg-[#dcf8c6] p-3 rounded-2xl rounded-tr-none shadow-xl border border-emerald-100/20 max-w-[90%]">
                <p className="text-[10.5px] font-medium text-slate-800 leading-tight">Si, estamos de acuerdo</p>
            </div>

            {/* Marcos Msg 2 */}
            <div className="land-msg land-msg-3 self-start bg-white p-3 rounded-2xl rounded-tl-none shadow-xl border border-emerald-50 max-w-[95%]">
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-50">
                    <div className="w-5 h-5 flex-shrink-0">
                        <img src={whatsappBubbleIcon} alt="WhatsApp" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Marcos</span>
                </div>
                <p className="text-[10.5px] font-medium text-slate-700 leading-tight">
                    Genial. Necesito 3 datos: ¿ingresos netos? ¿mascotas? ¿entrada inmediata?
                </p>
            </div>
        </div>
    );
}

function VoiceBubbles() {
    return (
        <div className="w-full flex flex-col gap-3 land-float-bob-delayed">
            {/* Voice Msg 1 */}
            <div className="land-msg land-msg-1 self-start bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl rounded-tl-none shadow-xl border border-white/10 max-w-[95%]">
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                    <div className="w-5 h-5 flex-shrink-0 text-primary-500"><Phone size={16} /></div>
                    <span className="text-[9px] font-bold text-primary-500 uppercase tracking-widest leading-none">Asistente de Voz</span>
                </div>
                <p className="text-[10.5px] font-medium text-white leading-tight">
                    Hola, soy Marcos. ¿Cuál es la referencia de la vivienda?...
                </p>
            </div>

            {/* User Voice response */}
            <div className="land-msg land-msg-2 self-end bg-primary-600 p-3 rounded-2xl rounded-tr-none shadow-xl max-w-[80%]">
                <p className="text-[12px] font-bold text-white tracking-widest leading-none">110974426</p>
            </div>

            {/* Voice Msg 2 */}
            <div className="land-msg land-msg-3 self-start bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl rounded-tl-none shadow-xl border border-white/10 max-w-[95%]">
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                    <div className="w-5 h-5 flex-shrink-0 text-primary-500"><Phone size={16} /></div>
                    <span className="text-[9px] font-bold text-primary-500 uppercase tracking-widest leading-none">Asistente de Voz</span>
                </div>
                <p className="text-[10.5px] font-medium text-white leading-tight">
                    Recibirás un SMS para continuar por WhatsApp y agendar tu visita.
                </p>
            </div>
        </div>
    );
}

export function Landing() {
    const [phase, setPhase] = useState<0 | 1>(0); // 0 = whatsapp, 1 = voice
    const [phaseKey, setPhaseKey] = useState(0); // forces re-mount of bubbles and progress ring

    const switchToPhase = useCallback((p: 0 | 1) => {
        setPhase(p);
        setPhaseKey(k => k + 1);
    }, []);

    useEffect(() => {
        const duration = phase === 0 ? WHATSAPP_DURATION : VOICE_DURATION;
        const timer = setTimeout(() => {
            switchToPhase(phase === 0 ? 1 : 0);
        }, duration);
        return () => clearTimeout(timer);
    }, [phase, phaseKey, switchToPhase]);

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans">
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
                        className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-2.5 rounded-btn text-sm font-semibold transition-all active:scale-95"
                    >
                        Iniciar sesión
                    </Link>
                </div>
            </nav>

            {/* Hero and Interaction Sections with unified gradient and arched bottom */}
            <div className="bg-gradient-to-b from-white via-[#fff7e6] to-[#ffb03f] relative overflow-hidden">
                {/* Hero Section */}
                <section className="relative pt-4 pb-8 lg:pt-8 lg:pb-12 bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-2xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold uppercase tracking-wider mb-6 border border-primary-100">
                            <TrendingUp size={14} />
                            Automatización Inteligente para Inmobiliarias
                        </div>
                        <h1 className="text-3xl lg:text-5xl font-extrabold text-slate-900 leading-[1.2] mb-6 tracking-tight">
                            No pierdas ni un solo lead más <span className="text-primary-500">por falta de tiempo.</span>
                        </h1>
                        <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
                            Proplead es la plataforma definitiva que utiliza IA para calificar leads 24/7 vía WhatsApp y llamadas de voz, permitiéndote cerrar más ventas mientras te enfocas en lo que importa.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                            <Link to="/login" className="w-full sm:w-auto px-10 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold text-lg transition-all flex items-center justify-center gap-2 group">
                                Empezar ahora <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <a href="#demo" className="w-full sm:w-auto px-10 py-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-btn font-bold text-lg transition-all">
                                Ver demostración
                            </a>
                        </div>
                        <div className="mt-8 flex items-center justify-center gap-6 opacity-60 grayscale">
                            <span className="text-sm font-semibold">Integraciones:</span>
                            <span className="font-bold flex items-center gap-1"><MessageSquare size={16} /> WhatsApp</span>
                            <span className="font-bold flex items-center gap-1"><Phone size={16} /> Vapi</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interaction Section */}
            <section id="dolores" className="relative pt-16 lg:pt-24 pb-32 bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                    <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 mb-20 lg:mb-32 px-4">

                        {/* ── Left: Vertical Timeline ── */}
                        <div className="flex-shrink-0 w-full lg:w-[340px] mb-12 lg:mb-0 flex justify-end">
                            <div className="w-full max-w-[280px]">
                            {/* Line connecting the two dots */}
                            <div className="relative flex flex-col">
                                {/* Connector line — between the two dots */}
                                <div className="absolute left-[17px] top-[42px] bottom-[42px] w-0.5 bg-slate-200 z-0" />

                                {/* WhatsApp Timeline Node */}
                                <button
                                    onClick={() => switchToPhase(0)}
                                    className="relative flex items-center gap-4 py-4 text-left group focus:outline-none"
                                >
                                    {/* Progress dot */}
                                    <div className="relative flex-shrink-0 z-10" key={`wa-ring-${phaseKey}`}>
                                        <ProgressRing
                                            active={phase === 0}
                                            completed={false}
                                            duration={WHATSAPP_DURATION}
                                            color="#10b981"
                                            inactive={phase !== 0}
                                        />
                                    </div>
                                    <div>
                                        <h3 className={`text-base font-bold mb-1 transition-colors ${phase === 0 ? 'text-emerald-700' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                            Cualificación por WhatsApp
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            Filtra interesados capturando ingresos y preferencias de forma automática 24/7.
                                        </p>
                                    </div>
                                </button>

                                {/* Voice Timeline Node */}
                                <button
                                    onClick={() => switchToPhase(1)}
                                    className="relative flex items-center gap-4 py-4 text-left group focus:outline-none"
                                >
                                    {/* Progress dot */}
                                    <div className="relative flex-shrink-0 z-10" key={`voice-ring-${phaseKey}`}>
                                        <ProgressRing
                                            active={phase === 1}
                                            completed={false}
                                            duration={VOICE_DURATION}
                                            color="#3b82f6"
                                            inactive={phase !== 1}
                                        />
                                    </div>
                                    <div>
                                        <h3 className={`text-base font-bold mb-1 transition-colors ${phase === 1 ? 'text-primary-700' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                            Cualificación por Voz
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            Atiende llamadas con IA conversacional y envía SMS para agendar visitas.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                        </div>

                        {/* ── Center: Idealista Screenshot ── */}
                        <div className="relative w-full lg:w-[45%] max-w-[550px] z-30 flex-shrink-0">
                            <div className="relative bg-white rounded overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                                <img
                                    src={idealistaImg}
                                    alt="Idealista Announcement"
                                    className="w-full h-auto"
                                />

                                {/* Hotspot: WhatsApp chat button — green during phase 0, hidden during phase 1 */}
                                <div
                                    className={`absolute top-[49%] right-[5.5%] flex items-center justify-center pointer-events-none transition-all duration-500 ${
                                        phase === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                                    }`}
                                >
                                    <div className="absolute w-6 h-6 bg-emerald-500 rounded-full animate-ping opacity-70" />
                                    <div className="relative w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                                </div>

                                {/* Hotspot: Phone button — blue during phase 1, hidden during phase 0 */}
                                <div
                                    className={`absolute top-[56.5%] right-[14%] flex items-center justify-center pointer-events-none transition-all duration-500 ${
                                        phase === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                                    }`}
                                >
                                    <div className="absolute w-6 h-6 bg-primary-500 rounded-full animate-ping opacity-70" />
                                    <div className="relative w-3 h-3 bg-primary-500 border-2 border-white rounded-full" />
                                </div>
                            </div>
                        </div>

                        {/* ── Right: Marcos + Conversation Bubbles ── */}
                        <div className="relative flex items-center gap-4 min-h-[300px] lg:min-h-[350px] w-full lg:w-[340px] flex-shrink-0">
                            {/* Marcos avatar */}
                            <div className="z-20 w-16 h-16 lg:w-20 lg:h-20 rounded-full border-[4px] border-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] overflow-hidden bg-white hover:scale-110 transition-transform duration-500 flex-shrink-0">
                                <img src={marcosImg} alt="Marcos" className="w-full h-full object-cover" />
                            </div>

                            {/* Bubble area */}
                            <div className="relative flex-1 min-h-[300px]">
                                {/* WhatsApp Bubbles */}
                                <div
                                    key={`wa-${phaseKey}`}
                                    className={`absolute z-30 flex flex-col gap-2 top-1/2 -translate-y-1/2 left-0 w-[220px] lg:w-[300px] select-none origin-left transition-all duration-500 ${
                                        phase === 0
                                            ? 'opacity-100 scale-100 translate-x-0'
                                            : 'opacity-0 scale-90 -translate-x-4 pointer-events-none'
                                    }`}
                                >
                                    <WhatsAppBubbles whatsappBubbleIcon={whatsappBubbleIcon} />
                                </div>

                                {/* Voice Bubbles */}
                                <div
                                    key={`voice-${phaseKey}`}
                                    className={`absolute z-30 flex flex-col gap-2 top-1/2 -translate-y-1/2 left-0 w-[200px] lg:w-[280px] select-none origin-left transition-all duration-500 ${
                                        phase === 1
                                            ? 'opacity-100 scale-100 translate-x-0'
                                            : 'opacity-0 scale-90 -translate-x-4 pointer-events-none'
                                    }`}
                                >
                                    <VoiceBubbles />
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </section>

            {/* Inverted Arch shape extending into the gradient */}
            <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-[0] pointer-events-none">
                <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="block w-full h-[50px] lg:h-[100px]">
                    <path d="M0 120 Q 600 0 1200 120 Z" fill="#f8fafc" />
                </svg>
            </div>
        </div>

            {/* Demo Section */}
            <section id="demo" className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl lg:text-4xl font-bold mb-4 tracking-tight">Control total en la palma de tu mano</h2>
                        <p className="text-base text-slate-600 max-w-2xl mx-auto">Interfáz diseñada para la velocidad y la toma de decisiones basada en datos reales.</p>
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
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="bg-slate-900 rounded-[48px] p-12 lg:p-20 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <h2 className="text-3xl lg:text-5xl font-bold text-white mb-8">¿Listo para escalar tus operaciones?</h2>
                        <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">Únete a cientos de inmobiliarias que ya están ahorrando miles de horas al mes con automatización inteligente.</p>
                        <Link to="/login" className="inline-flex items-center gap-2 px-12 py-6 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold text-xl transition-all active:scale-95">
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
