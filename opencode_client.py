"""Cliente para gerar mensagens usando modelos configurados no OpenCode."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Tuple


PROMPT = """Você é um redator de WhatsApp para ofertas de atacarejo.

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
"""


DEFAULT_MODEL = "nvidia/meta/llama-3.2-90b-vision-instruct"


ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
STATUS_RE = re.compile(r"^\s*[>›]\s*[\w -]+(?:\s*[·•]\s*.+)?\s*$")
PRODUCT_LINE_RE = re.compile(r"^\s*(?:[^\w\s*]+\s*)?(.+?\s+[—-]\s+\*?R\$\s*[\d.,]+\*?.*)$")
TITLE_LINE_RE = re.compile(r"^\s*(?:[^\w\s*]+\s*)?(\*[^*]+\*)(?:\s*[^\w\s*]+)?\s*$")
CAMPAIGN_EMOJIS = [
    (("pao", "pão", "paes", "pães", "padaria"), ("🍞", "💛")),
    (("verde", "horti", "hortifruti", "feira", "verdura", "legume"), ("🥬", "💚")),
    (("carne", "churrasco", "acougue", "açougue"), ("🥩", "🔥")),
    (("frango",), ("🍗", "🔥")),
    (("bebida", "refrigerante", "suco"), ("🥤", "🧊")),
    (("limpeza",), ("🧼", "✨")),
]
PRODUCT_EMOJIS = [
    (("alface", "couve", "repolho", "acelga", "rucula", "rúcula", "espinafre"), "🥬"),
    (("coentro", "salsa", "salsinha", "cheiro verde", "manjericao", "manjericão", "hortela", "hortelã"), "🌿"),
    (("cebolinha", "alho poro", "alho-poro"), "🌱"),
    (("cebola",), "🧅"),
    (("batata doce", "batata-doce"), "🍠"),
    (("batata",), "🥔"),
    (("macaxeira", "mandioca", "aipim"), "🥔"),
    (("cara", "cará", "inhame"), "🌱"),
    (("cenoura",), "🥕"),
    (("tomate",), "🍅"),
    (("pimentao", "pimentão", "pimenta"), "🫑"),
    (("brocolis", "brócolis"), "🥦"),
    (("milho",), "🌽"),
    (("berinjela",), "🍆"),
    (("pepino",), "🥒"),
    (("abobora", "abóbora", "jerimum"), "🎃"),
    (("banana",), "🍌"),
    (("laranja", "tangerina", "mexerica"), "🍊"),
    (("limao", "limão"), "🍋"),
    (("maca", "maçã"), "🍎"),
    (("pera",), "🍐"),
    (("uva",), "🍇"),
    (("melao", "melão"), "🍈"),
    (("melancia",), "🍉"),
    (("abacaxi",), "🍍"),
    (("manga",), "🥭"),
    (("morango",), "🍓"),
    (("coco",), "🥥"),
    (("abacate",), "🥑"),
    (("arroz",), "🍚"),
    (("feijao", "feijão"), "🫘"),
    (("macarrao", "macarrão", "massa"), "🍝"),
    (("farinha", "farofa"), "🌾"),
    (("acucar", "açúcar"), "🍬"),
    (("cafe", "café"), "☕"),
    (("leite", "ninho", "leite condensado", "creme de leite"), "🥛"),
    (("achocolatado", "chocolate", "nescau", "toddy"), "🍫"),
    (("queijo",), "🧀"),
    (("manteiga", "margarina"), "🧈"),
    (("iogurte",), "🥛"),
    (("frango", "galinha"), "🍗"),
    (("salsicha", "linguica", "linguiça", "hot dog", "hotdog"), "🌭"),
    (("carne", "bife", "acém", "acem", "patinho", "coxao", "coxão"), "🥩"),
    (("peixe", "tilapia", "tilápia", "sardinha"), "🐟"),
    (("ovo", "ovos"), "🥚"),
    (("pao", "pão", "paes", "pães", "pão francês", "pao frances", "bisnaga"), "🍞"),
    (("biscoito", "bolacha", "cream cracker", "cracker"), "🍪"),
    (("oleo", "óleo", "azeite"), "🛢️"),
    (("detergente", "sabao", "sabão", "amaciante", "desinfetante", "agua sanitaria", "água sanitária"), "🧼"),
    (("papel", "toalha", "higienico", "higiênico"), "🧻"),
    (("cerveja",), "🍺"),
    (("refrigerante", "coca", "guarana", "guaraná", "soda"), "🥤"),
    (("suco",), "🧃"),
]


def _clean_output(text: str) -> str:
    text = ANSI_RE.sub("", text).strip()
    text = re.sub(r"^```(?:text|markdown)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text).strip()
    lines = [
        line.rstrip()
        for line in text.splitlines()
        if not STATUS_RE.match(line.strip())
    ]
    while lines and not lines[0].strip():
        lines.pop(0)
    return _polish_message("\n".join(lines).strip())


def _polish_message(text: str) -> str:
    text = re.sub(r"\s+!", "!", text)
    text = re.sub(r"\s+,", ",", text)
    text = re.sub(r"\s+([.])", r"\1", text)
    text = re.sub(r"📍\s*(?=\n|$)", "", text)
    text = re.sub(r"(💚🥬)\s+(Ofertas)", r"\1\n\n\2", text)
    text = re.sub(r"(🛒🔥)\s+", r"\1\n\n", text)
    text = re.sub(r"\s*📍\s+(?=(?:[^\w\s*]+\s*)?.+?\s+[—-]\s+\*?R\$)", "\n", text)
    text = re.sub(r"\s+(?=[🥬🌿🧅🍠🥔🌱🛒]\s+\*)", "\n", text)
    text = re.sub(r"\s+(Corre pra)", r"\n\n\1", text)
    text = re.sub(r"(\([^)]*KG[^)]*\)\* — \*R\$ [0-9.,]+\*)\s+unid/kg", r"\1 kg", text, flags=re.IGNORECASE)
    text = re.sub(r"((?:\(|\b)KG(?:\)|\b).*?[—-]\s+\*?R\$\s*[0-9.,]+\*?)\s+unid/kg", r"\1 kg", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*📍\s*(?=\n[🥬🌿🧅🍠🥔🌱🛒]|\n\nCorre|$)", "", text)
    text = re.sub(r"(🛒🔥)\n(?=[🥬🌿🧅🍠🥔🌱🛒]\s+\*)", r"\1\n\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = _fix_title_emojis(text.strip())
    return _fix_product_emojis(text)


def _fix_title_emojis(text: str) -> str:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        match = TITLE_LINE_RE.match(line)
        if not match:
            return text
        title = match.group(1)
        normalized = title.lower()
        for keywords, emojis in CAMPAIGN_EMOJIS:
            if any(keyword in normalized for keyword in keywords):
                left, right = emojis
                lines[index] = f"{left}{right} {title} {right}{left}"
                return "\n".join(lines)
        return text
    return text


def _emoji_for_product(product: str) -> str:
    normalized = product.lower()
    for keywords, emoji in PRODUCT_EMOJIS:
        if any(keyword in normalized for keyword in keywords):
            return emoji
    return "🛒"


def _fix_product_emojis(text: str) -> str:
    raw_lines = text.splitlines()
    fixed_lines = []
    for index, line in enumerate(raw_lines):
        if not line.strip() and fixed_lines and _looks_like_product_line(fixed_lines[-1]):
            next_line = _next_non_empty(raw_lines, index + 1)
            if next_line and PRODUCT_LINE_RE.match(next_line):
                continue

        match = PRODUCT_LINE_RE.match(line)
        if not match:
            fixed_lines.append(line)
            continue
        offer = match.group(1).strip()
        parts = re.split(r"\s+[—-]\s+", offer, maxsplit=1)
        product = parts[0].strip().strip("*")
        emoji = _emoji_for_product(product)
        if len(parts) == 1:
            fixed_lines.append(f"{emoji} {offer}")
            continue

        price_and_unit = parts[1].strip()
        price_match = re.match(r"\*?(R\$\s*[\d.,]+)\*?(.*)$", price_and_unit)
        if not price_match:
            fixed_lines.append(f"{emoji} *{product}* — {price_and_unit}")
            continue

        price = price_match.group(1)
        unit = _normalize_unit(product, price_match.group(2).strip())
        fixed_lines.append(f"{emoji} *{product}* — *{price}*" + (f" {unit}" if unit else ""))
    return "\n".join(fixed_lines)


def _looks_like_product_line(line: str) -> bool:
    return bool(PRODUCT_LINE_RE.match(line))


def _next_non_empty(lines: list[str], start_index: int) -> str:
    for line in lines[start_index:]:
        if line.strip():
            return line
    return ""


def _normalize_unit(product: str, unit: str) -> str:
    if unit.lower() != "unid/kg":
        return unit
    if re.search(r"(?:\(|\b)kg(?:\)|\b)", product, flags=re.IGNORECASE):
        return "kg"
    return "unid"


class OpenCodeMessageClient:
    def __init__(self, model: str = "", timeout: int = 240):
        self.model = model.strip() or DEFAULT_MODEL
        self.timeout = timeout

    def generate_from_file(self, file_path: str) -> Tuple[bool, str]:
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return False, "Arquivo não encontrado."

        executable = shutil.which("opencode")
        if not executable:
            return False, "OpenCode não encontrado no PATH."

        cmd = [executable, "run", PROMPT, "--file", str(path), "--print-logs=false"]
        if self.model:
            cmd.extend(["--model", self.model])

        try:
            result = subprocess.run(
                cmd,
                check=False,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
        except subprocess.TimeoutExpired:
            return False, "OpenCode demorou demais para responder. Tente novamente ou use um arquivo menor."
        except Exception as e:
            return False, f"Falha ao executar OpenCode: {e}"

        output = _clean_output(result.stdout)
        error = _clean_output(result.stderr)
        if result.returncode != 0:
            return False, error or output or (
                "OpenCode retornou erro sem detalhes. Verifique se o modelo configurado aceita arquivo/imagem "
                "e se o OpenCode está autenticado."
            )
        if not output:
            return False, error or (
                "OpenCode não retornou texto útil. Verifique se o modelo configurado aceita imagem/PDF "
                "ou tente outro modelo em Modelo OpenCode."
            )
        return True, output
