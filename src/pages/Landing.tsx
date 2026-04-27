import { Link } from "react-router-dom";

export function Landing() {
  return (
    <div className="min-h-screen text-slate-900 font-body relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-primary-50 to-slate-50" />

      <div className="relative min-h-screen flex flex-col">
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Proplead" className="h-8 w-auto" />
            </div>
            <Link
              to="/login"
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-btn text-sm font-bold font-heading transition-all active:scale-95"
            >
              Iniciar sesión
            </Link>
          </div>
        </nav>

        <main className="min-h-screen flex items-center justify-center relative z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-48 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-black uppercase tracking-widest mb-6 border border-primary-100 font-heading">
              Estamos trabajando en la web
            </div>
            <h1 className="text-3xl lg:text-6xl font-extrabold text-slate-900 leading-[1.15] mb-6 tracking-tight lg:whitespace-nowrap font-special">
              Estamos mejorando Proplead para ti.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Gracias por tu paciencia. En este momento estamos actualizando la página para que la experiencia sea más clara y rápida.
              <br />
              Si ya tienes acceso, puedes iniciar sesión.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/login"
                className="px-10 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold font-heading text-lg transition-all active:scale-95 shadow-lg shadow-primary-500/20"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </main>

        <footer className="bg-white py-24 mb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-start gap-12 border-t border-slate-100 pt-16 opacity-40 hover:opacity-100 transition-opacity duration-500">
              <div className="max-w-xs">
                <img src="/logo.png" alt="Proplead" className="h-4 w-auto mb-6 grayscale" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-heading">Detalles de la empresa</p>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p className="font-bold text-slate-500">Talmate Limited</p>
                  <p>Reg no: 16733027</p>
                  <p>191 King's Cross Road, Flat 2</p>
                  <p>LDN WC1X 9DB (UK)</p>
                  <p className="pt-2">T: +44 7832 035605</p>
                  <p>E: e.perezreyes@proplead.io</p>
                </div>
              </div>

              <div className="flex flex-col md:items-end gap-6 pt-2">
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-[11px] font-bold text-slate-400 font-heading">
                  <Link to="/aviso-legal" className="hover:text-primary-500 transition-colors">Aviso Legal</Link>
                  <Link to="/legal/terms" className="hover:text-primary-500 transition-colors">Términos</Link>
                  <Link to="/legal/privacy-policy" className="hover:text-primary-500 transition-colors">Privacidad</Link>
                </div>
                <p className="text-[9px] text-slate-300 font-medium">
                  © 2026 Proplead | Marca comercial de Talmate Limited
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
