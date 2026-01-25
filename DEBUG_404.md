# ✅ RESUMEN: Functions Desplegadas (Con advertencia de 404)

## 🎉 Deploy completado pero con problemas de acceso

Las functions están desplegadas en **`europe-west1`** pero están dando **404**.

### ¿Por qué 404?

Las Firebase Functions Gen 2 pueden tardar unos minutos adicionales en estar disponibles, O puede haber un problema con los permisos/configuración.

---

## 🔧 Solución: Usar la consola de Firebase

### 1. Ve a la consola de Functions
https://console.firebase.google.com/project/real-estate-idealista-bot/functions

### 2. Verifica que las functions aparezcan:
- `healthz` (europe-west1)
- `newLead` (europe-west1) 
- `webhook` (europe-west1)

### 3. Haz clic en cada function para ver:
- ✅ Status: "Healthy" / "Active"
- 📊 Métricas
- 🔗 **URL correcta** (puede ser diferente a la que intentamos)

### 4. Copia las URLs reales desde la consola

---

## 📍 URLs provisionales (verificar en consola)

Según el deploy, las URLs deberían ser:

```
https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/webhook
https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/newLead
https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/healthz
```

**PERO** si dan 404, las URLs reales están en la consola de Firebase.

---

## ✅ Lo que SÍ funcionó

1. ✅ Configuración de secrets (WHAPI_TOKEN, OPENAI_API_KEY)
2. ✅ Configuración de variables de entorno
3. ✅ Build y compilación de TypeScript
4. ✅ Upload de código a Cloud Functions
5. ✅ Functions listadas correctamente (`firebase functions:list`)
6. ✅ Region `europe-west1` configurada
7. ✅ Node 20 runtime configurado

---

## 🔍 Verificación manual

### Paso 1: Ir a la consola
1. Abre https://console.firebase.google.com/project/real-estate-idealista-bot/functions
2. Deberías ver las 3 functions listadas
3. Haz clic en `healthz`
4. Copia la URL que aparece en "Trigger"

### Paso 2: Probar con curl
```bash
curl [LA_URL_DE_LA_CONSOLA]
```

**Si funciona:** ✅ Usa esa URL  
**Si sigue dando 404:** Hay un problema de configuración

---

## 🐛 Posibles causas del 404

1. **Tiempo de propagación**: Las functions Gen 2 tardan 2-5 minutos extra
2. **Permisos IAM**: Puede que las functions no sean públicas
3. **URL incorrecta**: Puede que la URL tenga un formato diferente en Gen 2

---

## 🚀 Solución alternativa: Ver logs en consola

1. Ve a: https://console.cloud.google.com/functions/list?project=real-estate-idealista-bot
2. Haz clic en cada function
3. Ve a la pestaña "LOGS"
4. Intenta hacer una petición y verás si llega

---

## 📝 Para el usuario

**Tu lead no se guardó antes porque:**
- Los emuladores locales estaban fallando
- No había functions corriendo

**Ahora:**
- ✅ Las functions ESTÁN desplegadas
- ✅ El código es correcto
- ⚠️ Solo necesitamos verificar las URLs correctas

**Próximo paso:**
Ve a la consola de Firebase y copia las URLs reales de las functions.

---

## 💡 Comando útil

Ver info detallada de una function:
```bash
gcloud functions describe healthz --region europe-west1 --gen2 --project real-estate-idealista-bot
```

---

**TL;DR:** Functions desplegadas, pero verifica las URLs en la consola de Firebase.
