import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, setDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCUp1ZUmkZnCXhTF0H5NbtDqZgZLJSe7nU",
  authDomain: "real-estate-idealista-bot.firebaseapp.com",
  projectId: "real-estate-idealista-bot",
  storageBucket: "real-estate-idealista-bot.firebasestorage.app",
  messagingSenderId: "886555215384",
  appId: "1:886555215384:web:9a0bbad782d57e2a92a56d",
  measurementId: "G-7JTKQSCGPH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "realestate-whatsapp-bot");

const anuncios = [
  {
    anuncio: "VIL001",
    descripcion: "Villa moderna en Marbella con vistas al mar",
    enlace: "https://www.idealista.com/inmueble/12345678/",
    tipoOperacion: "Venta",
    caracteristicas: `• 4 dormitorios, 3 baños
• 250m² construidos, 180m² útiles
• Terraza de 80m² con vistas panorámicas al mar
• Piscina privada
• Parking para 2 coches
• Cocina equipada con electrodomésticos de alta gama
• Sistema de domótica
• Aire acondicionado y calefacción
• Cerca de playas y campo de golf`,
    informeRentabilidadDisponible: true,
    informeRentabilidad: `INFORME DE RENTABILIDAD - Villa Marbella

Precio de venta: 850.000€
Rentabilidad potencial anual: 4.2%
Ingresos estimados por alquiler vacacional: 35.700€/año

Análisis:
- Zona de alta demanda turística
- Ocupación estimada: 70% (8.4 meses/año)
- Precio medio por noche: 350€
- Gastos de mantenimiento: 12.000€/año
- IBI y otros impuestos: 2.500€/año
- Rentabilidad neta: 21.200€/año (2.5%)`
  },
  {
    anuncio: "APT002",
    descripcion: "Apartamento céntrico en Madrid",
    enlace: "https://www.idealista.com/inmueble/23456789/",
    tipoOperacion: "Alquiler",
    caracteristicas: `• 2 dormitorios, 1 baño
• 85m² útiles
• Totalmente amueblado
• Balcón exterior
• Calefacción central
• Ascensor
• Portero físico
• A 5 minutos del metro
• Zona Salamanca`,
    informeRentabilidadDisponible: false,
    informeRentabilidad: ""
  },
  {
    anuncio: "CHA003",
    descripcion: "Chalet independiente con jardín en Valencia",
    enlace: "https://www.idealista.com/inmueble/34567890/",
    tipoOperacion: "Venta",
    caracteristicas: `• 5 dormitorios, 4 baños
• 320m² construidos en parcela de 600m²
• Jardín con césped natural
• Piscina y barbacoa
• Garaje para 3 coches
• Trastero de 30m²
• Paneles solares
• Sistema de riego automático
• Zona residencial tranquila`,
    informeRentabilidadDisponible: true,
    informeRentabilidad: `INFORME DE RENTABILIDAD - Chalet Valencia

Precio de venta: 620.000€
Potencial de revalorización: 15% en 5 años
Comparativa de mercado: Precio 8% por debajo de zona

Análisis:
- Zona en crecimiento con nuevos desarrollos
- Demanda alta de familias
- Colegios internacionales cercanos
- Futuras mejoras de infraestructura (nuevo metro)
- Inversión recomendada para largo plazo`
  },
  {
    anuncio: "EST004",
    descripcion: "Estudio amueblado Barcelona zona universitaria",
    enlace: "https://www.idealista.com/inmueble/45678901/",
    tipoOperacion: "Alquiler",
    caracteristicas: `• Estudio tipo loft (35m²)
• Totalmente amueblado y equipado
• Cocina americana
• Baño completo
• Internet de alta velocidad incluido
• Gastos de comunidad incluidos
• A 2 minutos de la universidad
• Transporte público excelente`,
    informeRentabilidadDisponible: false,
    informeRentabilidad: ""
  },
  {
    anuncio: "PEN005",
    descripcion: "Ático dúplex con terraza en Sevilla",
    enlace: "https://www.idealista.com/inmueble/56789012/",
    tipoOperacion: "Venta",
    caracteristicas: `• 3 dormitorios, 2 baños
• 140m² útiles + 60m² terraza
• Planta superior con terraza privada
• Vistas a la Giralda
• Parking incluido
• Trastero
• Edificio con piscina comunitaria
• Reformado recientemente
• Centro histórico`,
    informeRentabilidadDisponible: false,
    informeRentabilidad: ""
  }
];

