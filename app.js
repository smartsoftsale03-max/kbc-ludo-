const s=io();let roomCode='';
const $=id=>document.getElementById(id);
function name(){return $('name').value.trim()||'Player'}
function create(){s.emit('create',{name:name()},r=>{if(r.ok)enter(r.code);else $('msg').textContent=r.message})}
function join(){s.emit('join',{code:$('code').value.trim(),name:name()},r=>{if(r.ok)enter(r.code);else $('msg').textContent=r.message})}
function enter(c){roomCode=c;$('room').textContent=c;$('lobby').classList.add('hidden');$('game').classList.remove('hidden')}
function start(){s.emit('start',roomCode)}
function roll(){s.emit('roll',roomCode)}
s.on('state',r=>{$('players').textContent=r.players.map(p=>`${p.name} (${p.color})`).join(' • ');$('turn').textContent=r.status==='playing'?`Turn: ${r.players[r.turn]?.name||''}`:`Status: ${r.status}`})
s.on('rollResult',r=>{$('dice').textContent=' Dice: '+r.dice})
s.on('winner',r=>alert('🏆 Winner: '+r.name))
s.on('closed',()=>{alert('Room closed by admin');location.reload()})