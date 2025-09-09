// Static GitHub Pages version (no backend).
// Uses AllOrigins to fetch RSS (CORS-friendly). No API keys.

const statusEl = document.getElementById("status");
const quizEl = document.getElementById("quiz");
const resultsEl = document.getElementById("results");
const topicSel = document.getElementById("topic");
const loadBtn = document.getElementById("loadBtn");

// ---- Public RSS feeds ----
const FEEDS = [
  { name: "BBC London", url: "https://feeds.bbci.co.uk/news/england/london/rss.xml" },
  { name: "BBC UK", url: "https://feeds.bbci.co.uk/news/uk/rss.xml" },
  { name: "Evening Standard", url: "https://www.standard.co.uk/news/rss" },
  { name: "TfL News", url: "https://tfl.gov.uk/info-for/media/press-releases/rss" },
  { name: "Met Police News", url: "https://news.met.police.uk/rss/news" },
  { name: "London.gov.uk News", url: "https://www.london.gov.uk/feeds/news.xml" },
  { name: "Kent Live", url: "https://www.kentlive.news/news/?service=rss" },
  { name: "Surrey Live", url: "https://www.getsurrey.co.uk/news/?service=rss" },
  { name: "Sussex World", url: "https://www.sussexexpress.co.uk/rss" },
  { name: "Essex Live", url: "https://www.essexlive.news/news/?service=rss" },
  { name: "Hampshire Live", url: "https://www.hampshirelive.news/news/?service=rss" },
  { name: "Oxford Mail", url: "https://www.oxfordmail.co.uk/news/rss/" },
  { name: "Berkshire Live", url: "https://www.getreading.co.uk/news/?service=rss" },
  { name: "Bucks Free Press", url: "https://www.bucksfreepress.co.uk/news/rss/" }
];

// ---- Keywords for filtering ----
const REGION_TERMS = [
  "Westminster","Camden","Islington","Hackney","Tower Hamlets","Southwark","Lambeth","Wandsworth",
  "Hammersmith","Kensington","Chelsea","Hillingdon","Hounslow","Ealing","Brent","Harrow","Barnet",
  "Enfield","Waltham Forest","Redbridge","Newham","Barking","Dagenham","Havering","Bexley","Greenwich",
  "Lewisham","Bromley","Croydon","Sutton","Merton","Kingston","Richmond","Haringey","City of London",
  "Kent","Surrey","East Sussex","West Sussex","Essex","Berkshire","Buckinghamshire","Hampshire","Oxfordshire",
  "TfL","Transport for London","Met Police","GLA","City Hall","Heathrow","Gatwick","Stansted","Luton","Thameslink",
  "Southeastern","Southern","South Western Railway","Elizabeth line","Jubilee line","Northern line","DLR","Overground",
  "ULEZ","Congestion Charge","Barts","UCLH","Guy’s","St Thomas’","King’s College Hospital","M25","A3","A2","A23","A12"
];

const TOPIC_TERMS = {
  transport: ["tube","rail","train","bus","tfl","overground","dlr","station","road","m25","heathrow","gatwick","ulez","strike","delay","closure","fares","elizabeth line"],
  health: ["nhs","hospital","gp","clinic","ambulance","trust","covid","flu","waiting list","uclh","barts","st thomas"],
  crime: ["police","court","arrest","charged","investigation","murder","stabbing","robbery","met police","appeal"],
  politics: ["mayor","council","city hall","gla","election","policy","budget","consultation","planning","housing","parliament"],
  business: ["startup","tech","finance","city","bank","retail","shop","market","investment","jobs"],
  culture: ["museum","gallery","theatre","concert","festival","football","premier league","west end","film","exhibition","sport"],
  environment: ["weather","storm","flood","heatwave","environment","parks","air quality","river thames","green"]
};

// ---- Utilities ----
let globalItems = [];
let questions = [];
let userAnswers = new Map();

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pickN(arr, n){ const c=[...arr]; shuffle(c); return c.slice(0,n); }
function distinct(arr){ return [...new Map(arr.map(x=>[x,true])).keys()]; }
function includesAny(text, terms){ const t=(text||"").toLowerCase(); return terms.some(w=>t.includes(w.toLowerCase())); }

function cacheGet(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const {exp,data} = JSON.parse(raw);
    if(Date.now()>exp) { localStorage.removeItem(key); return null; }
    return data;
  }catch(_){ return null; }
}
function cacheSet(key,data,ms){ try{ localStorage.setItem(key, JSON.stringify({exp:Date.now()+ms,data})); }catch(_){} }

