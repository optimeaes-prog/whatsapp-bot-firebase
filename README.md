# WhatsApp Bot Firebase App

Aplicación web para gestionar un bot de WhatsApp para cualificación de leads inmobiliarios.

## Stack Tecnológico

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Firebase Functions (Node.js 18)
- **Base de datos**: Firestore
- **Auth**: Firebase Authentication
- **Hosting**: Firebase Hosting

## Modelo de autorización

Los permisos se modelan en dos capas que conviene entender juntas:

**Roles** (campo `users/{uid}.role`):

| Rol | Capacidad |
|---|---|
| `super_admin` | Acceso a cualquier organización, herramientas de plataforma (`triggerSync`, migraciones Twilio, panel de organizaciones). No se gestiona desde la UI: se asigna a mano en la consola de Firebase. |
| `owner` | Dueño de una organización. Lectura/escritura completa sobre los datos de su `orgId`. |
| `admin` | Gestiona el día a día de la organización (equipo, anuncios, leads, alertas) dentro de su `orgId`. |
| `member` (o `agent`) | Acceso limitado a su propio trabajo: anuncios/leads/conversaciones asignados o creados por él. |

Cada usuario está adscrito a una organización vía `users/{uid}.orgId`. El campo `role` y el campo `orgId` se leen desde Firestore en cada regla de seguridad (`getUserData()`).

**Endpoints y reglas — qué pasa por dónde:**

- **Firestore** está protegido por `firestore.rules`. Toda lectura/escritura desde el cliente pasa por estas reglas, que validan rol + `orgId`.
- **Storage** está protegido por `storage.rules` con el mismo patrón org-scoped. Los buckets internos de audio inbound/outbound se escriben sólo desde Cloud Functions vía Admin SDK.
- **Cloud Functions** usan el Admin SDK y por tanto **bypassan las reglas**. Cada endpoint debe re-validar permisos manualmente con `resolveUserContextFromToken(authHeader)` y comprobar `role`/`orgId` antes de escribir. Los webhooks (`whatsappWebhook`, `voiceWebhook`, `voiceGatherCallback`, `stripeWebhook`) validan firma criptográfica del emisor en lugar de auth de usuario.

**CORS, secretos y rate limits:**

- HTTP funciones autenticadas usan la allowlist `WEB_CLIENT_CORS` (sólo orígenes de Proplead + localhost para dev). Los webhooks usan `cors: false`. Los endpoints públicos (`getPackages`) pueden mantener `cors: true`.
- Los secretos viven en Secret Manager (`firebase functions:secrets:set …`). Acceso vía `defineSecret(...)` declarado en `functions/src/secrets.ts`.
- Los endpoints caros (mensajería saliente, intake de leads, retry-runs) están protegidos por `checkAndRecordRateLimit` con buckets por-org o por-phone+listing.

**Promoción de roles:** los cambios de rol (incluido alta de un `super_admin`) deben hacerse con un script de Admin SDK o directamente en la consola de Firebase. No hay flujo cliente que escriba `role` directamente y las reglas lo prohíben.

## Configuración

### 1. Instalar dependencias

```bash
# Frontend
npm install

# Functions
cd functions && npm install
```

### 2. Configurar Firebase

Asegúrate de tener Firebase CLI instalado:

```bash
npm install -g firebase-tools
firebase login
```

### 3. Configurar variables de entorno para Functions

```bash
# Configurar secretos
firebase functions:secrets:set OPENAI_API_KEY

# Configurar variables de entorno
firebase functions:config:set notification.number="34XXXXXXXXX"
firebase functions:config:set openai.model="gpt-4o"
```

#### Notificaciones de resumen de leads cualificados (WhatsApp)

- En la app, **Configuración → Notificaciones de leads**: los números de la organización reciben **siempre** cada resumen cuando un lead pasa a cualificado (además del fallback global de Functions si no hay números en Firestore).
- En **Equipo**, usuarios con rol distinto de `member` pueden guardar uno o más WhatsApp (separados por comas). Si están **asignados al anuncio** en Listados y su número es distinto de los de la organización, el backend notifica a **organización + ese usuario**; si el número coincide tras normalizarlo, solo se envía **un** mensaje a ese destino.

#### Twilio: plantilla de fallback para notificaciones a agente (fuera de 24h)

Cuando Twilio rechaza un mensaje libre por estar fuera de la ventana de 24h, el backend reintenta con una plantilla de WhatsApp si está configurado `TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION`.

Requisitos de la plantilla:
- Debe usar una sola variable `{{1}}` (resumen completo de la notificación).
- Debe terminar con texto fijo (no puede acabar en variable).

Ejemplo de cuerpo para aprobación en Twilio/Meta:

```text
Nuevo aviso Proplead:
{{1}}

— Proplead
```

Ejemplo de variable para la vista previa de aprobación:
- `1`: `Lead cualificado ✅ | Nombre: Ana | Tel: +34600111222 | Anuncio: 123456789`

### 4. Poblar la base de datos con datos de ejemplo

```bash
# Ejecutar script de seed
npm run seed
```

Este script creará:
- ✅ Configuración del bot con 4 estilos
- ✅ 5 anuncios de ejemplo (venta y alquiler)
- ✅ 2 leads de prueba

Ver más detalles en `scripts/README.md`

### 5. Desplegar

```bash
# Build frontend
npm run build

# Desplegar todo
firebase deploy

# O desplegar por partes
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Desarrollo local

```bash
# Frontend
npm run dev

# Functions (en otra terminal)
cd functions
npm run serve
```

## Estructura de carpetas

```
whatsapp_bot_firebase/
├── functions/            # Firebase Functions (backend)
│   ├── src/
│   │   ├── index.ts     # Endpoints HTTP
│   │   ├── types.ts     # Tipos TypeScript
│   │   └── services/    # Servicios (Firestore, OpenAI, mensajería)
│   └── package.json
├── src/                  # Frontend React
│   ├── components/      # Componentes reutilizables
│   ├── contexts/        # Contextos React (Auth)
│   ├── lib/             # Utilidades y config Firebase
│   ├── pages/           # Páginas de la app
│   ├── services/        # Servicios de acceso a Firestore
│   └── types/           # Tipos TypeScript
├── firebase.json        # Config de Firebase
└── package.json
```

## Endpoints de Functions

### WhatsApp
- `POST /webhook` - Webhook entrante de WhatsApp (Twilio / Cloud API)
- `POST /newLead` - Crear nuevo lead y enviar mensajes iniciales

### Sistema
- `GET /healthz` - Health check

## Colecciones de Firestore

- `anuncios` - Datos de anuncios inmobiliarios
- `leads` - Leads registrados
- `conversaciones` - Historial de conversaciones
- `cualificados` - Leads cualificados
- `botConfig` - Configuración del bot (estilos)

## Estilos de Bot

La app incluye 4 estilos predefinidos:

1. **Directo y Eficiente** - Mensajes cortos, sin relleno
2. **Amigable y Cercano** - Tono cálido con emojis
3. **Formal y Profesional** - Tratamiento de usted
4. **Ultra Conciso** - Mínimo de palabras
