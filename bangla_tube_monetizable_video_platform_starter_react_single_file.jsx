import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, LogIn, LogOut, PlusCircle, Play, DollarSign, Settings, ShieldCheck, Search, Bell, ThumbsUp, MessageCircle, Share2, Eye, Wallet, CheckCircle2, Clock, X, Menu, ImagePlus } from "lucide-react";

/**
 * BanglaTube — Single-file React starter app
 * -------------------------------------------------
 * Goals:
 *  - Owners earn via ads + optional premium
 *  - Creators earn via rev share on views (simulated)
 *  - File uploads play instantly using object URLs (no backend yet)
 *  - LocalStorage persistence for demo
 *  - Clean, mobile-first UI with TailwindCSS classes
 *
 * Deploy ideas:
 *  - Replace MockDB with your backend (Firebase/Supabase/S3/Cloudflare R2 + a server)
 *  - Replace <AdSlot/> with real AdSense (display) or Google Ad Manager (rewarded/interstitial)
 *  - Hook payouts to bKash/Nagad/Bank transfer APIs
 *  - Add proper auth (Firebase Auth / NextAuth)
 *
 * NOTE on Ads:
 *  - AdMob is for mobile apps. For the web, use Google AdSense or
 *    Google Ad Manager (which can serve rewarded ads). This starter includes
 *    safe placeholders you can swap with your live tags.
 */

/** ----------------------------- Mock Storage -------------------------------- */
const MockDB = {
  load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  },
  save(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

/** ----------------------------- Types --------------------------------------- */
/** @typedef {{ id:string, owner:string, title:string, description:string, category:string, src:string, thumb?:string, createdAt:number, views:number, likes:number, comments:number, approved:boolean, earnings:number }} Video */
/** @typedef {{ uid:string, name:string, role:"user"|"admin", balance:number, totalEarnings:number }} User */
/** @typedef {{ id:string, uid:string, amount:number, method:string, status:"pending"|"paid"|"rejected", createdAt:number }} Payout */

/** ----------------------------- Utilities ----------------------------------- */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts)/1000)
  if (s<60) return `${s}s ago`;
  const m = Math.floor(s/60); if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h<24) return `${h}h ago`;
  const d = Math.floor(h/24); if (d<30) return `${d}d ago`;
  const mo = Math.floor(d/30); if (mo<12) return `${mo}mo ago`;
  const y = Math.floor(mo/12); return `${y}y ago`;
}

