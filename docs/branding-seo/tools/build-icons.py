"""Web assets from the reviewed deterministic RGBA master; no original writes."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,struct,hashlib
ROOT=Path(__file__).resolve().parents[3];PUBLIC=ROOT/'frontend/public';BRAND=PUBLIC/'images/brand';QA=ROOT/'docs/branding-seo/verification'
master=Image.open(BRAND/'carteliax-logo-transparent.png').convert('RGBA')
bbox=master.getchannel('A').getbbox();symbol=master.crop(bbox)
def icon(size):
 extent=round(size*.92);ratio=extent/max(symbol.size)
 scaled=symbol.resize((round(symbol.width*ratio),round(symbol.height*ratio)),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(size,size),(0,0,0,0));canvas.alpha_composite(scaled,((size-scaled.width)//2,(size-scaled.height)//2));return canvas
assets={}
for size,name in [(16,'favicon-16x16.png'),(32,'favicon-32x32.png'),(180,'apple-touch-icon.png'),(192,'android-chrome-192x192.png'),(512,'android-chrome-512x512.png')]:
 icon(size).save(PUBLIC/name,optimize=True);assets[name]=size
for size in [64,96,512]:
 im=icon(size);im.save(BRAND/f'carteliax-mark-{size}.png',optimize=True);im.save(BRAND/f'carteliax-mark-{size}.webp',lossless=True,method=6)
 assets[f'images/brand/carteliax-mark-{size}.png']=size;assets[f'images/brand/carteliax-mark-{size}.webp']=size
icon(512).save(PUBLIC/'favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48)])
# Proof of dimensions, actual transparency, integrity and ICO directory.
checks=[]
for name,size in assets.items():
 path=PUBLIC/name;im=Image.open(path).convert('RGBA');alpha=im.getchannel('A');assert im.size==(size,size);assert alpha.getextrema()==(0,255);assert alpha.getpixel((0,0))==0
 checks.append({'path':name,'dimensions':list(im.size),'alpha_range':list(alpha.getextrema()),'bytes':path.stat().st_size})
data=(PUBLIC/'favicon.ico').read_bytes();reserved,kind,count=struct.unpack('<HHH',data[:6]);assert (reserved,kind,count)==(0,1,3)
ico_sizes=[]
for i in range(count):
 width,height,*_=struct.unpack('<BBBBHHII',data[6+i*16:22+i*16]);ico_sizes.append([width or 256,height or 256])
assert ico_sizes==[[16,16],[32,32],[48,48]]
rgba=__import__('numpy').array(master);rgb=__import__('numpy').array(Image.open(PUBLIC/'favicon.png').convert('RGB'));opaque=rgba[:,:,3]==255
assert __import__('numpy').array_equal(rgba[opaque,:3],rgb[opaque]),'Opaque original colours changed'
assert hashlib.sha256((PUBLIC/'favicon.png').read_bytes()).hexdigest()=='bc58668369b3438fbd16e082618b038d2997e596474c4862488eb4ac08ba6290'
(QA/'brand-assets.json').write_text(json.dumps({'pass':True,'original_intact':True,'all_opaque_pixels_rgb_preserved':True,'master_bbox':list(bbox),'ico_sizes':ico_sizes,'assets':checks},indent=2)+'\n')
# Review the exact resized icons, including at their actual display sizes.
contact=Image.new('RGB',(720,300),'#f5f5f0');draw=ImageDraw.Draw(contact)
for row,color in enumerate(['#ffffff','#111111','#235747']):
 draw.rectangle((0,row*100,720,(row+1)*100),fill=color)
 for col,size in enumerate([16,32,48,64]):
  x=30+col*140;y=row*100+(100-size)//2
  im=icon(size);contact.paste(im,(x,y),im);draw.text((x+size+8,row*100+40),str(size),fill='#222222' if row==0 else '#ffffff')
contact.save(QA/'favicon-size-review.png')
print(json.dumps({'pass':True,'assets':len(checks),'ico_sizes':ico_sizes,'original_intact':True}))
