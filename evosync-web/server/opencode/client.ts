/**
 * Cliente OpenCode — invoca o CLI `opencode run` com a mídia anexada.
 * Port direto de opencode_client.py. A função de polimento (_polish_message)
 * é mantida para gerar mensagens de WhatsApp no estilo do atacarejo.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PROMPT = `Você é um redator de WhatsApp para ofertas de atacarejo.

Use a imagem anexada como referência visual principal e gere APENAS a mensagem final para WhatsApp, sem explicações, sem avisos e sem listas de alternativas.

Regras:
- Extraia nome da campanha, loja, validade, produtos, preços e unidades diretamente do arquivo.
- Não use título padrão se o arquivo mostrar outro título.
- Não invente produto, preço, loja, validade, Instagram ou condição que não esteja claro.
- Se o título/campanha estiver visível, use exatamente o sentido dele.
- Escreva em português brasileiro.
- Use emojis relevantes e formatação de WhatsApp com *negrito*.
- Preserve preços no formato brasileiro, como R$ 1,99.
- Liste produtos em linhas separadas.
- Termine com uma chamada curta para aproveitar.
- Use quebras de linha exatamente no estilo do modelo abaixo.
- Não coloque marcador 📍 se não houver condição, validade ou loja específica.
- Evite repetir frases e não peça para compartilhar.
- Não inclua "imagem analisada", "promoção do dia" ou qualquer cabeçalho técnico.

Modelo de estilo:
🥬💚 *TÍTULO DA CAMPANHA!* 💚🥬

Ofertas esperando por você na loja de *NOME DA LOJA*! 🛒🔥

🥬 *Produto* — *R$ 0,00* unid/kg

📍 *Condição ou validade, se houver*

Corre pra aproveitar antes que acabe! 🛒✨
`;

export const DEFAULT_MODEL = "nvidia/meta/llama-3.2-90b-vision-instruct";

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const STATUS_RE = /^\s*[>›]\s*[\w -]+(?:\s*[·•]\s*.+)?\s*$/;

function cleanOutput(text: string): string {
  let t = (text || "").replace(ANSI_RE, "").trim();
  t = t.replace(/^```(?:text|markdown)?\s*/i, "").replace(/\s*```$/, "").trim();
  const lines = t
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => !STATUS_RE.test(l.trim()));
  while (lines.length && !lines[0].trim()) lines.shift();
  return polishMessage(lines.join("\n").trim());
}

function polishMessage(text: string): string {
  let t = text;
  t = t.replace(/\s+!/g, "!");
  t = t.replace(/\s+,/g, ",");
  t = t.replace(/\s+([.])/g, "$1");
  t = t.replace(/📍\s*(?=\n|$)/g, "");
  t = t.replace(/(💚🥬)\s+(Ofertas)/g, "$1\n\n$2");
  t = t.replace(/(🛒🔥)\s+/g, "$1\n\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function resolveOpencode(): string | null {
  const configured = (process.env.OPENCODE_BIN || "").trim();
  if (configured) {
    try {
      if (fs.existsSync(configured) && fs.statSync(configured).isFile()) {
        return configured;
      }
    } catch {
      /* noop */
    }
  }

  const env = process.env.PATH || "";
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of env.split(sep)) {
    if (!dir) continue;
    const exe = process.platform === "win32" ? "opencode.exe" : "opencode";
    const full = path.join(dir, exe);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    } catch {
      /* noop */
    }
  }
  return null;
}

function opencodeSpawnEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const home = (process.env.OPENCODE_HOME || "").trim();
  if (home) {
    env.HOME = home;
  }
  if (process.env.OPENCODE_CONFIG) {
    env.OPENCODE_CONFIG = process.env.OPENCODE_CONFIG;
  }
  if (process.env.XDG_CONFIG_HOME) {
    env.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;
  }
  if (process.env.XDG_DATA_HOME) {
    env.XDG_DATA_HOME = process.env.XDG_DATA_HOME;
  }
  return env;
}

export function opencodeAuthHint(): string | null {
  const nvidia = (process.env.NVIDIA_API_KEY || "").trim();
  const zen = (process.env.OPENCODE_API_KEY || process.env.OPENCODE_ZEN_API_KEY || "").trim();
  if (nvidia || zen) return null;
  return (
    "Configure NVIDIA_API_KEY (build.nvidia.com) ou OPENCODE_API_KEY (OpenCode Zen) em /opt/evosync/.env e reinicie o serviço."
  );
}

export class OpenCodeMessageClient {
  model: string;
  timeout: number;

  constructor(model = "", timeout = 240_000) {
    this.model = (model || "").trim() || DEFAULT_MODEL;
    this.timeout = timeout;
  }

  async generateFromFile(
    filePath: string
  ): Promise<{ ok: boolean; result: string }> {
    if (!filePath) return { ok: false, result: "Arquivo não informado." };
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return { ok: false, result: "Arquivo não encontrado." };
    }

    const executable = resolveOpencode();
    if (!executable) {
      return {
        ok: false,
        result:
          "OpenCode não encontrado. Instale o CLI ou defina OPENCODE_BIN em /opt/evosync/.env.",
      };
    }

    const authHint = opencodeAuthHint();
    if (authHint) {
      return { ok: false, result: authHint };
    }

    const args = [
      "run",
      PROMPT,
      "--file",
      filePath,
      "--print-logs=false",
      "--dangerously-skip-permissions",
    ];
    if (this.model) args.push("--model", this.model);

    return new Promise<{ ok: boolean; result: string }>((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const child = spawn(executable, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: opencodeSpawnEnv(),
      });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          child.kill("SIGKILL");
        } catch {
          /* noop */
        }
        resolve({
          ok: false,
          result:
            "OpenCode demorou demais para responder. Tente novamente ou use um arquivo menor.",
        });
      }, this.timeout);

      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, result: `Falha ao executar OpenCode: ${err.message}` });
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const out = cleanOutput(stdout);
        const err = cleanOutput(stderr);
        if (code !== 0) {
          resolve({
            ok: false,
            result:
              err ||
              out ||
              "OpenCode retornou erro sem detalhes. Verifique se o modelo configurado aceita arquivo/imagem e se o OpenCode está autenticado.",
          });
          return;
        }
        if (!out) {
          resolve({
            ok: false,
            result:
              err ||
              "OpenCode não retornou texto útil. Verifique se o modelo configurado aceita imagem/PDF ou tente outro modelo em Modelo OpenCode.",
          });
          return;
        }
        resolve({ ok: true, result: out });
      });
    });
  }
}
