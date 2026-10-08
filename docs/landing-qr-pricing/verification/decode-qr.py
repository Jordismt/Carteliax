"""Decode actual exported QR pixels using the installed libzbar; no network/dependencies."""
import ctypes, json, sys
from PIL import Image
z = ctypes.CDLL('libzbar.so.0')
for name in ['zbar_image_scanner_create', 'zbar_image_create', 'zbar_image_first_symbol', 'zbar_symbol_next']:
    getattr(z, name).restype = ctypes.c_void_p
z.zbar_image_first_symbol.argtypes = [ctypes.c_void_p]
z.zbar_symbol_next.argtypes = [ctypes.c_void_p]
z.zbar_symbol_get_data.argtypes = [ctypes.c_void_p]
z.zbar_symbol_get_data.restype = ctypes.c_char_p
z.zbar_image_scanner_set_config.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
z.zbar_image_set_size.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint]
z.zbar_image_set_format.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
z.zbar_image_set_data.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p]
z.zbar_scan_image.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
z.zbar_image_destroy.argtypes = [ctypes.c_void_p]
z.zbar_image_scanner_destroy.argtypes = [ctypes.c_void_p]
image = Image.open(sys.argv[1]).convert('L')
data = ctypes.create_string_buffer(image.tobytes())
scanner = z.zbar_image_scanner_create()
z.zbar_image_scanner_set_config(scanner, 0, 0, 1)
raw = z.zbar_image_create()
z.zbar_image_set_size(raw, *image.size)
z.zbar_image_set_format(raw, int.from_bytes(b'Y800', 'little'))
z.zbar_image_set_data(raw, data, len(image.tobytes()), None)
z.zbar_scan_image(scanner, raw)
values = []
symbol = z.zbar_image_first_symbol(raw)
while symbol:
    values.append(z.zbar_symbol_get_data(symbol).decode('utf-8'))
    symbol = z.zbar_symbol_next(symbol)
z.zbar_image_destroy(raw)
z.zbar_image_scanner_destroy(scanner)
print(json.dumps(values))
if not values: sys.exit(1)
