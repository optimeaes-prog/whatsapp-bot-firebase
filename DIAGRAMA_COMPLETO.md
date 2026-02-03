# 📊 Diagrama Detallado de Funcionamiento - WhatsApp Bot Firebase

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USUARIO FINAL (LEAD)                            │
│                         📱 WhatsApp Client                               │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │ Mensajes WhatsApp
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         🔌 WHAPI.CLOUD                                   │
│                    (WhatsApp Cloud API Gateway)                          │
│                                                                           │
│  • Recibe/Envía mensajes                                                │
│  • Gestiona conexiones WhatsApp                                         │
│  • Webhook notifications                                                 │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │ HTTP Webhook
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    ☁️  FIREBASE FUNCTIONS                                │
│                    (Backend - Node.js 18)                                │
│                    Region: europe-west1                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    📥 ENDPOINTS HTTP                             │   │
│  │                                                                  │   │
│  │  1. POST /webhook                                               │   │
│  │     • Recibe mensajes de Whapi                                  │   │
│  │     • Procesa conversaciones                                    │   │
│  │     • Gestiona estados                                          │   │
│  │                                                                  │   │
│  │  2. POST /newLead                                               │   │
│  │     • Crea nuevo lead                                           │   │
│  │     • Envía mensajes iniciales                                  │   │
│  │     • Inicializa conversación                                   │   │
│  │                                                                  │   │
│  │  3. GET /healthz                                                │   │
│  │     • Health check                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    🔧 SERVICIOS                                  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  firestore.ts                                             │  │   │
│  │  │  • fetchListingByCode()                                   │  │   │
│  │  │  • findLeadByChatId()                                     │  │   │
│  │  │  • updateLeadChatInfo()                                   │  │   │
│  │  │  • updateLeadStatus()                                     │  │   │
│  │  │  • getConversationByChatId()                              │  │   │
│  │  │  • upsertConversation()                                   │  │   │
│  │  │  • appendConversationRow()                                │  │   │
│  │  │  • appendQualifiedLeadRow()                               │  │   │
│  │  │  • getBotConfig() / getActiveStyle()                      │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  openaiClient.ts                                          │  │   │
│  │  │  • generateAssistantResponse()                            │  │   │
│  │  │  • summarizeLeadDetails()                                 │  │   │
│  │  │  • extractClientName()                                    │  │   │
│  │  │  • translateTextToBritishEnglish()                        │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  whapiClient.ts                                           │  │   │
│  │  │  • sendText()                                             │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              💾 ESTADO EN MEMORIA                                │   │
│  │                                                                  │   │
│  │  conversationStates = Map<chatId, ConversationState>            │   │
│  │                                                                  │   │
│  │  ConversationState:                                              │   │
│  │    • phone                                                       │   │
│  │    • listingCode                                                 │   │
│  │    • chatId                                                      │   │
│  │    • operationType (Venta/Alquiler)                              │   │
│  │    • description, link, features                                 │   │
│  │    • profitabilityReport                                         │   │
│  │    • history: HistoryItem[]                                      │   │
│  │    • name, qualificationStatus                                   │   │
│  │    • isFinished                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    🗄️  FIRESTORE DATABASE                                │
│                Named DB: "realestate-whatsapp-bot"                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📋 COLECCIONES                                                  │   │
│  │                                                                  │   │
│  │  1. listings (Anuncios)                                          │   │
│  │     • description                                                │   │
│  │     • listingCode (único)                                        │   │
│  │     • link (URL del anuncio)                                     │   │
│  │     • operationType (Venta/Alquiler)                             │   │
│  │     • features (características)                                 │   │
│  │     • profitabilityReportAvailable                               │   │
│  │     • profitabilityReport                                        │   │
│  │     • isActive (true/false)                                      │   │
│  │     • closureInfo (cuando isActive = false)                      │   │
│  │     • createdAt, updatedAt                                       │   │
│  │                                                                  │   │
│  │  2. leads (Contactos iniciales)                                  │   │
│  │     • phone                                                      │   │
│  │     • listingCode                                                │   │
│  │     • chatId                                                     │   │
│  │     • operationType                                              │   │
│  │     • name                                                       │   │
│  │     • qualificationStatus (not_qualified/qualified/rejected)     │   │
│  │     • firstMessageDate, lastMessageDate                          │   │
│  │     • createdAt                                                  │   │
│  │                                                                  │   │
│  │  3. conversations (Historial de chats)                           │   │
│  │     • phone                                                      │   │
│  │     • chatId (ID del documento)                                  │   │
│  │     • listingCode                                                │   │
│  │     • history: HistoryItem[]                                     │   │
│  │     • messageCount                                               │   │
│  │     • name                                                       │   │
│  │     • qualified (boolean|null)                                   │   │
│  │     • isFinished                                                 │   │
│  │     • lastMessage                                                │   │
│  │                                                                  │   │
│  │  4. qualifiedLeads (Leads cualificados)                          │   │
│  │     • phone                                                      │   │
│  │     • chatId                                                     │   │
│  │     • listingCode                                                │   │
│  │     • name                                                       │   │
│  │     • conversationSummary                                        │   │
│  │     • qualified (true)                                           │   │
│  │     • createdAt                                                  │   │
│  │                                                                  │   │
│  │  5. botConfig                                                    │   │
│  │     • doc: "config"                                              │   │
│  │     • activeStyleId                                              │   │
│  │     • styles: BotStyle[]                                         │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │ Queries
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    🌐 FRONTEND WEB APP                                   │
│                React 18 + Vite + TypeScript + TailwindCSS               │
│                Hosted on: Firebase Hosting                               │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔐 AUTENTICACIÓN                                                │   │
│  │     Firebase Authentication                                       │   │
│  │     • Email/Password                                             │   │
│  │     • Google Sign-In                                             │   │
│  │     • AuthContext (React Context)                                │   │
│  │     • ProtectedRoute component                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📱 PÁGINAS                                                      │   │
│  │                                                                  │   │
│  │  1. Login (/login)                                               │   │
│  │     • Inicio de sesión                                           │   │
│  │     • Google OAuth                                               │   │
│  │                                                                  │   │
│  │  2. Dashboard (/)                                                │   │
│  │     • Estadísticas generales                                     │   │
│  │     • Total de anuncios activos                                  │   │
│  │     • Leads totales/cualificados/rechazados                      │   │
│  │     • Conversaciones activas                                     │   │
│  │     • Gráficos de conversión                                     │   │
│  │                                                                  │   │
│  │  3. Listings (/anuncios)                                         │   │
│  │     • Tabla de anuncios                                          │   │
│  │     • CRUD completo (Create, Read, Update, Delete)               │   │
│  │     • Activar/Desactivar anuncios                                │   │
│  │     • Gestión de cierre (razón + lead asociado)                  │   │
│  │     • Filtros (activos/cerrados, tipo operación)                 │   │
│  │     • Búsqueda por código/descripción                            │   │
│  │     • Exportación a CSV                                          │   │
│  │                                                                  │   │
│  │  4. Leads (/leads)                                               │   │
│  │     • Tabla de todos los leads                                   │   │
│  │     • Crear nuevo lead (trigger /newLead endpoint)               │   │
│  │     • Filtros por estado de cualificación                        │   │
│  │     • Filtros por tipo de operación                              │   │
│  │     • Ver historial de conversación                              │   │
│  │     • Botón de iniciar chat                                      │   │
│  │                                                                  │   │
│  │  5. Conversations (/conversaciones)                              │   │
│  │     • Historial completo de conversaciones                       │   │
│  │     • Ver mensajes completos (assistant/user)                    │   │
│  │     • Filtrar por estado (activas/finalizadas)                   │   │
│  │     • Ver detalles del lead                                      │   │
│  │     • Timestamps de mensajes                                     │   │
│  │                                                                  │   │
│  │  6. QualifiedLeads (/cualificados)                               │   │
│  │     • Lista de leads cualificados                                │   │
│  │     • Resumen de la conversación                                 │   │
│  │     • Datos extraídos (nombre, ingresos, etc.)                   │   │
│  │     • Opción de cerrar anuncio asociado                          │   │
│  │     • Exportación a CSV                                          │   │
│  │                                                                  │   │
│  │  7. Configuracion (/configuracion)                               │   │
│  │     • Selector de estilo del bot                                 │   │
│  │     • 4 estilos disponibles:                                     │   │
│  │       - Directo y Eficiente                                      │   │
│  │       - Amigable y Cercano                                       │   │
│  │       - Formal y Profesional                                     │   │
│  │       - Ultra Conciso                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔧 SERVICIOS (Frontend)                                         │   │
│  │                                                                  │   │
│  │  • listings.ts - CRUD de anuncios                                │   │
│  │  • leads.ts - Gestión de leads                                   │   │
│  │  • conversations.ts - Historial de chats                         │   │
│  │  • qualifiedLeads.ts - Leads cualificados                        │   │
│  │  • botConfig.ts - Configuración del bot                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            │ Acceso directo a Firestore
                            ↓
                   [Firestore Database]


