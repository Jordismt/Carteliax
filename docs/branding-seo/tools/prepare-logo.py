"""Deterministic background extraction. Original is never written.
Requires Pillow + NumPy already available locally; no generative editing.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import hashlib, json
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'frontend/public/favicon.png'
QA=ROOT/'docs/branding-seo/verification'
OUT=ROOT/'frontend/public/images/brand'
original_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert original_hash=='bc58668369b3438fbd16e082618b038d2997e596474c4862488eb4ac08ba6290','Different source: review shadow zone before extraction'
rgb=np.array(Image.open(SOURCE).convert('RGB'))
h,w,_=rgb.shape
# Only near-white, almost neutral pixels can be background. Interior whites
# not connected to the exterior are explicitly kept.
neutral=(rgb.min(axis=2)>=246)&(np.ptp(rgb.astype(np.int16),axis=2)<=5)
mask=Image.fromarray(np.where(neutral,255,0).astype('uint8')).copy()
for x in range(w):
 for y in (0,h-1):
  if mask.getpixel((x,y))==255:ImageDraw.floodfill(mask,(x,y),128)
for y in range(h):
 for x in (0,w-1):
  if mask.getpixel((x,y))==255:ImageDraw.floodfill(mask,(x,y),128)
bg=np.array(mask)==128
# Explicitly authorized removal of the warm exterior shadow. This source-
# specific zone stays below the rear page and outside the solid front bevel.
# Keep an eight-pixel band around the measured teal cover, without drawing it.
def dilate(a):
 p=np.pad(a,1,constant_values=False)
 return np.logical_or.reduce([p[dy:dy+h,dx:dx+w] for dy in range(3) for dx in range(3)])
ygrid,xgrid=np.indices((h,w))
front=(rgb[:,:,0]<180)&(rgb[:,:,1].astype(int)-rgb[:,:,0]>8)&(rgb[:,:,2].astype(int)-rgb[:,:,0]>8)&(xgrid<660)&(ygrid>440)
solid_bevel=front.copy()
for _ in range(8):solid_bevel=dilate(solid_bevel)
shadow_zone=(xgrid>=590)&(xgrid<=735)&(ygrid>=905)&(ygrid>910+(xgrid-659)*.30+3)
shadow_zone|=(ygrid>1000)&(xgrid>=300)&(xgrid<735)
shadow_removed=shadow_zone&~solid_bevel&~bg
bg|=shadow_zone&~solid_bevel
fg=~bg
# Three-pixel exterior contour only. No global white colour-key is applied.
near=bg.copy()
for _ in range(3):near=dilate(near)
edge=fg&near
core=fg&~near
result=np.dstack([rgb,np.where(bg,0,255).astype('uint8')])
# Unmatte antialiased contour against locally estimated neutral background.
# The rest of the logo keeps its exact original RGB and opacity.
offsets=sorted([(dy,dx) for dy in range(-6,7) for dx in range(-6,7) if dy or dx],key=lambda d:d[0]**2+d[1]**2)
changed=0
for y,x in np.argwhere(edge):
 inner=None;outside=None
 for dy,dx in offsets:
  yy,xx=y+dy,x+dx
  if 0<=yy<h and 0<=xx<w:
   if inner is None and core[yy,xx]:inner=rgb[yy,xx].astype(float)
   if outside is None and bg[yy,xx]:outside=np.array([254.5,254.5,254.5])
   if inner is not None and outside is not None:break
 if inner is None or outside is None:continue
 c=rgb[y,x].astype(float);v=inner-outside;norm=v@v
 if norm<100:continue
 a=float(np.clip(((c-outside)@v)/norm,0,1))
 # Only a good fit to a white matte is corrected. Shading not explained by
 # this model is kept; alpha is never changed inside the three-pixel contour.
 residual=np.linalg.norm(c-(a*inner+(1-a)*outside))
 teal_matte=c.min()>200 and inner.min()<160 and a<.4 and not (x>620 and y>900)
 if a<=.01 and teal_matte:
  result[y,x,3]=0;changed+=1;continue
 if .01<a<.98 and (residual<=10 or teal_matte):
  color=np.clip(np.rint((c-(1-a)*outside)/a),0,255).astype('uint8')
  result[y,x,:3]=inner.astype('uint8') if residual>10 else color;result[y,x,3]=round(a*255);changed+=1
# Safety checks BEFORE writing anything: legitimate whites, coloured core,
# original integrity, one coherent silhouette and absence of outside islands.
probes={'fork':(466,603),'cream_page':(650,360),'solid_cream_bevel':(655,970),'cream_qr_center':(766,759)}
for name,(x,y) in probes.items():
 assert not bg[y,x],f'Unsafe extraction reached legitimate detail: {name}'
 assert np.array_equal(result[y,x,:3],rgb[y,x]) and result[y,x,3]==255,f'Changed legitimate detail: {name}'
assert np.array_equal(result[core,:3],rgb[core]),'Opaque core colour changed'
assert (bg[:150]).all(),'Unclassified external background'
ys,xs=np.where(fg);bbox=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
assert 300<bbox[0]<340 and 190<bbox[1]<230 and 950<bbox[2]<1000 and 1030<bbox[3]<1070,f'Unexpected silhouette: {bbox}'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==original_hash
QA.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
master=Image.fromarray(result)
master.save(OUT/'carteliax-logo-transparent.png',optimize=True)
# Visual review on different backgrounds, at original pixel scale.
cut=master.crop(tuple(bbox));padding=32;panel=(cut.width+padding*2,cut.height+padding*2)
backgrounds=[('#ffffff','white'),('#111111','black'),('#235747','teal'),('#c87c55','colour')]
contact=Image.new('RGB',(panel[0]*4,panel[1]+32),'#eeeeee')
for i,(color,name) in enumerate(backgrounds):
 canvas=Image.new('RGBA',panel,color);canvas.alpha_composite(cut,(padding,padding));canvas.convert('RGB').save(QA/f'logo-on-{name}.png',optimize=True)
 contact.paste(canvas.convert('RGB'),(i*panel[0],32));ImageDraw.Draw(contact).text((i*panel[0]+16,10),name,fill='#111111')
contact.save(QA/'logo-background-review.png',optimize=True)
report={'status':'FINAL_WITH_AUTHORIZED_EXTERIOR_SHADOW_REMOVAL','shadow_pixels_removed':int(shadow_removed.sum()),'source':str(SOURCE.relative_to(ROOT)),'sha256_original':original_hash,'dimensions':[w,h],'foreground_bbox':bbox,'exterior_transparent_pixels':int(bg.sum()),'unmatted_contour_pixels':changed,'contour_max_width':3,'core_rgb_preserved':True,'legitimate_white_probes':{name:{'position':[x,y],'rgba':result[y,x].tolist()} for name,(x,y) in probes.items()},'alpha_range':[int(result[:,:,3].min()),int(result[:,:,3].max())],'partial_alpha_pixels':int(((result[:,:,3]>0)&(result[:,:,3]<255)).sum())}
(QA/'logo-extraction.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
