"""Decodifica el QR de public/assets/qr-pago.png y muestra el payload embebido."""
import sys, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'assets' / 'qr-pago.png'

img = Image.open(SRC).convert('RGB')
print(f'IMG: {SRC.name} {img.size}')

decoded = None

# Intento 1: pyzbar
try:
    from pyzbar.pyzbar import decode as zbar_decode
    res = zbar_decode(img)
    if res:
        decoded = res[0].data.decode('utf-8', errors='replace')
        print(f'[pyzbar] OK · type={res[0].type}')
except Exception as e:
    print(f'[pyzbar] err: {e}')

# Intento 2: OpenCV QRCodeDetector
if not decoded:
    try:
        import cv2, numpy as np
        arr = np.array(img)[:, :, ::-1]
        det = cv2.QRCodeDetector()
        data, pts, _ = det.detectAndDecode(arr)
        if data:
            decoded = data
            print(f'[opencv] OK')
    except Exception as e:
        print(f'[opencv] err: {e}')

if not decoded:
    print('NO PUDE DECODIFICAR — probá con otra imagen o un decoder online')
    sys.exit(1)

print('─' * 60)
print('PAYLOAD:')
print(decoded)
print('─' * 60)
print(f'LEN={len(decoded)} chars')

# Guardar para reuso
out = ROOT / 'scripts' / 'qr_payload.txt'
out.write_text(decoded, encoding='utf-8')
print(f'guardado en {out.relative_to(ROOT)}')
