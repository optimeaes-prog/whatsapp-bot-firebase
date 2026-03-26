const https = require('https');

async function setupWebhook() {
  const token = process.env.CALENDLY_PAT || process.argv[2];
  
  if (!token) {
    console.error("Error: Por favor, proporciona tu Personal Access Token (PAT) de Calendly.");
    console.error("Uso: node scripts/setup_calendly_webhook.js TU_TOKEN_AQUI");
    process.exit(1);
  }

  const webhookUrl = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/calendlyWebhook";

  console.log("Paso 1: Obteniendo tu cuenta de Calendly...");
  
  // Get User info to find Organization URI
  const userReqOptions = {
    hostname: 'api.calendly.com',
    path: '/users/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const getUser = new Promise((resolve, reject) => {
    const req = https.request(userReqOptions, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

  try {
    const userRes = await getUser;
    const orgUri = userRes.resource.current_organization;
    console.log(`✓ Cuenta encontrada. Organización: ${orgUri}`);

    console.log("Paso 2: Creando el Webhook...");
    
    // Create webhook
    const postData = JSON.stringify({
      url: webhookUrl,
      events: ["invitee.created"],
      organization: orgUri,
      scope: "organization"
    });

    const webhookReqOptions = {
      hostname: 'api.calendly.com',
      path: '/webhook_subscriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const createWebhook = new Promise((resolve, reject) => {
      const req = https.request(webhookReqOptions, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Error ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const webhookRes = await createWebhook;
    console.log("¡ÉXITO! El Webhook se ha conectado correctamente.");
    console.log("Respuesta de Calendly:", webhookRes.resource);
  } catch (error) {
    console.error("X Error conectando con Calendly:", error.message);
    if (error.message.includes("401")) {
      console.error("El Token proporcionado es incorrecto o ha expirado.");
    }
  }
}

setupWebhook();
