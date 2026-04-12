import { useState, useEffect } from "react";
import { Check, RefreshCw, Type, Layout as LayoutIcon, Laptop, Palette } from "lucide-react";
import { Button, PageHeader } from "../components/ui";

const FONT_STACKS = [
  {
    id: "modern-leader",
    name: "The Modern Leader",
    description: "Strong SaaS identity with expressive hero titles.",
    special: "Bricolage Grotesque",
    heading: "Plus Jakarta Sans",
    body: "Inter",
    url: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500&display=swap"
  },
  {
    id: "sharp-geometric",
    name: "Sharp & Geometric",
    description: "Tech-focused, clean lines and perfect geometry.",
    special: "Outfit",
    heading: "Sora",
    body: "Public Sans",
    url: "https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Sora:wght@600;700&family=Public+Sans:wght@400;500&display=swap"
  },
  {
    id: "friendly-saas",
    name: "Friendly & Human",
    description: "Soft corners and approachable typography.",
    special: "Lexend",
    heading: "Manrope",
    body: "Figtree",
    url: "https://fonts.googleapis.com/css2?family=Lexend:wght@700;800&family=Manrope:wght@600;700&family=Figtree:wght@400;500&display=swap"
  },
  {
    id: "sophisticated-tech",
    name: "Sophisticated Tech",
    description: "Combination of serif elegance and sans-serif utility.",
    special: "Fraunces",
    heading: "IBM Plex Sans",
    body: "Urbanist",
    url: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,700&family=IBM+Plex+Sans:wght@600;700&family=Urbanist:wght@400;500&display=swap"
  },
  {
    id: "bold-contemporary",
    name: "Bold & Contemporary",
    description: "High contrast and unique personality.",
    special: "Syne",
    heading: "Space Grotesk",
    body: "Work Sans",
    url: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@600;700&family=Work+Sans:wght@400;500&display=swap"
  },
  {
    id: "classic-professional",
    name: "Classic Professional",
    description: "The gold standard of corporate SaaS reliability.",
    special: "Montserrat",
    heading: "Ubuntu",
    body: "Roboto",
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Ubuntu:wght@500;700&family=Roboto:wght@400;500&display=swap"
  }
];

