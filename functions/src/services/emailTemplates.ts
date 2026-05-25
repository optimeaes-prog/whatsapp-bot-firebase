/**
 * Email Templates as HTML strings with Inline CSS.
 * These are based on the "SaaS Official" designs chosen from the Email Gallery.
 */

const SHARED_STYLES = {
  fontSans: 'font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";',
  primaryColor: '#FFB03F',
  redColor: '#EF4444',
  slate900: '#0F172A',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate50: '#F8FAFC',
};

const PROPLEAD_LOGO_URL = "https://proplead.io/proplead-high-resolution-logo.png";

function renderPropleadLogoHeader(): string {
  return `
    <div style="text-align: center; margin-bottom: 32px;">
      <img
        src="${PROPLEAD_LOGO_URL}"
        alt="Proplead"
        style="height: 44px; width: auto; display: inline-block;"
      />
    </div>
  `;
}

/**
 * Generates the Welcome Email HTML
 */
export function formatWelcomeEmail(data: {
  name: string;
  orgName: string;
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; ${SHARED_STYLES.fontSans} background-color: ${SHARED_STYLES.slate50};">
      <div style="padding: 48px 16px;">
        <div style="max-width: 500px; margin: 0 auto;">
          <!-- Header/Logo -->
          ${renderPropleadLogoHeader()}

          <!-- Main Card Container -->
          <div style="margin-bottom: 48px;">
            <!-- Content Card -->
            <div style="background-color: #FFFFFF; border-radius: 24px; padding: 40px; border: 1px solid #F1F5F9; box-shadow: 0 18px 35px -18px rgba(0, 0, 0, 0.35);">
              <div style="margin-bottom: 24px;">
                <span style="background-color: #FFFBEB; color: #D97706; font-weight: bold; padding: 4px 12px; border-radius: 9999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
                  ✨ Cuenta activada
                </span>
              </div>

              <h1 style="font-size: 28px; font-weight: 900; color: ${SHARED_STYLES.slate900}; margin-bottom: 16px; letter-spacing: -0.025em; line-height: 1.2;">
                Primer día con Proplead:<br />
                vamos a dejarlo listo
              </h1>
              
              <p style="color: ${SHARED_STYLES.slate500}; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                Hola ${data.name},
              </p>
              <p style="color: ${SHARED_STYLES.slate500}; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                La mayoría de cierres se pierden por algo muy simple: tardar en responder o dejar conversaciones a medias. Proplead está para evitarlo.
              </p>
              <div style="color: ${SHARED_STYLES.slate500}; font-size: 14px; line-height: 1.6; margin-bottom: 32px;">
                <div style="margin-bottom: 6px;">En cuanto lo actives, tu asistente te ayudará a:</div>
                <div style="margin-left: 0;">
                  <div style="margin-bottom: 6px;">• responder en minutos, no horas</div>
                  <div style="margin-bottom: 6px;">• hacer seguimiento sin que se te escape nadie</div>
                  <div>• convertir más consultas en visitas y cierres</div>
                </div>
              </div>

              <div style="background-color: ${SHARED_STYLES.slate50}; padding: 24px; border-radius: 16px; margin-bottom: 32px; border: 1px solid #F1F5F9;">
                <p style="font-size: 12px; font-weight: bold; color: ${SHARED_STYLES.slate900}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; margin-top: 0;">🚀 Siguientes pasos</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 14px; color: ${SHARED_STYLES.slate500};">
                  <tr>
                    <td valign="middle" style="width: 28px; padding: 0 12px 16px 0;">
                      <table role="presentation" width="20" height="20" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 50%;">
                        <tr>
                          <td align="center" valign="middle" style="width: 20px; height: 20px; font-size: 10px; line-height: 1; font-weight: bold; color: ${SHARED_STYLES.primaryColor}; mso-line-height-rule: exactly;">1</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" style="padding: 0 0 16px 0;">
                      Agenda tu onboarding call (unos 15 min) y dejamos tu asistente listo contigo.
                    </td>
                  </tr>
                  <tr>
                    <td valign="middle" style="width: 28px; padding: 0 12px 0 0;">
                      <table role="presentation" width="20" height="20" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 50%;">
                        <tr>
                          <td align="center" valign="middle" style="width: 20px; height: 20px; font-size: 10px; line-height: 1; font-weight: bold; color: ${SHARED_STYLES.primaryColor}; mso-line-height-rule: exactly;">2</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" style="padding: 0;">
                      Crea tu primer anuncio y ve a tu asistente en acción.
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center;">
                <a href="https://proplead.io/onboarding" style="display: block; background-color: ${SHARED_STYLES.slate900}; color: #FFFFFF; font-weight: bold; padding: 16px; border-radius: 12px; text-decoration: none; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                  Completar onboarding &rarr;
                </a>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: ${SHARED_STYLES.slate400}; font-size: 12px;">
            <p style="margin: 0 0 16px; line-height: 1.6; font-weight: 500;">
              ${
                data.preferencesUrl && data.unsubscribeUrl
                  ? `<a href="${data.preferencesUrl}" style="color: ${SHARED_STYLES.slate400}; text-decoration: underline;">Actualiza tus preferencias de correo</a> o <a href="${data.unsubscribeUrl}" style="color: ${SHARED_STYLES.slate400}; text-decoration: underline;">darte de baja</a>.`
                  : "Si quieres gestionar comunicaciones por correo, escríbenos a soporte."
              }
            </p>
            <p style="opacity: 0.6; padding-top: 24px; border-top: 1px solid #E2E8F0; line-height: 1.6;">
              © 2026 Proplead Technologies.<br>
              Has recibido este mensaje automático porque tu correo ha sido registrado en Proplead. No respondas a esta dirección.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates the Low Balance Alert HTML
 */
export function formatLowBalanceEmail(data: { name: string; balance: number }): string {
  const percentage = Math.max(8, (data.balance / 100) * 100);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; ${SHARED_STYLES.fontSans} background-color: ${SHARED_STYLES.slate50};">
      <div style="padding: 48px 16px;">
        <div style="max-width: 500px; margin: 0 auto;">
          <!-- Header/Logo -->
          ${renderPropleadLogoHeader()}

          <!-- Main Card Container -->
          <div style="position: relative; margin-bottom: 48px;">
            <!-- Decorative tilted bg -->
            <div style="position: absolute; inset: 0; background-color: ${SHARED_STYLES.redColor}; border-radius: 24px; transform: rotate(-2deg); box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4);"></div>
            
            <!-- Content Card -->
            <div style="position: relative; background-color: #FFFFFF; border-radius: 24px; padding: 40px; border: 1px solid #FEE2E2; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
              <div style="margin-bottom: 24px;">
                <span style="background-color: #FEF2F2; color: ${SHARED_STYLES.redColor}; font-weight: bold; padding: 4px 12px; border-radius: 9999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
                  ⚠️ Critical Warning
                </span>
              </div>

              <h1 style="font-size: 28px; font-weight: 900; color: ${SHARED_STYLES.slate900}; margin-bottom: 16px; letter-spacing: -0.025em; line-height: 1.2;">
                Tu sistema está perdiendo energía.
              </h1>
              
              <p style="color: ${SHARED_STYLES.slate500}; font-size: 14px; line-height: 1.6; margin-bottom: 32px;">
                <strong>${data.name}</strong>, el volumen de interacciones para tu organización es alto, y la reserva actual ha descendido peligrosamente al mínimo. 
              </p>

              <div style="background-color: ${SHARED_STYLES.slate50}; padding: 24px; border-radius: 16px; margin-bottom: 32px; border: 1px solid #F1F5F9;">
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; color: ${SHARED_STYLES.slate900}; margin-bottom: 8px;">
                  <span>Conversaciones Restantes</span>
                  <span style="color: ${SHARED_STYLES.redColor};">${data.balance} / 100</span>
                </div>
                <div style="width: 100%; height: 8px; background-color: #E2E8F0; border-radius: 4px; overflow: hidden;">
                  <div style="background-color: ${SHARED_STYLES.redColor}; width: ${percentage}%; height: 100%;"></div>
                </div>
                <p style="margin-top: 16px; font-size: 10px; color: ${SHARED_STYLES.slate400}; font-style: italic;">
                  Si el saldo llega a 0, dejaremos de enviar mensajes automáticos a WhatsApp, perdiendo posibles validaciones en tiempo real.
                </p>
              </div>

              <div style="text-align: center;">
                <a href="https://proplead.io/billing" style="display: block; background-color: ${SHARED_STYLES.redColor}; color: #FFFFFF; font-weight: bold; padding: 16px; border-radius: 12px; text-decoration: none; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4);">
                  Recargar Saldo Manualmente
                </a>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: ${SHARED_STYLES.slate400}; font-size: 12px;">
            <p style="opacity: 0.6; padding-top: 24px; border-top: 1px solid #E2E8F0; line-height: 1.6;">
              © 2026 Proplead Technologies.<br>
              Este es un mensaje transaccional obligatorio.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates the Payment Failed HTML
 */
export function formatPaymentFailedEmail(data: { name: string; orgName: string; lastPaymentAmount: string }): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; ${SHARED_STYLES.fontSans} background-color: ${SHARED_STYLES.slate50};">
      <div style="padding: 48px 16px;">
        <div style="max-width: 500px; margin: 0 auto;">
          <!-- Header/Logo -->
          ${renderPropleadLogoHeader()}

          <!-- Main Card Container -->
          <div style="position: relative; margin-bottom: 48px;">
            <!-- Decorative tilted bg -->
            <div style="position: absolute; inset: 0; background-color: ${SHARED_STYLES.slate900}; border-radius: 24px; transform: rotate(-2deg); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"></div>
            
            <!-- Content Card -->
            <div style="position: relative; background-color: #FFFFFF; border-radius: 24px; padding: 40px; border: 1px solid #F1F5F9; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
              <div style="margin-bottom: 24px;">
                <span style="background-color: ${SHARED_STYLES.slate50}; color: ${SHARED_STYLES.slate500}; font-weight: bold; padding: 4px 12px; border-radius: 9999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
                  💳 Billing Failed
                </span>
              </div>

              <h1 style="font-size: 28px; font-weight: 900; color: ${SHARED_STYLES.slate900}; margin-bottom: 16px; letter-spacing: -0.025em; line-height: 1.2;">
                Tu pago no se procesó.
              </h1>
              
              <p style="color: ${SHARED_STYLES.slate500}; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                ${data.name}, nuestro proveedor de pagos Stripe nos ha informado del rechazo del cargo mensual para <strong>${data.orgName}</strong>, posiblemente por caducidad o falta de fondos temporales.
              </p>

              <div style="background-color: #FEF2F2; padding: 24px; border-radius: 16px; margin-bottom: 32px; border: 1px solid #FEE2E2; text-align: center;">
                <p style="font-size: 12px; font-weight: bold; color: ${SHARED_STYLES.redColor}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; margin-top: 0;">Monto pendiente</p>
                <p style="font-size: 32px; font-family: monospace; color: #991B1B; font-weight: bold; margin: 0;">${data.lastPaymentAmount}</p>
              </div>

              <div style="text-align: center;">
                <a href="https://proplead.io/billing" style="display: block; background-color: ${SHARED_STYLES.slate900}; color: #FFFFFF; font-weight: bold; padding: 16px; border-radius: 12px; text-decoration: none; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                  Actualizar método de pago
                </a>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: ${SHARED_STYLES.slate400}; font-size: 12px;">
            <div style="margin-bottom: 16px; font-weight: 500;">
              <a href="#" style="color: ${SHARED_STYLES.slate400}; text-decoration: none; margin: 0 12px;">Ver Facturas</a>
            </div>
            <p style="opacity: 0.6; padding-top: 24px; border-top: 1px solid #E2E8F0; line-height: 1.6;">
              © 2026 Proplead Technologies.<br>
              Departamento Administrativo.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates the Invitation Email HTML
 */
export function formatInvitationEmail(data: { name: string; orgName: string; inviterName: string; inviteLink: string }): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; ${SHARED_STYLES.fontSans} background-color: ${SHARED_STYLES.slate50};">
      <div style="padding: 48px 16px;">
        <div style="max-width: 500px; margin: 0 auto;">
          <!-- Header/Logo -->
          ${renderPropleadLogoHeader()}

          <!-- Main Card Container -->
          <div style="position: relative; margin-bottom: 48px;">
            <!-- Decorative tilted bg -->
            <div style="position: absolute; inset: 0; background-color: ${SHARED_STYLES.primaryColor}; border-radius: 24px; transform: rotate(-2deg); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"></div>
            
            <!-- Content Card -->
            <div style="position: relative; background-color: #FFFFFF; border-radius: 24px; padding: 40px; border: 1px solid #F1F5F9; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
              <div style="margin-bottom: 24px;">
                <span style="background-color: #FFFBEB; color: #D97706; font-weight: bold; padding: 4px 12px; border-radius: 9999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;">
                  📩 Invitation
                </span>
              </div>

              <h1 style="font-size: 28px; font-weight: 900; color: ${SHARED_STYLES.slate900}; margin-bottom: 16px; letter-spacing: -0.025em; line-height: 1.2;">
                ${data.inviterName} te ha invitado a Proplead
              </h1>
              
              <p style="color: ${SHARED_STYLES.slate500}; font-size: 14px; line-height: 1.6; margin-bottom: 32px;">
                Hola <strong>${data.name}</strong>, has sido invitado a unirte a la organización <strong>${data.orgName}</strong> en nuestra plataforma. Podrás acceder al panel de control y colaborar con el equipo.
              </p>

              <div style="text-align: center;">
                <a href="${data.inviteLink}" style="display: block; background-color: ${SHARED_STYLES.slate900}; color: #FFFFFF; font-weight: bold; padding: 16px; border-radius: 12px; text-decoration: none; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                  Aceptar Invitación &rarr;
                </a>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; color: ${SHARED_STYLES.slate400}; font-size: 12px;">
            <p style="opacity: 0.6; padding-top: 24px; border-top: 1px solid #E2E8F0; line-height: 1.6;">
              © 2026 Proplead Technologies.<br>
              Este link expirará en 7 días. Si no esperabas esta invitación, puedes ignorar este correo.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
