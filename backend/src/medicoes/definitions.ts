// Faixas e limites operacionais de exemplo para a demonstração do sistema.
export const demoParameters = [
  {
    codigo: "OD",
    nome: "Oxigênio dissolvido",
    unidadePadrao: "mg/L",
    minPossivel: 0,
    maxPossivel: 30,
    minIdeal: 5,
    maxIdeal: 7,
  },
  {
    codigo: "TEMPERATURA",
    nome: "Temperatura",
    unidadePadrao: "°C",
    minPossivel: -5,
    maxPossivel: 60,
    minIdeal: 28,
    maxIdeal: 33,
  },
  {
    codigo: "SALINIDADE",
    nome: "Salinidade",
    unidadePadrao: "ppt",
    minPossivel: 0,
    maxPossivel: 100,
    minIdeal: 15,
    maxIdeal: 35,
  },
  {
    codigo: "PH",
    nome: "pH",
    unidadePadrao: "pH",
    minPossivel: 0,
    maxPossivel: 14,
    minIdeal: 7.5,
    maxIdeal: 8.5,
  },
] as const;

export const supportedCodes = demoParameters.map((parameter) => parameter.codigo);
