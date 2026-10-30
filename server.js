
const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const crypto=require('crypto');
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(require('express-session')({secret:'kbc-ludo-demo-change-this',resave:false,saveUninitialized:false,cookie:{maxAge:3*24*60*60*1000}}));

const rooms=new Map();
const admins=new Map([['ludokbc@gmail.com','Demo@123']]);
const colors=['red','green','yellow','blue'];
const safe=[0,8,13,21,26,34,39,47];
function roomCode(){return crypto.randomBytes(3).toString('hex').toUpperCase()}
function state(r){return {code:r.code,status:r.status,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,connected:p.connected})),turn:r.turn,started:r.status==='playing'}}

app.use(express.static(path.join(__dirname,'public')));
app.use('/admin',express.static(path.join(__dirname,'admin')));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'admin','index.html')));

app.post('/api/admin/login',(req,res)=>{
 const {email,password}=req.body;
 if(admins.get(email)===password){req.session.admin=true;return res.json({ok:true})}
 res.status(401).json({ok:false,message:'Invalid login'});
});
app.post('/api/admin/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
function auth(req,res,next){if(req.session.admin)return next();res.status(401).json({message:'Unauthorized'})}
app.get('/api/admin/me',auth,(req,res)=>res.json({ok:true}));
app.get('/api/admin/stats',auth,(req,res)=>{
 let players=0; for(const r of rooms.values()) players+=r.players.size;
 res.json({rooms:rooms.size,players,playing:[...rooms.values()].filter(r=>r.status==='playing').length});
});
app.get('/api/admin/rooms',auth,(req,res)=>res.json([...rooms.values()].map(state)));
app.post('/api/admin/kick',auth,(req,res)=>{
 const r=rooms.get(req.body.room), p=r?.players.get(req.body.playerId);
 if(!p)return res.status(404).json({message:'Player not found'});
 io.sockets.sockets.get(p.id)?.disconnect(true); r.players.delete(p.id);
 io.to(r.code).emit('state',state(r)); res.json({ok:true});
});
app.post('/api/admin/reset-room',auth,(req,res)=>{
 const r=rooms.get(req.body.room); if(!r)return res.status(404).json({message:'Room not found'});
 r.status='waiting'; r.turn=0; r.players.forEach(p=>p.tokens=[-1,-1,-1,-1]);
 io.to(r.code).emit('state',state(r)); res.json({ok:true});
});
app.post('/api/admin/close-room',auth,(req,res)=>{
 const r=rooms.get(req.body.room); if(!r)return res.status(404).json({message:'Room not found'});
 io.to(r.code).emit('closed'); rooms.delete(r.code); res.json({ok:true});
});

io.on('connection',socket=>{
 socket.on('create',({name},cb)=>{
  const code=roomCode(), r={code,status:'waiting',players:new Map(),turn:0};
  r.players.set(socket.id,{id:socket.id,name:name||'Player',color:colors[0],connected:true,tokens:[-1,-1,-1,-1]});
  rooms.set(code,r); socket.join(code); cb({ok:true,code}); io.to(code).emit('state',state(r));
 });
 socket.on('join',({code,name},cb)=>{
  const r=rooms.get((code||'').toUpperCase());
  if(!r)return cb({ok:false,message:'Room not found'});
  if(r.players.size>=4)return cb({ok:false,message:'Room is full'});
  const color=colors[r.players.size];
  r.players.set(socket.id,{id:socket.id,name:name||'Player',color,connected:true,tokens:[-1,-1,-1,-1]});
  socket.join(r.code); cb({ok:true,code:r.code}); io.to(r.code).emit('state',state(r));
 });
 socket.on('start',code=>{
  const r=rooms.get(code); if(r&&r.players.size>=2){r.status='playing';r.turn=0;io.to(code).emit('state',state(r));}
 });
 socket.on('roll',code=>{
  const r=rooms.get(code); if(!r||r.status!=='playing')return;
  const arr=[...r.players.values()]; const p=arr[r.turn%arr.length];
  if(p.id!==socket.id)return;
  const dice=1+Math.floor(Math.random()*6);
  let moved=false;
  if(dice===6){let i=p.tokens.findIndex(x=>x<0);if(i>=0){p.tokens[i]=0;moved=true}}
  if(!moved){let i=p.tokens.findIndex(x=>x>=0&&x<57);if(i>=0){p.tokens[i]=Math.min(57,p.tokens[i]+dice);moved=true}}
  if(p.tokens.every(x=>x===57)){r.status='finished';io.to(code).emit('winner',{name:p.name,color:p.color})}
  else if(dice!==6)r.turn=(r.turn+1)%arr.length;
  io.to(code).emit('rollResult',{dice,player:p.name});io.to(code).emit('state',state(r));
 });
 socket.on('disconnect',()=>{
  for(const r of rooms.values())if(r.players.has(socket.id)){r.players.get(socket.id).connected=false;io.to(r.code).emit('state',state(r));}
 });
});
server.listen(process.env.PORT||3000,()=>console.log('KBC LUDO running'));
