// Frame v2 — title row + toolbar + dialogs
(function(){
  const BASE = '/micro-apps-repository';

  // Read config from meta/data attributes
  const title  = document.querySelector('meta[name="app-title"]')?.content || document.title || 'Micro Rehab App';
  const badge  = document.querySelector('meta[name="app-badge"]')?.content || 'Prototype';
  const accentWord = document.querySelector('meta[name="app-accent"]')?.content || ''; // optional
  const actions = (document.querySelector('[data-actions]')?.getAttribute('data-actions') || 'start,csv,difficulty,help')
                    .split(',').map(s=>s.trim()).filter(Boolean);

  // Create title row
  const head = document.createElement('div');
  head.className = 'container';
  head.innerHTML = `
    <div class="page-head">
      <a class="badge" href="${BASE}/">Catalogue</a>
      <span class="badge">${badge}</span>
      <h1 class="h1">
        ${title.replace(accentWord, `<span class="accent">${accentWord}</span>`)}
      </h1>
      <div class="toolbar" id="toolbar"></div>
    </div>`;
  document.body.prepend(head);

  // Build buttons
  const toolbar = head.querySelector('#toolbar');
  const BTN = (label, cls, id) => {
    const b = document.createElement('button');
    b.className = `btn pill ${cls||''}`.trim();
    b.id = id; b.type='button'; b.textContent = label;
    toolbar.appendChild(b); return b;
  };

  const buttons = {};
  actions.forEach(a=>{
    if(a==='start')      buttons.start = BTN('Start new round','primary','btn-start');
    if(a==='csv')        buttons.csv = BTN('Download CSV','ghost','btn-csv');
    if(a==='difficulty') buttons.diff = BTN('Difficulty','ghost','btn-diff');
    if(a==='help')       buttons.help = BTN('How to play','ghost','btn-help');
  });

  // Help dialog (simple)
  const help = document.createElement('div');
  help.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px';
  help.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>
    <div class="card" style="position:relative;z-index:1;max-width:720px;width:min(96vw,720px)">
      <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong>How to play</strong>
        <button class="btn pill" id="help-close">Close</button>
      </header>
      <div id="help-content">
        <p>Shortcuts: <span class="kbd">Alt+S</span> save CSV, <span class="kbd">Alt+R</span> reset.</p>
      </div>
    </div>`;
  document.body.appendChild(help);
  const openHelp = (html) => { if(html) help.querySelector('#help-content').innerHTML = html; help.style.display='flex'; };
  const closeHelp = ()=> help.style.display='none';
  help.addEventListener('click', e=>{ if(e.target===help || e.target.id==='help-close') closeHelp(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeHelp(); });

  // Difficulty popover (very light)
  const diff = document.createElement('div');
  diff.style.cssText = 'position:absolute;inset:auto;display:none';
  document.body.appendChild(diff);
  const openDiff = (anchor)=>{
    diff.className='card';
    diff.style.display='block';
    const r = anchor.getBoundingClientRect();
    diff.style.top = (window.scrollY + r.bottom + 8)+'px';
    diff.style.left = (window.scrollX + r.left)+'px';
    diff.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><strong>Difficulty</strong>
        <span class="muted" style="color:var(--muted);font-size:13px">(Alt + 1/2/3)</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn pill" data-level="easy">Easy</button>
        <button class="btn pill" data-level="med">Medium</button>
        <button class="btn pill" data-level="hard">Hard</button>
      </div>`;
  };
  const closeDiff = ()=> diff.style.display='none';

  // Wire default behaviours + events apps can listen to
  if(buttons.help) buttons.help.addEventListener('click', ()=> openHelp());
  if(buttons.diff){
    buttons.diff.addEventListener('click', (e)=>{ diff.style.display==='block' ? closeDiff() : openDiff(e.currentTarget); });
    diff.addEventListener('click', e=>{
      const lv = e.target.getAttribute('data-level'); if(!lv) return;
      window.dispatchEvent(new CustomEvent('app:set-difficulty',{detail:{level:lv}}));
      closeDiff();
    });
    document.addEventListener('keydown', e=>{
      if(e.altKey && ['1','2','3'].includes(e.key)){
        const map = {1:'easy',2:'med',3:'hard'};
        window.dispatchEvent(new CustomEvent('app:set-difficulty',{detail:{level:map[e.key]}}));
      }
    });
  }
  if(buttons.csv) buttons.csv.addEventListener('click', ()=> window.dispatchEvent(new CustomEvent('app:download-csv')));
  if(buttons.start) buttons.start.addEventListener('click', ()=> window.dispatchEvent(new CustomEvent('app:start-round')));
  document.addEventListener('keydown', e=>{ if(e.altKey && (e.key==='s'||e.key==='S')) window.dispatchEvent(new CustomEvent('app:download-csv')); });
  document.addEventListener('keydown', e=>{ if(e.altKey && (e.key==='r'||e.key==='R')) window.dispatchEvent(new CustomEvent('app:reset')); });

  // Public API for apps
  window.AppFrame = {
    setHelp(html){ openHelp(html); },   // or just open with custom content
    setTitle(t){ /* update big title if you like */ },
  };
})();
