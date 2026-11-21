import nodemailer from "nodemailer";

export interface ResetMessage {
  email: string;
  url: string;
}
export async function sendResetEmail(message: ResetMessage) {
  const host = process.env.SMTP_HOST ?? "127.0.0.1";
  const local = ["localhost", "127.0.0.1", "::1", "mailpit"].includes(host);
  const port = Number(process.env.SMTP_PORT ?? (local ? 1025 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Porta SMTP inválida.");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !local && !secure,
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "CarciControl <acesso@carcicontrol.local>",
      to: message.email,
      subject: "Redefinição de senha do CarciControl",
      text: `Use o link abaixo para definir uma nova senha. O link expira em 30 minutos e pode ser usado uma única vez.\n\n${message.url}\n\nSe você não solicitou a alteração, ignore esta mensagem.`,
    });
  } finally {
    transport.close();
  }
}
