import { useMemo, useState } from "react";
import {
  Activity,
  AudioLines,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Film,
  Languages,
  Layers3,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Save,
  Scissors,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

const roles = [
  { id: "narrator", name: "旁白", color: "#8b5cf6", voice: "温和叙述音" },
  { id: "peppa", name: "Peppa", color: "#f97316", voice: "明亮儿童音" },
  { id: "mommy", name: "猪妈妈", color: "#ec4899", voice: "温柔女声" },
  { id: "daddy", name: "猪爸爸", color: "#06b6d4", voice: "亲切男声" },
];

const initialSegments = [
  { id: 1, start: "00:02.800", end: "00:03.800", role: "peppa", source: "I'm Peppa Pig.", target: "我是佩佩猪。", confidence: 98 },
  { id: 2, start: "00:03.800", end: "00:06.700", role: "narrator", source: "This is my little brother, George.", target: "这是我的弟弟，乔治。", confidence: 96 },
  { id: 3, start: "00:06.700", end: "00:08.700", role: "narrator", source: "This is Mommy Pig.", target: "这是猪妈妈。", confidence: 97 },
  { id: 4, start: "00:08.700", end: "00:11.200", role: "narrator", source: "And this is Daddy Pig.", target: "这是猪爸爸。", confidence: 95 },
  { id: 5, start: "00:11.200", end: "00:14.300", role: "narrator", source: "Peppa Pig.", target: "佩佩猪。", confidence: 90 },
  { id: 6, start: "00:14.300", end: "00:21.400", role: "narrator", source: "Muddy puddles.", target: "泥坑。", confidence: 93 },
  { id: 7, start: "00:21.400", end: "00:30.600", role: "narrator", source: "It is raining today, so Peppa and George cannot play outside.", target: "今天下雨了，所以佩佩和乔治不能到外面玩。", confidence: 94 },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${remainder}`;
}

export default function Home() {
  const { user } = useAuth();
  const [segments, setSegments] = useState(initialSegments);
  const [selectedId, setSelectedId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(3.2);
  const [backgroundVolume, setBackgroundVolume] = useState([82]);
  const [voiceVolume, setVoiceVolume] = useState([100]);
  const [activeTab, setActiveTab] = useState<"transcript" | "mix" | "clone">("transcript");
  const [isSaved, setIsSaved] = useState(false);

  const selected = segments.find((segment) => segment.id === selectedId) ?? segments[0];
  const selectedRole = roles.find((role) => role.id === selected.role) ?? roles[0];
  const totalSeconds = 311.04;

  const updateSelected = (field: "source" | "target" | "role" | "start" | "end", value: string) => {
    setSegments((items) => items.map((item) => (item.id === selectedId ? { ...item, [field]: value } : item)));
    setIsSaved(false);
  };

  const timelineMarkers = useMemo(() => [0, 60, 120, 180, 240, 300], []);

  return (
    <div className="min-h-screen bg-[#0b0d12] text-slate-100 selection:bg-violet-500/30">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0d12]/90 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20">
              <AudioLines className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2"><span className="text-sm font-semibold tracking-tight">Dubbing Studio</span><Badge className="border-violet-400/30 bg-violet-400/10 text-[10px] text-violet-200">BETA</Badge></div>
              <p className="text-xs text-slate-500">视频配音 · 音轨分离 · 时间轴编辑</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400 md:flex"><Activity className="h-3.5 w-3.5 text-emerald-400" />处理节点在线</div>
            {user ? <span className="max-w-32 truncate text-sm text-slate-400">{user.name ?? user.email}</span> : <Button variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => startLogin()}>登录</Button>}
            <Button className="bg-white text-slate-950 hover:bg-slate-200" onClick={() => setIsSaved(true)}><Save className="mr-2 h-4 w-4" />{isSaved ? "已保存" : "保存项目"}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-6 py-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <aside className="hidden space-y-5 xl:block">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Projects</p><Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:bg-white/10 hover:text-white"><Plus className="h-4 w-4" /></Button></div>
          <div className="space-y-2">
            <div className="rounded-xl border border-violet-400/30 bg-violet-400/[0.09] p-3"><div className="mb-2 flex items-center gap-2"><Film className="h-4 w-4 text-violet-300" /><span className="truncate text-sm font-medium">Peppa Pig · Muddy Puddles</span></div><div className="flex items-center justify-between text-[11px] text-slate-500"><span>普通话配音</span><span>刚刚</span></div></div>
            <div className="rounded-xl border border-transparent p-3 transition hover:border-white/10 hover:bg-white/[0.03]"><div className="mb-2 flex items-center gap-2"><Film className="h-4 w-4 text-slate-500" /><span className="truncate text-sm text-slate-300">品牌宣传片 · 01</span></div><div className="text-[11px] text-slate-500">草稿 · 12:04</div></div>
          </div>
          <Separator className="bg-white/10" />
          <div className="space-y-3 text-sm text-slate-400"><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05] hover:text-white"><Layers3 className="h-4 w-4" />素材库</button><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05] hover:text-white"><Clock3 className="h-4 w-4" />处理记录</button><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05] hover:text-white"><Settings2 className="h-4 w-4" />工作区设置</button></div>
          <div className="rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[0.08] to-violet-400/[0.08] p-4"><WandSparkles className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-sm font-medium text-slate-200">处理节点</p><p className="mt-1 text-xs leading-5 text-slate-500">ffmpeg · Demucs · OpenVoice 可在独立节点运行，不阻塞编辑。</p><div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Ready</div></div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><span>Projects</span><ChevronRight className="h-3.5 w-3.5" /><span>Peppa Pig · Muddy Puddles</span></div><h1 className="text-2xl font-semibold tracking-tight text-white">配音工作台</h1><p className="mt-1 text-sm text-slate-500">编辑内容、角色和混音参数，再提交到处理节点。</p></div><div className="flex gap-2"><Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"><Upload className="mr-2 h-4 w-4" />替换视频</Button><Button className="bg-violet-500 text-white hover:bg-violet-400"><Sparkles className="mr-2 h-4 w-4" />开始处理</Button></div></div>

          <Card className="overflow-hidden border-white/10 bg-[#11141b] shadow-2xl shadow-black/20">
            <div className="relative aspect-video max-h-[400px] bg-gradient-to-br from-[#242130] via-[#141823] to-[#0d131b]">
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 76% 30%, rgba(139,92,246,.34), transparent 26%), radial-gradient(circle at 20% 80%, rgba(6,182,212,.18), transparent 30%)" }} />
              <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-slate-300 backdrop-blur"><Film className="h-3.5 w-3.5" />预览画面 · 1920×1080</div>
              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3"><Button size="icon" className="h-11 w-11 rounded-full bg-white text-slate-950 hover:bg-slate-200" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}</Button><div className="flex-1"><div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${(playhead / totalSeconds) * 100}%` }} /></div><div className="flex justify-between text-[11px] text-slate-400"><span>{formatTime(playhead)}</span><span>05:11</span></div></div><Button size="icon" variant="ghost" className="text-slate-300 hover:bg-white/10"><Volume2 className="h-5 w-5" /></Button><Button size="icon" variant="ghost" className="text-slate-300 hover:bg-white/10"><MoreHorizontal className="h-5 w-5" /></Button></div>
            </div>
            <div className="border-t border-white/10 bg-[#0e1117] px-5 py-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-slate-400"><Scissors className="h-3.5 w-3.5 text-violet-300" />时间轴预览</div><span className="text-[11px] text-slate-600">拖动播放头可定位对白</span></div><div className="relative h-20 rounded-xl border border-white/5 bg-[#0a0c11] px-2 pt-5"><div className="absolute left-2 right-2 top-2 flex justify-between text-[10px] text-slate-600">{timelineMarkers.map((marker) => <span key={marker}>{formatTime(marker)}</span>)}</div><div className="absolute bottom-3 left-2 right-2 h-10"><div className="absolute inset-0 rounded-md bg-gradient-to-r from-cyan-400/10 via-violet-400/10 to-cyan-400/5" />{segments.map((segment) => { const start = Number(segment.start.slice(0, 2)) * 60 + Number(segment.start.slice(3)); const end = Number(segment.end.slice(0, 2)) * 60 + Number(segment.end.slice(3)); const role = roles.find((item) => item.id === segment.role) ?? roles[0]; return <button key={segment.id} onClick={() => { setSelectedId(segment.id); setPlayhead(start); }} className={`absolute top-1 h-8 rounded border px-1 text-left transition ${segment.id === selectedId ? "border-white/80 ring-2 ring-white/20" : "border-white/10 hover:border-white/40"}`} style={{ left: `${(start / totalSeconds) * 100}%`, width: `${Math.max(((end - start) / totalSeconds) * 100, 1.4)}%`, backgroundColor: `${role.color}55` }}><span className="block truncate text-[9px] font-medium text-white/80">{segment.id}</span></button>; })}<div className="absolute bottom-0 top-0 w-px bg-white" style={{ left: `${(playhead / totalSeconds) * 100}%` }} /></div></div></div>
          </Card>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#11141b] p-1"><button onClick={() => setActiveTab("transcript")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition ${activeTab === "transcript" ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Languages className="h-4 w-4" />字幕与配音</button><button onClick={() => setActiveTab("mix")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition ${activeTab === "mix" ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><SlidersHorizontal className="h-4 w-4" />背景混音</button><button onClick={() => setActiveTab("clone")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition ${activeTab === "clone" ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><WandSparkles className="h-4 w-4" />声音克隆</button></div>

          {activeTab === "transcript" && <Card className="border-white/10 bg-[#11141b]"><CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="text-base text-white">对白时间轴 <span className="ml-2 text-xs font-normal text-slate-500">{segments.length} / 54 segments</span></CardTitle><div className="flex items-center gap-2"><Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><Check className="mr-1 h-3 w-3" />自动转写完成</Badge><Button size="sm" variant="ghost" className="text-slate-400 hover:bg-white/10 hover:text-white"><Plus className="mr-1 h-3.5 w-3.5" />添加片段</Button></div></CardHeader><CardContent className="space-y-2"><div className="grid grid-cols-[44px_132px_minmax(0,1fr)_minmax(0,1fr)_90px] gap-3 px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-slate-600"><span>#</span><span>时间</span><span>原文</span><span>译文</span><span>角色</span></div>{segments.map((segment) => { const role = roles.find((item) => item.id === segment.role) ?? roles[0]; return <button key={segment.id} onClick={() => setSelectedId(segment.id)} className={`grid w-full grid-cols-[44px_132px_minmax(0,1fr)_minmax(0,1fr)_90px] items-center gap-3 rounded-xl border p-3 text-left transition ${selectedId === segment.id ? "border-violet-400/40 bg-violet-400/[0.08]" : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"}`}><span className="text-xs font-medium text-slate-500">{segment.id.toString().padStart(2, "0")}</span><span className="font-mono text-[11px] text-slate-400">{segment.start}<br /><span className="text-slate-600">→ {segment.end}</span></span><span className="truncate text-xs text-slate-300">{segment.source}</span><span className="truncate text-xs text-white">{segment.target}</span><span className="flex items-center gap-1.5 text-xs text-slate-300"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />{role.name}</span></button>; })}</CardContent></Card>}
          {activeTab === "mix" && <Card className="border-white/10 bg-[#11141b]"><CardHeader><CardTitle className="text-base text-white">背景混音</CardTitle></CardHeader><CardContent className="space-y-6"><div><div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">背景音乐与环境声</span><span className="font-mono text-cyan-300">{backgroundVolume[0]}%</span></div><Slider value={backgroundVolume} onValueChange={setBackgroundVolume} max={120} step={1} /></div><div><div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">普通话配音</span><span className="font-mono text-violet-300">{voiceVolume[0]}%</span></div><Slider value={voiceVolume} onValueChange={setVoiceVolume} max={140} step={1} /></div><div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 text-slate-200"><Layers3 className="h-4 w-4 text-cyan-300" />分离策略</div><p className="text-xs leading-5">使用 Demucs 双 stem 分离原人声与背景。处理节点会保留 no_vocals 层，再按对白窗口做动态衰减。</p></div></CardContent></Card>}
          {activeTab === "clone" && <Card className="border-white/10 bg-[#11141b]"><CardHeader><CardTitle className="text-base text-white">声音克隆设置</CardTitle></CardHeader><CardContent><div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100"><WandSparkles className="mb-2 h-5 w-5 text-amber-300" /><p className="font-medium">本地克隆节点</p><p className="mt-1 text-xs leading-5 text-amber-100/60">上传单角色参考音频后，可在独立节点尝试 OpenVoice V2。当前项目默认使用预置音色，避免混合人声直接作为参考。</p></div><div className="mt-4 grid grid-cols-2 gap-3"><Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"><Upload className="mr-2 h-4 w-4" />上传参考音频</Button><Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"><AudioLines className="mr-2 h-4 w-4" />提取角色样本</Button></div></CardContent></Card>}
        </section>

        <aside className="space-y-5">
          <Card className="border-white/10 bg-[#11141b]"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base text-white">片段编辑</CardTitle><Badge style={{ color: selectedRole.color, borderColor: `${selectedRole.color}55`, backgroundColor: `${selectedRole.color}15` }}>{selectedRole.name}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><Label className="text-[11px] text-slate-500">开始</Label><Input value={selected.start} onChange={(event) => updateSelected("start", event.target.value)} className="mt-1 border-white/10 bg-black/20 font-mono text-xs text-slate-200" /></div><div><Label className="text-[11px] text-slate-500">结束</Label><Input value={selected.end} onChange={(event) => updateSelected("end", event.target.value)} className="mt-1 border-white/10 bg-black/20 font-mono text-xs text-slate-200" /></div></div><div><Label className="text-[11px] text-slate-500">角色</Label><Select value={selected.role} onValueChange={(value) => updateSelected("role", value)}><SelectTrigger className="mt-1 border-white/10 bg-black/20 text-slate-200"><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name} · {role.voice}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-[11px] text-slate-500">原文</Label><Textarea value={selected.source} onChange={(event) => updateSelected("source", event.target.value)} className="mt-1 min-h-20 resize-none border-white/10 bg-black/20 text-xs leading-5 text-slate-300" /></div><div><Label className="text-[11px] text-slate-500">普通话译文</Label><Textarea value={selected.target} onChange={(event) => updateSelected("target", event.target.value)} className="mt-1 min-h-20 resize-none border-violet-400/30 bg-violet-400/[0.04] text-xs leading-5 text-white" /></div><div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"><span className="text-slate-500">识别置信度</span><span className="font-mono text-emerald-300">{selected.confidence}%</span></div><Button className="w-full bg-violet-500 text-white hover:bg-violet-400" onClick={() => setIsSaved(true)}><Check className="mr-2 h-4 w-4" />应用片段修改</Button></CardContent></Card>
          <Card className="border-white/10 bg-[#11141b]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-white"><Settings2 className="h-4 w-4 text-slate-400" />处理队列</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">音频预处理</span><span className="text-emerald-300">完成</span></div><Progress value={100} className="h-1.5 bg-white/10" /></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">转写与翻译</span><span className="text-emerald-300">完成</span></div><Progress value={100} className="h-1.5 bg-white/10" /></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">配音与混音</span><span className="text-slate-500">待开始</span></div><Progress value={0} className="h-1.5 bg-white/10" /></div><Separator className="bg-white/10" /><Button variant="outline" className="w-full border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"><Download className="mr-2 h-4 w-4" />导出设置</Button></CardContent></Card>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.14] to-cyan-400/[0.08] p-4"><p className="text-sm font-medium text-white">Editable by design</p><p className="mt-1 text-xs leading-5 text-slate-400">所有识别、翻译、角色和混音参数都会在处理前保留为可编辑版本。</p><div className="mt-4 flex items-center gap-2 text-xs text-slate-300"><span className="h-2 w-2 rounded-full bg-violet-300" />当前编辑片段 {selected.id.toString().padStart(2, "0")}</div></div>
        </aside>
      </main>
    </div>
  );
}