┌─────────────────────────────────────────────────────────────────────────┐
│                    🤖 OPENAI API (GPT-4o)                                │
│                                                                           │
│  • Genera respuestas del asistente                                      │
│  • Extrae nombre del cliente                                            │
│  • Resume detalles del lead                                             │
│  • Traduce características a inglés británico                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo de una Conversación

### 1️⃣ **INICIO: Crear un Lead desde Frontend**

```
Frontend (Leads Page)
    ↓
1. Usuario admin crea lead con:
   • phone: "34612345678"
   • listingCode: "CASA123"
    ↓
2. Frontend llama: POST https://[region]-[project].cloudfunctions.net/newLead
   Body: { "telefono": "34612345678", "anuncio": "CASA123" }
    ↓
3. Backend (newLead function):
    ↓
    a. Busca listing en Firestore por listingCode
    ↓
    b. Determina idioma inicial según teléfono
       • Empieza con 34 → Español
       • Otros → Inglés (traduce características)
    ↓
    c. Genera 2 mensajes iniciales:
       • Mensaje 1: Saludo + Link Instagram
       • Mensaje 2: Link del anuncio + Características
    ↓
    d. Envía mensajes a WhatsApp vía Whapi:
       POST https://gate.whapi.cloud/messages/text
       Headers: { Authorization: "Bearer [WHAPI_TOKEN]" }
       Body: { "to": "34612345678", "body": "[mensaje]" }
    ↓
    e. Guarda lead en Firestore (collection: leads)
    ↓
    f. Guarda conversación inicial (collection: conversations)
    ↓
    g. Crea estado en memoria:
       conversationStates.set(chatId, {
         phone, listingCode, chatId, operationType,
         description, link, features,
         profitabilityReport, history, isFinished: false
       })
    ↓
Response: { "chatId": "34612345678@c.us" }
```

