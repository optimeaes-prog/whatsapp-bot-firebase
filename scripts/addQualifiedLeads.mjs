import admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse the .env file
const envPath = path.join(__dirname, '../functions/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

// Parse environment variables
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex);
      const value = trimmed.substring(equalIndex + 1);
      env[key] = value;
    }
  }
}

// Check for service account in env
let serviceAccount;
if (env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Using service account from FIREBASE_SERVICE_ACCOUNT env variable');
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
  }
}

// Initialize Firebase Admin
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.log('⚠️  No service account found, using default credentials with explicit project');
  admin.initializeApp({
    projectId: 'real-estate-idealista-bot'
  });
}

// Get Firestore instance with the specific database
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

const qualifiedLeadsData = [
  {
    phone: "34663070956",
    chatId: "34663070956@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34663070956
Nombre: Agustín
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 2 personas, pareja
Ingresos: 2.200 € netos al mes entre los dos
Mascotas: Sin mascotas
Fechas: Entrada inmediata, estancia larga con intención de varios años
Disponibilidad visita: Muy interesados, prefiere visita sobre las 15:00 h
Notas: Ya había hablado previamente con el agente y enviado la información; recalca alto interés en este mismo piso.`,
    name: "Agustín",
    qualified: true
  },
  {
    phone: "34624004651",
    chatId: "34624004651@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34624004651
Nombre: Nora
Propiedad: DEIRE 2
Operación: Alquiler
Personas: Dos adultos y una niña de dos años
Ingresos: 2.700 € netos mensuales entre los dos adultos
Mascotas: Sin mascotas
Fechas: Entrada en febrero
Disponibilidad visita: Por las mañanas
Notas: Perfil encaja con alquiler de larga estancia`,
    name: "Nora",
    qualified: true
  },
  {
    phone: "34601675085",
    chatId: "34601675085@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34601675085
Nombre: Valeria
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 3 personas: madre y dos hijos de 12 y 18 años
Ingresos: Madre con nómina 1.500€ netos mensuales y contrato; hija mayor gana 600€ sin nómina todavía
Mascotas: Sin mascotas
Fechas: Entrada aproximada en febrero
Disponibilidad visita: Tardes, después de las 17:00
Notas: Busca alquiler de larga estancia; encaja con el perfil solicitado según el asistente`,
    name: "Valeria",
    qualified: true
  },
  {
    phone: "34659117151",
    chatId: "34659117151@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34659117151
Nombre: madre de la chica (nombre no indicado)
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: una persona, la hija sola
Ingresos: hija con ingresos netos aprox. 2500€ al mes trabajando en el departamento de dirección de un hotel
Mascotas: Sin mascotas
Fechas: alquiler de febrero a diciembre
Disponibilidad visita: mañana sobre las 12:00 en Torrox
Notas: Búsqueda para la hija que apenas usa la vivienda salvo para dormir y ducharse; abiertas a ver otras viviendas similares si son más convenientes; la hija vivió el año pasado en El Peñoncillo con un alquiler considerado abusivo; este año también está en Torrox y el siguiente aún no lo sabe hasta cierre.`,
    name: "madre de la chica (nombre no indicado)",
    qualified: true
  },
  {
    phone: "34672113244",
    chatId: "34672113244@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34672113244
Nombre: Irina
Propiedad: DEIRE 2
Operación: Alquiler
Personas: Matrimonio con un hijo de 5 años
Ingresos: Ingresos familiares de unos 1500 € mensuales
Mascotas: Sin mascotas
Fechas: Pueden mudarse a partir de febrero
Disponibilidad visita: Tardes después de comer, a partir de las 17:00
Notas: Familia de Ucrania, llevan un año buscando apartamento; la clienta no habla español y un amigo hispanohablante coordinará por teléfono`,
    name: "Irina",
    qualified: true
  },
  {
    phone: "34632031984",
    chatId: "34632031984@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34632031984
Nombre: Aman
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 3 primos
Ingresos: nómina de casi 1300 € y primo con unos 1400 €
Mascotas: Sin mascotas
Fechas: entrada prevista 1 de marzo, disponible a partir del 25 de febrero
Disponibilidad visita: 3 de febrero sobre las 15:00 en Nerja
Notas: Busca piso o apartamento de alquiler en Torrox o Nerja; se muda para abrir un bar en Nerja y firmará el contrato del bar el 3 de febrero`,
    name: "Aman",
    qualified: true
  },
  {
    phone: "34622704914",
    chatId: "34622704914@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34622704914
Nombre: Sin datos
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 2 adultos y 2 niños
Ingresos: Ingresos conjuntos aprox. 3000€ netos mensuales
Mascotas: Sin mascotas
Fechas: Entrada inmediata
Disponibilidad visita: Por las tardes o fines de semana
Notas: Busca alquiler en Málaga capital, zona indiferente, presupuesto máximo 700€ pudiendo subir algo si los suministros están incluidos, mínimo 2-3 dormitorios`,
    name: "",
    qualified: true
  },
  {
    phone: "34624427540",
    chatId: "34624427540@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34624427540
Nombre: Allison
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 3 personas: usuaria, esposa y una hija de 7 años
Ingresos: Solo trabaja la usuaria, ingresos familiares aprox. 3.200€ netos mensuales
Mascotas: Sin mascotas
Fechas: Entrada lo antes posible
Disponibilidad visita: Fines de semana`,
    name: "Allison",
    qualified: true
  },
  {
    phone: "34653690569",
    chatId: "34653690569@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34653690569
Nombre: Corrado
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 1 persona, solo
Ingresos: Nómina fija en el aeropuerto, aproximadamente 1400-1500 € netos mensuales según turnos
Mascotas: Sin mascotas
Fechas: Entrada aproximadamente en febrero, larga estancia
Disponibilidad visita: Prefiere tardes; propone mañana por la tarde o jueves por la mañana
Notas: Interesado en alquiler de larga estancia; acepta condiciones de 3 meses de entrada`,
    name: "Corrado",
    qualified: true
  },
  {
    phone: "34604147118",
    chatId: "34604147118@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34604147118
Nombre: Victoria
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 4 personas: 3 adultos y 1 niño de 13 años, refugiados de Ucrania
Ingresos: Ayuda de la Cruz Roja que paga el alquiler mensual; sin trabajo aún pero intención de trabajar al mudarse
Mascotas: Sin mascotas
Fechas: Desde febrero de 2026 hasta junio de 2027 seguro
Disponibilidad visita: Preferencia sábados; de lunes a viernes tienen clases de 11:30 a 14:00; domingos sin autobuses
Notas: Buscan alquiler temporal en Torre del Mar, Málaga, Torrox o Vélez-Málaga, sin cargos adicionales, mínimo 2 dormitorios, espacio para dormir 4 personas, con muebles y electrodomésticos, baño y aseo, suministros incluidos en el alquiler. Viven actualmente en el centro de la Cruz Roja en Almáchar y están aprendiendo español.`,
    name: "Victoria",
    qualified: true
  },
  {
    phone: "34602436007",
    chatId: "34602436007@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34602436007
Nombre: Julio César
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: Padre y una hija de 21 años
Ingresos: Aproximadamente 2000 € netos mensuales, trabaja como cocinero en el Reyna Pez del dueño del hotel Santa Rosa en El Morche
Mascotas: Sin mascotas
Fechas: Entrada primeros días de marzo, larga temporada
Disponibilidad visita: Mañanas, trabaja por las tardes
Notas: Busca alquiler de larga temporada; pregunta también por opciones de 2 habitaciones`,
    name: "Julio César",
    qualified: true
  },
  {
    phone: "34672572700",
    chatId: "34672572700@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34672572700
Nombre: Adriana
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 4 personas, 2 con nómina
Ingresos: Ingresos netos conjuntos unos 3000 € mensuales
Mascotas: Sin mascotas, dispuesta a seguir sin perro a largo plazo
Fechas: Entrada en marzo o abril, para todo el año y larga temporada
Disponibilidad visita: Indiferente, sin problema de horario, está de vacaciones
Notas: Busca alquiler de larga temporada; acepta condición de no tener mascotas ni adopciones futuras`,
    name: "Adriana",
    qualified: true
  },
  {
    phone: "34652217000",
    chatId: "34652217000@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34652217000
Nombre: Jorge Ramírez
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: Viviría solo, pareja solo fines de semana
Ingresos: 2100 € netos mensuales
Mascotas: Sin mascotas
Fechas: Entrada a finales de febrero o principios de febrero según cómo vaya con la vivienda actual
Disponibilidad visita: Sin datos
Notas: Busca saber si tiene parking o fácil aparcamiento, especialmente en verano`,
    name: "Jorge Ramírez",
    qualified: true
  },
  {
    phone: "34604146321",
    chatId: "34604146321@s.whatsapp.net",
    listingCode: "109312972",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34604146321
Nombre: Anamarys
Propiedad: PISO REUS
Operación: Venta
Forma de pago: Compra mediante hipoteca ya concedida
Ingresos: Sin datos
Disponibilidad visita: Le es indiferente el horario de contacto
Notas: Interesada en el piso actualmente alquilado por habitaciones para usarlo como vivienda habitual en el futuro; pregunta por la duración de los contratos de alquiler vigentes y por el motivo de venta del propietario`,
    name: "Anamarys",
    qualified: true
  },
  {
    phone: "34602436007",
    chatId: "34602436007@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34602436007
Nombre: Julio
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 2 personas
Ingresos: unos 2000€ netos mensuales
Mascotas: Sin mascotas
Fechas: entrada primeros días de febrero
Disponibilidad visita: indiferente, cualquier horario`,
    name: "Julio",
    qualified: true
  },
  {
    phone: "34691630370",
    chatId: "34691630370@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34691630370
Nombre: Sandra
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 4 personas: pareja y dos hijos de 7 y 3 años
Ingresos: 2.700€ netos mensuales aprox.
Mascotas: Sin mascotas
Fechas: Entrada lo antes posible, larga temporada
Disponibilidad visita: Indiferente
Notas: Matrimonio de Barcelona, traslado laboral del marido, buscan alquiler larga temporada, precio máximo 900€`,
    name: "Sandra",
    qualified: true
  },
  {
    phone: "34678865362",
    chatId: "34678865362@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34678865362
Nombre: Sin datos
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: Solo el usuario
Ingresos: Nómina de 1400€ netos mensuales
Mascotas: Sin mascotas
Fechas: Quiere mudarse cuanto antes, idealmente a principios de febrero
Disponibilidad visita: Prefiere llamadas por la mañana`,
    name: "",
    qualified: true
  },
  {
    phone: "34613499957",
    chatId: "34613499957@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34613499957
Nombre: Sin datos
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 3 personas
Ingresos: 2500 euros mensuales netos aproximadamente
Mascotas: Sin mascotas
Fechas: Entrada inmediata, antes del viernes
Disponibilidad visita: Disponible para visitar hasta el viernes
Notas: Acepta que luz y agua no están incluidas y van a su cargo`,
    name: "",
    qualified: true
  },
  {
    phone: "34601675085",
    chatId: "34601675085@s.whatsapp.net",
    listingCode: "109766872",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34601675085
Nombre: Valeria Catallini
Propiedad: DEIRE 2
Operación: Alquiler
Personas: 3 personas: madre, hija de 18 años e hijo de 12 años
Ingresos: 2100€ netos mensuales entre ella y su hija
Mascotas: Sin mascotas
Fechas: Entrada a mediados de febrero o marzo, cuando esté disponible
Disponibilidad visita: Esta semana cualquier horario excepto mañana por la mañana; próxima semana por las tardes; en general disponibilidad flexible
Notas: Interesada en piso en alquiler en Torrox pueblo; actualmente de vacaciones esta semana`,
    name: "Valeria Catallini",
    qualified: true
  },
  {
    phone: "40722196445",
    chatId: "40722196445@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 40722196445
Nombre: Sin datos
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 2 personas, pareja sin hijos
Ingresos: Ingresos netos mensuales entre 4500 y 5000 €
Mascotas: Sin mascotas
Fechas: Llegan a España el 8 de febrero; buscan entrada ideal el 10 de febrero; estarán en Málaga en Airbnb del 8 al 15 de febrero para buscar piso
Disponibilidad visita: Prefiere llamadas y coordinación de visita entre la 13:00 y las 16:00
Notas: Buscan piso de alquiler a largo plazo; les interesa programar la visita y conocer el día cuanto antes; también les gustaría ver más pisos en alquiler.`,
    name: "",
    qualified: true
  },
  {
    phone: "34625040109",
    chatId: "34625040109@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34625040109
Nombre: Sin datos
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 2 personas
Ingresos: 2500 € netos mensuales aproximados
Mascotas: Sin mascotas
Fechas: Entrada cuanto antes
Disponibilidad visita: Tardes
Notas: Interesado en alquiler de larga estancia en la vivienda del anuncio facilitado`,
    name: "",
    qualified: true
  },
  {
    phone: "34659842282",
    chatId: "34659842282@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34659842282
Nombre: Luís Martín
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 1 persona, solo él
Ingresos: 1700 € netos mensuales demostrables, jubilado
Mascotas: 3 pájaros en jaula
Fechas: Entrada ideal finales de febrero, alquiler larga estancia
Disponibilidad visita: Indiferente, puede mañanas o tardes
Notas: Acepta condiciones de entrada de 3.900 € (1 mes fianza, 1 mes agencia y 1 mes adelantado)`,
    name: "Luís Martín",
    qualified: true
  },
  {
    phone: "34631733192",
    chatId: "34631733192@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34631733192
Nombre: Hugo Ponce de León
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 1 persona
Ingresos: 1600 € netos mensuales
Mascotas: Sin mascotas
Fechas: Entrada prevista 03/03/2026
Disponibilidad visita: Lunes o miércoles después de las 12 h (visita la hace María Trinidad Campos por él)
Notas: Interesado principal: Hugo Ponce de León. Puede asistir en su lugar la dueña del restaurante donde trabaja, María Trinidad Campos. Hugo trabaja full time en un chiringuito en febrero por temporada baja y delega la visita en María por confianza en su criterio.`,
    name: "Hugo Ponce de León",
    qualified: true
  },
  {
    phone: "34614585134",
    chatId: "34614585134@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34614585134
Nombre: Sin datos
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: Vivirá solo; su mujer trabaja en Ibiza y vendrá unas dos veces al mes
Ingresos: Autónomo, cobra comisiones de venta para empresa italiana; ha facturado 12.100 € entre diciembre y ahora; buen saldo bancario demostrable
Mascotas: Sin mascotas
Fechas: Entrada deseada: 1 de marzo; está en El Palo hasta finales de febrero
Disponibilidad visita: Indiferente, disponible 24h; especialmente fácil los lunes a cualquier hora
Notas: Prioritario poder empadronarse para cambiar matrícula de coche italiano y convertir permiso de conducir; muy interesado en la vivienda y también en zonas Torre del Mar, Rincón y La Cala; busca alquiler de larga estancia`,
    name: "",
    qualified: true
  },
  {
    phone: "34633015314",
    chatId: "34633015314@s.whatsapp.net",
    listingCode: "110238165",
    conversationSummary: `Lead cualificado ✅
Teléfono: 34633015314
Nombre: Josep
Propiedad: CÁCERES (morche)
Operación: Alquiler
Personas: 2 personas
Ingresos: 3500 € netos mensuales entre ambos
Mascotas: Sin mascotas
Fechas: Entrada: a partir del mes que viene
Disponibilidad visita: Por las tardes`,
    name: "Josep",
    qualified: true
  }
];