/** ----------------------------- Theme --------------------------------------- */
const Card = ({ className="", children }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-200 bg-white/80 backdrop-blur p-4 ${className}`}>{children}</div>
)
const Pill = ({ children, className="" }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${className}`}>{children}</span>
)
const Button = ({ as:Tag="button", className="", children, ...props }) => (
  <Tag className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 font-semibold border shadow-sm hover:shadow transition active:scale-[.99] ${className}`} {...props}>{children}</Tag>
)
const Input = (props) => <input {...props} className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||""}`} />
const Textarea = (props) => <textarea {...props} className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||""}`} />

/** ----------------------------- Ads ----------------------------------------- */
const AdSlot = ({ id, size="responsive", className="" }) => {
  // Replace this with your real ad tag (AdSense/Ad Manager). Keep dimensions!
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full rounded-xl border-2 border-dashed border-gray-300 p-3 text-center text-gray-600 bg-gray-50">
        <div className="text-xs uppercase tracking-wide">Ad Slot</div>
        <div className="text-sm">{id} — {size}</div>
        {/* Example: AdSense tag (uncomment + set your data-ad-client + slot)
        <ins class="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot="YYYYYYYYYY"
          data-ad-format="auto" data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
        */}
      </div>
    </div>
  )
}

const RewardedGate = ({ onUnlock }) => {
  const [watching, setWatching] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => setWatching(true)} className="bg-emerald-600 text-white border-emerald-700"><Play size={16}/> Watch Rewarded Ad</Button>
      <span className="text-sm text-gray-600">Unlock bonus & tip the creator.</span>
      <AnimatePresence>
        {watching && (
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
            <Card className="max-w-md w-full text-center">
              <div className="font-semibold mb-2">Rewarded Ad Playing… (demo)</div>
              <p className="text-sm text-gray-600">Replace with real rewarded interstitial from Google Ad Manager.</p>
              <div className="h-40 my-4"><AdSlot id="rewarded-video" size="300x250" className="h-full"/></div>
              <Button onClick={() => { setWatching(false); onUnlock?.(); }} className="bg-indigo-600 text-white border-indigo-700 w-full"><CheckCircle2 size={16}/> Done</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** ----------------------------- App ----------------------------------------- */
export default function BanglaTubeApp() {
  const [videos, setVideos] = useState/** @type {[Video[], any]} */(MockDB.load('bt_videos', []))
  const [users, setUsers] = useState/** @type {[User[], any]} */(MockDB.load('bt_users', []))
  const [payouts, setPayouts] = useState/** @type {[Payout[], any]} */(MockDB.load('bt_payouts', []))
  const [me, setMe] = useState/** @type {[User|null, any]} */(MockDB.load('bt_me', null))
  const [tab, setTab] = useState('home')
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { MockDB.save('bt_videos', videos) }, [videos])
  useEffect(() => { MockDB.save('bt_users', users) }, [users])
  useEffect(() => { MockDB.save('bt_payouts', payouts) }, [payouts])
  useEffect(() => { MockDB.save('bt_me', me) }, [me])

  // Revenue share model (editable by admin in Settings)
  const [settings, setSettings] = useState(MockDB.load('bt_settings', {
    rpmUSD: 1.8, // site revenue per 1000 views in USD (demo)
    creatorShare: 0.6, // 60% share to creators
    minPayout: 5, // USD
    currency: 'USD',
    siteName: 'BanglaTube',
  }))
  useEffect(() => { MockDB.save('bt_settings', settings) }, [settings])

  // Seed an admin on first run
  useEffect(() => {
    if (users.length===0) {
      const admin = { uid: uid(), name: 'Admin', role: 'admin', balance: 0, totalEarnings: 0 }
      setUsers([admin])
      setMe(admin)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return videos.filter(v=>v.approved).sort((a,b)=>b.createdAt-a.createdAt)
    return videos.filter(v => v.approved && (v.title.toLowerCase().includes(term) || v.description.toLowerCase().includes(term) || v.category.toLowerCase().includes(term)))
  }, [q, videos])

  const isAdmin = me?.role === 'admin'

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <Header me={me} onLogin={(u)=>{ setMe(u); if(!users.find(x=>x.uid===u.uid)) setUsers([...users, u]) }} onLogout={()=>setMe(null)} settings={settings} setTab={setTab} tab={tab} q={q} setQ={setQ} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <AdSlot id="top-banner" size="728x90" />
          {tab==="home" && <Feed videos={filtered} onView={(v)=>handleView(v, { me, videos, setVideos, settings, setUsers })} onLike={(v)=>handleLike(v, { me, videos, setVideos })} onComment={(v)=>handleComment(v, { me, videos, setVideos })} me={me} settings={settings} />}
          {tab==="upload" && <UploadCard me={me} onUploaded={(video)=>setVideos([video,...videos])} />}
          {tab==="dashboard" && <CreatorDashboard me={me} myVideos={videos.filter(v=>v.owner===me?.uid)} settings={settings} onRequestPayout={(amt, method)=>handlePayoutRequest({ me, setPayouts, settings, amt, method })} />}
          {tab==="admin" && isAdmin && <AdminPanel videos={videos} setVideos={setVideos} payouts={payouts} setPayouts={setPayouts} users={users} setUsers={setUsers} settings={settings} setSettings={setSettings} />}
          <Footer />
        </section>
        <aside className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Trending Now</div>
              <Pill className="bg-amber-50 border-amber-200 text-amber-700 flex items-center gap-1"><FireDot/> Hot</Pill>
            </div>
            <div className="mt-3 space-y-3">
              {videos.filter(v=>v.approved).sort((a,b)=>b.views-a.views).slice(0,5).map(v=> (
                <div key={v.id} className="flex gap-3 items-center">
                  <div className="w-24 aspect-video rounded-lg overflow-hidden bg-black/5">{v.thumb? <img src={v.thumb} alt="thumb" className="w-full h-full object-cover"/> : <div className="w-full h-full grid place-items-center text-xs text-gray-500">No Thumb</div>}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold line-clamp-2">{v.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2"><Eye size={14}/>{fmt(v.views)} views</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <AdSlot id="sidebar-rectangle" size="300x250" />
          <Card>
            <div className="font-semibold mb-2">Monetization Rules</div>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
              <li>Creators earn <b>{Math.round(settings.creatorShare*100)}%</b> of ad revenue on their video views.</li>
              <li>Site RPM (demo): <b>{settings.currency} {settings.rpmUSD}</b> per 1,000 views.</li>
              <li>Minimum payout: <b>{settings.currency} {settings.minPayout}</b>.</li>
              <li>Strictly no copyrighted/reused content without rights.</li>
            </ul>
          </Card>
          <Card>
            <div className="font-semibold mb-2">Need Help?</div>
            <p className="text-sm text-gray-600">Email: support@banglatube.example • Policy • Terms</p>
          </Card>
        </aside>
      </main>
    </div>
  )
}

/** ----------------------------- Header -------------------------------------- */
function Header({ me, onLogin, onLogout, settings, setTab, tab, q, setQ, menuOpen, setMenuOpen }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 flex items-center gap-3">
        <Button className="lg:hidden" onClick={()=>setMenuOpen(!menuOpen)}><Menu size={18}/></Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 grid place-items-center text-white font-black">B</div>
          <div className="font-extrabold text-lg">{settings.siteName}</div>
          <Pill className="bg-indigo-50 border-indigo-200 text-indigo-700">Beta</Pill>
        </div>
        <div className="flex-1"/>
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative w-full">
            <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search videos…"/>
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-2">
          <HeaderNavButton icon={<Play size={16}/>} label="Home" active={tab==='home'} onClick={()=>setTab('home')} />
          <HeaderNavButton icon={<Upload size={16}/>} label="Upload" active={tab==='upload'} onClick={()=>setTab('upload')} />
          <HeaderNavButton icon={<DollarSign size={16}/>} label="Dashboard" active={tab==='dashboard'} onClick={()=>setTab('dashboard')} />
          {me?.role==='admin' && <HeaderNavButton icon={<ShieldCheck size={16}/>} label="Admin" active={tab==='admin'} onClick={()=>setTab('admin')} />}
        </nav>
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-gray-500"/>
          {me ? (
            <Button onClick={onLogout}><LogOut size={16}/> Logout</Button>
          ) : (
            <AuthButton onAuthed={onLogin} />
          )}
        </div>
      </div>

      {/* Mobile search + tabs */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative">
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search videos…"/>
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{height:0}} animate={{height:"auto"}} exit={{height:0}} className="md:hidden border-t">
            <div className="px-4 py-3 grid grid-cols-2 gap-2">
              <HeaderNavButton icon={<Play size={16}/>} label="Home" active={tab==='home'} onClick={()=>setTab('home')} />
              <HeaderNavButton icon={<Upload size={16}/>} label="Upload" active={tab==='upload'} onClick={()=>setTab('upload')} />
              <HeaderNavButton icon={<DollarSign size={16}/>} label="Dashboard" active={tab==='dashboard'} onClick={()=>setTab('dashboard')} />
              {me?.role==='admin' && <HeaderNavButton icon={<ShieldCheck size={16}/>} label="Admin" active={tab==='admin'} onClick={()=>setTab('admin')} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function HeaderNavButton({ icon, label, active, onClick }) {
  return (
    <Button onClick={onClick} className={`${active? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white'} `}>
      {icon}{label}
    </Button>
  )
}