---

### 2️⃣ **CONVERSACIÓN: Cliente responde por WhatsApp**

```
Cliente escribe en WhatsApp
    ↓
Whapi.cloud recibe mensaje
    ↓
Whapi envía webhook: POST https://[region]-[project].cloudfunctions.net/webhook
Body: {
  "messages": [{
    "chat_id": "34612345678@c.us",
    "from": "34612345678",
    "text": { "body": "Sí, me interesan las características" },
    "timestamp": 1707000000
  }]
}
    ↓
Backend (webhook function):
    ↓
1. Extrae mensajes inbound (filtra mensajes del cliente, ignora from_me)
    ↓
2. Para cada mensaje:
    ↓
    a. Busca/reconstruye ConversationState:
       • Primero busca en memoria (conversationStates)
       • Si no existe, busca en Firestore (conversations)
       • Si tampoco, reconstruye desde lead + listing
    ↓
    b. Añade mensaje del usuario al historial:
       history.push({ role: "user", text: "[mensaje]", timestamp })
    ↓
    c. Intenta extraer nombre si no lo tiene:
       • Llama a OpenAI con extractClientName()
       • Actualiza lead en Firestore si detecta nombre
    ↓
    d. Guarda snapshot de conversación en Firestore
    ↓
    e. Obtiene estilo activo del bot (botConfig/config)
    ↓
    f. Genera respuesta con OpenAI:
       • buildInstructions() → Prompt con estilo + contexto
       • buildInputText() → Historial formateado
       • OpenAI Responses API → Respuesta del asistente
    ↓
    g. Parsea respuesta buscando marcadores:
       • [LEAD_CUALIFICADO] → qualified = true
       • [LEAD_NO_INTERESADO] → qualified = false
       • Sin marcador → continúa conversación
    ↓
    h. Envía respuesta a WhatsApp vía Whapi
    ↓
    i. Añade respuesta al historial:
       history.push({ role: "assistant", text: "[respuesta]" })
    ↓
    j. Guarda conversación actualizada en Firestore
    ↓
    k. Si hay marcador de cierre (qualified !== undefined):
        ↓
        • state.isFinished = true
        ↓
        SI qualified = true:
            ↓
            • Genera resumen con summarizeLeadDetails()
              → OpenAI extrae: name, people, income, pets,
                paymentMethod, dates, visitAvailability, notes
            ↓
            • Construye mensaje de notificación
            ↓
            • Envía notificación al número configurado (NOTIFICATION_NUMBER)
            ↓
            • Guarda en qualifiedLeads collection
            ↓
            • Actualiza lead: qualificationStatus = "qualified"
        
        SI qualified = false:
            ↓
            • Actualiza lead: qualificationStatus = "rejected"
```

