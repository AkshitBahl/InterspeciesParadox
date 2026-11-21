/**
 * Original, dependency-free isometric city illustration / tiny traversal simulation.
 * The intro intentionally has NO access to profiles, mediation scores or persistence.
 */

export const START_X = -10.7;
export const ENCOUNTER_X = 5.35;
export const WALK_SPEED = 4.3;
export const WALKABLE_Z_MIN = -1.04;
export const WALKABLE_Z_MAX = 1.02;

export type Direction = "left" | "right" | "up" | "down" | null;

export interface WalkerPosition { x: number; z: number }

export function advanceWalker(
  position: WalkerPosition,
  delta: number,
  horizontal: number,
  vertical: number,
): WalkerPosition {
  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const distance = Math.min(Math.max(delta, 0), 0.05) * WALK_SPEED;
  return {
    x: clamp(position.x + (horizontal / magnitude) * distance, START_X, ENCOUNTER_X - 0.15),
    z: clamp(position.z + (vertical / magnitude) * distance, WALKABLE_Z_MIN, WALKABLE_Z_MAX),
  };
}

export function reachedEncounter(position: WalkerPosition): boolean {
  return position.x >= ENCOUNTER_X - 0.31;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

type Context = CanvasRenderingContext2D;

function fillCircle(c: Context, x: number, y: number, r: number, color: string): void {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); c.fillStyle = color; c.fill();
}

function polygon(c: Context, points: Array<[number,number]>, color: string): void {
  if (!points.length) return;
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.closePath(); c.fillStyle = color; c.fill();
}