// ---- Fetch feeds through AllOrigins ----
async function fetchFeed(feed){
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
  const res = await fetch(proxied);
  if(!res.ok) throw new Error(`Fetch failed: ${feed.name}`);
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, "application/xml");

  const items = [...xml.querySelectorAll("item")].map(item => ({
    source: feed.name,
    title: (item.querySelector("title")?.textContent || "").trim(),
    link: (item.querySelector("link")?.textContent || "").trim(),
    isoDate: (item.querySelector("pubDate")?.textContent || "").trim(),
    snippet: (item.querySelector("description")?.textContent || "")
      .replace(/<[^>]+>/g," ")
      .replace(/\s+/g," ")
      .trim()
  }));
  return items;
}

async function loadAllFeeds(){
  const cacheKey = "lnq_feedcache_v1";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const lists = await Promise.allSettled(FEEDS.map(fetchFeed));
  const all = lists.flatMap(r => r.status==="fulfilled"? r.value: []);
  const seen = new Set();
  const dedup = [];
  for (const it of all){
    const sig = `${it.link}|${it.title}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    dedup.push(it);
  }
  dedup.sort((a,b)=> new Date(b.isoDate||0) - new Date(a.isoDate||0));
  cacheSet(cacheKey, dedup, 6*60*60*1000); // 6h
  return dedup;
}

async function fetchNews(topic){
  statusEl.classList.remove("hidden");
  statusEl.textContent = "Loading latest RSS items…";
  resultsEl.classList.add("hidden");
  quizEl.classList.add("hidden");
  userAnswers.clear();

  const items = await loadAllFeeds();
  const regional = items.filter(it =>
    includesAny(`${it.title} ${it.snippet} ${it.source}`, REGION_TERMS)
  );

  let filtered = regional;
  const t = topic.toLowerCase();
  if (t !== "all" && TOPIC_TERMS[t]){
    filtered = regional.filter(it => includesAny(`${it.title} ${it.snippet}`, TOPIC_TERMS[t]));
  }

  globalItems = filtered.slice(0, 120);
  statusEl.textContent = `Loaded ${globalItems.length} ${t.toUpperCase()} items. Building quiz…`;
}

// ---- Question builders ----
function makeMCQ(questionText, correct, distractors, meta){
  const pool = distractors.filter(d => d && d !== correct);
  const opts = shuffle([correct, ...pickN(pool, 3)]).slice(0,4);
  return { type:"mcq", questionText, options: opts, correct, meta };
}

function makeRealVsFake(realHeadline, source, link){
  const templates = [
    "Mayor announces surprise {X} trial across {Y}",
    "{Y} council to introduce overnight {X} charges",
    "{X} disruption hits commuters after unexpected inspection",
    "Plan to expand {X} in central {Y} leaked"
  ];
  const X = ["ULEZ","bus","rail","parking","congestion","roadworks","ticket"];
  const Y = ["London","Kent","Surrey","Sussex","Essex","Berkshire","Buckinghamshire","Hampshire","Oxfordshire"];
  const decoys = templates.map(t => t.replace("{X}", X[Math.floor(Math.random()*X.length)])
                                   .replace("{Y}", Y[Math.floor(Math.random()*Y.length)]));
  const options = shuffle([realHeadline, ...pickN(decoys,3)]);
  return { type:"realfake", questionText: "Which of these is a real headline?", options, correct: realHeadline, meta: { source, link } };
}

function buildQuestions(items){
  const pool = items.slice(0,80);
  const qs = [];

  for (const it of pickN(pool, 5)){
    if (!it.title) continue;
    qs.push(makeRealVsFake(it.title, it.source, it.link));
  }

  const sources = distinct(pool.map(it => it.source));
  const places = ["London","Westminster","Camden","Islington","Hackney","Kent","Surrey","Sussex","Essex","Berkshire","Hampshire","Oxford"];
  const timeOpts = ["Today","Yesterday","In the last 3 days","In the last week","In the last month"];

  for (const it of pickN(pool, 40)){
    if (qs.length >= 20) break;
    const typePick = Math.random();

    if (typePick < 0.33 && it.title){
      const words = it.title.split(" ");
      if (words.length > 4){
        const idx = Math.max(1, Math.min(words.length-2, Math.floor(Math.random()*words.length)));
        const answer = words[idx].replace(/[^\w-]/g,"");
        const blanked = words.map((w,i)=> i===idx ? "____" : w).join(" ");
        const distractors = distinct(pickN(pool, 12).map(x => (x.title.split(" ")[1]||"").replace(/[^\w-]/g,""))).filter(Boolean);
        if (answer && distractors.length >= 3){
          qs.push(makeMCQ(`Fill the missing word in this real headline:\n“${blanked}”`, answer, distractors, { source: it.source, link: it.link }));
          continue;
        }
      }
    } else if (typePick < 0.66){
      const correct = it.source;
      const distract = sources.filter(s => s !== correct);
      if (distract.length >= 3){
        qs.push(makeMCQ(`Which outlet published: “${it.title}”?`, correct, distract, { link: it.link }));
        continue;
      }
    } else {
      const pub = new Date(it.isoDate || Date.now());
      const now = new Date();
      const diffDays = Math.floor((now - pub)/(1000*60*60*24));
      let correct;
      if (diffDays <= 0) correct = "Today";
      else if (diffDays === 1) correct = "Yesterday";
      else if (diffDays <= 3) correct = "In the last 3 days";
      else if (diffDays <= 7) correct = "In the last week";
      else correct = "In the last month";
      qs.push(makeMCQ(`Roughly when was this published? “${it.title}”`, correct, timeOpts.filter(t=>t!==correct), { source: it.source, link: it.link }));
      continue;
    }
    const correctPlace = places.find(p => (`${it.title} ${it.snippet}`).toLowerCase().includes(p.toLowerCase())) || "London";
    qs.push(makeMCQ(`Where is this most closely associated? “${it.title}”`, correctPlace, places.filter(p=>p!==correctPlace), { source: it.source, link: it.link }));
  }
  return qs.slice(0,20);
}

// ---- Render & answer handling ----
function renderQuiz(){
  quizEl.innerHTML = "";
  resultsEl.classList.add("hidden");
  quizEl.classList.remove("hidden");

  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const h = document.createElement("h3");
    h.textContent = `Q${idx+1}. ${q.questionText}`;
    card.appendChild(h);

    const opts = document.createElement("div");
    opts.className = "options";
    q.options.forEach(opt => {
      const b = document.createElement("button");
      b.className = "opt";
      b.textContent = opt;
      b.onclick = () => selectAnswer(idx, opt, b, opts);
      opts.appendChild(b);
    });
    card.appendChild(opts);

    if (q.meta){
      const m = document.createElement("div");
      m.className = "meta";
      if (q.meta.source) {
        const s = document.createElement("span");
        s.className = "badge";
        s.textContent = q.meta.source;
        m.appendChild(s);
      }
      if (q.meta.link){
        const a = document.createElement("a");
        a.href = q.meta.link;
        a.target = "_blank";
        a.rel = "noopener";
        a.className = "source-link";
        a.textContent = "Source";
        m.appendChild(a);
      }
      card.appendChild(m);
    }

    quizEl.appendChild(card);
  });

  const finish = document.createElement("button");
  finish.textContent = "Finish & See Score";
  finish.onclick = showResults;
  finish.style.marginTop = "8px";
  quizEl.appendChild(finish);
}

function selectAnswer(qIndex, opt, button, container){
  if (userAnswers.has(qIndex)) return;
  userAnswers.set(qIndex, opt);
  [...container.children].forEach(ch => {
    ch.disabled = true;
    if (ch.textContent === questions[qIndex].correct) ch.classList.add("correct");
    if (ch.textContent === opt && opt !== questions[qIndex].correct) ch.classList.add("incorrect");
  });
}

function showResults(){
  const total = questions.length;
  let correct = 0;
  for (let i=0;i<total;i++){
    if (userAnswers.get(i) === questions[i].correct) correct++;
  }
  resultsEl.innerHTML = "";
  resultsEl.classList.remove("hidden");
  const card = document.createElement("div");
  card.className = "card";
  const p = document.createElement("p");
  p.className = "score";
  p.textContent = `Score: ${correct} / ${total}`;
  card.appendChild(p);

  const review = document.createElement("div");
  review.innerHTML = "<h3>Review</h3>";
  const list = document.createElement("ol");
  for (let i=0;i<total;i++){
    const li = document.createElement("li");
    const ua = userAnswers.get(i);
    const ok = ua === questions[i].correct;
    li.innerHTML = `<div>${questions[i].questionText}</div>
      <div>Your answer: <strong>${ua || "(no answer)"}</strong> — ${ok ? "✅ Correct" : `❌ Correct: <strong>${questions[i].correct}</strong>`}</div>`;
    list.appendChild(li);
  }
  review.appendChild(list);
  card.appendChild(review);
  resultsEl.appendChild(card);
}

// ---- Event ----
loadBtn.addEventListener("click", async ()=>{
  try{
    await fetchNews(topicSel.value);
    questions = buildQuestions(globalItems);
    statusEl.textContent = `Quiz ready: ${questions.length} questions.`;
    renderQuiz();
  }catch(e){
    statusEl.textContent = "Error: " + e.message + " (Some feeds may be temporarily unavailable.)";
  }
});
