# Verificación Post-Seed

## ✅ Cómo verificar que el seed funcionó correctamente

### 1. Verificar desde Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: `real-estate-idealista-bot`
3. Ve a **Firestore Database**
4. Selecciona la base de datos: `realestate-whatsapp-bot`
5. Deberías ver las siguientes colecciones:

```
📁 anuncios (5 documentos)
📁 botConfig (1 documento)
📁 leads (2 documentos)
```

### 2. Verificar desde la aplicación web

#### Paso 1: Iniciar el frontend
```bash
npm run dev
```

#### Paso 2: Iniciar sesión
1. Ve a `http://localhost:5173/login`
2. Inicia sesión con tu cuenta de Firebase Auth

#### Paso 3: Verificar cada sección

**Dashboard** (`/`)
- Deberías ver:
  - Anuncios: 5
  - Leads: 2
  - Conversaciones: 0 (normal, aún no hay conversaciones)
  - Cualificados: 0 (normal, aún no hay leads cualificados)

**Anuncios** (`/anuncios`)
- Deberías ver 5 anuncios:
  - ✅ Villa moderna en Marbella (VIL001) - VENTA
  - ✅ Apartamento céntrico en Madrid (APT002) - ALQUILER
  - ✅ Chalet independiente con jardín en Valencia (CHA003) - VENTA
  - ✅ Estudio amueblado Barcelona (EST004) - ALQUILER
  - ✅ Ático dúplex con terraza en Sevilla (PEN005) - VENTA

**Leads** (`/leads`)
- Deberías ver 2 leads de ejemplo:
  - ✅ 34612345678 - VIL001 (Venta)
  - ✅ 34698765432 - APT002 (Alquiler)

**Configuración** (`/configuracion`)
- Deberías ver 4 estilos disponibles:
  - ✅ Directo y Eficiente (activo por defecto)
  - ✅ Amigable y Cercano
  - ✅ Formal y Profesional
  - ✅ Ultra Conciso

### 3. Probar funcionalidad del bot

#### Opción A: Probar con el endpoint newLead

```bash
# Asegúrate de que las functions están corriendo
cd functions
npm run serve
```

En otra terminal:
```bash
# Crear un nuevo lead
curl -X POST http://localhost:5001/real-estate-idealista-bot/us-central1/newLead \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "34600000000",
    "anuncio": "VIL001"
  }'
```

**Resultado esperado:**
- Deberías recibir un `chatId` en la respuesta
- Se enviarían 2 mensajes al WhatsApp (si tienes Whapi configurado)

#### Opción B: Ver los logs de las functions

```bash
cd functions
npm run serve
```

En los logs deberías ver:
```
✔  functions: Loaded functions definitions from source: healthz, newLead, webhook.
```

### 4. Troubleshooting

**❌ No veo ningún dato en el Dashboard**
- Verifica que iniciaste sesión correctamente
- Abre la consola del navegador (F12) y busca errores
- Verifica que estás conectado a la base de datos correcta: `realestate-whatsapp-bot`

**❌ Error "Missing or insufficient permissions"**
- Las reglas de Firestore requieren autenticación
- Temporalmente puedes cambiar las reglas a `allow read, write: if true;` solo para testing
- Recuerda revertir las reglas después

**❌ El script de seed da error de módulo**
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

**❌ No se conecta a Firebase**
- Verifica tu conexión a internet
- Verifica que el proyecto existe en Firebase Console
- Revisa que `firebase.ts` tiene la configuración correcta

### 5. Siguiente paso: Configurar Whapi

Para que el bot funcione completamente necesitas:

1. Crear cuenta en [Whapi.cloud](https://whapi.cloud)
2. Obtener tu token de API
3. Configurar el webhook apuntando a tu función `webhook`
4. Configurar las variables de entorno en Firebase:

```bash
firebase functions:secrets:set WHAPI_TOKEN
firebase functions:config:set whapi.url="https://gate.whapi.cloud"
```

### 6. Siguiente paso: Configurar OpenAI

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:config:set openai.model="gpt-4o"
```

## 🎉 ¡Listo!

Si ves todos los datos correctamente, tu aplicación está lista para:
- ✅ Gestionar anuncios inmobiliarios
- ✅ Crear leads manualmente desde el frontend
- ✅ Recibir mensajes de WhatsApp (una vez configures Whapi)
- ✅ Cualificar leads automáticamente con IA
- ✅ Cambiar el estilo de conversación del bot