---

## 🧠 Lógica de Cualificación del Bot

### **Para VENTA:**

```
1. Pregunta nombre (si no lo ha dado)
2. Confirma características
3. Pregunta: "¿Compra al contado o con hipoteca?"
   • Si hipoteca: "¿Ya la tienes concedida?"
4. Pregunta disponibilidad para visita (mañanas/tardes/indiferente)
5. Cierre + [LEAD_CUALIFICADO]
```

### **Para ALQUILER:**

```
1. Pregunta nombre (si no lo ha dado)
2. Pregunta TODO junto:
   • ¿Cuántas personas viviréis?
   • ¿Ingresos netos mensuales?
   • ¿Fecha de entrada?
   • ¿Mascotas?
3. Pregunta disponibilidad para visita
4. Cierre + [LEAD_CUALIFICADO]
```

### **Marcadores de Estado:**

- `[LEAD_CUALIFICADO]`: Lead completo y válido → qualified = true
- `[LEAD_NO_INTERESADO]`: Cliente no interesado → qualified = false
- Sin marcador: Conversación continúa

---

## 📊 Gestión de Estilos del Bot

```
Frontend: Configuración Page
    ↓
Usuario selecciona estilo:
  • "directo" - Mensajes cortos, agrupa preguntas
  • "amigable" - Tono cálido con emojis
  • "formal" - Tratamiento de usted
  • "conciso" - Ultra breve, tipo telegrama
    ↓
Frontend llama: setDoc(botConfig/config, { activeStyleId })
    ↓
Firestore actualiza activeStyleId
    ↓
Backend: getActiveStyle() lee activeStyleId y devuelve BotStyle
    ↓
generateAssistantResponse() usa style.promptModifier
    ↓
OpenAI recibe instrucciones con el estilo activo
    ↓
Respuestas reflejan el estilo configurado
```

---

## 🎯 Casos de Uso Clave

### **A. Crear Anuncio Nuevo**

```
Frontend: Listings Page → "Crear Anuncio"
    ↓
Formulario:
  • description, listingCode (único), link
  • operationType: Venta / Alquiler
  • features (características)
  • profitabilityReportAvailable + profitabilityReport
    ↓
Frontend: createListing()
    ↓
Firestore: addDoc(listings, { ...data, isActive: true, createdAt, updatedAt })
    ↓
Anuncio creado y visible en tabla
```

---

### **B. Iniciar Chat con Lead**

```
Frontend: Leads Page → Botón "Iniciar Chat"
    ↓
Lead tiene: phone + listingCode
    ↓
Frontend llama: POST /newLead con { telefono, anuncio }
    ↓
Backend:
  1. Busca listing
  2. Determina idioma
  3. Genera mensajes iniciales
  4. Envía a WhatsApp
  5. Crea/actualiza lead en Firestore
  6. Crea conversación en Firestore
  7. Crea estado en memoria
    ↓
Lead recibe mensajes en WhatsApp
    ↓
Conversación lista para continuar
```

---

### **C. Ver Conversación en Dashboard**

```
Frontend: Conversations Page
    ↓
Query: getConversations() → orderBy("lastMessage", "desc")
    ↓
Firestore devuelve lista de conversaciones
    ↓
Frontend muestra:
  • Nombre del lead
  • Teléfono
  • Código de anuncio
  • Número de mensajes
  • Estado (activa/finalizada/cualificada)
  • Botón "Ver Historial"
    ↓
Usuario hace clic en "Ver Historial"
    ↓
Modal muestra history[]:
  • [ASISTENTE]: Mensaje del bot (fondo azul)
  • [USUARIO]: Mensaje del cliente (fondo gris)
  • Timestamps formateados
```

---

### **D. Desactivar Anuncio por Venta/Alquiler**

```
Frontend: Listings Page → "Desactivar Anuncio"
    ↓
Modal de desactivación:
  • Razón: sold_to_qualified / rented_to_qualified / 
           sold_to_other / rented_to_other / other
  • Si es "to_qualified": Selector de lead cualificado
  • Notas adicionales (opcional)
    ↓
Frontend: deactivateListing(id, reason, qualifiedLeadId, notes)
    ↓
Firestore: updateDoc(listings/[id], {
  isActive: false,
  closureInfo: { reason, qualifiedLeadId, qualifiedLeadName, notes, closedAt },
  updatedAt
})
    ↓
Anuncio marcado como cerrado
    ↓
Dashboard actualiza estadísticas de conversión
```

