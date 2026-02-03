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

// Helper function to parse conversation text into history items
function parseConversation(conversationText) {
  const lines = conversationText.split('\n');
  const history = [];
  let timestamp = Date.now();
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    if (trimmedLine.startsWith('[BOT]')) {
      history.push({
        role: 'assistant',
        text: trimmedLine.replace('[BOT]', '').trim(),
        timestamp: timestamp
      });
      timestamp += 1000; // Increment by 1 second for each message
    } else if (trimmedLine.startsWith('[CLIENTE]')) {
      history.push({
        role: 'user',
        text: trimmedLine.replace('[CLIENTE]', '').trim(),
        timestamp: timestamp
      });
      timestamp += 1000;
    }
  }
  
  return history;
}

const conversationsData = [
  {
    phone: "34669354177",
    chatId: "34669354177@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Alquiler de temporada hasta junio de 2026

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] Si
[BOT] Genial, gracias por confirmarlo.  
¿Con quién hablo?

Además, para avanzar necesito: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales? ¿Fecha de entrada? ¿Mascotas?`,
    messageCount: 4,
    lastMessage: "2026-02-01T16:21:33.049Z",
    name: "",
    qualified: null
  },
  {
    phone: "34678748877",
    chatId: "34678748877@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] Si, me gustaría verlo
[BOT] Genial, me alegro que te interese verlo.  
Para avanzar, necesito: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales aproximados entre todos? ¿Fecha de entrada prevista? ¿Tenéis mascotas?  

Y, por cierto, ¿con quién hablo?
[CLIENTE] Prefiero hablar con una  persona.
[BOT] De acuerdo, no hay problema, lo gestionamos para que te atienda un comercial.

Si te interesa seguir adelante para que te llamen, necesito SOLO estos datos:  
¿cuántas personas viviríais? ¿ingresos netos mensuales aproximados entre todos? ¿fecha de entrada prevista? ¿tenéis mascotas? Y dime también tu nombre y teléfono de contacto.`,
    messageCount: 6,
    lastMessage: "2026-02-01T15:02:24.549Z",
    name: "",
    qualified: null
  },
  {
    phone: "34603619627",
    chatId: "34603619627@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T14:04:23.044Z",
    name: "",
    qualified: null
  },
  {
    phone: "48519343924",
    chatId: "48519343924@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Seasonal rental until June 2026

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-02-01T11:49:16.988Z",
    name: "",
    qualified: null
  },
  {
    phone: "34643313604",
    chatId: "34643313604@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-02-01T11:34:18.513Z",
    name: "",
    qualified: null
  },
  {
    phone: "447922416869",
    chatId: "447922416869@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Possibility of long-term rental: "3 months required to move in (1 month's deposit, 1 month agency fee and 1 month's rent in advance)".
• It is not possible to rent with pets.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-02-01T09:04:36.060Z",
    name: "",
    qualified: null
  },
  {
    phone: "34624383245",
    chatId: "34624383245@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] Ola qué meses es apartment disponible
[BOT] El piso está disponible para entrar ya, con posibilidad de larga estancia.  

Para ayudarte mejor, ¿con quién hablo? Y, para avanzar: ¿cuántas personas viviríais, ingresos netos mensuales, fecha en la que te gustaría entrar y si tenéis mascotas?`,
    messageCount: 4,
    lastMessage: "2026-02-01T05:26:17.658Z",
    name: "",
    qualified: null
  },
  {
    phone: "34632347081",
    chatId: "34632347081@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-02-01T03:04:19.239Z",
    name: "",
    qualified: null
  },
  {
    phone: "34666346336",
    chatId: "34666346336@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] Cuáles son los precios de las habitaciones ? Y hasta cuando están alquiladas ?
[BOT] Actualmente no tengo el detalle del precio de cada habitación ni las fechas exactas de finalización de los contratos; el piso está alquilado por habitaciones y se vende como inversión con inquilinos en curso.  
¿Te encaja este tipo de operación aunque no se pueda visitar y se compre con los contratos actuales? Si es así, te puedo pasar el informe de rentabilidad.`,
    messageCount: 4,
    lastMessage: "2026-01-31T16:02:26.607Z",
    name: "",
    qualified: null
  },
  {
    phone: "34645151026",
    chatId: "34645151026@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T14:49:13.654Z",
    name: "",
    qualified: null
  },
  {
    phone: "491632467592",
    chatId: "491632467592@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Possibility of long-term rental: "3 months required to move in (1 month's deposit, 1 month agency fee and 1 month's rent in advance)".
• Pets are not allowed.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T14:04:17.058Z",
    name: "",
    qualified: null
  },
  {
    phone: "34649492129",
    chatId: "34649492129@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T12:04:16.483Z",
    name: "",
    qualified: null
  },
  {
    phone: "542954615132",
    chatId: "542954615132@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Possibility of long-term rental: "3 months required to move in (1 month's deposit, 1 month agency fee and 1 month's rent in advance)".
• Pets are not allowed.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T11:19:31.635Z",
    name: "",
    qualified: null
  },
  {
    phone: "34610036661",
    chatId: "34610036661@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Alquiler de temporada hasta junio de 2026

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T10:34:12.922Z",
    name: "",
    qualified: null
  },
  {
    phone: "34614529140",
    chatId: "34614529140@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T10:04:21.574Z",
    name: "",
    qualified: null
  },
  {
    phone: "447778963266",
    chatId: "447778963266@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Seasonal rental until June 2026

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T09:04:36.652Z",
    name: "",
    qualified: null
  },
  {
    phone: "393784311751",
    chatId: "393784311751@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Seasonal rental until June 2026

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-31T08:53:23.464Z",
    name: "",
    qualified: null
  },
  {
    phone: "34661598739",
    chatId: "34661598739@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-30T09:49:36.313Z",
    name: "",
    qualified: null
  },
  {
    phone: "34627038625",
    chatId: "34627038625@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-30T09:49:19.787Z",
    name: "",
    qualified: null
  },
  {
    phone: "34640657702",
    chatId: "34640657702@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-29T20:04:25.296Z",
    name: "",
    qualified: null
  },
  {
    phone: "34651499246",
    chatId: "34651499246@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] Si
[BOT] Genial. ¿Con quién hablo?

Para avanzar, necesito: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales aproximados? ¿Fecha de entrada? ¿Tenéis mascotas (aunque no se aceptan, debo confirmarlo)?`,
    messageCount: 4,
    lastMessage: "2026-01-28T11:22:06.647Z",
    name: "",
    qualified: null
  },
  {
    phone: "541169682112",
    chatId: "541169682112@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/109397949/

Just to confirm, have you reviewed the property highlights?

• Pets are not allowed. Possibility of long-term rental.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-28T09:50:40.129Z",
    name: "",
    qualified: null
  },
  {
    phone: "34604121139",
    chatId: "34604121139@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-28T09:50:05.277Z",
    name: "",
    qualified: null
  },
  {
    phone: "34631819302",
    chatId: "34631819302@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-28T09:49:19.959Z",
    name: "",
    qualified: null
  },
  {
    phone: "34624879217",
    chatId: "34624879217@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T18:19:37.640Z",
    name: "",
    qualified: null
  },
  {
    phone: "33675340899",
    chatId: "33675340899@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Possibility of long-term rental: "3 months required to move in (1 month deposit, 1 month agency fee and 1 month current rent)".
• It is not possible to rent with pets.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T18:19:21.999Z",
    name: "",
    qualified: null
  },
  {
    phone: "34677373540",
    chatId: "34677373540@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] No me deja verla
[BOT] Vale, te paso los datos clave por aquí para ayudarte:  
- Es un alquiler de larga estancia  
- No admiten mascotas  

¿Te interesa igualmente? Y dime, ¿con quién hablo?`,
    messageCount: 4,
    lastMessage: "2026-01-27T15:05:38.224Z",
    name: "",
    qualified: null
  },
  {
    phone: "491607678876",
    chatId: "491607678876@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Just to confirm, have you reviewed the property highlights?

• Long-term rental possible: "3 months required to move in (1 month deposit, 1 month agency fee and 1 month rent in advance)".
• Pets are not allowed.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T11:41:04.885Z",
    name: "",
    qualified: null
  },
  {
    phone: "34682817924",
    chatId: "34682817924@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T11:35:02.329Z",
    name: "",
    qualified: null
  },
  {
    phone: "34687160825",
    chatId: "34687160825@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T08:50:41.587Z",
    name: "",
    qualified: null
  },
  {
    phone: "34669446487",
    chatId: "34669446487@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T08:50:20.864Z",
    name: "",
    qualified: null
  },
  {
    phone: "34699701917",
    chatId: "34699701917@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T08:49:40.366Z",
    name: "",
    qualified: null
  },
  {
    phone: "34647098053",
    chatId: "34647098053@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T08:49:27.142Z",
    name: "",
    qualified: null
  },
  {
    phone: "34649401829",
    chatId: "34649401829@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-27T08:49:13.767Z",
    name: "",
    qualified: null
  },
  {
    phone: "34604146321",
    chatId: "34604146321@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] No se abre. Por favor, podrías enviarlo por whatsapp?
[BOT] Vale, ese enlace es solo para ver características, la gestión sigue por aquí.  
Ahora mismo el piso está alquilado por habitaciones y no se puede visitar. ¿Te encaja este tipo de inversión así, sin visita física?`,
    messageCount: 4,
    lastMessage: "2026-01-26T04:52:43.750Z",
    name: "",
    qualified: null
  },
  {
    phone: "46734144344",
    chatId: "46734144344@s.whatsapp.net",
    listingCode: "109397949",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/109397949/

Just to confirm, have you reviewed the property highlights?

• Pets are not permitted in the rental.
• Possibility of long-term rental.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩
[CLIENTE] Hello
Im interested in this one
Pets Are allowed? I have a dog
[BOT] Hi! In this flat pets are **not permitted**, so you wouldn't be able to live there with your dog.  

Would you like me to let the team know you're interested only in pet‑friendly rentals so they can offer you alternatives?
[CLIENTE] Yes please
Tell me if u have any available
[BOT] De acuerdo, te aviso: en este piso no se admiten mascotas, así que lo descartamos.  

Para pasarte opciones pet‑friendly que encajen contigo, ¿me dices por favor: zona o barrios que te interesan, presupuesto máximo mensual y fecha aproximada de entrada?
[CLIENTE] Cerca de Torre del Mar, Torrox y Nerja, máximo 950€ al mes
[BOT] Genial, zona y presupuesto anotados. Ahora, para ajustar bien las opciones:  
¿Para qué fecha aproximada buscas entrar, cuántas personas viviríais y tu rango de ingresos netos mensuales? ¿Mascotas solo el perro o alguna más?`,
    messageCount: 8,
    lastMessage: "2026-01-26T00:19:34.988Z",
    name: "",
    qualified: null
  },
  {
    phone: "34620234927",
    chatId: "34620234927@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T20:09:14.335Z",
    name: "",
    qualified: null
  },
  {
    phone: "34634081782",
    chatId: "34634081782@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T20:08:59.319Z",
    name: "",
    qualified: null
  },
  {
    phone: "34666369176",
    chatId: "34666369176@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T20:08:29.462Z",
    name: "",
    qualified: null
  },
  {
    phone: "34695989776",
    chatId: "34695989776@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T20:07:55.634Z",
    name: "",
    qualified: null
  },
  {
    phone: "34669494253",
    chatId: "34669494253@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T20:07:42.807Z",
    name: "",
    qualified: null
  },
  {
    phone: "34696174487",
    chatId: "34696174487@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T20:07:11.227Z",
    name: "",
    qualified: null
  },
  {
    phone: "34632031984",
    chatId: "34632031984@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T16:33:49.432Z",
    name: "",
    qualified: null
  },
  {
    phone: "34643071178",
    chatId: "34643071178@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T16:33:20.921Z",
    name: "",
    qualified: null
  },
  {
    phone: "34614716158",
    chatId: "34614716158@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T16:32:59.701Z",
    name: "",
    qualified: null
  },
  {
    phone: "34673152503",
    chatId: "34673152503@s.whatsapp.net",
    listingCode: "110238165",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110238165/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Posibilidad de alquilar a larga estancia
• ""3 meses para entrar (1 mes de fianza, 1 de honorarios de la agencia y 1 al corriente)""
• No es posible alquilar con mascotas

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T16:32:49.626Z",
    name: "",
    qualified: null
  },
  {
    phone: "34651139900",
    chatId: "34651139900@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/109397949/

Por confirmar, ¿has visto las características?

• No es posible alquilar con mascotas
• Posibilidad de alquilar a larga estancia

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] La vida laboral no la conseguimos sacar y el piso lo necesitamos urgentemente
[BOT] ¿Con quién hablo?  
Para poder valorar tu perfil necesito: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales aproximados? ¿Fecha de entrada? Y confirmarte que no se aceptan mascotas.`,
    messageCount: 4,
    lastMessage: "2026-01-25T12:48:47.302Z",
    name: "",
    qualified: null
  },
  {
    phone: "34661464293",
    chatId: "34661464293@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Alquiler de temporada hasta junio de 2026

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T10:29:45.585Z",
    name: "",
    qualified: null
  },
  {
    phone: "34611322221",
    chatId: "34611322221@s.whatsapp.net",
    listingCode: "110181098",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Alquiler de temporada hasta junio de 2026

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T10:29:35.695Z",
    name: "",
    qualified: null
  },
  {
    phone: "31650887500",
    chatId: "31650887500@s.whatsapp.net",
    listingCode: "109766872",
    conversation: `[BOT] Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.