function AuthButton({ onAuthed }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  return (
    <>
      <Button onClick={()=>setOpen(true)} className="bg-black text-white"><LogIn size={16}/> Sign In</Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-6">
            <Card className="w-full max-w-md">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Sign in to continue</div>
                <Button className="px-2 py-1" onClick={()=>setOpen(false)}><X size={16}/></Button>
              </div>
              <div className="text-sm text-gray-600 mb-3">Demo auth: enter a display name. (Admin can be created in code.)</div>
              <Input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button onClick={()=>{ if(!name) return; onAuthed({ uid: uid(), name, role:'user', balance:0, totalEarnings:0 }); setOpen(false); }} className="bg-indigo-600 text-white border-indigo-700"><LogIn size={16}/> Continue</Button>
                <Button onClick={()=>setOpen(false)} className="bg-white">Cancel</Button>
              </div>
              <div className="text-xs text-gray-500 mt-3">Replace with Google/Facebook login in production.</div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** ----------------------------- Feed ---------------------------------------- */
function Feed({ videos, onView, onLike, onComment, me, settings }) {
  return (
    <div className="grid gap-4">
      {videos.map(v => (
        <Card key={v.id} className="p-0 overflow-hidden">
          <VideoPlayer v={v} onView={()=>onView(v)} />
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-200 grid place-items-center font-bold text-indigo-800">{v.owner?.slice(0,2).toUpperCase()}</div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{v.title}</div>
                <div className="text-sm text-gray-600">{v.description}</div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <Pill className="bg-gray-50 border-gray-200">{v.category||'General'}</Pill>
                  <div className="flex items-center gap-1"><Eye size={14}/>{fmt(v.views)} views</div>
                  <div className="flex items-center gap-1"><Clock size={14}/>{timeAgo(v.createdAt)}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button onClick={()=>onLike(v)}><ThumbsUp size={16}/> Like ({fmt(v.likes)})</Button>
              <Button onClick={()=>onComment(v)}><MessageCircle size={16}/> Comment ({fmt(v.comments)})</Button>
              <Button><Share2 size={16}/> Share</Button>
              <div className="flex-1"/>
              <Pill className="bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-1"><DollarSign size={14}/> Earns ~{settings.currency} {fmt(v.views/1000*settings.rpmUSD*settings.creatorShare)}</Pill>
            </div>
            <div className="mt-4">
              <RewardedGate onUnlock={()=>alert('Thanks! Bonus credited to creator (demo).')}/>
            </div>
          </div>
        </Card>
      ))}
      {videos.length===0 && (
        <Card className="text-center py-16">
          <div className="text-xl font-semibold mb-2">No videos yet</div>
          <p className="text-gray-600">Be the first to upload and start earning!</p>
        </Card>
      )}
    </div>
  )
}

function VideoPlayer({ v, onView }) {
  const ref = useRef(null)
  const [played, setPlayed] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onPlay = () => { if (!played) { onView?.(); setPlayed(true) } }
    el.addEventListener('play', onPlay)
    return () => el.removeEventListener('play', onPlay)
  }, [onView, played])
  return (
    <div className="relative">
      <video ref={ref} src={v.src} poster={v.thumb} controls className="w-full aspect-video bg-black"/>
      <div className="absolute left-3 bottom-3 w-40">
        <AdSlot id={`in-player-overlay-${v.id}`} size="160x90" />
      </div>
    </div>
  )
}

