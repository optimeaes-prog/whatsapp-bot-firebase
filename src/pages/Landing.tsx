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

        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
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
      </div>
    </div>
  );
}
