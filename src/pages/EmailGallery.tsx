import { useState } from "react";
import { Mail, CheckCircle2, AlertTriangle, XCircle, CreditCard, Sparkles, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

type EmailType = "welcome" | "low_balance" | "payment_failed";

type EmailVersion = {
  id: string;
  type: EmailType;
  styleName: string;
  subject: string;
  previewText: string;
  render: (data: any) => React.ReactNode;
};

const EmailGallery = () => {
  const [activeType, setActiveType] = useState<EmailType>("welcome");

  const userData = {
    name: "Alex",
    balance: 8,
    orgName: "Proplead Real Estate",
    lastPaymentAmount: "39€",
  };

  const emailVersions: EmailVersion[] = [
    // --- WELCOME EMAILS ---
    {
        id: "w1",
        type: "welcome",
        styleName: "SaaS Official - Welcome",
        subject: "Welcome to Proplead, ¡todo está listo! 👋",
        previewText: "Tu asistente virtual acaba de encender los motores.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-primary-500 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary-500 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-primary-400/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-primary-50 text-primary-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <Sparkles size={12}/> Account Activated
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                ¡Bienvenido al club de la automatización!
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                Hola <strong>{data.name}</strong>, el motor de IA para <strong>{data.orgName}</strong> ya ha sido aprovisionado. Desde este momento tienes acceso completo a nuestra plataforma de calificación de leads.
                            </p>

                            <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                                <p className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4">🚀 Siguientes pasos</p>
                                <ul className="space-y-4">
                                   <li className="flex gap-3 text-sm text-slate-600">
                                      <div className="w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm text-primary-500">1</div>
                                      <span>Conecta tu número de WhatsApp escaneando el código QR en el panel.</span>
                                   </li>
                                   <li className="flex gap-3 text-sm text-slate-600">
                                      <div className="w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm text-primary-500">2</div>
                                      <span>Añade tu primer listado y define a tu Lead Ideal.</span>
                                   </li>
                                </ul>
                            </div>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary-500 hover:shadow-primary-200 transition-all flex justify-center items-center gap-2 group">
                                Iniciar Sesión <ArrowRight className="group-hover:translate-x-1 transition-all" size={18}/>
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <div className="flex justify-center gap-6 font-medium">
                            <a href="#" className="hover:text-primary-500 transition-colors">Academy & Docs</a>
                            <a href="#" className="hover:text-primary-500 transition-colors">Login Dashboard</a>
                        </div>
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies.<br/>
                            Has recibido este mensaje automático porque tu correo ha sido registrado en Proplead. No respondas a esta dirección.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: "w2",
        type: "welcome",
        styleName: "SaaS Official - Scan QR",
        subject: "Siguiente paso: Conecta WhatsApp 📱",
        previewText: "Dale vida a tu bot de ventas con un simple escaneo.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-primary-500 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary-500 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-primary-400/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-primary-50 text-primary-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <Zap size={12}/> Setup Pending
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                ¡El bot espera tus órdenes!
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                Todo el entorno está preparado, {data.name}. Para que la Inteligencia Artificial comience a responder a tus clientes automáticamente, necesitamos conectar la vía de comunicación principal.
                            </p>

                            <div className="bg-[#f0f9ff] p-6 rounded-2xl mb-8 border border-blue-100 flex items-start gap-4">
                                <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                                    <CheckCircle2 size={16} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-slate-800 mb-1">Vinculación en 1 click</p>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Entra en Configuración {'->'} WhatsApp y escanea el QR con tu teléfono (como si abrieras WhatsApp Web). Y listos.
                                    </p>
                                </div>
                            </div>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary-500 hover:shadow-primary-200 transition-all flex justify-center items-center gap-2 group">
                                Escanear ahora 
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: "w3",
        type: "welcome",
        styleName: "SaaS Official - Credits Bonus",
        subject: "Desbloqueado: Paquete de Conversaciones 🎁",
        previewText: "Tienes un bonus disponible en tu cuenta.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-primary-500 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary-500 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-primary-400/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-primary-50 text-primary-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <Sparkles size={12}/> Welcome Bonus
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Empezamos con buen pie.
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                Queremos que compruebes la eficiencia tecnológica antes de comprometerte, {data.name}. Hemos depositado crédito operativo en el depósito de <strong>{data.orgName}</strong>.
                            </p>

                            <div className="bg-amber-50 p-6 rounded-2xl mb-8 border border-amber-200 text-center">
                                <h2 className="text-4xl font-black text-amber-600 mb-2">+40</h2>
                                <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">Conversaciones Gratis</p>
                            </div>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary-500 hover:shadow-primary-200 transition-all">
                                Ir al HUB Principal
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        )
    },

    // --- LOW BALANCE EMAILS ---
    {
        id: "lb1",
        type: "low_balance",
        styleName: "SaaS Official - Low Balance Critical",
        subject: "Acción Crítica: Reservas al mínimo ⚠️",
        previewText: "La actividad del bot se suspenderá pronto.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-red-500 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-red-500 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-red-400/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-red-50 text-red-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <AlertTriangle size={12}/> Critical Warning
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Tu sistema está perdiendo energía.
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                <strong>{data.name}</strong>, el volumen de interacciones para tu organización es alto, y la reserva actual ha descendido peligrosamente al mínimo. 
                            </p>

                            <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                                <div className="flex justify-between text-sm text-slate-800 mb-2 font-bold">
                                    <span>Conversaciones Restantes</span>
                                    <span className="text-red-500">{data.balance} / 100</span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="bg-red-500 w-[8%] h-full"></div>
                                </div>
                                <p className="mt-4 text-[10px] text-slate-400 italic">
                                    Si el saldo llega a 0, dejaremos de enviar mensajes automáticos a WhatsApp, perdiendo posibles validaciones en tiempo real.
                                </p>
                            </div>

                            <button className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-900 transition-all flex justify-center items-center gap-2 group">
                                Recargar Saldo Manualmente
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. <br/>Este es un mensaje transaccional obligatorio.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: "lb2",
        type: "low_balance",
        styleName: "SaaS Official - Usage Milestone",
        subject: "¡Mucho tráfico detectado! 📈",
        previewText: "El saldo de conversaciones bajó un poco deprisa.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-primary-500 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary-500 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-primary-400/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-primary-50 text-primary-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <Zap size={12}/> High Usage
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Tu máquina está echando humo 🚂
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                ¡Eso es fantástico, {data.name}! Sin embargo, notamos que estás generando tantos leads que tu provisión de conversaciones está llegando a su fin para este mes (te quedan <strong>{data.balance}</strong>).
                            </p>

                            <div className="bg-primary-50 p-6 rounded-2xl mb-8 border border-primary-100 flex flex-col items-center">
                                <p className="text-sm font-bold text-primary-900 mb-2">Adelántate al tráfico y ahorra.</p>
                                <p className="text-xs text-primary-700/80 text-center mb-6">
                                    Puedes realizar una recarga en la sección Facturación o mejorar tu plan actual.
                                </p>
                                <button className="bg-primary-600 text-white font-bold py-3 px-8 rounded-xl text-sm shadow hover:bg-slate-900 transition-all">
                                    Ir a mi Facturación
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. Transaccional / Notificaciones de uso.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: "lb3",
        type: "low_balance",
        styleName: "SaaS Official - Pause Warning",
        subject: "Pausa programada del Agente Virtual ⏳",
        previewText: "Tus cupos se agotarán muy pronto.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-red-600 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-red-600 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-red-500/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-red-50 text-red-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <XCircle size={12}/> Immediate Attention
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Desconexión inminente de la IA.
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-8">
                                La cuota límite de su plan se excederá pronto (solo restan {data.balance} conversaciones). Nuestro sistema protegerá su infraestructura limitando la IA a modo lectura.
                            </p>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center mb-8 shadow-inner">
                                <div>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance restante</p>
                                     <p className="text-2xl font-black text-slate-800">{data.balance} conv.</p>
                                </div>
                                <div className="text-right">
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado futuro</p>
                                     <p className="text-sm font-bold text-red-500">Hibernación</p>
                                </div>
                            </div>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-red-600 transition-all flex justify-center items-center gap-2 group">
                                Impedir Pausa Automática
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. <br/>Recibes esto porque tienes alertas de saldo bajas limitadas a on.
                        </p>
                    </div>
                </div>
            </div>
        )
    },

    // --- PAYMENT FAILED EMAILS ---
    {
        id: "pf1",
        type: "payment_failed",
        styleName: "SaaS Official - Card Declined",
        subject: "Fallo en la renovación (Bloqueo Parcial) 💳",
        previewText: "Tu último pago con tarjeta ha sido devuelto.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-slate-900 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-slate-900 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-slate-800/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <CreditCard size={12}/> Billing Failed
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Tu pago no se procesó.
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                {data.name}, nuestro proveedor de pagos Stripe nos ha informado del rechazo del cargo mensual, posiblemente por caducidad o falta de fondos temporales.
                            </p>

                            <div className="bg-red-50/50 p-6 rounded-2xl mb-8 border border-red-100 text-center">
                                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Monto pendiente</p>
                                <p className="text-3xl font-mono text-red-800 font-bold">{data.lastPaymentAmount}</p>
                            </div>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-red-600 transition-all flex justify-center items-center gap-2 group">
                                Actualizar método de pago
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <div className="flex justify-center gap-6 font-medium">
                            <a href="#" className="hover:text-primary-500 transition-colors">Ver Facturas</a>
                        </div>
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. <br/>De partamento Administrativo.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: "pf2",
        type: "payment_failed",
        styleName: "SaaS Official - Robot Down",
        subject: "🤖 Parada técnica por impago.",
        previewText: "El asistente ha dejado de recibir instrucciones.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-slate-900 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-slate-900 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-slate-800/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <ShieldCheck size={12}/> Security Freeze
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Hemos bajado la persiana.
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                Un pago recurrente asociado a <strong>{data.orgName}</strong> sigue en status insolvente. Para proteger tu cuenta, hemos congelado los recursos de Inteligencia Artificial que estabas utilizando.
                            </p>

                            <ul className="mb-8 space-y-3">
                                <li className="flex items-center gap-2 text-sm text-slate-500 line-through opacity-70">
                                    <CheckCircle2 size={16} /> Recepción de mensajes.
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-500 line-through opacity-70">
                                    <CheckCircle2 size={16} /> Captación y guardado de leads.
                                </li>
                                <li className="flex items-center gap-2 text-sm text-red-500 font-medium">
                                    <XCircle size={16} /> Generación automática suspendida.
                                </li>
                            </ul>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary-500 transition-all flex justify-center items-center gap-2 group">
                                Reanudar Facturación ({data.lastPaymentAmount})
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. <br/>
                            Dispones de 14 días para subsanar el impago antes de la eliminación de los historiales de datos.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: "pf3",
        type: "payment_failed",
        styleName: "SaaS Official - Restricted Access",
        subject: "Bloqueo Activo y Deuda Pendiente 🔒",
        previewText: "Restricción importante en la cuenta.",
        render: (data) => (
            <div className="bg-slate-50 py-12 px-4 font-sans max-h-[800px] overflow-y-auto">
                <div className="max-w-[500px] mx-auto">
                    <div className="flex justify-center mb-8">
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                           <div className="w-6 h-6 bg-slate-900 rounded-md"></div> PROPLEAD
                        </div>
                    </div>

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-slate-900 rounded-3xl rotate-[-2deg] shadow-lg"></div>
                        <div className="absolute inset-0 bg-slate-800/50 rounded-3xl rotate-[2deg] shadow-md"></div>
                        
                        <div className="relative bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 flex flex-col">
                            <div className="flex items-center mb-6 gap-2">
                                <span className="bg-red-50 text-red-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1">
                                    <AlertTriangle size={12}/> Delinquent Invoice
                                </span>
                            </div>

                            <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight text-slate-900">
                                Cuenta degradada.
                            </h1>
                            
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                Tras múltiples intentos fallidos de procesar tu factura de <strong>{data.lastPaymentAmount}</strong>, el sistema ha activado un bloqueo de seguridad preventiva. Múltiples funcionalidades están restringidas.
                            </p>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-8 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Concepto Devuelto</p>
                                    <p className="text-slate-700 font-semibold">{data.orgName} - Renovation</p>
                                </div>
                                <a href="#" className="text-sm font-bold text-primary-500 hover:text-primary-700 underline">
                                    Ver recibo
                                </a>
                            </div>

                            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-red-600 transition-all flex justify-center items-center gap-2 group">
                                Pagar Cuota Ahora 
                            </button>
                        </div>
                    </div>

                    <div className="text-center space-y-4 px-6 text-slate-400 text-[10px] sm:text-xs">
                        <p className="opacity-60 pt-6 border-t border-slate-200 leading-relaxed">
                            © 2026 Proplead Technologies. <br/>
                            This is an automated administrative notification. Do not reply.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
  ];



  const filteredVersions = emailVersions.filter(v => v.type === activeType);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-8 border-b border-gray-200 bg-white shadow-sm sticky top-0 z-50">
        <h1 className="text-3xl font-black text-gray-900 mb-6 italic tracking-tight flex items-center gap-3">
          <Mail className="text-primary-500" size={32} />
          Email Template Gallery
        </h1>
        
        <div className="flex flex-wrap gap-2">
          {(["welcome", "low_balance", "payment_failed"] as EmailType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                "px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all border-2",
                activeType === type 
                  ? "bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-200 scale-105"
                  : "bg-white text-gray-400 border-gray-100 hover:border-primary-200 hover:text-gray-600"
              )}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-12">
        {filteredVersions.map((version) => (
          <div key={version.id} className="flex flex-col group h-fit">
            <div className="mb-4 flex items-center justify-between">
                <div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-primary-500 bg-primary-50 px-3 py-1 rounded-full mb-1 inline-block">
                     {version.styleName}
                   </span>
                   <h3 className="text-lg font-bold text-gray-900">{version.subject}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-primary-500 group-hover:border-primary-200 transition-all cursor-pointer">
                    <Mail size={18} />
                </div>
            </div>
            
            <div className="relative rounded-3xl overflow-hidden border-8 border-white shadow-xl transition-all group-hover:shadow-2xl group-hover:-translate-y-1">
               {/* Mobile/Email Container Emulation */}
               <div className="bg-white overflow-hidden max-h-[800px] overflow-y-auto custom-scrollbar">
                  {version.render(userData)}
               </div>
            </div>
            <div className="mt-4 text-[10px] text-gray-400 italic px-2">
              Preview Text: "{version.previewText}"
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default EmailGallery;
