# Acuerdo de Encargo / DPA — Talmate Limited (Encargado)

**Última actualización:** 2026-04-01  
**Versión:** 0.1 (borrador)  

Este Acuerdo de Encargo del Tratamiento (“**DPA**”) forma parte del acuerdo entre **Talmate Limited** (“**Encargado**”, “**Talmate**”) y el cliente que usa la Plataforma (“**Responsable**”, “**Cliente**”), y regula el tratamiento de datos personales por parte del Encargado por cuenta del Responsable.

Cuando aplique, este DPA pretende cumplir con el artículo 28 RGPD / UK GDPR y servir de soporte para obligaciones comparables en tratamientos que involucren a personas en Argentina (Ley 25.326).

## 1. Definiciones
Los términos “datos personales”, “tratamiento”, “responsable”, “encargado”, “interesado”, “violación de seguridad” tendrán el significado establecido en la normativa aplicable (RGPD/UK GDPR y, en su caso, normativa argentina).

## 2. Alcance y roles
2.1 El **Responsable** determina los fines del tratamiento de los leads/contactos y sus comunicaciones.  
2.2 El **Encargado** trata datos personales por cuenta del Responsable para prestar la Plataforma.

> Nota sobre cualificación con IA: la Plataforma incluye flujos de cualificación con IA diseñados y mantenidos por Talmate. Las partes reconocen que ciertos medios técnicos pueden ser determinados por el Encargado, sin perjuicio de que el tratamiento se realice para prestar el servicio al Responsable conforme a este DPA.

## 3. Obligaciones del Encargado
El Encargado:
- tratará los datos personales únicamente siguiendo instrucciones documentadas del Responsable, incluyendo lo necesario para prestar el servicio
- garantizará que el personal autorizado esté sujeto a deber de confidencialidad
- aplicará medidas técnicas y organizativas apropiadas (“MTO”)
- asistirá al Responsable en el ejercicio de derechos de los interesados (en la medida exigida por la ley y razonablemente posible)
- asistirá en seguridad, notificación de brechas y DPIA/consultas previas cuando proceda
- a elección del Responsable, suprimirá o devolverá los datos al finalizar el servicio (salvo obligación legal de conservación)
- pondrá a disposición información razonable para demostrar cumplimiento y permitirá auditorías según lo previsto

## 4. Obligaciones del Responsable
El Responsable es responsable de:
- contar con base legal para contactar leads y tratar sus datos
- proporcionar avisos de privacidad obligatorios a los interesados
- que sus instrucciones sean lícitas
- gestionar consentimientos/opt-outs cuando corresponda (marketing, tracking, aviso de grabación, etc.)
- cumplir términos de terceros (WhatsApp/Twilio/Whapi, etc.) y la normativa aplicable

## 5. Subencargados
5.1 El Responsable autoriza al Encargado a contratar subencargados para prestar el servicio.  
5.2 El Encargado mantendrá una lista de subencargados y notificará cambios materiales cuando sea factible.  
5.3 El Encargado impondrá a los subencargados obligaciones de protección de datos no menos protectoras que las de este DPA.

Lista indicativa: ver `legal/subprocessors.md`.

## 6. Transferencias internacionales
Cuando el tratamiento implique transferencias fuera de UK/EEE, el Encargado aplicará salvaguardas adecuadas, tales como:
- Cláusulas Contractuales Tipo (SCC) (UE)
- UK IDTA y/o UK Addendum a las SCC
y medidas suplementarias cuando sea necesario.

Para transferencias vinculadas a Argentina, las partes aplicarán salvaguardas exigidas por la normativa argentina aplicable.

## 7. Medidas técnicas y organizativas (MTO)
El Encargado aplicará MTO apropiadas al riesgo, incluyendo:
- control de acceso (mínimo privilegio) y autenticación
- cifrado en tránsito y cifrado en reposo gestionado por proveedor cuando esté disponible
- registro y monitorización para prevenir abuso y mejorar seguridad
- separación de entornos cuando sea posible
- procedimientos de respuesta a incidentes

Más detalle: Anexo 2.

## 8. Violaciones de seguridad
El Encargado notificará al Responsable sin dilación indebida tras tener conocimiento de una violación de seguridad que afecte a los datos del Responsable, y facilitará información razonable para cumplir obligaciones legales.

## 9. Auditorías
El Responsable podrá auditar el cumplimiento:
- como norma, no más de una vez al año salvo incidente material o sospecha razonable
- con preaviso razonable
- sujeto a confidencialidad y requisitos de seguridad
- el Encargado podrá atender auditorías aportando informes de terceros y documentación cuando proceda

## 10. Devolución y supresión
Al finalizar el servicio o a solicitud del Responsable, el Encargado suprimirá o devolverá los datos del Responsable en un plazo razonable, salvo obligación legal de conservación.

## 11. Responsabilidad
La responsabilidad derivada de este DPA se regirá por las limitaciones del contrato principal, salvo que la ley imperativa disponga lo contrario.

## Anexo 1 — Detalles del tratamiento

### A. Objeto
Prestación de la Plataforma para gestionar conversaciones de WhatsApp/voz, flujos de cualificación, resúmenes de leads y funcionalidades relacionadas.

### B. Duración
Durante la vigencia del uso/suscripción, más el periodo de devolución/supresión.

### C. Naturaleza y finalidad del tratamiento
Actividades que pueden incluir:
- recepción de mensajes/calls (webhooks) y envío de respuestas
- almacenamiento de historial de conversación y estado del lead
- ejecución de flujos automatizados de cualificación y generación de resúmenes
- soporte de mensajería manual, etiquetado y operaciones
- (si aplica) gestión de llamadas y grabaciones/URLs de grabación

### D. Categorías de interesados
Leads/contactos del Responsable y otras personas que se comunican con el Responsable por WhatsApp/voz.

### E. Categorías de datos personales
Puede incluir:
- identificadores: teléfono, chat IDs, call IDs, timestamps
- contenido: texto de mensajes e historial de conversación
- atributos de lead: nombre, composición familiar, ingresos (numérico), mascotas, forma de pago, disponibilidad, notas
- voz/llamadas: metadatos y grabaciones/URLs (si se habilita)

### F. Categorías especiales
No se pretende tratar. El Responsable debe evitar su uso salvo necesidad estricta con base legal y garantías.

### G. Operaciones de tratamiento (descripción técnica)
Flujo indicativo (según implementación):
- eventos entrantes WhatsApp/voz → buffer/almacenamiento → tareas encoladas → respuesta/resumen con IA → envío de mensaje y actualización de estados.

## Anexo 2 — Medidas técnicas y organizativas
Incluyen:
- controles de acceso y segregación lógica
- gestión segura de secretos (API keys)
- seguridad de transporte (TLS) entre servicios y proveedores
- logs y monitorización de operaciones clave
- prácticas de desarrollo seguro y control de cambios
- procedimientos de respuesta a incidentes y brechas

## Anexo 3 — Subencargados
Ver `legal/subprocessors.md`.

