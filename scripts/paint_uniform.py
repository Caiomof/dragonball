"""Texture-space outfit painting on the EXISTING skinned Quaternius-style humanoid.
No replacement geometry, no changes to skinning or animations. Uses the source GLTF
mesh UVs + bone weights to mask clothing and preserve exposed skin/face.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE=Path(__file__).resolve().parents[1]/'public/models/hero'
GLTF=BASE/'Superhero_Male_FullBody.gltf'
J=json.loads(GLTF.read_text()); RAW=(BASE/'Superhero_Male_FullBody.bin').read_bytes()
S={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};D={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
def acc(i):
 a=J['accessors'][i];v=J['bufferViews'][a['bufferView']];d=np.dtype(D[a['componentType']]);n=S[a['type']];stride=v.get('byteStride',d.itemsize*n);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.array([np.frombuffer(RAW,d,count=n,offset=offset+k*stride) for k in range(a['count'])])

body=J['meshes'][2]['primitives'][0]
attrs=body['attributes'];pos=acc(attrs['POSITION']);uv=acc(attrs['TEXCOORD_0']);joints=acc(attrs['JOINTS_0']);weights=acc(attrs['WEIGHTS_0']);faces=acc(body['indices']).reshape(-1,3)
names=np.array([J['nodes'][k]['name'] for k in J['skins'][0]['joints']]);dom=names[joints[np.arange(len(joints)),weights.argmax(axis=1)]]
base=Image.open(BASE/'T_Superhero_Male_Dark.png').convert('RGB'); W,H=base.size
mask=Image.new('RGB',(W,H),(0,0,0));draw=ImageDraw.Draw(mask)
# Region code: 1=skin, 2=gi jacket, 3=gi trouser, 4=boot, 5=belt, 6=gauntlet
categories=[]
for ix in faces:
 p=pos[ix];y=p[:,1].mean(); bones=[str(x) for x in dom[ix]]
 if y>1.54 or all(('hand' in b or 'thumb' in b or 'index' in b or 'middle' in b or 'ring' in b or 'pinky' in b) for b in bones):c=1
 elif y<0.20 and any('foot' in b or 'ball_' in b for b in bones):c=4
 elif y<0.92 and any('thigh' in b or 'calf' in b or 'pelvis' in b for b in bones):c=3
 elif any('upperarm' in b or 'clavicle' in b or 'spine' in b for b in bones):c=2
 elif any('lowerarm' in b for b in bones):c=1
 elif 0.92<=y<=1.08 and any('pelvis' in b for b in bones):c=5
 elif any('pelvis' in b or 'thigh' in b for b in bones):c=3
 elif y<0.22:c=4
 elif y<1.1:c=3
 elif y<1.55:c=2
 else:c=1
 categories.append(c)
 pts=[(round(uv[q,0]*(W-1)),round(uv[q,1]*(H-1))) for q in ix]
 draw.polygon(pts,fill=(c,0,0))
# Extend edges to avoid seams in anisotropic texture sampling.
a=np.asarray(base).astype(np.float32);k=np.asarray(mask)[:,:,0];
# Preserve texture shading in textile, but remove bare-torso skin hue.
lum=(a[:,:,0]*0.27+a[:,:,1]*0.60+a[:,:,2]*0.13)/255.0
shade=(0.67+0.46*lum)[:,:,None]
y,x=np.mgrid[:H,:W];fabric=(np.sin(x*0.19)*np.sin(y*0.23)*0.018)[:,:,None]
Palettes={
 'saiyajin': dict(skin=(232,184,146),shirt=(232,105,35),pants=(29,56,119),boots=(24,45,85),belt=(51,76,160)),
 'terraqueo':dict(skin=(192,138,103),shirt=(35,153,146),pants=(208,185,131),boots=(81,61,49),belt=(236,204,89)),
 'namekuseijin':dict(skin=(115,180,88),shirt=(110,81,165),pants=(222,216,202),boots=(119,67,65),belt=(216,186,112)),
 'majin':dict(skin=(242,158,191),shirt=(43,43,75),pants=(235,235,240),boots=(212,177,44),belt=(240,201,75))
}
for race,colors in Palettes.items():
 out=a.copy()
 for code,entry in [(1,'skin'),(2,'shirt'),(3,'pants'),(4,'boots'),(5,'belt'),(6,'belt')]:
  region=k==code
  if not np.any(region):continue
  col=np.array(colors[entry],dtype=np.float32)
  shadeImage=np.clip(col*(shade+fabric),0,255)
  # Keep detailed original face/skin shading while re-colouring appropriately.
  mix=(0.27 if code==1 else 0.08)
  candidate=shadeImage*(1-mix)+a*mix
  out[region]=candidate[region]
 # Put a cloth sash around the waist on torso UV polygons via bone-mapped mask where possible.
 fn=BASE/f'T_Origens_Gi_{race}.png'
 Image.fromarray(np.uint8(np.clip(out,0,255)),'RGB').save(fn,compress_level=1)
 print(fn.name,round(fn.stat().st_size/1024),'KiB')
