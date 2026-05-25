export type Metrics = {
  label: string;
  qualificationRate: number;
  responseRate: number;
  leads: number;
  messages: number;
  funnel: { conversations: number; responded: number; qualified: number };
  recentLeadsKey: "all30d" | "all7d" | "casaAlgarrobo";
};

export const METRICS_30D: Metrics = {
  label: "Últimos 30 días",
  qualificationRate: 23,
  responseRate: 72,
  leads: 110,
  messages: 657,
  funnel: { conversations: 107, responded: 77, qualified: 25 },
  recentLeadsKey: "all30d",
};

export const METRICS_7D: Metrics = {
  label: "Últimos 7 días",
  qualificationRate: 28,
  responseRate: 80,
  leads: 38,
  messages: 195,
  funnel: { conversations: 36, responded: 29, qualified: 10 },
  recentLeadsKey: "all7d",
};

export const METRICS_CASA_ALGARROBO: Metrics = {
  label: "Casa Algarrobo · 7 días",
  qualificationRate: 35,
  responseRate: 78,
  leads: 14,
  messages: 88,
  funnel: { conversations: 13, responded: 10, qualified: 5 },
  recentLeadsKey: "casaAlgarrobo",
};

export const RECENT_LEADS_30D = [
  { name: "Al", phone: "+34 664 *** ***", id: "111536482", date: "22 may 2026, 09:18", status: "qualified", operation: "Alquiler" },
  { name: "amarjit", phone: "+34 685 *** ***", id: "111433879", date: "22 may 2026, 09:18", status: "not_qualified", operation: "Alquiler" },
  { name: "Hans", phone: "+31 6**** ***07", id: "111333534", date: "21 may 2026, 06:06", status: "qualified", operation: "Alquiler" },
  { name: "Sergio", phone: "+34 695 *** ***", id: "111456710", date: "20 may 2026, 09:50", status: "not_qualified", operation: "Alquiler" },
  { name: "Lina", phone: "+49 15* **** ****", id: "111333534", date: "20 may 2026, 22:14", status: "not_qualified", operation: "Alquiler" },
  { name: "Helen", phone: "+41 7** *** ***", id: "111333534", date: "19 may 2026, 14:12", status: "rejected", operation: "Alquiler" },
] as const;

export const RECENT_LEADS_7D = [
  { name: "Al", phone: "+34 664 *** ***", id: "111536482", date: "22 may 2026, 09:18", status: "qualified", operation: "Alquiler" },
  { name: "Hans", phone: "+31 6**** ***07", id: "111333534", date: "21 may 2026, 06:06", status: "qualified", operation: "Alquiler" },
  { name: "Sergio", phone: "+34 695 *** ***", id: "111456710", date: "20 may 2026, 09:50", status: "not_qualified", operation: "Alquiler" },
  { name: "Lina", phone: "+49 15* **** ****", id: "111333534", date: "20 may 2026, 22:14", status: "not_qualified", operation: "Alquiler" },
  { name: "Bilge", phone: "+90 53* *** ****", id: "111433879", date: "16 may 2026, 10:27", status: "qualified", operation: "Alquiler" },
  { name: "Laura", phone: "+34 644 *** ***", id: "111433879", date: "17 may 2026, 17:14", status: "qualified", operation: "Alquiler" },
] as const;

export const RECENT_LEADS_CASA = [
  { name: "Hans", phone: "+31 6**** ***07", id: "111333534", date: "21 may 2026, 06:06", status: "qualified", operation: "Alquiler" },
  { name: "Lina", phone: "+49 15* **** ****", id: "111333534", date: "20 may 2026, 22:14", status: "not_qualified", operation: "Alquiler" },
  { name: "Helen", phone: "+41 7** *** ***", id: "111333534", date: "19 may 2026, 14:12", status: "rejected", operation: "Alquiler" },
  { name: "Raphael", phone: "+33 615 *** ***", id: "111333534", date: "19 may 2026, 11:11", status: "not_qualified", operation: "Alquiler" },
  { name: "Soledad", phone: "+34 663 *** ***", id: "111333534", date: "18 may 2026, 16:42", status: "rejected", operation: "Alquiler" },
  { name: "Tomás", phone: "+34 671 *** ***", id: "111333534", date: "17 may 2026, 12:08", status: "qualified", operation: "Alquiler" },
] as const;
