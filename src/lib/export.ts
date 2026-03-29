import type { Conversation } from "../types";
import { formatPhoneWhatsApp } from "./utils";

export function downloadConversation(conversation: Conversation) {
    const name = conversation.name || (conversation.phone ? formatPhoneWhatsApp(conversation.phone) : conversation.id);
    const history = conversation.history || [];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Conversación con ${name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #374151; max-width: 800px; margin: 40px auto; padding: 20px; background-color: #f9fafb; }
          .container { background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #111827; }
          .meta { color: #6b7280; font-size: 14px; margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
          .meta-item { background: #f3f4f6; padding: 8px 12px; border-radius: 6px; }
          .meta-item strong { color: #4b5563; }
          .messages { display: flex; flex-direction: column; gap: 16px; }
          .message { display: flex; flex-direction: column; max-width: 85%; }
          .message.assistant { align-self: flex-end; align-items: flex-end; }
          .message.user { align-self: flex-start; align-items: flex-start; }
          .bubble { padding: 12px 16px; border-radius: 12px; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
          .assistant .bubble { background-color: #10b981; color: white; border-bottom-right-radius: 2px; }
          .user .bubble { background-color: white; color: #111827; border-bottom-left-radius: 2px; border: 1px solid #e5e7eb; }
          .time { font-size: 10px; margin-top: 6px; font-weight: 500; }
          .user .time { color: #9ca3af; }
          .assistant .time { color: #d1fae5; }
          pre { white-space: pre-wrap; margin: 0; font-family: inherit; font-size: 14px; }
          .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          @media print { 
            body { background-color: white; margin: 0; padding: 0; } 
            .container { border: none; box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Registro de Conversación</h1>
            <div class="meta">
              <div class="meta-item"><strong>Cliente:</strong> ${name}</div>
              <div class="meta-item"><strong>Teléfono:</strong> ${conversation.phone || 'N/A'}</div>
              <div class="meta-item"><strong>Referencia:</strong> ${conversation.listingCode || 'N/A'}</div>
              <div class="meta-item"><strong>Exportado:</strong> ${new Date().toLocaleString()}</div>
            </div>
          </div>
          <div class="messages">
            ${history.map(msg => `
              <div class="message ${msg.role}">
                <div class="bubble">
                  <pre>${msg.text}</pre>
                  <div class="time">${new Date(msg.timestamp).toLocaleString()}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="footer">
            Generado automáticamente por Proplead WhatsApp Asistente
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversacion_${name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
