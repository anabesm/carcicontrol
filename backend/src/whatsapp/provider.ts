export interface WhatsAppOptions {
  accessToken?: string;
  phoneNumberId?: string;
  version?: string;
  appSecret?: string;
  verifyToken?: string;
  fetcher?: typeof fetch;
}
export function whatsAppOptions(): WhatsAppOptions {
  return {
    ...(process.env.WHATSAPP_ACCESS_TOKEN
      ? { accessToken: process.env.WHATSAPP_ACCESS_TOKEN }
      : {}),
    ...(process.env.WHATSAPP_PHONE_NUMBER_ID
      ? { phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID }
      : {}),
    version: process.env.WHATSAPP_API_VERSION ?? "v27.0",
    ...(process.env.WHATSAPP_APP_SECRET
      ? { appSecret: process.env.WHATSAPP_APP_SECRET }
      : {}),
    ...(process.env.WHATSAPP_VERIFY_TOKEN
      ? { verifyToken: process.env.WHATSAPP_VERIFY_TOKEN }
      : {}),
  };
}
export function providerStatus(options: WhatsAppOptions) {
  const missing: string[] = [];
  if (!options.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!options.phoneNumberId || !/^\d+$/.test(options.phoneNumberId))
    missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!options.appSecret) missing.push("WHATSAPP_APP_SECRET");
  if (!options.verifyToken) missing.push("WHATSAPP_VERIFY_TOKEN");
  if (!/^v\d+\.\d+$/.test(options.version ?? ""))
    missing.push("WHATSAPP_API_VERSION");
  return { configurado: missing.length === 0, variaveisPendentes: missing };
}
export type SendResult =
  | { status: "ACEITO"; messageId: string }
  | { status: "FALHA" | "INCERTO"; error: string };
export async function sendTemplate(
  options: WhatsAppOptions,
  input: {
    id: number;
    phone: string;
    text: string;
    template: string;
    language: string;
  },
): Promise<SendResult> {
  if (!providerStatus(options).configurado)
    return { status: "FALHA", error: "Integração não configurada." };
  try {
    const response = await (options.fetcher ?? fetch)(
      `https://graph.facebook.com/${options.version}/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.phone,
          type: "template",
          biz_opaque_callback_data: String(input.id),
          template: {
            name: input.template,
            language: { code: input.language },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: input.text }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      return {
        status: response.status >= 500 ? "INCERTO" : "FALHA",
        error: `Provedor retornou HTTP ${response.status}.`,
      };
    const payload: unknown = await response.json();
    const messageId =
      payload &&
      typeof payload === "object" &&
      "messages" in payload &&
      Array.isArray(payload.messages)
        ? (payload.messages[0]?.id as unknown)
        : undefined;
    if (typeof messageId !== "string" || !messageId || messageId.length > 500)
      return {
        status: "INCERTO",
        error:
          "Resposta sem identificador de mensagem. Confirme no provedor antes de reenviar.",
      };
    return { status: "ACEITO", messageId };
  } catch {
    return {
      status: "INCERTO",
      error:
        "A conexão terminou sem confirmação. Consulte o provedor antes de reenviar.",
    };
  }
}
