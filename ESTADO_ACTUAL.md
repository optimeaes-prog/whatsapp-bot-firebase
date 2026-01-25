# ✅ Base de Datos Inicializada

## 🎉 Tu base de datos Firestore ha sido poblada exitosamente

### Colecciones creadas:

#### 1. **botConfig** (1 documento)
```
botConfig/
└── config
    ├── activeStyleId: "directo"
    └── styles: [4 estilos]
```

**Estilos disponibles:**
- ✅ **Directo y Eficiente** (activo) - Mensajes cortos, sin relleno
- ✅ **Amigable y Cercano** - Tono cálido con emojis  
- ✅ **Formal y Profesional** - Tratamiento de usted
- ✅ **Ultra Conciso** - Mínimo de palabras

#### 2. **anuncios** (5 documentos)

| ID | Descripción | Tipo | Rentabilidad |
|---|---|---|---|
| VIL001 | Villa moderna en Marbella con vistas al mar | Venta | ✅ Sí |
| APT002 | Apartamento céntrico en Madrid | Alquiler | ❌ No |
| CHA003 | Chalet independiente con jardín en Valencia | Venta | ✅ Sí |
| EST004 | Estudio amueblado Barcelona zona universitaria | Alquiler | ❌ No |
| PEN005 | Ático dúplex con terraza en Sevilla | Venta | ❌ No |

#### 3. **leads** (2 documentos de ejemplo)

| Teléfono | Anuncio | Tipo | Chat ID |
|---|---|---|---|
| 34612345678 | VIL001 | Venta | 34612345678@c.us |
| 34698765432 | APT002 | Alquiler | 34698765432@c.us |

---

## 🚀 Próximos pasos

### 1. Verificar los datos en Firebase Console
👉 [Abrir Firestore Console](https://console.firebase.google.com/project/real-estate-idealista-bot/firestore/databases/realestate-whatsapp-bot/data)

### 2. Iniciar la aplicación web

```bash
# Terminal 1: Frontend
npm run dev
# Abre: http://localhost:5173

# Terminal 2: Functions (ya corriendo)
cd functions && npm run serve
# Corriendo en: http://localhost:5001
```

### 3. Explorar la interfaz

**Dashboard** (`/`)
- Verás las estadísticas:
  - 5 anuncios
  - 2 leads
  - 0 conversaciones (esperado)
  - 0 cualificados (esperado)

**Anuncios** (`/anuncios`)
- Lista completa de los 5 anuncios
- Puedes crear, editar o eliminar anuncios

**Leads** (`/leads`)
- 2 leads de ejemplo
- Puedes iniciar conversaciones desde aquí

**Configuración** (`/configuracion`)
- Cambiar el estilo del bot entre los 4 disponibles
- Los cambios se aplican inmediatamente a nuevas conversaciones

---

## 🤖 Probar el bot de WhatsApp

### Opción 1: Probar el endpoint `newLead`

```bash
curl -X POST http://localhost:5001/real-estate-idealista-bot/us-central1/newLead \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "34600000000",
    "anuncio": "VIL001"
  }'
```

**⚠️ Nota:** Para que envíe mensajes reales necesitas:
1. Configurar Whapi.cloud
2. Configurar las variables de entorno:
   ```bash
   firebase functions:secrets:set WHAPI_TOKEN
   firebase functions:config:set whapi.url="https://gate.whapi.cloud"
   ```

### Opción 2: Simular webhook de WhatsApp

```bash
curl -X POST http://localhost:5001/real-estate-idealista-bot/us-central1/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "from": "34600000000",
      "chat_id": "34600000000@c.us",
      "text": "Hola, me interesa la villa",
      "timestamp": 1706000000,
      "from_me": false
    }]
  }'
```

---

## 📋 Checklist de configuración completa

### Configuración básica (✅ Ya hecho)
- [x] Proyecto Firebase creado
- [x] Firestore configurado
- [x] Frontend configurado
- [x] Functions configuradas  
- [x] Datos de ejemplo cargados

### Configuración de producción (⏳ Pendiente)
- [ ] Configurar Whapi.cloud
  - [ ] Crear cuenta en Whapi
  - [ ] Obtener token de API
  - [ ] Configurar webhook
- [ ] Configurar OpenAI
  - [ ] Crear cuenta/API key
  - [ ] Configurar secret en Functions
- [ ] Configurar número de notificaciones
- [ ] Desplegar a Firebase Hosting
- [ ] Desplegar Functions a producción

---

## 🔧 Comandos útiles

```bash
# Seed: Poblar base de datos
npm run seed:admin

# Dev: Desarrollar frontend
npm run dev

# Build: Compilar para producción
npm run build

# Deploy: Desplegar todo
firebase deploy

# Deploy parcial
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules

# Logs de functions
firebase functions:log

# Ver config de functions
firebase functions:config:get
```

---

## 📚 Documentación adicional

- [README.md](../README.md) - Documentación principal
- [scripts/README.md](./README.md) - Detalles del script de seed
- [scripts/VERIFICACION.md](./VERIFICACION.md) - Guía de verificación paso a paso

---

## ❓ Troubleshooting

**No veo los datos en el frontend**
- Verifica que iniciaste sesión
- Abre la consola del navegador (F12) y busca errores
- Verifica que estás conectado a la BD correcta: `realestate-whatsapp-bot`

**Error de permisos en Firestore**
- Las reglas actuales requieren autenticación
- Asegúrate de haber iniciado sesión en la app web

**Functions no responden**
- Verifica que están corriendo: `cd functions && npm run serve`
- Busca errores en los logs de la terminal

---

## 🎯 Estado actual

✅ **Base de datos**: Poblada y lista  
✅ **Frontend**: Configurado y funcional  
✅ **Functions**: Código listo (emuladores corriendo)  
⏳ **Whapi**: Pendiente de configurar  
⏳ **OpenAI**: Pendiente de configurar  
⏳ **Producción**: Pendiente de desplegar  

---

¡Tu aplicación está lista para comenzar a usarse! 🚀
