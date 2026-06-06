"""Regenera el QR de pago con identidad Botánica.

Lee el payload de Yape ya decodificado (scripts/qr_payload.txt) y genera un PNG
cuadrado, limpio, con el color verde-jardín de la marca. La app de Yape escanea
igual porque el payload es idéntico — solo cambia el envoltorio visual.
"""
from pathlib import Path
import qrcode
from qrcode.constants import ERROR_CORRECT_H

ROOT = Path(__file__).resolve().parent.parent
PAYLOAD = (ROOT / 'scripts' / 'qr_payload.txt').read_text(encoding='utf-8').strip()
OUT = ROOT / 'public' / 'assets' / 'qr-pago.png'

# Paleta Botánica (oscuros, alto contraste)
BRAND_DARK = '#1F442E'   # verde jardín nocturno
BG         = '#FFFFFF'

qr = qrcode.QRCode(
    version=None,                      # auto: ajusta a la longitud del payload
    error_correction=ERROR_CORRECT_H,  # 30% corrección — robusto contra suciedad/reflejos
    box_size=18,                       # px por módulo → QR final ~860x860 con border 4
    border=4,                          # quiet zone (mínimo recomendado por la spec)
)
qr.add_data(PAYLOAD)
qr.make(fit=True)

img = qr.make_image(fill_color=BRAND_DARK, back_color=BG).convert('RGB')
img.save(OUT, optimize=True)
print(f'OK · {OUT.relative_to(ROOT)} · {img.size}')