Don't forget to follow me—there are all kinds of real estate opportunities on this profile 👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] You've shown interest in this property for rent 👇

https://www.idealista.com/inmueble/109397949/

Just to confirm, have you reviewed the property highlights?

• Pets are not allowed. Possibility to rent long-term.

* If I ever say something that doesn't apply, thanks for understanding—I'm improved every day to deliver the best service 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T10:29:06.967Z",
    name: "",
    qualified: null
  },
  {
    phone: "34679572361",
    chatId: "34679572361@s.whatsapp.net",
    listingCode: "109312972",
    conversation: `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en venta👇

https://www.idealista.com/inmueble/109312972

Por confirmar, ¿has visto las características?

• Alquilado por habitaciones
• No se puede visitar

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩`,
    messageCount: 2,
    lastMessage: "2026-01-25T10:28:53.540Z",
    name: "",
    qualified: null
  }
];

async function addConversations() {
  console.log('Starting to add conversations...');
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const convData of conversationsData) {
    try {
      // Check if conversation already exists
      const existingConvSnapshot = await db
        .collection('conversations')
        .doc(convData.chatId)
        .get();

      if (existingConvSnapshot.exists) {
        console.log(`Conversation already exists for chatId ${convData.chatId}`);
        skippedCount++;
        continue;
      }

      // Parse conversation history
      const history = parseConversation(convData.conversation);
      
      // Parse lastMessage timestamp
      const lastMessageDate = new Date(convData.lastMessage);
      
      // Add to conversations collection using chatId as document ID
      await db.collection('conversations').doc(convData.chatId).set({
        phone: convData.phone,
        chatId: convData.chatId,
        listingCode: convData.listingCode,
        history: history,
        messageCount: convData.messageCount,
        lastMessage: Timestamp.fromDate(lastMessageDate),
        name: convData.name || "",
        qualified: convData.qualified,
        isFinished: false,
      });

      successCount++;
      console.log(`✓ Added conversation for ${convData.phone} - ${convData.listingCode}`);

    } catch (error) {
      errorCount++;
      console.error(`✗ Error adding conversation for ${convData.phone}:`, error);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total conversations processed: ${conversationsData.length}`);
  console.log(`Successfully added: ${successCount}`);
  console.log(`Skipped (already exist): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the script
addConversations()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
