# Proplead — Guía de funciones por página

Guía de usuario de las cuatro pantallas operativas principales de Proplead: **Conversaciones**, **Leads**, **Anuncios** y **Dashboard**. Cubre filtros, columnas, acciones, modales y comportamientos del asistente IA en cada una.

---

## 1. Conversaciones (`/conversations`)

Bandeja de entrada de WhatsApp. Muestra todas las conversaciones de la agencia y permite leer el historial, intervenir manualmente, y consultar/editar la ficha del lead asociado.

### Vista de lista

Cada fila muestra:

- Teléfono / nombre del remitente
- Badge de tipo de operación (Venta / Alquiler)
- Badge de cualificación (Cualificado / No interesado / Pendiente)
- Indicador de opt-out (si el contacto se ha dado de baja)
- Fecha del último mensaje

Orden por defecto: más reciente primero.

### Filtros

- **Estado de la conversación** (segmentado): Activas / Finalizadas
- **Anuncio**: todos o un código de anuncio concreto
- **Cualificación**: todos / cualificados / no cualificados
- **Estado del anuncio**: todos / activo / inactivo
- **Asistente IA**: todos / activo / desactivado (filtra por conversaciones donde el bot está encendido o apagado)
- **Rango de fechas**: todo / hoy / ayer / últimos 7 días / últimos 30 días
- **Tipo de contacto** (segmentado): Leads / No identificados
- **Opt-out** (segmentado): todos / dados de baja / activos
- **Búsqueda**: texto libre en el contenido de las conversaciones

### Detalle de conversación

Al abrir una conversación verás:

- Historial completo de mensajes con etiquetas asistente/usuario, marcas de tiempo y soporte de formato en negrita (`*texto*`)
- Badge de cualificación y de finalización
- Panel lateral con la **ficha del lead** (notas + etiquetas) editable en línea
- **Descargar conversación** — exporta el historial completo
- **Toggle del asistente IA** — activa/desactiva el bot por conversación. Cuando está apagado, se habilita el envío manual

### Envío de mensajes manual

- Área de redacción con `Shift+Enter` para salto de línea, `Enter` para enviar
- Disponible solo cuando el asistente está desactivado para esa conversación

### Responsive

- Móvil: la lista se oculta cuando entras en una conversación; vista pantalla completa con botón de volver
- Desktop: dos paneles (lista + detalle) simultáneos

---

## 2. Leads (`/leads`)

Tabla maestra de todos los leads (un lead = un contacto vinculado a un anuncio). Está pensada para trabajo en bloque: filtrar, seleccionar muchos a la vez y aplicarles acciones masivas.

### Columnas (todas se pueden ocultar individualmente desde "Configurar columnas"; la preferencia se guarda por navegador)

- **Nombre** (clic = abre el editor)
- **Teléfono** formateado (clic = abre el editor)
- **ID Idealista** del anuncio + enlace externo a Idealista
- **Identificador anuncio** (descripción)
- **Tipo** — Venta / Alquiler
- **Estado** — No cualificado / Sin respuesta / Cualificado / Rechazado
- **Consentimiento** (estado GDPR)
- **Cualificación** — fecha en que se cualificó
- **Último mensaje** — fecha
- **Mensajes** — total intercambiados, con escala de color
- **Mascotas** — Sí / No
- **Ingresos mensuales** (€)
- **Método de pago** — Contado / Hipoteca
- **Ver resumen** — botón que expande el resumen de la conversación generado por IA
- **Notas** — truncadas con tooltip
- **Chat** — abre la conversación completa en un modal + acceso rápido a "Consentimiento"
- **Tags** — etiquetas personalizadas (excluye la etiqueta interna `lead`)

### Filtros

- **Búsqueda**: teléfono / nombre / código o descripción de anuncio (debounce de 300 ms)
- **Tipo**: Venta / Alquiler / todos
- **Estado** (cualificación): no cualificados / sin respuesta / cualificados / rechazados
- **Anuncio**: multiselección de códigos
- **Mascotas**: todos / con mascotas / sin mascotas
- **Pago**: todos / Contado / Hipoteca
- **Ingresos**: slider con rango 0 – 10 000 € + inputs mín/máx + botón "Limpiar"

### Ordenación (clic en cabecera)

Nombre · Teléfono · Código de anuncio · Tipo de operación · Estado · Fecha último mensaje · Nº de mensajes · Ingresos.

### Selección múltiple y acciones masivas

Al marcar uno o más leads aparece una **barra de acciones flotante**:

- **Enviar mensaje masivo** — modal con redactor y aviso de envío múltiple
- **Cambiar estado** — aplica uno de los 4 estados a todos los seleccionados
- **Añadir etiquetas** — input separado por comas, fusiona con las existentes sin duplicar
- **Quitar etiqueta** — elimina una etiqueta concreta de todos
- **Cambiar código de anuncio** — reasigna el lead a otro anuncio (sincroniza también la conversación)
- **Exportar CSV** — descarga los leads seleccionados
- **Eliminar** — borrado masivo con casilla de confirmación ("acción irreversible")

Selector "Seleccionar todos" en cabecera (desktop) y en cabecera de la lista móvil.

### Editor de lead (modal)

Campos editables:

- Nombre
- Código de anuncio (con enlace externo a Idealista)
- Tipo de operación (Venta / Alquiler) — obligatorio
- Estado de cualificación
- Mascotas (sin especificar / Sí / No)
- Ingresos mensuales (€)
- Método de pago (sin especificar / Contado / Hipoteca)
- Etiquetas (la etiqueta `lead` está reservada y se rechaza)
- Notas (textarea)
- Botón **Ver conversación** que abre el chat completo
- En modo *impersonation read-only* todos los campos quedan deshabilitados

### Modal de consentimiento GDPR

Disponible desde el botón "Consentimiento" en la columna de chat (o en el pie de la tarjeta móvil):

- **Origen**: Web de la agencia / Formulario Idealista / Llamada telefónica / En persona / Mensaje entrante de WhatsApp
- **Idioma**: Español / English
- **Fecha y hora** (por defecto, ahora)
- **URL del consentimiento** (opcional)
- **Subir archivo de prueba** (opcional)

### Modal de conversación

Mismo historial completo que en /conversations, con cabecera (nombre, teléfono, código de anuncio, nº de mensajes) y botón de descarga.

### Parámetros de URL útiles

- `/leads?ad=CODIGO` — pre-filtra por código de anuncio
- `/leads?status=ESTADO` — pre-filtra por estado de cualificación

Estos enlaces se usan desde la página de Anuncios (botones "Cualificados" / "No cualificados").

### Vistas responsive

- Desktop: tabla con scroll horizontal, sombras laterales indican que hay más columnas
- Móvil: tarjetas con checkbox, nombre, teléfono, badges y acciones rápidas

### Estados vacíos

- "No hay leads" con icono cuando no existe ningún lead
- "No se encontraron resultados" con botón de reset cuando hay filtros activos

---

## 3. Anuncios (`/listings`)

Catálogo de inmuebles. Cada anuncio configura cómo el asistente IA conversa con leads interesados en esa propiedad.

### Tarjeta de anuncio

Información mostrada:

- **Título / descripción** (clic = editar; en gris si está inactivo)
- Badge de **tipo de operación** (Venta / Alquiler)
- **Precio** formateado según operación (€/mes para Alquiler, € para Venta)
- **Metros cuadrados** y **habitaciones**
- **Ref** — ID interno / CRM
- **ID Idealista** (9 dígitos) con enlace externo a Idealista
- **ID Fotocasa** (opcional, 9 dígitos)
- **Dirección** (clic = expandir, icono MapPin)
- **Descripción Idealista** — colapsable/expandible
- **Motivo de cierre** y **lead cualificado asociado** (solo si está inactivo)

Métricas en el lateral derecho:

- Nº de conversaciones
- Nº de cualificados
- Tasa de respuesta (%)
- Tasa de cualificación (%)

### Filtros y ordenación

- **Búsqueda**: título / ID / dirección / agente / descripción (debounce 300 ms)
- **Estado** (segmentado): activos / inactivos
- **Tipo**: todos / Venta / Alquiler
- **Orden**: por defecto · actualización descendente · más conversaciones · más cualificados · título A-Z

### Crear / editar anuncio (modal)

**Información del inmueble**

- Identificador (máx 50, obligatorio, con contador)
- Tipo de operación (obligatorio) — controla el formato del precio
- ID Idealista (9 dígitos, obligatorio)
- ID Fotocasa (9 dígitos, opcional)
- ID interno / CRM (opcional)
- Agente asignado (obligatorio; los agentes solo se ven a sí mismos, owners/admins pueden asignar a cualquier miembro)
- Precio (€)
- Metros (m²)
- Habitaciones

**Ubicación**

- Buscador con autocompletado vía Nominatim (OpenStreetMap), restringido a España, mínimo 3 caracteres, hasta 10 sugerencias
- Detalles ampliables: calle y número · ciudad · provincia · código postal · país (por defecto España)

