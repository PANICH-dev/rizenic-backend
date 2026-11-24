// Shared object rendering for both vehicle inspection diagrams.
window.DiagramObjects = {
 size(item) { return Math.max(12, Math.min(160, Number(item.size) || (item.type === 'O' ? 36 : item.type === 'X' ? 28 : 48))); },
 bounds(ctx,item) {
  const size=this.size(item); if(item.type==='O'||item.type==='X')return {x:item.x-size/2,y:item.y-size/2,w:size,h:size};
  ctx.save();ctx.font=size+'px Prompt, sans-serif';const width=ctx.measureText(item.text||'').width;ctx.restore();return {x:item.x,y:item.y-size,w:width,h:size*1.2};
 },
 hit(ctx,items,x,y) { for(let i=items.length-1;i>=0;i--){const b=this.bounds(ctx,items[i]);if(x>=b.x-8&&x<=b.x+b.w+8&&y>=b.y-8&&y<=b.y+b.h+8)return i;}return -1; },
 paint(ctx,items,selected=-1) {
  ctx.save();ctx.lineJoin='round';
  items.forEach((item,index)=>{
   const size=this.size(item);ctx.lineWidth=4;ctx.strokeStyle=item.type==='O'?'#15803d':'#b91c1c';ctx.fillStyle='#b91c1c';ctx.beginPath();
   if(item.type==='O'){ctx.arc(item.x,item.y,size/2,0,Math.PI*2);ctx.stroke();}
   else if(item.type==='X'){const r=size/2;ctx.moveTo(item.x-r,item.y-r);ctx.lineTo(item.x+r,item.y+r);ctx.moveTo(item.x+r,item.y-r);ctx.lineTo(item.x-r,item.y+r);ctx.stroke();}
   else {ctx.font=size+'px Prompt, sans-serif';ctx.strokeStyle='white';ctx.strokeText(item.text||'',item.x,item.y);ctx.fillText(item.text||'',item.x,item.y);}
   if(index===selected){const b=this.bounds(ctx,item);ctx.save();ctx.setLineDash([5,4]);ctx.lineWidth=1;ctx.strokeStyle='#2563eb';ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);ctx.restore();}
  });ctx.restore();
 },
 label(item,index) { return (index+1)+'. '+(item.type==='O'?'วงกลม':item.type==='X'?'กากบาท':item.text||'ข้อความ'); }
};
