# Script de Seed para Firestore

Este script puebla tu base de datos Firestore con datos de ejemplo para comenzar a usar la aplicación inmediatamente.

## ¿Qué datos crea?

### 1. **Bot Config** (1 documento)
- Configuración con 4 estilos de conversación predefinidos:
  - **Directo y Eficiente**: Mensajes cortos, sin relleno
  - **Amigable y Cercano**: Tono cálido con emojis
  - **Formal y Profesional**: Tratamiento de usted
  - **Ultra Conciso**: Mínimo de palabras
- Estilo activo por defecto: "Directo y Eficiente"

### 2. **Anuncios** (5 documentos)
- **VIL001**: Villa moderna en Marbella (Venta) - Con informe de rentabilidad
- **APT002**: Apartamento céntrico en Madrid (Alquiler)
- **CHA003**: Chalet independiente en Valencia (Venta) - Con informe de rentabilidad
- **EST004**: Estudio amueblado Barcelona (Alquiler)
- **PEN005**: Ático dúplex en Sevilla (Venta)

### 3. **Leads** (2 documentos de ejemplo)
- 2 leads de prueba vinculados a los anuncios VIL001 y APT002

## Cómo ejecutar

### Opción 1: Desde la raíz del proyecto

```bash
npm run seed
```

### Opción 2: Ejecutar directamente

```bash
node scripts/seedFirestore.js
```

## Requisitos

- Tener las dependencias de Firebase instaladas (`npm install`)
- Estar conectado a Firebase (el script usa la configuración de producción)
- Tener permisos de escritura en Firestore

## Qué sucede después

Una vez ejecutado el script:

1. ✅ Podrás ver todos los anuncios en la página `/anuncios`
2. ✅ Podrás cambiar el estilo del bot en `/configuracion`
3. ✅ Podrás ver los leads de ejemplo en `/leads`
4. ✅ El bot estará listo para recibir mensajes de WhatsApp
5. ✅ Las colecciones `conversaciones` y `cualificados` se crearán automáticamente cuando lleguen mensajes

## Notas

- El script es **idempotente parcialmente**: El bot config se sobrescribe si ya existe, pero los anuncios y leads se agregan como nuevos documentos cada vez que lo ejecutes
- Si quieres limpiar los datos antes de ejecutarlo, borra las colecciones desde la consola de Firebase
- Los leads de ejemplo usan números de teléfono ficticios y chatIds de prueba

## Colecciones Firestore creadas

```
realestate-whatsapp-bot/
├── botConfig/
│   └── config (documento único)
├── anuncios/
│   └── [5 documentos]
├── leads/
│   └── [2 documentos de ejemplo]
├── conversaciones/  ← Se crea automáticamente al recibir mensajes
└── cualificados/    ← Se crea automáticamente al cualificar leads
```

## Solución de problemas

### Error: "Missing or insufficient permissions"
- Verifica que las reglas de Firestore permitan escritura
- Asegúrate de estar autenticado (o temporalmente permite escritura sin auth para el seed)

### Error: "Cannot find module 'firebase'"
```bash
npm install
```

### El script se ejecuta pero no veo los datos
- Verifica que estás mirando la base de datos correcta: `realestate-whatsapp-bot`
- Revisa la consola de Firebase para confirmar que los documentos se crearon
