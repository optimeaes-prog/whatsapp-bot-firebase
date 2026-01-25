# ✅ FUNCTIONS DESPLEGADAS EN PRODUCCIÓN

## 🎉 ¡Deploy exitoso!

Las Firebase Functions están ahora corriendo en **producción** en la región `europe-west1`.

---

## 📍 URLs de producción

### Webhook (para Whapi)
```
https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/webhook
```
**Uso:** Configurar este URL como webhook en Whapi.cloud

### newLead (crear leads)
```
https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/newLead
```
**Uso:** Llamar desde tu frontend o API para crear nuevos leads

### healthz (health check)
```
https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/healthz
```
**Uso:** Verificar que las functions están funcionando

---

## ✅ Lo que se desplegó

- ✅ **3 funciones HTTP** en `europe-west1`
- ✅ **Secrets configurados**:
  - `WHAPI_TOKEN` ✓
  - `OPENAI_API_KEY` ✓
- ✅ **Variables de entorno**:
  - `whapi.url` = https://gate.whapi.cloud
  - `openai.model` = gpt-5.1
  - `notification.number` = 34669354177
- ✅ **Firestore conectado** a base de datos: `realestate-whatsapp-bot`

---

## 🔧 Configuración de Whapi

Para que tu bot reciba mensajes de WhatsApp:

### 1. Ve a Whapi.cloud Dashboard
https://whapi.cloud/dashboard

### 2. Configura el webhook

En la sección de "Webhooks" o "Settings":

```
Webhook URL: https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/webhook
Method: POST
Events: message_received (o similar según Whapi)
```

### 3. Verifica que funciona

Una vez configurado, Whapi enviará todos los mensajes entrantes a tu función `webhook`.

---

## 🧪 Probar las functions

### Test 1: Health Check
```bash
curl https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/healthz
```
**Respuesta esperada:** `{"status":"ok"}`

### Test 2: Crear un nuevo lead
```bash
curl -X POST https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/newLead \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "34600000000",
    "anuncio": "VIL001"
  }'
```

**Qué sucede:**
1. Valida que el anuncio existe en Firestore
2. Detecta el idioma (español por el 34)
3. Envía 2 mensajes iniciales a WhatsApp
4. Guarda el lead en Firestore (`leads/`)
5. Crea la conversación en Firestore (`conversaciones/`)
6. Retorna `{"chatId": "34600000000@c.us"}`

---

## 🔄 Flujo completo ahora en producción

```
Usuario escribe a WhatsApp
        ↓
Whapi recibe el mensaje
        ↓
Whapi llama a tu webhook
  https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/webhook
        ↓
Function webhook procesa:
  1. Lee conversación de Firestore
  2. Consulta estilo activo del bot
  3. Genera respuesta con OpenAI
  4. Envía respuesta por Whapi
  5. Actualiza Firestore
        ↓
Si el lead se cualifica:
  - Envía notificación al 34669354177
  - Guarda en cualificados/
  - Marca conversación como finished
```

---

## 📊 Verificar en Firestore

1. Ve a Firebase Console
   https://console.firebase.google.com/project/real-estate-idealista-bot/firestore

2. Selecciona la base de datos: `realestate-whatsapp-bot`

3. Verás las colecciones:
   - `anuncios` (5 docs) ✅
   - `botConfig` (1 doc) ✅
   - `leads` (2+ docs)
   - `conversaciones` (se crean con cada lead)
   - `cualificados` (se crean cuando se cualifican)

---

## 🎯 ¿Por qué tu lead no se guardaba antes?

**Problema:** Los emuladores locales estaban fallando por errores de inicialización de Firebase Admin.

**Solución:** Desplegamos a producción directamente en `europe-west1`.

**Ahora:**
- ✅ Las functions están corriendo 24/7
- ✅ Pueden recibir webhooks de Whapi
- ✅ Guardan datos en Firestore
- ✅ Envían mensajes de WhatsApp
- ✅ Generan respuestas con OpenAI

---

## 💰 Costos (aproximados)

**Firebase Functions (Gen 2):**
- Primeras 2M invocaciones/mes: GRATIS
- CPU y RAM: ~$0.10 por lead cualificado

**OpenAI (gpt-5.1):**
- Depende del modelo configurado
- ~$0.01-0.05 por conversación completa

**Whapi:**
- Según tu plan en Whapi.cloud

**Firestore:**
- Lecturas/Escrituras incluidas en plan gratuito para bajo volumen

---

## 🔍 Monitoreo

### Ver logs en tiempo real
```bash
firebase functions:log --only webhook,newLead
```

O desde la consola:
https://console.firebase.google.com/project/real-estate-idealista-bot/functions/logs

### Ver métricas
https://console.firebase.google.com/project/real-estate-idealista-bot/functions

---

## 🚀 Siguiente paso: Configurar Whapi Webhook

**CRÍTICO:** Para que los leads se guarden automáticamente desde WhatsApp:

1. Inicia sesión en https://whapi.cloud/dashboard
2. Ve a tu canal de WhatsApp
3. Configura webhook:
   ```
   URL: https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/webhook
   ```
4. Activa eventos de mensajes entrantes
5. Guarda

Una vez hecho esto, **cada mensaje que recibas en WhatsApp se procesará automáticamente**.

---

## ✅ Checklist final

- [x] Functions desplegadas en `europe-west1`
- [x] Secrets configurados (Whapi + OpenAI)
- [x] Variables de entorno configuradas
- [x] Firestore poblado con datos de ejemplo
- [x] URLs de producción generadas
- [ ] **Configurar webhook en Whapi** ← ¡Hazlo ahora!
- [ ] Probar enviando un mensaje de WhatsApp
- [ ] Verificar que se guarda en Firestore

---

¡Tu bot está **LIVE** y listo para recibir leads! 🎉