export default function FontGallery() {
  const [activeStack, setActiveStack] = useState<string | null>(() => {
    return localStorage.getItem("active_font_stack");
  });

  useEffect(() => {
    // Inject google fonts if not already there
    FONT_STACKS.forEach(stack => {
      const linkId = `font-link-${stack.id}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = stack.url;
        document.head.appendChild(link);
      }
    });

    return () => {
      // Keep them to avoid flickering when switching
    };
  }, []);

  const applyStack = (stack: typeof FONT_STACKS[0]) => {
    const root = document.documentElement;
    root.style.setProperty("--font-special", `'${stack.special}', sans-serif`);
    root.style.setProperty("--font-heading", `'${stack.heading}', sans-serif`);
    root.style.setProperty("--font-body", `'${stack.body}', sans-serif`);
    
    // Also update the font-family on body directly to be sure
    document.body.style.fontFamily = `'${stack.body}', sans-serif`;
    
    setActiveStack(stack.id);
    localStorage.setItem("active_font_stack", stack.id);
    localStorage.setItem("font_special", stack.special);
    localStorage.setItem("font_heading", stack.heading);
    localStorage.setItem("font_body", stack.body);
  };

  const resetFonts = () => {
    const root = document.documentElement;
    root.style.removeProperty("--font-special");
    root.style.removeProperty("--font-heading");
    root.style.removeProperty("--font-body");
    document.body.style.fontFamily = "";
    setActiveStack(null);
    localStorage.removeItem("active_font_stack");
    localStorage.removeItem("font_special");
    localStorage.removeItem("font_heading");
    localStorage.removeItem("font_body");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12">
        <PageHeader 
          title="Laboratorio de Tipografía" 
          subtitle="Explora 6 combinaciones de fuentes (Special, Heading, Body) diseñadas para SaaS."
          actions={
            <Button variant="outline" size="sm" onClick={resetFonts}>
              <RefreshCw size={16} className="mr-2" />
              Restablecer
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {FONT_STACKS.map((stack) => {
          const isActive = activeStack === stack.id;
          
          return (
            <div 
              key={stack.id}
              className={`flex flex-col bg-white rounded-2xl border-2 transition-all p-6 shadow-sm hover:shadow-md ${isActive ? 'border-primary-500 ring-4 ring-primary-50' : 'border-gray-100'}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{stack.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{stack.description}</p>
                </div>
                {isActive && (
                  <div className="bg-primary-100 text-primary-700 p-1 rounded-full">
                    <Check size={16} />
                  </div>
                )}
              </div>

              {/* Preview Box */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6 space-y-6 flex-1 border border-gray-100">
                {/* Special Title */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Special Title (Hero)</span>
                  <p 
                    style={{ fontFamily: `'${stack.special}', sans-serif` }}
                    className="text-3xl font-extrabold text-gray-900 leading-tight"
                  >
                    Automatiza tus anuncios con IA
                  </p>
                </div>

                {/* Main Heading */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 font-heading">Page Title</span>
                  <p 
                    style={{ fontFamily: `'${stack.heading}', sans-serif` }}
                    className="text-xl font-bold text-gray-800"
                  >
                    Gestión de Leads
                  </p>
                </div>

                {/* Table Header Example */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 font-heading">Table Header</span>
                  <div className="flex border-b border-gray-200 bg-gray-100/50 rounded-t-mg overflow-hidden">
                    <div 
                      style={{ fontFamily: `'${stack.heading}', sans-serif` }}
                      className="flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                    >
                      Nombre
                    </div>
                    <div 
                      style={{ fontFamily: `'${stack.heading}', sans-serif` }}
                      className="flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                    >
                      Estado
                    </div>
                  </div>
                  <div className="flex border-b border-gray-100 bg-white">
                    <div 
                      style={{ fontFamily: `'${stack.body}', sans-serif` }}
                      className="flex-1 px-3 py-1.5 text-[11px] text-gray-700"
                    >
                      Juan Pérez
                    </div>
                    <div 
                      style={{ fontFamily: `'${stack.body}', sans-serif` }}
                      className="flex-1 px-3 py-1.5 text-[11px] text-gray-700"
                    >
                      Cualificado
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Body text</span>
                  <p 
                    style={{ fontFamily: `'${stack.body}', sans-serif` }}
                    className="text-sm text-gray-600 leading-relaxed"
                  >
                    Encuentra rápidamente todos tus candidatos cualificados y observa el resumen de su conversación generado por nuestro agente inteligente.
                  </p>
                </div>

                {/* Buttons/UI */}
                <div className="pt-2 flex gap-2">
                  <div 
                    style={{ fontFamily: `'${stack.body}', sans-serif` }}
                    className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-medium rounded-md"
                  >
                    Botón Primario
                  </div>
                  <div 
                    style={{ fontFamily: `'${stack.body}', sans-serif` }}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-[10px] font-medium rounded-md"
                  >
                    Botón Secundario
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                <div className="grid grid-cols-1 gap-2 text-[11px] text-gray-600 font-medium">
                  <div className="flex justify-between items-center px-2 py-1 bg-gray-50 rounded">
                    <span>Special</span>
                    <span className="text-gray-400">{stack.special}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1 bg-gray-50 rounded">
                    <span>Heading</span>
                    <span className="text-gray-400">{stack.heading}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1 bg-gray-50 rounded">
                    <span>Body</span>
                    <span className="text-gray-400">{stack.body}</span>
                  </div>
                </div>

                <Button 
                  variant={isActive ? "primary" : "outline"}
                  onClick={() => applyStack(stack)}
                  className="mt-4 w-full"
                >
                  {isActive ? "Aplicado" : "Aplicar este stack"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold font-heading mb-6 flex items-center gap-2">
          <Palette className="text-primary-600" />
          ¿Cómo funciona este sistema?
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
              <Type size={20} />
            </div>
            <h3 className="font-bold font-heading text-lg">Impacto Visual</h3>
            <p className="text-sm text-gray-600">
              Al separar la tipografía en tres niveles, creamos una jerarquía visual clara. El "Special Title" da personalidad a la landing page, mientras que el "Heading" unifica toda la interfaz administrativa.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Laptop size={20} />
            </div>
            <h3 className="font-bold font-heading text-lg">Consistencia SaaS</h3>
            <p className="text-sm text-gray-600">
              Productos como Slack, Monday o Amazon utilizan fuentes con mucha personalidad para sus cabeceras y fuentes extremadamente legibles para los datos, mejorando la experiencia de uso diario.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <LayoutIcon size={20} />
            </div>
            <h3 className="font-bold font-heading text-lg">Rendimiento</h3>
            <p className="text-sm text-gray-600">
              Utilizamos variables CSS para que el cambio sea instantáneo en toda la aplicación sin recargas, permitiéndote probar cómo se siente la herramienta con cada estilo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