---

## 🔒 Seguridad y Autenticación

```
Frontend:
  ↓
1. Usuario no autenticado → Redirige a /login
  ↓
2. Login con email/password o Google
  ↓
3. Firebase Auth valida credenciales
  ↓
4. AuthContext guarda usuario en estado
  ↓
5. ProtectedRoute permite acceso a rutas privadas
  ↓
6. Todas las queries a Firestore usan auth.currentUser
  ↓
7. Firestore Rules validan autenticación:
   • allow read, write: if request.auth != null
```

---

## 🌍 Manejo de Idiomas

```
Lead con teléfono:
  ↓
1. Backend extrae dígitos y normaliza
  ↓
2. Verifica si empieza con "34" o cumple patrón español
  ↓
3. SI español → language = "es"
   SI otro → language = "en"
  ↓
4. Para "en":
   • Traduce features con translateTextToBritishEnglish()
   • Mensajes iniciales en inglés británico
   • OpenAI responde en inglés
  ↓
5. Todos los mensajes y respuestas en el idioma detectado
```

---

## 📈 Métricas y Estadísticas (Dashboard)

```
Dashboard carga:
  ↓
1. Total de anuncios activos: getActiveListings().length
  ↓
2. Leads totales: getLeads().length
  ↓
3. Leads cualificados: filter(qualificationStatus === "qualified")
  ↓
4. Leads rechazados: filter(qualificationStatus === "rejected")
  ↓
5. Conversaciones activas: filter(isFinished === false)
  ↓
6. Conversaciones completadas: filter(isFinished === true)
  ↓
7. Estadísticas de conversión:
   • getConversionStats() → closureInfo.reason
   • Gráfico de cierre de anuncios por razón
  ↓
8. Gráficos de línea de tiempo:
   • Leads por fecha (groupBy createdAt)
   • Conversiones por semana/mes
```

---

## 🧩 Componentes Clave

### **ConversationState (En memoria)**

```typescript
type ConversationState = {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: "Venta" | "Alquiler";
  name?: string;
  description: string;
  link: string;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport?: string;
  history: HistoryItem[];       // Historial completo de mensajes
  pendingUserMessages: PendingItem[];
  isFinished: boolean;
  qualificationStatus?: boolean; // true = cualificado, false = rechazado
};
```

### **HistoryItem**

```typescript
type HistoryItem = {
  role: "assistant" | "user";
  text: string;
  timestamp: number;
};
```

### **LeadSummary (Generado por OpenAI)**

```typescript
type LeadSummary = {
  name?: string;
  people?: string;            // Cuántas personas vivirán
  income?: string;            // Ingresos netos/forma de sustento
  pets?: string;              // Sí/no y tipo
  paymentMethod?: string;     // Hipoteca/contado
  dates?: string;             // Fecha de entrada/salida
  visitAvailability?: string; // Disponibilidad para visita
  notes?: string;             // Contexto adicional
};
```

---

## 🔧 Variables de Entorno

### **Firebase Functions (.env)**

```bash
OPENAI_API_KEY=[secret]           # API Key de OpenAI
WHAPI_TOKEN=[secret]              # Token de Whapi.cloud
WHAPI_API_URL=https://gate.whapi.cloud
NOTIFICATION_NUMBER=34XXXXXXXXX   # Teléfono para notificaciones
OPENAI_MODEL=gpt-4o               # Modelo de OpenAI
```

### **Frontend (.env)**

```bash
VITE_FIREBASE_API_KEY=[key]
VITE_FIREBASE_AUTH_DOMAIN=[domain]
VITE_FIREBASE_PROJECT_ID=[projectId]
VITE_FIREBASE_STORAGE_BUCKET=[bucket]
VITE_FIREBASE_MESSAGING_SENDER_ID=[senderId]
VITE_FIREBASE_APP_ID=[appId]
VITE_FIREBASE_DATABASE_ID=realestate-whatsapp-bot
```

---

## 📦 Tecnologías Utilizadas

### **Backend**

- **Firebase Functions** (Node.js 18)
- **Firestore** (Base de datos NoSQL)
- **OpenAI API** (GPT-4o)
- **Whapi.cloud** (WhatsApp Cloud API)
- **TypeScript**
- **Axios** (HTTP client)

### **Frontend**