const botConfig = {
  activeStyleId: "directo",
  styles: [
    {
      id: "directo",
      name: "Directo y Eficiente",
      description: "Mensajes cortos, sin relleno, agrupa preguntas.",
      promptModifier: `- Mensajes CORTOS y DIRECTOS. Máximo 2-3 líneas por mensaje.
- NO repitas información que el usuario acaba de dar.
- NO hagas resúmenes innecesarios ("Entonces, para resumir...").
- NO uses frases de relleno ("¡Gracias por la información!", "Todo parece encajar bien", "Entendido").
- AGRUPA las preguntas relacionadas en UN SOLO mensaje.
- Si el usuario da varios datos, reconócelos brevemente y pregunta SOLO lo que falta.
- Sé amable pero valora el tiempo del usuario.
- VARÍA tu vocabulario: no repitas "Perfecto" constantemente. Usa alternativas como "Genial", "Estupendo", "Vale", "De acuerdo", etc.`
    },
    {
      id: "amigable",
      name: "Amigable y Cercano",
      description: "Tono cálido con emojis, más personalizado.",
      promptModifier: `- Usa un tono CÁLIDO y CERCANO, como si hablaras con un amigo.
- Incluye emojis ocasionales para dar calidez (😊, 👍, 🏠, ✨) pero sin exceso.
- Haz preguntas de una en una para que la conversación fluya naturalmente.
- Muestra entusiasmo genuino por ayudar al cliente a encontrar su hogar ideal.
- Usa expresiones cercanas como "¡Qué bien!", "Me encanta", "¡Genial!".
- Personaliza las respuestas usando el nombre del cliente cuando lo sepas.
- Sé empático si el cliente expresa dudas o preocupaciones.`
    },
    {
      id: "formal",
      name: "Formal y Profesional",
      description: "Tratamiento de usted, lenguaje corporativo.",
      promptModifier: `- Usa tratamiento de USTED en todo momento.
- Mantén un tono PROFESIONAL y CORPORATIVO.
- Evita coloquialismos y expresiones informales.
- Usa frases como "Le informo que...", "Permítame indicarle...", "Tendría usted disponibilidad para...".
- Sé cortés pero manteniendo distancia profesional.
- No uses emojis ni expresiones demasiado efusivas.
- Estructura las respuestas de forma clara y ordenada.
- Agradece formalmente: "Le agradezco su interés", "Gracias por su tiempo".`
    },
    {
      id: "conciso",
      name: "Ultra Conciso",
      description: "Mínimo de palabras, solo lo esencial.",
      promptModifier: `- MÁXIMA brevedad. Una línea por mensaje si es posible.
- Solo lo ESENCIAL. Nada de cortesías innecesarias.
- Preguntas directas sin introducción.
- Respuestas tipo telegrama.
- Sin emojis, sin relleno, sin repeticiones.
- Ejemplo: "¿Nombre?" en vez de "¿Con quién tengo el gusto de hablar?"
- Ejemplo: "¿Hipoteca o contado?" en vez de "¿La compra sería al contado o necesitaría financiación mediante hipoteca?"`
    }
  ]
};

// Datos de ejemplo para leads (opcional, para testing)
const sampleLeads = [
  {
    telefono: "34612345678",
    anuncio: "VIL001",
    chatId: "34612345678@c.us",
    tipoOperacion: "Venta",
    createdAt: new Date()
  },
  {
    telefono: "34698765432",
    anuncio: "APT002",
    chatId: "34698765432@c.us",
    tipoOperacion: "Alquiler",
    createdAt: new Date()
  }
];

async function seedFirestore() {
  try {
    console.log("🌱 Iniciando seed de Firestore...\n");

    // 1. Crear Bot Config
    console.log("📝 Creando configuración del bot...");
    await setDoc(doc(db, "botConfig", "config"), botConfig);
    console.log("✅ Bot config creado\n");

    // 2. Crear Anuncios
    console.log("🏠 Creando anuncios...");
    for (const anuncio of anuncios) {
      await addDoc(collection(db, "anuncios"), anuncio);
      console.log(`   ✅ ${anuncio.anuncio} - ${anuncio.descripcion}`);
    }
    console.log(`✅ ${anuncios.length} anuncios creados\n`);

    // 3. Crear Leads de ejemplo (opcional)
    console.log("👥 Creando leads de ejemplo...");
    for (const lead of sampleLeads) {
      await addDoc(collection(db, "leads"), lead);
      console.log(`   ✅ Lead: ${lead.telefono} - ${lead.anuncio}`);
    }
    console.log(`✅ ${sampleLeads.length} leads creados\n`);

    console.log("🎉 ¡Seed completado exitosamente!\n");
    console.log("📊 Resumen:");
    console.log(`   - Bot Config: 1 documento (4 estilos)`);
    console.log(`   - Anuncios: ${anuncios.length} documentos`);
    console.log(`   - Leads: ${sampleLeads.length} documentos`);
    console.log("\n✨ Tu base de datos está lista para usar!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante el seed:", error);
    process.exit(1);
  }
}

seedFirestore();