/** ----------------------------- Upload -------------------------------------- */
function UploadCard({ me, onUploaded }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Entertainment")
  const [file, setFile] = useState/** @type {[File|null, any]} */(null)
  const [thumb, setThumb] = useState/** @type {[string|undefined, any]} */(undefined)
  const [busy, setBusy] = useState(false)

  const inputRef = useRef(null)

  const canSubmit = me && title && file && !busy

  const handleThumb = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    setThumb(url)
  }

  const handleUpload = async () => {
    if (!canSubmit) return
    setBusy(true)
    // In production: upload to cloud storage and store the returned URL in DB
    const url = URL.createObjectURL(file)
    const video = /** @type {Video} */({
      id: uid(), owner: me.uid, title, description, category, src: url, thumb, createdAt: Date.now(), views: 0, likes: 0, comments: 0, approved: me.role==='admin', earnings: 0
    })
    await new Promise(r=>setTimeout(r, 600)) // mimic latency
    onUploaded(video)
    setBusy(false)
    setTitle(""); setDescription(""); setFile(null); setThumb(undefined)
    if (inputRef.current) inputRef.current.value = ""
    alert(me.role==='admin' ? 'Uploaded! Video is live.' : 'Uploaded! Pending admin approval.')
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="font-semibold text-lg mb-3">Upload & Earn</div>
          {!me && <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">Please sign in to upload.</div>}
          <div className="grid md:grid-cols-2 gap-3">
            <Input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
            <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full rounded-xl border px-3 py-2">
              {['Entertainment','Education','News','Sports','Technology','Music'].map(c=> <option key={c}>{c}</option>)}
            </select>
            <Textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} className="md:col-span-2 min-h-[90px]"/>
            <div className="md:col-span-2 grid gap-3">
              <label className="block">
                <div className="font-medium mb-1">Select a video file</div>
                <Input ref={inputRef} type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0]||null)} />
              </label>
              <label className="block">
                <div className="font-medium mb-1">Optional thumbnail</div>
                <Input type="file" accept="image/*" onChange={handleThumb} />
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button disabled={!canSubmit} onClick={handleUpload} className={`text-white ${canSubmit? 'bg-indigo-600 border-indigo-700' : 'bg-gray-400 border-gray-400 cursor-not-allowed'}`}>
              <PlusCircle size={16}/> {busy? 'Uploading…' : 'Upload'}</Button>
            <Pill className="bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-1"><DollarSign size={14}/> Earn on every 1,000 views</Pill>
          </div>
        </div>
        <div className="hidden md:block w-64">
          <div className="aspect-video rounded-xl bg-black/5 mb-2 overflow-hidden grid place-items-center">
            {thumb? <img src={thumb} alt="thumb" className="w-full h-full object-cover"/> : <ImagePlus />}
          </div>
          <AdSlot id="upload-sidebar" size="300x250"/>
        </div>
      </div>
    </Card>
  )
}

