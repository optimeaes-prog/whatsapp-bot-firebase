import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "./ui";
import { saveCheckoutIntent } from "../lib/checkoutStorage";
import type { SubscriptionPlanId } from "../types";

export interface CheckoutBreakdownData {
  planId: string;
  planName: string;
  basePrice: number;
  billing: "monthly" | "year";
  extraBlocks: number;
  totalConversations: number;
  totalPrice: number;
}

export function BreakdownModal({
  data,
  onClose,
}: {
  data: CheckoutBreakdownData | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!data) return null;

  const handleProceed = () => {
    setLoading(true);
    saveCheckoutIntent({
      planId: data.planId as SubscriptionPlanId,
      billingInterval: data.billing === "monthly" ? "month" : "year",
      extraBlocks: data.extraBlocks,
    });
    // Add brief delay to show loading state before navigation
    setTimeout(() => {
      navigate("/login");
    }, 400);
  };

  const periodLabel = data.billing === "monthly" ? "mes" : "año";
  const annualDiscountFactor = 0.85; // 15% discount
  
  // Calculate block price depending on billing: 10/mo or 8.5/mo * 12
  const extraBlockPrice = 10;
  const blockUnitPrice = data.billing === "monthly" 
    ? extraBlockPrice 
    : extraBlockPrice * 12 * annualDiscountFactor;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm relative animate-in fade-in zoom-in-95 duration-200">
        {/* Ticket Container */}
        <div className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-t-2xl overflow-hidden flex flex-col pt-8">
          
          {/* Header */}
          <div className="px-8 pb-6 text-center border-b border-gray-50">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-50 rounded-full mb-3 text-primary-600">
              <Check size={24} strokeWidth={3} />
            </div>
            <h3 className="text-xs font-black font-heading text-primary-600 uppercase tracking-[0.2em] mb-1">
              Confirmación de Orden
            </h3>
            <h2 className="text-2xl font-black font-heading text-gray-900 tracking-tight">RESUMEN</h2>
          </div>

          {/* Perforation Line Section */}
          <div className="relative h-6 flex items-center -mx-3">
             <div className="w-6 h-6 rounded-full bg-black/60 shadow-inner z-10 -ml-3" />
             <div className="flex-1 border-t-2 border-dashed border-gray-100" />
             <div className="w-6 h-6 rounded-full bg-black/60 shadow-inner z-10 -mr-3" />
          </div>

          {/* Ticket Body */}
          <div className="px-8 py-2 flex-1">
            <div className="space-y-5">
              {/* Item: Plan Base */}
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">Suscripción</p>
                  <p className="font-bold text-gray-900 leading-tight">Proplead {data.planName}</p>
                  <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                    80 conversaciones/{periodLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-gray-900">{data.basePrice.toFixed(2)}€</p>
                </div>
              </div>

              {/* Item: Extra Blocks */}
              {data.extraBlocks > 0 && (
                <div className="flex justify-between items-start pt-4 border-t border-gray-50">
                  <div className="flex-1 pr-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">Complementos</p>
                    <p className="font-bold text-gray-900 leading-tight">
                      {data.extraBlocks} {data.extraBlocks === 1 ? "Bloque extra" : "Bloques extras"}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      +{40 * data.extraBlocks} conversaciones
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-mono font-bold text-gray-900">+{(blockUnitPrice * data.extraBlocks).toFixed(2)}€</p>
                  </div>
                </div>
              )}

              {/* Totals Section */}
              <div className="pt-6 border-t border-primary-100 mt-2">
                <div className="flex justify-between items-center text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                  <span>Volumen Total</span>
                  <span className="text-gray-900">{data.totalConversations} conv./{periodLabel}</span>
                </div>
                
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900 uppercase tracking-tighter">Total {data.billing === "year" ? "Anual" : "Mensual"}</p>
                    {data.billing === "year" && (
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                        Dto. 15% incluido
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black font-mono text-gray-900 leading-none">
                      {data.totalPrice.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Receipt Note */}
            <div className="mt-8 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 italic">
               <p className="text-[10px] text-gray-500 text-center leading-relaxed">
                 Serás redirigido para completar el pago seguro en Stripe. Al proceder aceptas los términos de nuestro servicio.
               </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-8 pb-8 flex flex-col gap-3">
            <Button 
              onClick={handleProceed} 
              loading={loading} 
              className="w-full font-black font-heading h-12 shadow-xl shadow-primary-500/20 text-base" 
              size="lg" 
              variant="primary"
            >
              Proceder al pago
            </Button>
            <button 
              onClick={onClose} 
              className="text-xs font-black text-gray-400 hover:text-gray-600 transition-colors py-2 uppercase tracking-[0.2em]"
            >
              Cancelar
            </button>
          </div>

          {/* Zig-zag bottom edge */}
          <div 
            className="h-3 bg-white w-full" 
            style={{ 
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 95% 40%, 90% 100%, 85% 40%, 80% 100%, 75% 40%, 70% 100%, 65% 40%, 60% 100%, 55% 40%, 50% 100%, 45% 40%, 40% 100%, 35% 40%, 30% 100%, 25% 40%, 20% 100%, 15% 40%, 10% 100%, 5% 40%, 0 100%)" 
            }} 
          />
        </div>
      </div>
    </div>
  );
}
