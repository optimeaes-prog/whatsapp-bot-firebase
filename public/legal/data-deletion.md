# Eliminación y exportación de datos / Data deletion and export

**Última actualización / Last updated:** 2026-04-23

## ES — Solicitudes de privacidad

Esta página explica cómo solicitar eliminación o exportación de datos en Proplead, incluyendo flujos vinculados a **WhatsApp Business Platform** y solicitudes iniciadas desde **Meta/Facebook**.

Puedes solicitar la eliminación de tus datos o una exportación de los datos de tu organización de dos maneras:

1. Desde la app de Proplead, en `Configuración > Privacidad y datos`.
2. Escribiendo a **dpo@proplead.io** desde el email de tu cuenta.

### Categorías de datos incluidas en estas solicitudes

- Datos de cuenta y usuarios de la organización.
- Datos de leads/contactos y conversaciones.
- Metadatos operativos y trazas de auditoría.
- Datos técnicos mínimos necesarios para seguridad y cumplimiento.

### Qué hacemos cuando pides eliminar tu cuenta

- Marcamos tu organización como eliminada (soft-delete).
- Programamos la eliminación definitiva a los 30 días.
- Revocamos la suscripción de webhook de WhatsApp asociada a tu WABA.
- Eliminamos el secreto de acceso guardado en Secret Manager.

### Conservación y retención

Durante la ventana de 30 días mantenemos el estado de soft-delete para recuperación operativa o cumplimiento legal aplicable. Finalizada esa ventana, ejecutamos la eliminación definitiva conforme a nuestra política vigente.

### Qué incluye la exportación

Generamos un archivo ZIP con una instantánea de los datos de tu organización (documentos de Firestore relacionados con tu tenant) y te enviamos un enlace firmado por email válido durante 7 días.

### Derechos de las personas usuarias

Puedes solicitar acceso, rectificación, actualización, supresión y otros derechos aplicables escribiendo a **dpo@proplead.io** desde el email de tu cuenta.

### Seguimiento de solicitudes de Meta/Facebook

Las solicitudes de eliminación iniciadas desde Meta se procesan mediante nuestro callback de eliminación de datos y se pueden consultar en:

`/legal/deletion-status?code=<confirmation_code>`

## EN — Privacy requests

This page explains how to request deletion or export of Proplead data, including flows linked to the **WhatsApp Business Platform** and requests initiated from **Meta/Facebook**.

You can request account deletion or a data export for your organization in two ways:

1. In the Proplead app under `Settings > Privacy and data`.
2. By emailing **dpo@proplead.io** from your account email.

### Data categories covered by these requests

- Account and organization user data.
- Leads/contacts and conversation data.
- Operational metadata and audit traces.
- Minimum technical/security data required for compliance.

### What happens when you request account deletion

- We mark your organization as deleted (soft-delete).
- We schedule permanent deletion after 30 days.
- We revoke the WhatsApp webhook subscription linked to your WABA.
- We delete the stored access secret in Secret Manager.

### Retention window

During the 30-day window, data remains in soft-delete status for operational recovery or legal compliance where required. After that window, we execute permanent deletion according to our active policy.

### What the export contains

We generate a ZIP file with a snapshot of your organization data (Firestore documents linked to your tenant) and send a signed email link valid for 7 days.

### User rights

You can request access, rectification, update, deletion, and other applicable rights by emailing **dpo@proplead.io** from your account email.

### Meta/Facebook deletion request status

Deletion requests initiated by Meta are handled through our data deletion callback and can be checked at:

`/legal/deletion-status?code=<confirmation_code>`
