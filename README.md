# WhatsApp Bot Firebase App

Aplicación web para gestionar un bot de WhatsApp para cualificación de leads inmobiliarios.

## Stack Tecnológico

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Firebase Functions (Node.js 18)
- **Base de datos**: Firestore
- **Auth**: Firebase Authentication
- **Hosting**: Firebase Hosting

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
firebase functions:secrets:set WHAPI_TOKEN

# Configurar variables de entorno
firebase functions:config:set whapi.url="https://gate.whapi.cloud"
firebase functions:config:set notification.number="34XXXXXXXXX"
firebase functions:config:set openai.model="gpt-4o"
```

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
│   │   └── services/    # Servicios (Firestore, OpenAI, Whapi)
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

- `POST /webhook` - Webhook para recibir mensajes de Whapi
- `POST /newLead` - Crear nuevo lead y enviar mensajes iniciales
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