function stroke(c: Context, x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

function rect(c: Context, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color; c.fillRect(x, y, w, h);
}

function roundRect(c: Context, x: number, y: number, w: number, h: number, r: number, color: string): void {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = color; c.fill();
}

function gradient(c: Context, x1: number, y1: number, x2: number, y2: number, stops: Array<[number,string]>): CanvasGradient {
  const g = c.createLinearGradient(x1,y1,x2,y2);
  for(const [at,color] of stops) g.addColorStop(at,color);
  return g;
}

export interface SceneFrame {
  width: number;
  height: number;
  time: number;
  cameraX: number;
  player: WalkerPosition;
  walking: boolean;
  encounter: boolean;
  reducedMotion: boolean;
}

export function drawCity(c: Context, s: SceneFrame): void {
  const { width:w, height:h, cameraX, player } = s;
  const unit = clamp(w / 1220, 0.77, 1.32);
  const horizon = h * (h < 690 ? .57 : .55);
  const groundY = h * (h < 690 ? .80 : .76);
  const time = s.reducedMotion ? 0 : s.time;
  const screenX = (worldX: number) => w * .65 + (worldX - cameraX) * 91 * unit;
  const walkY = (z: number) => groundY + z * 30 * unit;

  // Deep twilight sky and botanical glow.
  c.fillStyle = gradient(c,0,0,0,h,[[0,"#071d20"],[.37,"#18453c"],[.64,"#699078"],[1,"#142d26"]]);
  c.fillRect(0,0,w,h);
  const sunX = w * .75 - cameraX * 3.7;
  const sunY = h*.235;
  const glow = c.createRadialGradient(sunX,sunY,5,sunX,sunY,Math.min(w,h)*.47);
  glow.addColorStop(0,"rgba(250,240,179,.35)"); glow.addColorStop(.45,"rgba(204,232,160,.12)"); glow.addColorStop(1,"rgba(177,208,160,0)");
  c.fillStyle = glow; c.fillRect(0,0,w,h);
  fillCircle(c,sunX,sunY,Math.min(57*unit,58),"#e7ebbb");
  fillCircle(c,sunX,sunY,Math.min(48*unit,48),"#f5efcb");

  // Hills layer with deterministic, softly rolling silhouettes.
  for(let layer=0; layer<3; layer++) {
    c.beginPath(); c.moveTo(0,h);
    for(let x=0; x<=w+30; x+=18) {
      const y = horizon - 95 + layer*48 + Math.sin((x+cameraX*13)/(125+layer*68))*(31+layer*9)
        + Math.sin((x+33)/(60+layer*23))*12;
      c.lineTo(x,y);
    }
    c.lineTo(w,h); c.closePath();
    c.fillStyle = ["#315b50","#214f43","#143a33"][layer]; c.fill();
  }

  // Far-future towers and their living rooflines. Parallax is intentionally subtle.
  for(let i=-7;i<24;i++) {
    const x = screenX(i*2.7-5)*.43 + w*.27;
    const bh = (54 + ((i*37+930)%7)*25)*unit;
    const bw = (35+((i*13+1000)%5)*13)*unit;
    rect(c,x,horizon+40-bh,bw,bh,"#173d38");
    rect(c,x+bw*.14,horizon+28-bh,bw*.1,10*unit,"#598770");
    for(let n=0;n<5;n++) {
      const wx = x+8*unit+(n%3)*9*unit;
      const wy = horizon+25-bh+(n*17*unit);
      if(wy < horizon+33 && wx<x+bw-3) rect(c,wx,wy,3*unit,7*unit,"rgba(207,232,165,.23)");
    }
  }

  // Distant hanging greenhouses / green-bridge line.
  stroke(c,0,horizon+62,w,horizon+62,"#638d72",5*unit);
  stroke(c,0,horizon+65,w,horizon+65,"rgba(9,43,34,.55)",8*unit);
  for(let x=20;x<w+50;x+=58*unit) {
    stroke(c,x,horizon+60,x+12*unit,horizon+83,"rgba(16,55,42,.8)",5*unit);
    fillCircle(c,x+4*unit,horizon+78,8*unit,"#3f8664");
  }

  // Street bed: foreground isometric paving, safe walkable route, distant verge.
  polygon(c,[[0,groundY-69*unit],[w,groundY-69*unit],[w,h],[0,h]],"#183b32");
  polygon(c,[[0,groundY-71*unit],[w,groundY-71*unit],[w,groundY-33*unit],[0,groundY-33*unit]],"#66896d");
  polygon(c,[[0,groundY-37*unit],[w,groundY-37*unit],[w,groundY+89*unit],[0,groundY+89*unit]],"#b3bba1");
  polygon(c,[[0,groundY+75*unit],[w,groundY+75*unit],[w,groundY+113*unit],[0,groundY+113*unit]],"#78907b");
  polygon(c,[[0,groundY+114*unit],[w,groundY+114*unit],[w,h],[0,h]],"#14392f");
  for(let i=-24; i<38;i++) {
    const x = screenX(i*.79);
    if(x<-100 || x>w+100) continue;
    stroke(c,x,groundY-37*unit,x-30*unit,groundY+74*unit,"rgba(57,87,66,.18)",1.3);
    if(i%3===0) stroke(c,x,groundY+74*unit,x-8*unit,groundY+105*unit,"rgba(239,245,212,.11)",1);
  }
  stroke(c,0,groundY-37*unit,w,groundY-37*unit,"rgba(250,248,211,.4)",2);
  stroke(c,0,groundY+75*unit,w,groundY+75*unit,"rgba(246,239,204,.24)",2);

  // Far-side apartment complexes and botanical infrastructure.
  const buildings = [
    {x:-12.4,ww:2.2,hh:205,shade:0},
    {x:-7.2,ww:2.5,hh:260,shade:1},
    {x:-1.8,ww:3.0,hh:196,shade:2},
    {x:5.4,ww:3.0,hh:308,shade:0},
    {x:11.7,ww:2.6,hh:236,shade:1},
    {x:18.5,ww:3.0,hh:300,shade:2},
  ];
  for (const b of buildings) {
    const cx=screenX(b.x), ww=b.ww*87*unit;
    if(cx+ww<-120 || cx-ww>w+180) continue;
    drawBuilding(c,cx,groundY-69*unit,ww,b.hh*unit,b.shade,unit,time);
  }

  // Garden planters, trees and street furniture.
  for(let i=-10;i<17;i++) {
    const wx=i*2.17+.7;
    const px=screenX(wx);
    if(px<-80||px>w+80)continue;
    if(i%2===0) drawTree(c,px,groundY-70*unit,unit*(.84+(i%3)*.08),time+i*.41);
    else drawPlanter(c,px,groundY-68*unit,unit,time+i*.6);
  }

  // Luminous route guidance is a visual hint, not real-world navigation.
  for(let i=-15;i<8;i++) {
    const px=screenX(i*.85);
    if(px<0||px>w)continue;
    const pulse=.55+.45*Math.sin(time*2.1-i*.61);
    fillCircle(c,px,groundY+34*unit,3.0*unit,`rgba(233,242,181,${pulse*.47})`);
    if(i%3===0) stroke(c,px-12*unit,groundY+35*unit,px+10*unit,groundY+35*unit,"rgba(233,242,181,.24)",1);
  }

  // In the near view the entrance becomes visible; bird + nest sit beside it.
  const gateX=screenX(ENCOUNTER_X+1.2);
  if(gateX>-170 && gateX<w+200) {
    drawGate(c,gateX,groundY-70*unit,unit);
    drawRobin(c,gateX-88*unit,groundY-160*unit,unit,time,s.encounter);
  }

  // Near-side leaves / flowers supply depth without covering walking controls.
  for(let i=-9;i<20;i++) {
    const px=screenX(i*1.57-.8);
    if(px<-60||px>w+60)continue;
    drawShrub(c,px,groundY+123*unit,unit*(.7+(i%4)*.11),time+i*.8);
  }

  // A gentle pool of light tracks the player.
  const playerSX=screenX(player.x), playerSY=walkY(player.z);
  const playerGlow=c.createRadialGradient(playerSX,playerSY-8,2,playerSX,playerSY-8,80*unit);
  playerGlow.addColorStop(0,"rgba(237,244,177,.16)"); playerGlow.addColorStop(1,"rgba(237,244,177,0)");
  c.fillStyle=playerGlow; c.beginPath(); c.ellipse(playerSX,playerSY-8,90*unit,38*unit,0,0,Math.PI*2);c.fill();
  drawHuman(c,playerSX,playerSY,unit*1.02,time,s.walking);

  // Atmospheric pollen and drifting city lights.
  for(let i=0;i<32;i++) {
    const seed=i*47.31;
    const x=((seed*31+time*(5+(i%4))*unit)%(w+80)+w+80)%(w+80);
    const y=h*.15+((seed*17)%Math.max(100,h*.64))+(s.reducedMotion?0:Math.sin(time+i)*8);
    const radius=(.65+(i%3)*.6)*unit;
    fillCircle(c,x,y,radius,`rgba(224,244,179,${.11+(i%4)*.08})`);
  }

  // Filmic vignette and subtle grain-like scanlines.
  const vignette=c.createRadialGradient(w*.58,h*.52,h*.12,w*.58,h*.52,Math.max(w,h)*.77);
  vignette.addColorStop(0,"rgba(3,15,16,0)");vignette.addColorStop(1,"rgba(4,18,17,.56)");
  c.fillStyle=vignette;c.fillRect(0,0,w,h);
}

function drawBuilding(c:Context,x:number,base:number,w:number,h:number,shade:number,u:number,t:number):void {
  const side=33*u,roof=19*u;
  const faces=["#496f60","#5d8770","#36594e"];
  const sides=["#284c40","#385e4d","#24483b"];
  polygon(c,[[x,base-h],[x+side,base-h-roof],[x+w+side,base-h-roof],[x+w,base-h]],"#87a38a");
  rect(c,x,base-h,w,h,faces[shade]);
  polygon(c,[[x+w,base-h],[x+w+side,base-h-roof],[x+w+side,base-roof],[x+w,base]],sides[shade]);
  rect(c,x-5*u,base-h+16*u,9*u,h-16*u,"rgba(15,58,48,.28)");
  for(let row=0;row<Math.floor((h-40*u)/(43*u));row++) {
    for(let col=0;col<Math.floor((w-26*u)/(36*u));col++) {
      const xx=x+19*u+col*36*u,yy=base-h+29*u+row*43*u;
      roundRect(c,xx,yy,19*u,27*u,2*u,"#1f5347");
      rect(c,xx+4*u,yy+3*u,11*u,13*u,(row+col+shade)%3===0?"#e5dcac":"#8cae9d");
      stroke(c,xx+10*u,yy+2*u,xx+10*u,yy+24*u,"rgba(27,66,49,.47)",1.2*u);
      rect(c,xx-3*u,yy+24*u,25*u,4*u,"#a5bf97");
      if((row+col)%2===0) {
        stroke(c,xx+18*u,yy+25*u,xx+25*u,yy+34*u,"#295b43",2*u);
        fillCircle(c,xx+24*u,yy+33*u,5*u,"#3d956a");
      }
    }
  }
  // Rooftop growing terraces, animated wind drift.
  rect(c,x,base-h-7*u,w,9*u,"#254e3d");
  for(let col=0;col<Math.floor(w/(23*u));col++) {
    const xx=x+9*u+col*23*u;
    stroke(c,xx,base-h-9*u,xx+Math.sin(t*1.2+col)*2*u,base-h-(19+(col%3)*6)*u,"#294e33",2*u);
    fillCircle(c,xx-3*u,base-h-(23+(col%3)*5)*u,7*u,col%3===0?"#bed19b":"#58966d");
  }
}

function drawPlanter(c:Context,x:number,y:number,u:number,t:number):void {
  polygon(c,[[x-28*u,y-10*u],[x+26*u,y-10*u],[x+17*u,y+12*u],[x-20*u,y+12*u]],"#567564");
  rect(c,x-27*u,y-14*u,54*u,6*u,"#aec2aa");
  for(let i=-2;i<=2;i++) {
    const xx=x+i*9*u;
    stroke(c,xx,y-14*u,xx+Math.sin(t+i)*4*u,y-(36+(i%2)*6)*u,"#3b845b",2*u);
    fillCircle(c,xx+(i%2)*5*u,y-(38+(i%2)*5)*u,8*u,i%2===0?"#85b88b":"#bfd5a0");
  }
}

function drawTree(c:Context,x:number,y:number,u:number,t:number):void {
  stroke(c,x,y,x+5*u,y-121*u,"#2b503d",13*u);
  stroke(c,x+3*u,y-70*u,x-30*u,y-106*u,"#2b503d",6*u);
  const leaves=[[0,-136,43],[-28,-119,34],[29,-115,38],[-11,-165,32],[42,-145,27],[-39,-144,26]];
  for(const [ox,oy,r] of leaves) {
    const xx=x+(ox+Math.sin(t*.7+ox)*2.2)*u,yy=y+oy*u;
    fillCircle(c,xx,yy,r*u,"#2c6950");fillCircle(c,xx-5*u,yy-8*u,r*.72*u,"#5e9570");
  }
  for(let i=0;i<3;i++) fillCircle(c,x+(i*25-22)*u,y-(126+i*11)*u,3*u,"#d7e4a8");
}

function drawGate(c:Context,x:number,base:number,u:number):void {
  // Entry canopy with a nest beside it (scripted conflict illustration).
  rect(c,x-43*u,base-114*u,129*u,114*u,"#21483d");
  polygon(c,[[x-52*u,base-114*u],[x+89*u,base-114*u],[x+101*u,base-129*u],[x-37*u,base-129*u]],"#98b48d");
  rect(c,x-15*u,base-100*u,71*u,100*u,"#0a2a29");
  rect(c,x-12*u,base-96*u,64*u,90*u,"#295e55");
  rect(c,x-12*u,base-96*u,31*u,90*u,"rgba(182,216,174,.18)");
  fillCircle(c,x+42*u,base-50*u,3*u,"#e3e4ba");
  stroke(c,x-72*u,base-64*u,x-30*u,base-64*u,"#315344",11*u);
  stroke(c,x-58*u,base-63*u,x-58*u,base-94*u,"#365a41",5*u);
  for(let i=0;i<7;i++) stroke(c,x-(89-i*8)*u,base-(94+(i%3)*5)*u,x-(80-i*8)*u,base-(101+(i%4)*5)*u,"#b9aa73",3*u);
  fillCircle(c,x-62*u,base-102*u,15*u,"#6f7850");
  fillCircle(c,x-62*u,base-106*u,9*u,"#b6b082");
  // Seedling grows from upper balcony.
  rect(c,x-40*u,base-123*u,125*u,7*u,"#a5be91");
  for(let i=0;i<7;i++) fillCircle(c,x-31*u+i*17*u,base-(132+(i%2)*9)*u,12*u,"#488b63");
}

function drawRobin(c:Context,x:number,y:number,u:number,t:number,alert:boolean):void {
  // A stylized robin mascot drawn from shapes, no external artwork.
  const flap=Math.sin(t*8)*5*u;
  c.save(); c.translate(x,y+(alert?Math.sin(t*6)*2*u:0));
  fillCircle(c,0,4*u,17*u,"rgba(24,50,38,.18)");
  polygon(c,[[7*u,9*u],[33*u,2*u],[18*u,20*u]],"#654f3d");
  fillCircle(c,0,0,21*u,"#6d6252");
  fillCircle(c,-5*u,2*u,15*u,"#d87b4d");
  polygon(c,[[-5*u,-8*u],[22*u,(-20+flap)*u],[17*u,5*u]],"#8c785f");
  fillCircle(c,-8*u,-13*u,14*u,"#706454");
  fillCircle(c,-12*u,-16*u,3*u,"#152e25");
  fillCircle(c,-13*u,-17*u,1.2*u,"#ffffff");
  polygon(c,[[-23*u,-12*u],[-35*u,-7*u],[-23*u,-4*u]],"#e8c47c");
  stroke(c,0,17*u,-3*u,31*u,"#796745",2*u);
  stroke(c,10*u,17*u,9*u,31*u,"#796745",2*u);
  if(alert) {
    fillCircle(c,-33*u,-36*u,3*u,"#edeead");
    fillCircle(c,-46*u,-45*u,2*u,"#edeead");
  }
  c.restore();
}

function drawHuman(c:Context,x:number,y:number,u:number,t:number,walking:boolean):void {
  const stride=walking?Math.sin(t*11)*9*u:0;
  c.save(); c.translate(x,y);
  c.beginPath(); c.ellipse(0,3*u,23*u,7*u,0,0,Math.PI*2); c.fillStyle="rgba(8,32,26,.38)"; c.fill();
  // Legs and walking shoes.
  stroke(c,-7*u,-32*u,-9*u+stride,-8*u,"#183e37",11*u);
  stroke(c,6*u,-32*u,7*u-stride,-8*u,"#17362f",11*u);
  roundRect(c,-20*u+stride,-7*u,19*u,8*u,4*u,"#dbe3c4");
  roundRect(c,1*u-stride,-7*u,19*u,8*u,4*u,"#dbe3c4");
  // Coat, arms, backpack.
  roundRect(c,-21*u,-90*u,43*u,60*u,12*u,"#d1ddba");
  polygon(c,[[-10*u,-90*u],[17*u,-90*u],[21*u,-34*u],[-12*u,-34*u]],"#d2d1ab");
  roundRect(c,13*u,-78*u,17*u,39*u,7*u,"#7c9f86");
  stroke(c,-17*u,-76*u,-23*u,-51*u+(walking?stride*.25:0),"#d2c7a2",10*u);
  stroke(c,16*u,-74*u,20*u,-50*u-(walking?stride*.25:0),"#d2c7a2",10*u);
  // Neck, head and simple face.
  rect(c,-5*u,-101*u,12*u,13*u,"#b78361");
  fillCircle(c,1*u,-117*u,22*u,"#c99573");
  polygon(c,[[-20*u,-114*u],[-22*u,-131*u],[-5*u,-143*u],[14*u,-139*u],[20*u,-128*u],[8*u,-135*u],[-6*u,-131*u]],"#243c32");
  fillCircle(c,16*u,-115*u,2*u,"#1c362d");
  // Bright, distinct scarf is visible at any viewport width.
  polygon(c,[[-15*u,-94*u],[11*u,-91*u],[16*u,-85*u],[-18*u,-84*u]],"#d7a15d");
  polygon(c,[[8*u,-85*u],[18*u,-82*u],[15*u,-63*u],[9*u,-67*u]],"#e3b477");
  c.restore();
}

function drawShrub(c:Context,x:number,y:number,u:number,t:number):void {
  const lean=Math.sin(t*.45)*2*u;
  stroke(c,x,y,x+lean,y-24*u,"#2c6b49",3*u);
  fillCircle(c,x-18*u+lean,y-18*u,20*u,"#225b45");
  fillCircle(c,x+11*u+lean,y-22*u,21*u,"#337a54");
  fillCircle(c,x+lean,y-36*u,18*u,"#4f9464");
  if(Math.round(x/u)%3===0) fillCircle(c,x+12*u,y-40*u,3*u,"#e0c790");
}
