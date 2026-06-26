/**
 * Cliente HTTP para a Evolution API v2.
 * Port direto de evo_client.py usando fetch nativo.
 */

export function normalizeNumberLocal(
  number: string,
  defaultCc = "55"
): string {
  if (!number) return "";
  const digits = (number || "").replace(/\D+/g, "");
  if (!digits) return "";

  if (digits.startsWith(defaultCc)) return digits;
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11)
    return defaultCc + digits;
  if (digits.length === 12 && digits.startsWith("55")) return digits;
  return digits;
}

export class EvoClient {
  baseUrl: string;
  apiKey: string;
  instance: string;
  timeout: number;

  constructor(baseUrl: string, apiKey: string, instance: string, timeout = 30_000) {
    this.baseUrl = (baseUrl || "").replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.instance = instance;
    this.timeout = timeout;
  }

  private url(...parts: string[]): string {
    return [this.baseUrl, ...parts].join("/");
  }

  private get headers(): HeadersInit {
    return { apikey: this.apiKey };
  }

  private async request(
    method: string,
    url: string,
    body?: BodyInit | null,
    extraHeaders?: HeadersInit
  ): Promise<{ status: number; ok: boolean; text: string; json: any }> {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
          ...this.headers,
          ...(extraHeaders || {}),
        },
        body: body ?? undefined,
        signal: ctl.signal,
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return {
        status: res.status,
        ok: res.ok,
        text: text.slice(0, 500),
        json,
      };
    } catch (e: any) {
      return { status: 0, ok: false, text: String(e?.message || e), json: null };
    } finally {
      clearTimeout(tm);
    }
  }

  async ping(): Promise<{ ok: boolean; msg: string }> {
    const r = await this.request("GET", this.url(""));
    if (r.status === 200) {
      const version = r.json?.version ?? "?";
      return { ok: true, msg: `OK · v${version}` };
    }
    if (r.status === 0) {
      return { ok: false, msg: `Falha de conexão: ${r.text}` };
    }
    return { ok: false, msg: `HTTP ${r.status}` };
  }

  async connectionState(): Promise<{ state: string | null; err: string }> {
    const r = await this.request(
      "GET",
      this.url("instance", "connectionState", this.instance)
    );
    if (r.status !== 200) {
      return { state: null, err: `HTTP ${r.status}: ${r.text.slice(0, 200)}` };
    }
    if (!r.json) return { state: null, err: "Resposta inválida" };
    const inst = r.json.instance || {};
    const state = inst.state ?? r.json.state ?? r.json.status ?? null;
    return { state: state != null ? String(state) : null, err: "OK" };
  }

  async instanceExists(): Promise<{ ok: boolean; info: string }> {
    const r = await this.request(
      "GET",
      this.url("instance", "connectionState", this.instance)
    );
    if (r.status === 200) return { ok: true, info: "ok" };
    if (r.status === 0) return { ok: false, info: `sem_conexao: ${r.text}` };
    if (r.status === 404)
      return { ok: false, info: `instancia_inexistente: ${r.text.slice(0, 200)}` };
    if (r.status === 401 || r.status === 403)
      return { ok: false, info: `autenticacao: HTTP ${r.status}` };
    return { ok: false, info: `http_${r.status}: ${r.text.slice(0, 200)}` };
  }

  async sendText(
    number: string,
    text: string
  ): Promise<{ ok: boolean; msg: string }> {
    const r = await this.request(
      "POST",
      this.url("message", "sendText", this.instance),
      JSON.stringify({ number, text })
    );
    if (r.status === 200 || r.status === 201) return { ok: true, msg: "ok" };
    if (r.status === 0) return { ok: false, msg: `Erro de rede: ${r.text}` };
    return { ok: false, msg: `HTTP ${r.status}: ${r.text.slice(0, 300)}` };
  }

  async sendMedia(
    number: string,
    mediaPath: string,
    caption: string,
    mediatype: string
  ): Promise<{ ok: boolean; msg: string }> {
    const fs = await import("node:fs");
    if (!fs.existsSync(mediaPath))
      return { ok: false, msg: "Arquivo de mídia não encontrado" };
    const path = await import("node:path");
    const mime = await import("node:path");
    // Guess mime from extension
    const ext = path.extname(mediaPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const fileMime = mimeMap[ext] ?? "application/octet-stream";

    const buf = fs.readFileSync(mediaPath);
    const fileName = path.basename(mediaPath);
    const form = new FormData();
    form.append("number", number);
    form.append("mediatype", mediatype);
    form.append("fileName", fileName);
    if (caption) form.append("caption", caption);
    form.append(
      "file",
      new Blob([new Uint8Array(buf)], { type: fileMime }),
      fileName
    );

    const r = await this.request(
      "POST",
      this.url("message", "sendMedia", this.instance),
      form
    );
    if (r.status === 200 || r.status === 201) return { ok: true, msg: "ok" };
    if (r.status === 0) return { ok: false, msg: `Erro: ${r.text}` };
    return { ok: false, msg: `HTTP ${r.status}: ${r.text.slice(0, 300)}` };
  }

  async findContactsRaw(): Promise<{ data: any[] | null; err: string }> {
    const r = await this.request(
      "POST",
      this.url("chat", "findContacts", this.instance),
      "{}"
    );
    if (r.status !== 200)
      return { data: null, err: `HTTP ${r.status}: ${r.text.slice(0, 300)}` };
    if (!r.json)
      return { data: null, err: "Resposta inválida" };
    if (!Array.isArray(r.json))
      return { data: null, err: `Formato inesperado: ${typeof r.json}` };
    return { data: r.json, err: "ok" };
  }

  async checkWhatsapp(
    numbers: string[]
  ): Promise<{ data: any[] | null; err: string }> {
    const r = await this.request(
      "POST",
      this.url("chat", "whatsappNumbers", this.instance),
      JSON.stringify({ numbers })
    );
    if (r.status !== 200)
      return { data: null, err: `HTTP ${r.status}: ${r.text.slice(0, 300)}` };
    if (!r.json)
      return { data: null, err: "Resposta inválida" };
    if (!Array.isArray(r.json))
      return { data: null, err: `Formato inesperado: ${typeof r.json}` };
    return { data: r.json, err: "ok" };
  }

  // ==========================================================================
  // Managed central (Fase B) — métodos para criar/gerenciar instâncias na
  // Evolution API centralizada. Não dependem de `this.instance` — o nome da
  // instância é passado como parâmetro porque cada chamada pode operar em
  // uma instância diferente.
  // ==========================================================================

  /**
   * Cria uma nova instância na Evolution API. Não conecta — só provisiona.
   * Endpoint: POST /instance/create
   * Body: { instanceName, qrcode: false, integration: "WHATSAPP-BAILEYS" }
   * Retorna { instance: { instanceName, instanceId, status, ... } } em caso de
   * sucesso, ou { error: true, response: { message: [...] } } em caso de erro
   * (ex: nome já existe → 403 com mensagem "Already exists").
   */
  async createInstance(
    instanceName: string
  ): Promise<{ ok: boolean; info: string; data?: any }> {
    const body = JSON.stringify({
      instanceName,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
    });
    const r = await this.request("POST", this.url("instance", "create"), body);
    if (r.status === 200 || r.status === 201) {
      return {
        ok: true,
        info: "instância criada",
        data: r.json,
      };
    }
    if (r.status === 403 || r.status === 409) {
      return {
        ok: false,
        info: `já existe: ${r.text.slice(0, 200)}`,
      };
    }
    return {
      ok: false,
      info: `HTTP ${r.status}: ${r.text.slice(0, 300)}`,
    };
  }

  /**
   * Solicita o QR code de pareamento de uma instância. A Evolution API
   * devolve um QR em base64 (PNG) que precisa ser escaneado pelo app
   * WhatsApp do cliente.
   *
   * Endpoint: GET /instance/connect/{instanceName}
   * Retorna { pairingCode, code, base64, count } em sucesso.
   *
   * Importante: cada chamada GERA UM NOVO QR — o anterior vira inválido.
   * Por isso cacheamos por até 30s no app pra evitar flood de chamadas.
   */
  async connectInstance(
    instanceName: string
  ): Promise<{
    ok: boolean;
    info: string;
    qr?: { base64?: string; code?: string; pairingCode?: string };
  }> {
    const r = await this.request(
      "GET",
      this.url("instance", "connect", instanceName)
    );
    if (r.status === 200 && r.json) {
      const qr = r.json.qrcode || r.json.qr || r.json;
      return {
        ok: true,
        info: "ok",
        qr: {
          base64: qr?.base64 || qr?.qrcode || undefined,
          code: qr?.code || undefined,
          pairingCode: qr?.pairingCode || undefined,
        },
      };
    }
    // 404 = instância não existe
    if (r.status === 404) {
      return { ok: false, info: "instância não existe" };
    }
    // 400 com "already connected" → escaneamento anterior já foi feito
    if (r.status === 400 && /already.*connect/i.test(r.text)) {
      return { ok: false, info: "já conectado" };
    }
    return { ok: false, info: `HTTP ${r.status}: ${r.text.slice(0, 300)}` };
  }

  /**
   * Estado de conexão de uma instância.
   * Endpoint: GET /instance/connectionState/{instanceName}
   * Retorna { instance: { state: "open" | "close" | "connecting" } } em sucesso.
   */
  async getInstanceState(
    instanceName: string
  ): Promise<{ state: string | null; err: string }> {
    const r = await this.request(
      "GET",
      this.url("instance", "connectionState", instanceName)
    );
    if (r.status === 404) {
      return { state: null, err: "instância não existe" };
    }
    if (r.status !== 200) {
      return { state: null, err: `HTTP ${r.status}: ${r.text.slice(0, 200)}` };
    }
    if (!r.json) return { state: null, err: "Resposta inválida" };
    const inst = r.json.instance || {};
    const state = inst.state ?? r.json.state ?? r.json.status ?? null;
    return { state: state != null ? String(state) : null, err: "OK" };
  }

  /**
   * Desconecta o WhatsApp da instância (logout). NÃO deleta a instância —
   * para recriar/limpar use deleteInstance().
   * Endpoint: DELETE /instance/logout/{instanceName}
   */
  async logoutInstance(
    instanceName: string
  ): Promise<{ ok: boolean; info: string }> {
    const r = await this.request(
      "DELETE",
      this.url("instance", "logout", instanceName)
    );
    if (r.status === 200 || r.status === 204) {
      return { ok: true, info: "desconectado" };
    }
    if (r.status === 404) {
      return { ok: false, info: "instância não existe" };
    }
    return { ok: false, info: `HTTP ${r.status}: ${r.text.slice(0, 200)}` };
  }

  /**
   * Deleta uma instância completamente (logout + remove do DB + apaga sessão).
   * Endpoint: DELETE /instance/{instanceName}
   */
  async deleteInstance(
    instanceName: string
  ): Promise<{ ok: boolean; info: string }> {
    const r = await this.request(
      "DELETE",
      this.url("instance", instanceName)
    );
    if (r.status === 200 || r.status === 204) {
      return { ok: true, info: "instância deletada" };
    }
    if (r.status === 404) {
      return { ok: true, info: "instância não existia (idempotente)" };
    }
    return { ok: false, info: `HTTP ${r.status}: ${r.text.slice(0, 200)}` };
  }
}