/** ----------------------------- Creator Dashboard --------------------------- */
function CreatorDashboard({ me, myVideos, settings, onRequestPayout }) {
  if (!me) return <Card><div className="text-sm">Please sign in to view your dashboard.</div></Card>
  const totalViews = myVideos.reduce((s,v)=>s+v.views,0)
  const gross = totalViews/1000*settings.rpmUSD
  const net = gross*settings.creatorShare
  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-sm text-gray-600">Your Balance</div>
            <div className="text-2xl font-extrabold">{settings.currency} {fmt(me.balance)}</div>
          </div>
          <div className="h-10 w-px bg-gray-200"/>
          <div>
            <div className="text-sm text-gray-600">Lifetime Earnings</div>
            <div className="text-xl font-bold">{settings.currency} {fmt(me.totalEarnings)}</div>
          </div>
          <div className="h-10 w-px bg-gray-200"/>
          <div>
            <div className="text-sm text-gray-600">Total Views</div>
            <div className="text-xl font-bold">{fmt(totalViews)}</div>
          </div>
          <div className="flex-1"/>
          <PayoutRequest min={settings.minPayout} currency={settings.currency} disabled={me.balance < settings.minPayout} onRequest={onRequestPayout} />
        </div>
      </Card>
      <Card>
        <div className="font-semibold mb-3">Your Videos</div>
        <div className="grid gap-3">
          {myVideos.map(v => (
            <div key={v.id} className="flex items-center gap-3">
              <div className="w-28 aspect-video rounded-lg overflow-hidden bg-black/5">{v.thumb? <img src={v.thumb} alt="thumb" className="w-full h-full object-cover"/> : null}</div>
              <div className="flex-1">
                <div className="font-medium">{v.title} {!v.approved && <Pill className="bg-amber-50 border-amber-200 text-amber-700">Pending</Pill>}</div>
                <div className="text-xs text-gray-600 flex gap-3"><Eye size={14}/>{fmt(v.views)}<span>Likes {fmt(v.likes)}</span><span>Comments {fmt(v.comments)}</span></div>
              </div>
              <div className="text-right">
                <div className="text-sm">Est. Net</div>
                <div className="font-semibold">{settings.currency} {fmt(v.views/1000*settings.rpmUSD*settings.creatorShare)}</div>
              </div>
            </div>
          ))}
          {myVideos.length===0 && <div className="text-sm text-gray-600">No uploads yet.</div>}
        </div>
      </Card>
    </div>
  )
}