**Cualificación y filtros del asistente**

- **Cualificación rápida** (toggle): si está activado, el asistente no cualifica — pasa el lead directamente al agente en cuanto contacta
- **Condiciones** (textarea, hasta 450 caracteres con contador): lista con viñetas; `Enter` añade automáticamente `• ` al inicio de la nueva línea

**Filtros específicos de Alquiler**

- Ingreso mensual neto mínimo (€)
- Máximo de personas que residirán

(Si se rellenan, el asistente rechaza automáticamente a quienes no cumplan)

**Filtros específicos de Venta**

- Checkbox "Requerir hipoteca aprobada o pago al contado" — el asistente rechaza a quien no entre en ninguno de los dos métodos

**Contenido comercial**

- Descripción de Idealista (textarea hasta 5 000 caracteres, obligatoria)
- Solo en Venta: checkbox "Informe de rentabilidad disponible" + textarea de hasta 5 000 caracteres

### Acciones en la tarjeta

- **Desactivar / Reactivar** (icono Power/PowerOff)
- **Editar**
- **Eliminar** (modal de confirmación "no se puede deshacer")
- **No cualificados** → abre `/leads?status=non_qualified_all_statuses&ad=CODIGO`
- **Cualificados** → abre `/leads?status=qualified&ad=CODIGO`

### Modal de desactivación

- **Motivo de cierre** según operación:
  - Venta: Vendido a un lead cualificado / Vendido a otra persona externa / Otros motivos
  - Alquiler: Alquilado a un lead cualificado / Alquilado a otra persona externa / Otros motivos
- Si seleccionas "a un lead cualificado", aparece un desplegable para elegir el lead cualificado concreto de ese anuncio
- **Notas de cierre** (textarea, opcional)

### Estados vacíos

- "No hay anuncios" con icono Megáfono cuando no existe ninguno
- "Ningún anuncio coincide" con icono Lupa y botón de reset cuando hay filtros aplicados

---

## 4. Dashboard (`/`)

Vista general de KPIs y rendimiento de la cuenta.

### Filtros globales del panel

- **Rango de fechas**: hoy / ayer / últimos 7 días / últimos 30 días (por defecto) / rango personalizado con date pickers de inicio y fin
- **Anuncio**: todos o multi-selección

El rango aplicado se muestra como etiqueta debajo del filtro.

### Tarjetas de KPI principales

- **Tasa de cualificación** (%) — cualificados / total de conversaciones
- **Tasa de respuesta** (%) — conversaciones con respuesta del usuario / total
- **Total de leads**
- **Total de mensajes** intercambiados

### Embudo de conversión

Flujo visual en tres etapas:

**Conversaciones → Respondidas → Cualificadas**

Para cada paso muestra el conteo absoluto y el porcentaje de conversión respecto al paso anterior.

### Otras métricas calculadas en backend

- Anuncios activos
- Anuncios cerrados en el rango
- Conversaciones activas (no finalizadas)
- Vendidos a leads cualificados (Venta)
- Alquilados a leads cualificados (Alquiler)

### Leads recientes (grid de 6 tarjetas)

Cada tarjeta muestra:

- Icono de usuario + **nombre**
- **Teléfono**
- Badge de **cualificación**
- Badge de **tipo de operación**
- **ID del anuncio** + descripción en gris
- **Fecha de creación**
- Enlace **"Ver detalles"** → navega a `/leads`

### Estados

- **Cargando**: skeletons en las tarjetas y spinner sobre las métricas
- **Vacío**: mensaje por defecto cuando no hay datos en el rango

### Tracking

- Se registra cualquier cambio en los filtros de fecha y de anuncio para analítica interna

---

## Comportamientos transversales

- **Modo solo lectura (impersonation)**: cuando un admin está suplantando otro usuario, todos los formularios se deshabilitan y cualquier intento de edición lanza un toast informativo
- **Tiempo real**: las cuatro páginas se suscriben a Firestore, así que altas, cambios de estado y mensajes nuevos aparecen sin recargar
- **Badges compartidos**: `QualificationBadge` y `OperationTypeBadge` usan los mismos colores en Conversaciones, Leads, Anuncios y Dashboard
- **Atajos de teclado**: en cualquier redactor de mensaje, `Shift+Enter` = nueva línea, `Enter` = enviar
- **Responsive**: todas las páginas pasan a tarjetas / pantalla completa en móvil; la tabla de Leads y la lista de Conversaciones tienen vistas específicas para pantallas pequeñas
