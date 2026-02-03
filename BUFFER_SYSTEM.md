# Sistema de Buffer de Mensajes (90 segundos)

## Descripción

El bot ahora implementa un **buffer de 90 segundos** para acumular múltiples mensajes del usuario antes de responder. Esto permite que el bot reciba el contexto completo cuando los usuarios escriben varios mensajes seguidos.

## ¿Por qué es necesario?

Los usuarios normalmente escriben en fragmentos:
```
Usuario: "Hola"
Usuario: "Busco piso"
Usuario: "De 2 habitaciones"
Usuario: "En el centro"
```

**Sin buffer**: El bot respondería 4 veces, posiblemente con respuestas parciales o incompletas.

**Con buffer**: El bot espera 90 segundos sin mensajes nuevos, recopila los 4 mensajes y responde una vez con contexto completo.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuario envía mensaje → Webhook                              │
│    - Guarda mensaje en Firestore (pendingUserMessages)          │
│    - Cancela Cloud Task anterior (si existe)                     │
│    - Programa nueva Cloud Task para 90 segundos después          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Usuario envía otro mensaje (antes de 90s)                    │
│    - Guarda mensaje adicional                                   │
│    - Cancela Cloud Task anterior                                 │
│    - Programa NUEVA Cloud Task para 90s desde AHORA             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Pasan 90 segundos sin nuevos mensajes                        │
│    - Cloud Task ejecuta función processBuffer                    │
│    - Lee todos los mensajes pendientes de Firestore             │
│    - Los borra atómicamente (transaction)                        │
│    - Procesa todos juntos y genera UNA respuesta                │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. `services/cloudTasks.ts` (Nuevo)
Maneja la creación, cancelación y programación de Cloud Tasks:
- `scheduleBufferTask()`: Programa un task para procesar mensajes en 90s
- `cancelBufferTask()`: Cancela un task existente cuando llega nuevo mensaje
- `hasPendingTask()`: Verifica si hay un task activo

### 2. `services/firestore.ts` (Modificado)
Nuevas funciones para manejar mensajes pendientes:
- `addPendingMessage()`: Añade mensaje al array de pendientes
- `updateBufferTask()`: Guarda info del task programado
- `getPendingMessagesAndClear()`: Lee y borra mensajes atómicamente
- `hasPendingMessages()`: Verifica si hay mensajes pendientes

### 3. `index.ts` - Webhook (Modificado)
Ya NO procesa mensajes inmediatamente. Ahora:
1. Agrupa mensajes por `chatId`
2. Añade cada mensaje a `pendingUserMessages` en Firestore
3. Programa/reprograma Cloud Task para 90 segundos después

### 4. `index.ts` - processBuffer (Nueva función)
Nueva Cloud Function HTTP llamada por Cloud Tasks:
1. Recibe `{ chatId }` en el body
2. Lee mensajes pendientes de Firestore (y los borra)
3. Llama a `processBufferedMessages()` con todos los mensajes
4. Genera UNA respuesta con contexto completo

### 5. `index.ts` - processBufferedMessages (Nueva)
Reemplaza a la antigua `processMessage()`:
- Acepta un **array** de mensajes en lugar de uno solo
- Los añade todos al historial ordenados por timestamp
- Genera una sola respuesta considerando todo el contexto

## Campos de Firestore añadidos

### Colección `conversations`
```typescript
{
  // ... campos existentes
  pendingUserMessages: [
    { text: string, timestamp: number },
    { text: string, timestamp: number }
  ],
  pendingTaskName: string,        // Nombre del Cloud Task programado
  bufferExpiresAt: number         // Timestamp cuando expira el buffer
}
```

## Configuración de Cloud Tasks

### Cola creada
- **Nombre**: `message-buffer-queue`
- **Región**: `europe-west1`
- **Delay**: 90 segundos
- **Retry**: Default (3 intentos)

### Comandos ejecutados
```bash
gcloud services enable cloudtasks.googleapis.com
gcloud tasks queues create message-buffer-queue --location=europe-west1
```

## URLs de las funciones

| Función | URL |
|---------|-----|
| `webhook` | https://webhook-qewb2jyema-ew.a.run.app |
| `processBuffer` | https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/processBuffer |
| `newLead` | https://newlead-qewb2jyema-ew.a.run.app |
| `healthz` | https://healthz-qewb2jyema-ew.a.run.app |

## Configuración del buffer

Para cambiar el tiempo de espera, modifica en `services/cloudTasks.ts`:

```typescript
export const BUFFER_DELAY_SECONDS = 90; // Cambiar aquí
```

Luego redeploy:
```bash
npm run build
firebase deploy --only functions
```

## Seguridad

La función `processBuffer` verifica que la request viene de Cloud Tasks:
```typescript
const taskName = req.headers["x-cloudtasks-taskname"];
const queueName = req.headers["x-cloudtasks-queuename"];
```

En producción, solo Cloud Tasks puede invocar esta función porque usa OIDC authentication.

## Monitoreo

### Ver logs
```bash
firebase functions:log
```

### Ver tareas en la cola
```bash
gcloud tasks list --queue=message-buffer-queue --location=europe-west1
```

### Ver métricas en Cloud Console
- [Cloud Tasks Console](https://console.cloud.google.com/cloudtasks/queue/europe-west1/message-buffer-queue)
- [Cloud Functions Console](https://console.cloud.google.com/functions/list)

## Comportamiento esperado

### Escenario 1: Mensajes rápidos seguidos
```
00:00 - Usuario: "Hola"          → Task programado para 01:30
00:05 - Usuario: "Busco piso"    → Task cancelado, nuevo task para 01:35
00:10 - Usuario: "2 habitaciones" → Task cancelado, nuevo task para 01:40
01:40 - Bot responde con contexto completo de los 3 mensajes
```

### Escenario 2: Mensaje único
```
00:00 - Usuario: "¿Está disponible?" → Task programado para 01:30
01:30 - Bot responde
```

### Escenario 3: Conversación ya finalizada
```
00:00 - Usuario envía mensaje pero conversation.isFinished === true
        → Mensaje se guarda pero NO se procesa (bot ya cualificó/descartó)
```

## Testing local

Para probar localmente necesitas:
1. Emulador de Functions: `firebase emulators:start`
2. Configurar Cloud Tasks para apuntar a localhost (complicado)
3. **Alternativa**: Reducir `BUFFER_DELAY_SECONDS` a 5 segundos para testing en producción

## Costos

- **Cloud Tasks**: ~$0.40 por millón de operaciones
- **Cloud Functions invocations**: Cobradas normalmente
- **Firestore reads/writes**: Sin cambio significativo (mismo número de operaciones)

**Estimación**: Para 10,000 conversaciones/mes → ~$0.004 adicional por Cloud Tasks

## Troubleshooting

### "Task already exists"
El código ya maneja esto cancelando tasks existentes antes de crear nuevos.

### "No pending messages"
Normal si el task ya se procesó o se canceló. Se loggea pero no es error.

### Messages processed twice
No debería ocurrir gracias a `getPendingMessagesAndClear()` que usa transaction atómica.

### Task no se ejecuta
Verificar:
1. La cola existe: `gcloud tasks queues describe message-buffer-queue --location=europe-west1`
2. Permisos del service account
3. URL de processBuffer es correcta