- **React 18**
- **Vite** (Build tool)
- **TypeScript**
- **TailwindCSS** (Styling)
- **React Query** (Data fetching)
- **React Router** (Routing)
- **Firebase SDK** (Auth + Firestore)
- **Lucide React** (Icons)
- **Recharts** (Gráficos)

---

## 🚀 Despliegue

```bash
# Frontend
npm run build
firebase deploy --only hosting

# Backend
cd functions
npm run build
firebase deploy --only functions

# Firestore Rules
firebase deploy --only firestore:rules

# Todo junto
firebase deploy
```

---

## 📞 Flujo de Notificaciones

```
Lead cualificado
    ↓
Backend genera mensaje de notificación:
  • Lead cualificado ✅
  • Teléfono: [phone]
  • Nombre: [name]
  • Propiedad: [description]
  • Operación: [Venta/Alquiler]
  • [Datos específicos según operationType]
  • Disponibilidad visita: [visitAvailability]
    ↓
Envía a NOTIFICATION_NUMBER vía Whapi:
  sendText({ 
    to: NOTIFICATION_NUMBER, 
    body: [mensaje de notificación] 
  })
    ↓
Agente inmobiliario recibe notificación en WhatsApp
    ↓
Puede llamar al lead para confirmar visita
```

---

## 🎨 Características Avanzadas

### **1. Manejo de chatId Variants**

- Soporta `@c.us` y `@s.whatsapp.net`
- Normalización automática
- Búsqueda en todas las variantes

### **2. Traducción Automática**

- Detecta idioma por código de país
- Traduce características a inglés británico
- Mensajes iniciales en el idioma correcto

### **3. Extracción Inteligente de Nombre**

- OpenAI analiza historial
- Detecta presentaciones del cliente
- Actualiza lead automáticamente

### **4. Resumen de Lead**

- OpenAI genera JSON estructurado
- Extrae datos críticos según operationType
- Validación de valores vacíos/inválidos

### **5. Gestión de Cierre de Anuncios**

- Razones de cierre detalladas
- Asociación con leads cualificados
- Estadísticas de conversión
- Notas adicionales

### **6. Filtros y Búsquedas**

- Filtros por estado (activo/cerrado)
- Filtros por tipo de operación
- Filtros por cualificación
- Búsqueda por código/descripción/nombre

### **7. Exportación de Datos**

- Exportar anuncios a CSV
- Exportar leads cualificados a CSV
- Formato limpio y legible

---

## 🔍 Debugging y Monitoring

### **Logs en Functions**

```javascript
console.log("Webhook POST received", JSON.stringify(req.body));
console.log(`Processing ${inboundMessages.length} message(s)`);
console.log("Lead status updated to qualified", state.chatId);
console.error("Error processing message", error);
```

### **Health Check**

```
GET /healthz
Response: { "status": "ok" }
```

### **Verificación de Webhook**

```
GET /webhook
Response: { "status": "ok", "message": "Webhook is ready" }
```

---

## ✅ Resumen del Flujo Completo

1. **Admin crea anuncio** en Frontend (Listings)
2. **Admin crea lead** en Frontend (Leads)
3. **Backend envía mensajes iniciales** a WhatsApp vía Whapi
4. **Cliente responde** en WhatsApp
5. **Whapi envía webhook** a Backend
6. **Backend procesa mensaje** con estado en memoria + Firestore
7. **OpenAI genera respuesta** según estilo activo
8. **Backend envía respuesta** a WhatsApp
9. **Backend actualiza conversación** en Firestore
10. **Si cualificado**: OpenAI genera resumen + notificación + guarda en qualifiedLeads
11. **Admin ve todo** en Dashboard (conversaciones, leads, cualificados)
12. **Admin puede cerrar anuncio** asociándolo a lead cualificado

---

## 🎯 Beneficios del Sistema

✅ **Automatización completa** de la cualificación de leads  
✅ **Conversaciones naturales** con IA (GPT-4o)  
✅ **Dashboard centralizado** para gestión  
✅ **Multiidioma** (español/inglés) automático  
✅ **Estilos configurables** del bot  
✅ **Notificaciones en tiempo real** a WhatsApp del agente  
✅ **Trazabilidad completa** de conversaciones  
✅ **Estadísticas y métricas** de conversión  
✅ **Gestión de cierre** de anuncios con razones  
✅ **Escalable** con Firebase Functions  

---

**Fecha de creación:** Febrero 2026  
**Stack:** React + Firebase + OpenAI + Whapi.cloud  
**Región:** europe-west1