async function addQualifiedLeads() {
  console.log('Starting to add qualified leads...');
  
  let successCount = 0;
  let errorCount = 0;
  let updatedLeadsCount = 0;

  for (const leadData of qualifiedLeadsData) {
    try {
      // Check if qualified lead already exists
      const existingQualifiedLeadSnapshot = await db
        .collection('qualifiedLeads')
        .where('phone', '==', leadData.phone)
        .where('chatId', '==', leadData.chatId)
        .where('listingCode', '==', leadData.listingCode)
        .get();

      if (!existingQualifiedLeadSnapshot.empty) {
        console.log(`Qualified lead already exists for phone ${leadData.phone}, chatId ${leadData.chatId}, listing ${leadData.listingCode}`);
        continue;
      }

      // Add to qualifiedLeads collection
      await db.collection('qualifiedLeads').add({
        phone: leadData.phone,
        chatId: leadData.chatId,
        listingCode: leadData.listingCode,
        conversationSummary: leadData.conversationSummary,
        name: leadData.name,
        qualified: leadData.qualified,
        createdAt: Timestamp.now(),
      });

      successCount++;
      console.log(`✓ Added qualified lead for ${leadData.name || leadData.phone} - ${leadData.listingCode}`);

      // Find and update corresponding lead
      const leadSnapshot = await db
        .collection('leads')
        .where('phone', '==', leadData.phone)
        .where('listingCode', '==', leadData.listingCode)
        .get();

      if (!leadSnapshot.empty) {
        const leadDoc = leadSnapshot.docs[0];
        await leadDoc.ref.update({
          qualificationStatus: 'qualified',
          name: leadData.name || leadDoc.data().name,
          chatId: leadData.chatId,
        });
        updatedLeadsCount++;
        console.log(`  ✓ Updated corresponding lead status to 'qualified'`);
      } else {
        console.log(`  ⚠ No corresponding lead found for ${leadData.phone} - ${leadData.listingCode}`);
      }

    } catch (error) {
      errorCount++;
      console.error(`✗ Error adding qualified lead for ${leadData.phone}:`, error);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total qualified leads processed: ${qualifiedLeadsData.length}`);
  console.log(`Successfully added: ${successCount}`);
  console.log(`Updated leads: ${updatedLeadsCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the script
addQualifiedLeads()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
