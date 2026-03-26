import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Coins, CreditCard, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { CreditPackage } from "../types";
import { getUserCredits, getCreditPackages, createCheckoutSession, formatPrice } from "../services/credits";
import { cn } from "../lib/utils";

export function Credits() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Credits state
  const [credits, setCredits] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    loadCredits();

    // Check for payment status in URL params
    const payment = searchParams.get("payment");
    if (payment === "success") {
      setPaymentStatus("success");
      // Reload credits after successful payment
      setTimeout(() => loadCredits(), 1000);
      // Clear URL param after showing message
      setTimeout(() => {
        setSearchParams({});
        setPaymentStatus(null);
      }, 5000);
    } else if (payment === "cancelled") {
      setPaymentStatus("cancelled");
      setTimeout(() => {
        setSearchParams({});
        setPaymentStatus(null);
      }, 5000);
    }
  }, [searchParams, setSearchParams]);

  async function loadCredits() {
    try {
      setCreditsLoading(true);
      const [balance, pkgs] = await Promise.all([
        getUserCredits(),
        getCreditPackages(),
      ]);
      setCredits(balance);
      setPackages(pkgs);
    } catch (error) {
      console.error("Error loading credits:", error);
      // Use default packages if fetch fails
      setPackages([
        { id: "credits_50", name: "50 Créditos", amount: 500, credits: 50, currency: "eur" },
        { id: "credits_100", name: "100 Créditos", amount: 1000, credits: 100, currency: "eur" },
        { id: "credits_200", name: "200 Créditos", amount: 2000, credits: 200, currency: "eur" },
      ]);
    } finally {
      setCreditsLoading(false);
    }
  }

  async function handlePurchase(packageId: string) {
    setPurchaseLoading(packageId);
    try {
      const checkoutUrl = await createCheckoutSession(packageId);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Error al crear la sesión de pago. Por favor, inténtalo de nuevo.");
    } finally {
      setPurchaseLoading(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Coins className="text-amber-500" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Créditos</h1>
      </div>

      {/* Payment status banners */}
      {paymentStatus === "success" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="text-green-600" size={24} />
          <div>
            <p className="font-semibold text-green-800">¡Pago completado!</p>
            <p className="text-sm text-green-700">Tus créditos se han añadido a tu cuenta.</p>
          </div>
        </div>
      )}
      {paymentStatus === "cancelled" && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <XCircle className="text-amber-600" size={24} />
          <div>
            <p className="font-semibold text-amber-800">Pago cancelado</p>
            <p className="text-sm text-amber-700">El proceso de pago ha sido cancelado.</p>
          </div>
        </div>
      )}

      {/* Credits Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Saldo y Compra</h2>
        </div>

        {/* Current Balance */}
        <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium">Saldo actual</p>
              {creditsLoading ? (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="animate-spin text-amber-600" size={20} />
                  <span className="text-gray-500">Cargando...</span>
                </div>
              ) : (
                <p className="text-3xl font-bold text-amber-800">{credits.toLocaleString()} créditos</p>
              )}
            </div>
            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Coins className="text-amber-600" size={32} />
            </div>
          </div>
        </div>

        {/* Credit Packages */}
        <h3 className="text-md font-medium text-gray-700 mb-3">Comprar créditos</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="relative card bg-white border-2 border-gray-200 hover:border-primary-400 transition-all hover:shadow-lg"
            >
              {pkg.id === "credits_100" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
                    Popular
                  </span>
                </div>
              )}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Coins className="text-amber-500" size={20} />
                  <span className="text-2xl font-bold text-gray-900">{pkg.credits}</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{pkg.name}</p>
                <p className="text-xl font-bold text-primary-600 mb-4">
                  {formatPrice(pkg.amount, pkg.currency)}
                </p>
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchaseLoading !== null}
                  className={cn(
                    "w-full btn flex items-center justify-center gap-2",
                    pkg.id === "credits_100"
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {purchaseLoading === pkg.id ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      Comprar
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          1€ = 10 créditos • Pago seguro con Stripe
        </p>
      </div>
    </div>
  );
}