function PayoutRequest({ min, currency, onRequest, disabled }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(min)
  const [method, setMethod] = useState('bKash')
  return (
    <>
      <Button disabled={disabled} onClick={()=>setOpen(true)} className={`text-white ${disabled? 'bg-gray-400 border-gray-400' : 'bg-emerald-600 border-emerald-700'}`}><Wallet size={16}/> Request Payout</Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
            <Card className="w-full max-w-md">
              <div className="font-semibold mb-2">Withdraw Earnings</div>
              <div className="text-sm text-gray-600">Minimum payout: {currency} {fmt(min)}</div>
              <div className="grid gap-3 mt-3">
                <Input type="number" min={min} value={amount} onChange={e=>setAmount(parseFloat(e.target.value))} />
                <select value={method} onChange={e=>setMethod(e.target.value)} className="w-full rounded-xl border px-3 py-2">
                  {['bKash','Nagad','Rocket','Bank Transfer','PayPal'].map(m=> <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button onClick={()=>{ onRequest(amount, method); setOpen(false) }} className="bg-indigo-600 text-white border-indigo-700">Submit</Button>
                <Button onClick={()=>setOpen(false)} className="bg-white">Cancel</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** ----------------------------- Admin Panel --------------------------------- */
function AdminPanel({ videos, setVideos, payouts, setPayouts, users, setUsers, settings, setSettings }) {
  const toggleApprove = (id, approved) => setVideos(videos.map(v=>v.id===id? {...v, approved} : v))
  const handlePay = (pid) => {
    const req = payouts.find(p=>p.id===pid); if (!req) return
    setPayouts(payouts.map(p=>p.id===pid? {...p, status:'paid'} : p))
  }
  const handleReject = (pid) => setPayouts(payouts.map(p=>p.id===pid? {...p, status:'rejected'} : p))

  return (
    <div className="grid gap-4">
      <Card>
        <div className="font-semibold mb-2">Site Settings</div>
        <div className="grid md:grid-cols-5 gap-3 text-sm">
          <label className="block">RPM (per 1k views)
            <Input type="number" step="0.1" value={settings.rpmUSD} onChange={e=>setSettings({...settings, rpmUSD: parseFloat(e.target.value)})}/>
          </label>
          <label className="block">Creator Share (%)
            <Input type="number" value={Math.round(settings.creatorShare*100)} onChange={e=>setSettings({...settings, creatorShare: Math.max(0, Math.min(100, parseInt(e.target.value)))/100})}/>
          </label>
          <label className="block">Min Payout
            <Input type="number" value={settings.minPayout} onChange={e=>setSettings({...settings, minPayout: parseFloat(e.target.value)})}/>
          </label>
          <label className="block">Currency
            <Input value={settings.currency} onChange={e=>setSettings({...settings, currency: e.target.value})}/>
          </label>
          <label className="block">Site Name
            <Input value={settings.siteName} onChange={e=>setSettings({...settings, siteName: e.target.value})}/>
          </label>
        </div>
      </Card>

      <Card>
        <div className="font-semibold mb-2">Pending Videos</div>
        <div className="grid gap-3">
          {videos.filter(v=>!v.approved).map(v=> (
            <div key={v.id} className="flex items-center gap-3">
              <div className="w-28 aspect-video rounded-lg overflow-hidden bg-black/5">{v.thumb? <img src={v.thumb} alt="thumb" className="w-full h-full object-cover"/> : null}</div>
              <div className="flex-1">
                <div className="font-medium">{v.title}</div>
                <div className="text-xs text-gray-600">By {v.owner.slice(0,6)} • {timeAgo(v.createdAt)}</div>
              </div>
              <div className="flex gap-2">
                <Button className="bg-emerald-600 text-white border-emerald-700" onClick={()=>toggleApprove(v.id, true)}><CheckCircle2 size={16}/> Approve</Button>
                <Button className="bg-white" onClick={()=>setVideos(videos.filter(x=>x.id!==v.id))}><X size={16}/> Remove</Button>
              </div>
            </div>
          ))}
          {videos.filter(v=>!v.approved).length===0 && <div className="text-sm text-gray-600">No pending videos.</div>}
        </div>
      </Card>

      <Card>
        <div className="font-semibold mb-2">Payout Requests</div>
        <div className="grid gap-3">
          {payouts.map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="flex-1 text-sm">{p.uid.slice(0,6)} • {p.method} • {p.amount}</div>
              <Pill className={`$${p.status==='pending'?'bg-amber-50 border-amber-200 text-amber-700': p.status==='paid'?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-rose-50 border-rose-200 text-rose-700'}`}>{p.status}</Pill>
              {p.status==='pending' && (
                <>
                  <Button className="bg-emerald-600 text-white border-emerald-700" onClick={()=>handlePay(p.id)}>Mark Paid</Button>
                  <Button className="bg-white" onClick={()=>handleReject(p.id)}>Reject</Button>
                </>
              )}
            </div>
          ))}
          {payouts.length===0 && <div className="text-sm text-gray-600">No payout requests yet.</div>}
        </div>
      </Card>
    </div>
  )
}

/** ----------------------------- Footer -------------------------------------- */
function Footer() {
  return (
    <div className="text-center text-xs text-gray-500 py-6">
      © {new Date().getFullYear()} BanglaTube • Built with ❤ — Replace demo ads with your live tags. Respect Google Policies.
    </div>
  )
}

/** ----------------------------- Icons/Helpers -------------------------------- */
function FireDot(){
  return (
    <span className="relative inline-flex items-center">
      <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full"/>
      <span className="absolute inline-flex w-2.5 h-2.5 rounded-full opacity-75 animate-ping bg-amber-400"/>
    </span>
  )
}

/** ----------------------------- Actions ------------------------------------- */
function handleView(v, { me, videos, setVideos, settings, setUsers }) {
  const updated = videos.map(x=> x.id===v.id? { ...x, views: x.views+1 } : x)
  setVideos(updated)
  // credit earnings to owner (net revenue per view)
  const revPerView = settings.rpmUSD/1000 * settings.creatorShare
  const vid = updated.find(x=>x.id===v.id)
  const credit = revPerView
  const ownerId = vid?.owner
  if (!ownerId) return
  setUsers(prev => prev.map(u => u.uid===ownerId ? { ...u, balance: u.balance + credit, totalEarnings: u.totalEarnings + credit } : u))
}

function handleLike(v, { me, videos, setVideos }) {
  if (!me) return alert('Sign in to like')
  setVideos(videos.map(x=> x.id===v.id? { ...x, likes: x.likes+1 } : x))
}

function handleComment(v, { me, videos, setVideos }) {
  if (!me) return alert('Sign in to comment')
  setVideos(videos.map(x=> x.id===v.id? { ...x, comments: x.comments+1 } : x))
}

function handlePayoutRequest({ me, setPayouts, settings, amt, method }) {
  if (!me) return
  if (amt < settings.minPayout) return alert(`Minimum payout is ${settings.currency} ${settings.minPayout}`)
  if (amt > me.balance) return alert('Amount exceeds your balance')
  const req = /** @type {Payout} */({ id: uid(), uid: me.uid, amount: amt, method, status:'pending', createdAt: Date.now() })
  setPayouts(prev => [req, ...prev])
  alert('Payout request submitted! Admin will review.')
}
