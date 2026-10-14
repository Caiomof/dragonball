"""Create a self-contained CC0-original stylized animated GLB for offline play.
Original geometry and animations authored procedurally for this prototype.
No Blender/external models or network needed. Optional developer rebuild script.
"""
import json, struct, math, pathlib
import numpy as np
import trimesh

OUT = pathlib.Path(__file__).resolve().parents[1] / 'public/models/origens-warrior.glb'
def quat(axis,ang):
    return [math.sin(ang/2)*v for v in axis]+[math.cos(ang/2)]


binary = bytearray()
views=[]; accessors=[]; meshes=[]; materials=[]; nodes=[]; animations=[]

def push(data, target=None):
    while len(binary)%4:binary.append(0)
    offset=len(binary); binary.extend(data)
    obj={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
    if target:obj['target']=target
    views.append(obj)
    return len(views)-1

def acc(values, component=5126, ty='VEC3', target=None):
    if component==5126:a=np.asarray(values,dtype='<f4')
    elif component==5125:a=np.asarray(values,dtype='<u4')
    else: raise ValueError(component)
    v=push(a.tobytes(),target)
    n=len(a) if a.ndim>1 else len(a)//{'SCALAR':1,'VEC3':3,'VEC4':4}[ty]
    item={'bufferView':v,'componentType':component,'count':n,'type':ty}
    if component==5126 and ty=='VEC3':item['min']=np.min(a,axis=0).astype(float).tolist();item['max']=np.max(a,axis=0).astype(float).tolist()
    accessors.append(item)
    return len(accessors)-1

def material(name,rgba,metal=0,rough=0.82):
    materials.append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':rgba,'metallicFactor':metal,'roughnessFactor':rough}, 'doubleSided':True})
    return len(materials)-1
skin=material('SKIN',[0.94,0.65,0.45,1]); gi=material('GI_TOP',[0.95,0.37,0.12,1]); pants=material('PANTS',[0.17,0.30,0.56,1]); gloves=material('WRIST',[0.13,0.29,0.47,1]); boots=material('BOOTS',[0.10,0.18,0.28,1]); gold=material('BELT_GOLD',[0.99,0.76,0.32,1],0.2); hair=material('HAIR',[0.10,0.12,0.19,1]); white=material('EYE_WHITE',[0.98,0.94,0.83,1]); pupil=material('EYE_IRIS',[0.18,0.52,0.83,1]); black=material('DETAIL_DARK',[0.11,0.1,0.12,1]); shade=material('CLOTH_TRIM',[0.98,0.72,0.39,1]);

# PBR vertex normals ensure smooth lighting for stylized hero.
def addmesh(name,obj,mat):
    vertices=np.asarray(obj.vertices,dtype=np.float32); tri=np.asarray(obj.faces,dtype=np.uint32).ravel()
    norm=np.asarray(obj.vertex_normals,dtype=np.float32)
    meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':acc(vertices,ty='VEC3',target=34962),'NORMAL':acc(norm,ty='VEC3',target=34962)},'indices':acc(tri,5125,'SCALAR',34963),'material':mat}]})
    return len(meshes)-1

def sphere(name,mat,scale,pos=(0,0,0),subdiv=3):
    m=trimesh.creation.icosphere(subdivisions=subdiv,radius=1.0)
    m.apply_scale(scale);m.apply_translation(pos)
    return addmesh(name,m,mat)

def cone(name,mat,radius,height,pos=(0,0,0),sections=9):
    m=trimesh.creation.cone(radius=radius,height=height,sections=sections)
    m.apply_translation((pos[0],pos[1],pos[2]-height/2))
    # cone created along +Z, align to +Y using -90 X
    m.apply_transform(trimesh.transformations.rotation_matrix(-math.pi/2,(1,0,0),point=pos))
    return addmesh(name,m,mat)

def node(name,position=(0,0,0),mesh=None,parent=None,scale=None):
    n={'name':name,'translation':list(map(float,position))}
    if mesh is not None:n['mesh']=mesh
    if scale:n['scale']=list(scale)
    nodes.append(n);idx=len(nodes)-1
    if parent is not None:nodes[parent].setdefault('children',[]).append(idx)
    return idx

root=node('HeroRig')
hips=node('Hips',(0,1.0,0),parent=root)
torso=node('Spine',(0,0.27,0),parent=hips)
node('GI_Mesh',(0,0.20,0),sphere('Fitted Martial Arts Gi',gi,(0.33,0.42,0.21)),torso)
node('GI_Waist',(0,-0.1,0),sphere('Waist',gi,(0.29,0.18,0.20)),torso)
node('GI_Collar',(0,0.55,0),sphere('Collar',shade,(0.23,0.085,0.195)),torso)
node('GI_Belt',(0,-0.04,0),sphere('Woven Belt',gold,(0.33,0.064,0.23)),torso)
node('GI_BeltKnot',(0,-0.07,-0.24),sphere('Knot',gold,(0.085,0.09,0.07)),torso)
node('GI_Sigil',(0,0.30,-0.213),sphere('Chest Crest',gold,(0.095,0.105,0.014)),torso)
neck=node('Neck',(0,0.64,0),parent=torso)
node('NeckSkin',(0,0.07,0),sphere('Neck',skin,(0.105,0.14,0.11)),neck)
head=node('Head',(0,0.22,0),parent=neck)
node('FACE',(0,0.03,0),sphere('Face Smooth',skin,(0.258,0.31,0.239),subdiv=4),head)
node('Chin',(0,-0.20,-0.08),sphere('Jaw',skin,(0.175,0.082,0.194)),head)
for x in (-0.102,0.102):
    node('Eyeball', (x,0.09,-0.249),sphere('Eyes',white,(0.063,0.073,0.025)),head)
    node('Iris',(x,0.09,-0.267),sphere('Iris',pupil,(0.027,0.047,0.012)),head)
    node('Pupil',(x,0.09,-0.275),sphere('Pupil',black,(0.013,0.029,0.01)),head)
    node('Brow',(x,0.17,-0.248),sphere('Brow',hair,(0.070,0.019,0.018)),head)
node('Nose',(0,0.005,-0.254),sphere('Nose',skin,(0.035,0.05,0.045)),head)
node('Mouth',(0,-0.135,-0.224),sphere('Mouth',black,(0.069,0.014,0.014)),head)
# scalp and pointed anime hair with hair mesh visible on all races; can hide for Namekuseijin/Majin runtime
node('HAIR_SCALP',(0,0.245,0),sphere('Hair Volume',hair,(0.269,0.17,0.254)),head)
for k in range(12):
    theta=2*math.pi*k/12
    h=0.22+0.16*(k%3==0)
    idx=node('HAIR_SPIKE',(.19*math.cos(theta),.32+.05*(k%3),.17*math.sin(theta)),cone('Hair Spike',hair,0.092,h),head)
    nodes[idx]['rotation']=quat((0,0,1),-.31*math.cos(theta))
for k in range(4):
    node('HAIR_BANG',(-0.15+k*.1,.22,-.22),cone('Hair Bang',hair,.073,.19),head)

for sign,name in ((-1,'Left'),(1,'Right')):
    upper=node(name+'Arm',(sign*.39,.49,0),parent=torso)
    node(name+'ShoulderGuard',(sign*.02,-.065,0),sphere('Shoulder Gi',gi,(0.18,.16,.185)),upper)
    node(name+'UpperArm',(sign*.03,-.23,0),sphere('Upper Arm',skin,(0.13,.28,.135)),upper)
    fore=node(name+'ForeArm',(sign*.03,-.48,0),parent=upper)
    node(name+'Elbow',(0,.02,0),sphere('Elbow',skin,(.125,.12,.12)),fore)
    node(name+'ForearmMesh',(0,-.15,0),sphere('Forearm',skin,(.11,.22,.11)),fore)
    node(name+'WristBand',(0,-.29,0),sphere('Wrist Band',gloves,(.134,.07,.134)),fore)
    hand=node(name+'Hand',(0,-.38,0),parent=fore)
    node(name+'Palm',(0,-.03,-.012),sphere('Palm',skin,(.113,.115,.088)),hand)
    for finger in range(4):
        node(name+'Finger',((finger-1.5)*.045,-.139,-.052),sphere('Finger',skin,(.026,.069,.035)),hand)
    leg=node(name+'UpLeg',(sign*.18,-.06,0),parent=hips)
    node(name+'Thigh',(0,-.24,0),sphere('Pants Thigh',pants,(.18,.34,.205)),leg)
    shin=node(name+'Leg',(0,-.54,0),parent=leg)
    node(name+'Shin',(0,-.25,0),sphere('Pants Shin',pants,(.145,.33,.17)),shin)
    foot=node(name+'Foot',(0,-.52,0),parent=shin)
    node(name+'Shoe',(0,-.035,-.105),sphere('Boot',boots,(.162,.135,.30)),foot)
    node(name+'BootTrim',(0,.06,0),sphere('Boot Trim',gold,(.169,.07,.17)),foot)

name2id={n['name']:i for i,n in enumerate(nodes)}
# Animations strictly time-normalized; no speed-dependent runaway motion.
def make_clip(name,duration,cycles=1.0,kind='idle'):
    clip={'name':name,'samplers':[],'channels':[]}
    count=17 if kind in ('walk','run','flight') else 13
    ts=np.linspace(0,duration,count)
    input_idx=acc(ts,ty='SCALAR')
    def channel(bone,func,axis=(1,0,0)):
        vals=[quat(axis,func(t/duration)) for t in ts]
        output_idx=acc(vals,ty='VEC4')
        k=len(clip['samplers']);clip['samplers'].append({'input':input_idx,'output':output_idx,'interpolation':'LINEAR'})
        clip['channels'].append({'sampler':k,'target':{'node':name2id[bone],'path':'rotation'}})
    wave=lambda t,phase=0:math.sin(t*math.tau*cycles+phase)
    walk=kind in ('walk','run')
    amp={'idle':0.04,'walk':0.42,'run':0.71,'jump':0.05,'flight':0.02,'punch':0.04,'charge':0.04}.get(kind,0.05)
    for s,side in ((-1,'Left'),(1,'Right')):
        channel(side+'UpLeg',lambda t,s=s: (s*amp*wave(t))+(-.17 if kind=='flight' else 0))
        channel(side+'Leg',lambda t,s=s: (max(0,s*wave(t))*0.28 if walk else (-0.24 if kind=='flight' else 0.025*wave(t))),axis=(1,0,0))
        channel(side+'Arm', lambda t,s=s: (
            (-1.15*min(1,max(0,(t-.1)*9))+.56*min(1,max(0,(t-.68)*5))) if kind=='punch' and s==1 else
            (-.55*min(1,t*9)) if kind=='punch' else
            (-1.08*min(1,t*7)) if kind=='charge' else
            (-s*amp*.8*wave(t)) + (-.30 if kind=='flight' else -.05 if kind=='idle' else 0)
        ),axis=(1,0,0))
        channel(side+'ForeArm',lambda t,s=s: (-0.26 if kind=='run' else -0.13 if kind=='walk' else -0.14),axis=(1,0,0))
    channel('Spine',lambda t:(-.18 if kind=='flight' else .045*wave(t,0.3) if walk else .025*wave(t)))
    channel('Head',lambda t:0.02*wave(t),axis=(0,0,1))
    animations.append(clip)
for args in [('Idle',2,1,'idle'),('Walk',0.85,1,'walk'),('Run',0.63,1,'run'),('Jump',0.8,1,'jump'),('Flight',1.5,1,'flight'),('Punch',0.55,1,'punch'),('Charge',0.8,1,'charge')]:make_clip(*args)

scene={'asset':{'version':'2.0','generator':'DragonBallRPG Origens v0.1.6 original rig builder'},'scene':0,'scenes':[{'nodes':[root]}], 'nodes':nodes,'meshes':meshes,'materials':materials, 'animations':animations,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
j=json.dumps(scene,separators=(',',':')).encode('utf8')
while len(j)%4:j+=b' '
while len(binary)%4:binary.append(0)
length=12+8+len(j)+8+len(binary)
OUT.parent.mkdir(parents=True,exist_ok=True)
with OUT.open('wb') as f:
    f.write(struct.pack('<4sII',b'glTF',2,length));f.write(struct.pack('<I4s',len(j),b'JSON'));f.write(j);f.write(struct.pack('<I4s',len(binary),b'BIN\x00'));f.write(binary)
print(f'Generated {OUT} {OUT.stat().st_size/1024:.0f}KB, {len(nodes)} nodes, {len(animations)} animation clips')
