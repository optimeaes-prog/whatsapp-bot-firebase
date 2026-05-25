export type Message = {
  role: "assistant" | "user";
  text: string;
  time: string;
};

export type Conversation = {
  id: string;
  name: string;
  phoneMasked: string;
  listingId: string;
  listingName: string;
  qualified: boolean;
  finished: boolean;
  messages: Message[];
  notes: string;
  tags: string[];
  messageCount: number;
};

export const CONV_CARMEN: Conversation = {
  id: "c1",
  name: "Carmen R.",
  phoneMasked: "+34 664 *** ***",
  listingId: "111536482",
  listingName: "Los Alamos",
  qualified: true,
  finished: true,
  messageCount: 7,
  notes:
    "Acepta 1 mes de honorarios y entrada a partir de septiembre; ingresos familiares mensuales superiores a 4 200 euros.",
  tags: ["Septiembre", "Sin mascotas"],
  messages: [
    {
      role: "assistant",
      text:
        "Hola Carmen, soy Marcos, el asistente virtual de Jose García, encantado. Nos has contactado en idealista por esta vivienda:\nhttps://www.idealista.com/inmueble/111536482\n\n¿Es correcto?",
      time: "09:18",
    },
    { role: "user", text: "Sí, eso es. Estamos interesados en alquilarlo.", time: "10:03" },
    {
      role: "assistant",
      text:
        "Estupendo, Carmen. Es un alquiler con entrada a partir de septiembre y 1 mes de honorarios, ¿te encaja así?\n\nPara avanzar, necesito saber todo esto: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales aproximados? ¿Fecha de entrada deseada en septiembre? ¿Tenéis mascotas?",
      time: "10:04",
    },
    {
      role: "user",
      text:
        "Sí, nos encaja perfecto. Somos 2 adultos en la familia, ganamos en torno a 4.200 € netos al mes entre los dos, y nos gustaría entrar lo antes posible en septiembre, idealmente el 1. No tenemos mascotas.",
      time: "13:07",
    },
    {
      role: "assistant",
      text:
        "Genial Carmen, ¡todo encaja perfectamente! Te confirmo la disponibilidad y te paso con Jose para coordinar la visita y la firma. ¿Te viene bien el viernes a las 18:00?",
      time: "13:09",
    },
    { role: "user", text: "Sí, perfecto. Allí estaremos.", time: "13:10" },
    {
      role: "assistant",
      text: "Perfecto. Jose te contactará en unos minutos para confirmar. ¡Gracias!",
      time: "13:11",
    },
  ],
};
