import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AudioLines, Check, ChevronRight, Clock3, Download, Film, History, Languages, Layers3, Pause, Play, Plus, RotateCcw, Save, Scissors, Settings2, SlidersHorizontal, Sparkles, Upload, Volume2, WandSparkles, X } from "lucide-react";
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
import { trpc } from "@/lib/trpc";

type Segment = { id: number; startMs: number; endMs: number; role: string; source: string; target: string; confidence: number; voiceGain: number };
type Snapshot = { id: number; label: string; createdAt: Date; segments: Segment[] };

const roles = [
  { id: "narrator", name: "旁白", color: "#8b5cf6", voice: "温和叙述音" },
  { id: "peppa", name: "Peppa", color: "#f97316", voice: "明亮儿童音" },
  { id: "mommy", name: "猪妈妈", color: "#ec4899", voice: "温柔女声" },
  { id: "daddy", name: "猪爸爸", color: "#06b6d4", voice: "亲切男声" },
];
const seedSegments: Segment[] = [
  { id: 1, startMs: 2800, endMs: 3800, role: "peppa", source: "I'm Peppa Pig.", target: "我是佩佩猪。", confidence: 98, voiceGain: 100 },
  { id: 2, startMs: 3800, endMs: 6700, role: "narrator", source: "This is my little brother, George.", target: "这是我的弟弟，乔治。", confidence: 96, voiceGain: 100 },
  { id: 3, startMs: 6700, endMs: 8700, role: "narrator", source: "This is Mommy Pig.", target: "这是猪妈妈。", confidence: 97, voiceGain: 100 },
  { id: 4, startMs: 8700, endMs: 11200, role: "narrator", source: "And this is Daddy Pig.", target: "这是猪爸爸。", confidence: 95, voiceGain: 100 },
  { id: 5, startMs: 11200, endMs: 14300, role: "narrator", source: "Peppa Pig.", target: "佩佩猪。", confidence: 90, voiceGain: 100 },
  { id: 6, startMs: 14300, endMs: 21400, role: "narrator", source: "Muddy puddles.", target: "泥坑。", confidence: 93, voiceGain: 100 },
  { id: 7, startMs: 21400, endMs: 30600, role: "narrator", source: "It is raining today, so Peppa and George cannot play outside.", target: "今天下雨了，所以佩佩和乔治不能到外面玩。", confidence: 94, voiceGain: 100 },
];

function timeLabel(ms: number) {
  const seconds = ms / 1000;
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}
function toClock(ms: number) {
  return `${timeLabel(ms)}.${(ms % 1000).toString().padStart(3, "0").slice(-3)}`;
}
function makeWaveform(size = 180) {
  return Array.from({ length: size }, (_, index) => Math.max(0.08, Math.min(1, 0.2 + Math.abs(Math.sin(index * 0.31)) * 0.5 + Math.abs(Math.cos(index * 0.09)) * 0.25)));
}

export default function Home() {
  const { user } = useAuth();
  const [segments, setSegments] = useState<Segment[]>(seedSegments);
  const [selectedId, setSelectedId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(3200);
  const [durationMs, setDurationMs] = useState(311040);
  const [waveform, setWaveform] = useState<number[]>(makeWaveform());
  const [previewUrl, setPreviewUrl] = useState("");
  const [sourceVideoUrl, setSourceVideoUrl] = useState("");
  const [fileName, setFileName] = useState("Peppa Pig · Muddy Puddles");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadPaused, setUploadPaused] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [backgroundVolume, setBackgroundVolume] = useState([82]);
  const [voiceVolume, setVoiceVolume] = useState([100]);
  const [activeTab, setActiveTab] = useState<"transcript" | "mix" | "clone">("transcript");
  const [isSaved, setIsSaved] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "running" | "cached" | "error">("idle");
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState("");
  const [timelineZoom, setTimelineZoom] = useState([1]);
  const [dragState, setDragState] = useState<{ id: number; mode: "move" | "start" | "end"; x: number; startMs: number; endMs: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const uploadPauseRef = useRef(false);
  const uploadCancelRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const createProject = trpc.projects.create.useMutation();
  const saveVersion = trpc.projects.saveVersion.useMutation();
  const restoreVersion = trpc.projects.restoreVersion.useMutation();
  const remoteVersions = trpc.projects.versions.useQuery({ projectId: projectId ?? 0 }, { enabled: projectId !== null });
  const trpcUtils = trpc.useUtils();

  const selected = segments.find((segment) => segment.id === selectedId) ?? segments[0];
  const selectedRole = roles.find((role) => role.id === selected.role) ?? roles[0];
  const visibleDurationMs = Math.max(1000, Math.round(durationMs / timelineZoom[0]));
  const timelineMarkers = useMemo(() => Array.from({ length: 6 }, (_, index) => Math.round((visibleDurationMs * index) / 5)), [visibleDurationMs]);

  const pushHistory = (label: string, nextSegments = segments) => {
    setHistory((items) => [...items.slice(-19), { id: Date.now(), label, createdAt: new Date(), segments: structuredClone(nextSegments) }]);
  };
  const updateSelected = (field: keyof Pick<Segment, "source" | "target" | "role" | "startMs" | "endMs" | "voiceGain">, value: string | number) => {
    pushHistory("编辑对白片段");
    setSegments((items) => items.map((item) => item.id === selectedId ? { ...item, [field]: value } : item));
    setIsSaved(false);
  };
  const updateSegmentTimes = (id: number, startMs: number, endMs: number, label = "调整时间轴") => {
    const next = segments.map((item) => item.id === id ? { ...item, startMs: Math.max(0, Math.round(startMs)), endMs: Math.min(durationMs, Math.max(Math.round(startMs) + 200, Math.round(endMs))) } : item);
    pushHistory(label, next);
    setSegments(next);
    setIsSaved(false);
  };

  const buildWaveform = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return { durationMs: 0, waveform: makeWaveform() };
    const context = new AudioContextClass();
    const audio = await context.decodeAudioData(buffer.slice(0));
    const nextDurationMs = Math.round(audio.duration * 1000);
    setDurationMs(nextDurationMs);
    const channel = audio.getChannelData(0);
    const bucketSize = Math.max(1, Math.floor(channel.length / 220));
    const bars = Array.from({ length: 220 }, (_, index) => {
      let peak = 0;
      for (let offset = 0; offset < bucketSize; offset += 1) peak = Math.max(peak, Math.abs(channel[index * bucketSize + offset] ?? 0));
      return Math.max(0.06, Math.min(1, peak * 2.7));
    });
    setWaveform(bars);
    await context.close();
    return { durationMs: nextDurationMs, waveform: bars };
  };

  const uploadAndCreate = async (file: File) => {
    setIsCreating(true); setUploadProgress(2); setUploadPaused(false); uploadPauseRef.current = false; uploadCancelRef.current = false;
    const url = URL.createObjectURL(file); setPreviewUrl(url); setFileName(file.name);
    let mediaMeta = { durationMs: 0, waveform: makeWaveform() };
    try { mediaMeta = await buildWaveform(file); } catch { setWaveform(mediaMeta.waveform); }
    setUploadProgress(25);
    if (user) {
      try {
        const chunkSize = 8 * 1024 * 1024;
        const resumeKey = `dubbing-upload:${file.name}:${file.size}:${file.lastModified}`;
        const savedSessionId = window.localStorage.getItem(resumeKey);
        let sessionResponse = savedSessionId ? await fetch(`/api/upload/session/${savedSessionId}`, { credentials: "include" }) : null;
        if (!sessionResponse || !sessionResponse.ok) sessionResponse = await fetch("/api/upload/session", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type || "video/mp4", totalBytes: file.size, chunkSize }) });
        if (!sessionResponse.ok) throw new Error("session failed");
        const createdSession = await sessionResponse.json() as { session: { id: string; totalParts: number }; uploadedParts: number[] };
        window.localStorage.setItem(resumeKey, createdSession.session.id);
        setUploadSessionId(createdSession.session.id);
        const uploadedParts = new Set(createdSession.uploadedParts);
        for (let index = 0; index < createdSession.session.totalParts; index += 1) {
          while (uploadPauseRef.current && !uploadCancelRef.current) await new Promise((resolve) => setTimeout(resolve, 250));
          if (uploadCancelRef.current) { await fetch(`/api/upload/session/${createdSession.session.id}`, { method: "DELETE", credentials: "include" }); window.localStorage.removeItem(resumeKey); setUploadSessionId(null); setIsCreating(false); return; }
          if (uploadedParts.has(index)) continue;
          const part = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
          const response = await fetch(`/api/upload/session/${createdSession.session.id}/part/${index}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/octet-stream" }, body: part });
          if (!response.ok) throw new Error("part upload failed");
          setUploadProgress(Math.round(((index + 1) / createdSession.session.totalParts) * 70));
        }
        const response = await fetch(`/api/upload/session/${createdSession.session.id}/complete`, { method: "POST", credentials: "include" });
        if (!response.ok) throw new Error("complete failed");
        const uploaded = await response.json() as { url: string };
        setSourceVideoUrl(uploaded.url);
        setUploadProgress(82);
        const created = await createProject.mutateAsync({ name: file.name.replace(/\.[^.]+$/, ""), sourceUrl: uploaded.url, durationMs: mediaMeta.durationMs || durationMs, waveformJson: JSON.stringify(mediaMeta.waveform), segments });
        if (created?.id) setProjectId(created.id);
        setUploadSessionId(null); window.localStorage.removeItem(resumeKey);
      } catch { setUploadProgress(45); setPreviewError("上传失败，可重新选择文件后从头开始；已完成分片会在当前会话中保留。"); }
    }
    setUploadProgress(100); setIsCreating(false); setIsSaved(true);
  };
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void uploadAndCreate(file); };

  const cacheKey = (segment: Segment) => `dubbing-preview:${projectId ?? "draft"}:${segment.id}:${segment.target}:${segment.role}:${segment.voiceGain}`;
  const readCachedAudio = async (key: string) => { const cache = await caches.open("dubbing-audio-v1"); const response = await cache.match(key); return response ? URL.createObjectURL(await response.blob()) : null; };
  const writeCachedAudio = async (key: string, url: string) => { const cache = await caches.open("dubbing-audio-v1"); const response = await fetch(url); await cache.put(key, response.clone()); };
  const cancelPreview = async () => { previewAbortRef.current?.abort(); if (previewTaskId) await fetch(`/api/processing/preview/${previewTaskId}`, { method: "DELETE", credentials: "include" }).catch(() => undefined); previewAudioRef.current?.pause(); setPreviewTaskId(null); setPlayingSegment(null); setPreviewStatus("idle"); setPreviewProgress(0); };
  const playSentence = async (segment: Segment) => {
    await cancelPreview(); setPreviewError("");
    const key = cacheKey(segment); const cached = await readCachedAudio(key);
    if (cached) { setPreviewStatus("cached"); setPreviewProgress(100); const audio = new Audio(cached); previewAudioRef.current = audio; setPlayingSegment(segment.id); audio.onended = () => setPlayingSegment(null); await audio.play(); return; }
    const controller = new AbortController(); previewAbortRef.current = controller; setPlayingSegment(segment.id); setPreviewStatus("running"); setPreviewProgress(4);
    try {
      const response = await fetch("/api/processing/preview", { method: "POST", credentials: "include", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, segmentId: segment.id, text: segment.target, speaker: segment.role, voicePreset: selectedRole.voice, gain: segment.voiceGain }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? "试听生成失败"); }
      const result = await response.json() as { audioUrl?: string; url?: string; taskId?: string; id?: string; progress?: number };
      let audioUrl = result.audioUrl ?? result.url;
      const taskId = result.taskId ?? result.id;
      if (!audioUrl && taskId) { setPreviewTaskId(taskId); for (;;) { await new Promise((resolve) => setTimeout(resolve, 500)); const statusResponse = await fetch(`/api/processing/preview/${taskId}`, { credentials: "include", signal: controller.signal }); const status = await statusResponse.json() as { status: string; progress?: number; audioUrl?: string; url?: string; message?: string }; setPreviewProgress(status.progress ?? 10); if (status.status === "completed") { audioUrl = status.audioUrl ?? status.url; break; } if (["failed", "cancelled"].includes(status.status)) throw new Error(status.message ?? "试听任务失败"); } }
      if (!audioUrl) throw new Error("处理节点未返回音频地址");
      await writeCachedAudio(key, audioUrl); setPreviewTaskId(null); setPreviewStatus("idle"); setPreviewProgress(100); const audio = new Audio(audioUrl); previewAudioRef.current = audio; audio.onended = () => setPlayingSegment(null); await audio.play();
    } catch (error) { if ((error as Error).name !== "AbortError") { setPreviewStatus("error"); setPreviewError(error instanceof Error ? error.message : "处理节点暂时不可用"); } setPlayingSegment(null); }
  };
  const startExport = async () => {
    if (!projectId || !sourceVideoUrl) { setPreviewError("请先上传视频并创建项目"); return; }
    setExportUrl(""); setExportProgress(3); setPreviewError("");
    try {
      const response = await fetch("/api/processing/export", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, sourceUrl: sourceVideoUrl, backgroundGain: backgroundVolume[0], voiceGain: voiceVolume[0], segments: segments.map((segment) => ({ ...segment, speaker: segment.role, sourceText: segment.source, targetText: segment.target })) }) });
      if (!response.ok) throw new Error("导出任务提交失败");
      const result = await response.json() as { taskId?: string; id?: string; videoUrl?: string; url?: string };
      if (result.videoUrl ?? result.url) { setExportUrl(result.videoUrl ?? result.url ?? ""); setExportProgress(100); return; }
      const taskId = result.taskId ?? result.id;
      if (!taskId) throw new Error("处理节点未返回导出任务");
      setExportTaskId(taskId);
      for (;;) { await new Promise((resolve) => setTimeout(resolve, 700)); const statusResponse = await fetch(`/api/processing/export/${taskId}`, { credentials: "include" }); const status = await statusResponse.json() as { status: string; progress?: number; videoUrl?: string; url?: string; message?: string }; setExportProgress(status.progress ?? 10); if (status.status === "completed" && (status.videoUrl ?? status.url)) { setExportUrl(status.videoUrl ?? status.url ?? ""); setExportProgress(100); break; } if (["failed", "cancelled"].includes(status.status)) throw new Error(status.message ?? "视频导出失败"); }
    } catch (error) { setPreviewError(error instanceof Error ? error.message : "视频导出失败"); setExportTaskId(null); }
  };
  const cancelExport = async () => { if (exportTaskId) await fetch(`/api/processing/export/${exportTaskId}`, { method: "DELETE", credentials: "include" }).catch(() => undefined); setExportTaskId(null); setExportProgress(0); };
  const toggleVideo = () => {
    if (videoRef.current) { if (isPlaying) void videoRef.current.pause(); else void videoRef.current.play(); }
    setIsPlaying((value) => !value);
  };

  useEffect(() => {
    if (!dragState) return;
    const onMove = (event: PointerEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect(); if (!rect) return;
      const delta = ((event.clientX - dragState.x) / rect.width) * durationMs;
      if (dragState.mode === "move") updateSegmentTimes(dragState.id, dragState.startMs + delta, dragState.endMs + delta, "拖动对白片段");
      if (dragState.mode === "start") updateSegmentTimes(dragState.id, dragState.startMs + delta, dragState.endMs, "调整片段开始时间");
      if (dragState.mode === "end") updateSegmentTimes(dragState.id, dragState.startMs, dragState.endMs + delta, "调整片段结束时间");
    };
    const onUp = () => setDragState(null);
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragState, durationMs, segments]);

  const restoreSnapshot = async (snapshot: Snapshot) => { pushHistory("回退前自动保存"); setSegments(structuredClone(snapshot.segments)); setIsSaved(false); setShowHistory(false); };
  const restoreRemoteSnapshot = async (versionId: number) => {
    if (!projectId) return;
    const restored = await restoreVersion.mutateAsync({ projectId, versionId });
    const nextSegments = (restored?.segments ?? []).map((segment) => ({ id: segment.id, startMs: segment.startMs, endMs: segment.endMs, role: segment.speaker, source: segment.sourceText, target: segment.targetText, confidence: 100, voiceGain: segment.voiceGain ?? 100 }));
    if (nextSegments.length) { pushHistory("远程回退前自动保存"); setSegments(nextSegments); }
    await trpcUtils.projects.versions.invalidate({ projectId }); setShowHistory(false); setIsSaved(true);
  };
  const saveCurrentVersion = async () => {
    const snapshot = { segments: segments.map((segment) => ({ id: segment.id, startMs: segment.startMs, endMs: segment.endMs, speaker: segment.role, sourceText: segment.source, targetText: segment.target, voicePreset: null, voiceGain: segment.voiceGain })) };
    const local: Snapshot = { id: Date.now(), label: `手动保存 · ${new Date().toLocaleTimeString()}`, createdAt: new Date(), segments: structuredClone(segments) };
    setHistory((items) => [...items.slice(-19), local]); setIsSaved(true);
    if (projectId) { await saveVersion.mutateAsync({ projectId, label: local.label, snapshotJson: JSON.stringify(snapshot) }); await trpcUtils.projects.versions.invalidate({ projectId }); }
  };

  return <div className="min-h-screen bg-[#0b0d12] text-slate-100 selection:bg-violet-500/30">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0d12]/90 px-6 py-4 backdrop-blur-xl"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20"><AudioLines className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><span className="text-sm font-semibold">Dubbing Studio</span><Badge className="border-violet-400/30 bg-violet-400/10 text-[10px] text-violet-200">BETA</Badge></div><p className="text-xs text-slate-500">视频配音 · 音轨分离 · 时间轴编辑</p></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400 md:flex"><Activity className="h-3.5 w-3.5 text-emerald-400" />处理节点在线</div>{user ? <span className="max-w-32 truncate text-sm text-slate-400">{user.name ?? user.email}</span> : <Button variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => startLogin()}>登录</Button>}<Button className="bg-white text-slate-950 hover:bg-slate-200" onClick={() => void saveCurrentVersion()}><Save className="mr-2 h-4 w-4" />{isSaved ? "已保存" : "保存版本"}</Button></div></div></header>
    <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-6 py-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
      <aside className="hidden space-y-5 xl:block"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Projects</p><Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:bg-white/10 hover:text-white" onClick={() => fileInputRef.current?.click()}><Plus className="h-4 w-4" /></Button></div><input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={onFileChange} /><div className="space-y-2"><div className="rounded-xl border border-violet-400/30 bg-violet-400/[0.09] p-3"><div className="mb-2 flex items-center gap-2"><Film className="h-4 w-4 text-violet-300" /><span className="truncate text-sm font-medium">{fileName}</span></div><div className="flex items-center justify-between text-[11px] text-slate-500"><span>{projectId ? "已创建项目" : "本地草稿"}</span><span>刚刚</span></div></div><button onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border border-dashed border-white/10 p-3 text-left text-xs text-slate-500 hover:border-violet-400/40 hover:text-slate-300"><Upload className="mr-2 inline h-3.5 w-3.5" />导入新视频</button></div><Separator className="bg-white/10" /><div className="space-y-3 text-sm text-slate-400"><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05] hover:text-white"><Layers3 className="h-4 w-4" />素材库</button><button onClick={() => setShowHistory(true)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05] hover:text-white"><History className="h-4 w-4" />编辑历史 {history.length > 0 && <Badge className="ml-auto bg-violet-400/10 text-[10px] text-violet-300">{history.length}</Badge>}</button><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05] hover:text-white"><Settings2 className="h-4 w-4" />工作区设置</button></div><div className="rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[0.08] to-violet-400/[0.08] p-4"><WandSparkles className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-sm font-medium text-slate-200">处理节点</p><p className="mt-1 text-xs leading-5 text-slate-500">ffmpeg · Demucs · OpenVoice 在独立节点运行，不阻塞编辑。</p><div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Ready</div></div></aside>
      <section className="min-w-0 space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><span>Projects</span><ChevronRight className="h-3.5 w-3.5" /><span>{fileName}</span></div><h1 className="text-2xl font-semibold tracking-tight text-white">配音工作台</h1><p className="mt-1 text-sm text-slate-500">上传视频后自动建立项目，编辑内容、角色和时间轴，再提交到处理节点。</p></div><div className="flex gap-2"><Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />替换视频</Button><Button className="bg-violet-500 text-white hover:bg-violet-400"><Sparkles className="mr-2 h-4 w-4" />开始处理</Button></div></div>
        {isCreating && <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.06] p-3"><div className="mb-2 flex justify-between text-xs text-slate-300"><span>{uploadPaused ? "上传已暂停" : "正在分片上传并创建项目…"}</span><span>{uploadProgress}%</span></div><Progress value={uploadProgress} className="h-1.5 bg-white/10" /><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200" onClick={() => { uploadPauseRef.current = !uploadPauseRef.current; setUploadPaused(uploadPauseRef.current); }}>{uploadPaused ? "继续上传" : "暂停上传"}</Button><Button size="sm" variant="outline" className="border-red-400/20 bg-red-400/[0.05] text-red-200" onClick={() => { uploadCancelRef.current = true; uploadPauseRef.current = false; setUploadPaused(false); }}>取消上传</Button></div></div>}
        {previewError && <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100">{previewError}</div>}{previewStatus === "running" && <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3"><div className="mb-2 flex items-center justify-between text-xs text-cyan-100"><span>正在生成单句克隆试听…</span><span>{previewProgress}%</span></div><Progress value={previewProgress} className="h-1.5 bg-white/10" /><Button size="sm" variant="outline" className="mt-3 border-white/10 bg-white/[0.03] text-slate-200" onClick={() => void cancelPreview()}>取消试听</Button></div>}{previewStatus === "cached" && <div className="text-[11px] text-emerald-300">已命中本地音频缓存，跳过重复合成。</div>}
        <Card className="overflow-hidden border-white/10 bg-[#11141b] shadow-2xl shadow-black/20"><div className="relative aspect-video max-h-[400px] bg-gradient-to-br from-[#242130] via-[#141823] to-[#0d131b]">{previewUrl ? <video ref={videoRef} src={previewUrl} className="h-full w-full object-contain" onTimeUpdate={(event) => setPlayhead(Math.round(event.currentTarget.currentTime * 1000))} onEnded={() => setIsPlaying(false)} /> : <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 76% 30%, rgba(139,92,246,.34), transparent 26%), radial-gradient(circle at 20% 80%, rgba(6,182,212,.18), transparent 30%)" }} />}<div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-slate-300 backdrop-blur"><Film className="h-3.5 w-3.5" />{previewUrl ? "本地视频预览" : "预览画面 · 1920×1080"}</div><div className="absolute bottom-5 left-5 right-5 flex items-center gap-3"><Button size="icon" className="h-11 w-11 rounded-full bg-white text-slate-950 hover:bg-slate-200" onClick={toggleVideo}>{isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}</Button><div className="flex-1"><div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${(playhead / visibleDurationMs) * 100}%` }} /></div><div className="flex justify-between text-[11px] text-slate-400"><span>{timeLabel(playhead)}</span><span>{timeLabel(durationMs)}</span></div></div><Button size="icon" variant="ghost" className="text-slate-300 hover:bg-white/10"><Volume2 className="h-5 w-5" /></Button></div></div><div className="border-t border-white/10 bg-[#0e1117] px-5 py-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-slate-400"><Scissors className="h-3.5 w-3.5 text-violet-300" />时间轴与音频波形</div><div className="flex items-center gap-2 text-[11px] text-slate-500"><span>缩放</span><Slider value={timelineZoom} onValueChange={setTimelineZoom} min={0.5} max={4} step={0.25} className="w-28" /><span className="font-mono text-cyan-300">{timelineZoom[0].toFixed(2)}×</span></div><span className="text-[11px] text-slate-600">拖动片段；边缘可调整入点/出点</span></div><div ref={timelineRef} className="relative h-28 rounded-xl border border-white/5 bg-[#0a0c11] px-2 pt-5"><div className="absolute left-2 right-2 top-2 flex justify-between text-[10px] text-slate-600">{timelineMarkers.map((marker) => <span key={marker}>{timeLabel(marker)}</span>)}</div><div className="absolute bottom-10 left-2 right-2 flex h-8 items-center gap-px opacity-80">{waveform.map((value, index) => <span key={index} className="flex-1 rounded-full bg-cyan-300/40" style={{ height: `${Math.max(10, value * 100)}%` }} />)}</div><div className="absolute bottom-3 left-2 right-2 h-7">{segments.map((segment) => { const role = roles.find((item) => item.id === segment.role) ?? roles[0]; const left = (segment.startMs / visibleDurationMs) * 100; const width = Math.max(((segment.endMs - segment.startMs) / visibleDurationMs) * 100, 1.2); return <button key={segment.id} onClick={() => { setSelectedId(segment.id); setPlayhead(segment.startMs); }} onPointerDown={(event) => { event.preventDefault(); setSelectedId(segment.id); setDragState({ id: segment.id, mode: "move", x: event.clientX, startMs: segment.startMs, endMs: segment.endMs }); }} className={`absolute top-0 h-7 rounded border px-1 text-left ${segment.id === selectedId ? "border-white/80 ring-2 ring-white/20" : "border-white/10 hover:border-white/40"}`} style={{ left: `${left}%`, width: `${width}%`, backgroundColor: `${role.color}88` }}><span onPointerDown={(event) => { event.stopPropagation(); setDragState({ id: segment.id, mode: "start", x: event.clientX, startMs: segment.startMs, endMs: segment.endMs }); }} className="absolute inset-y-0 left-0 w-1 cursor-ew-resize bg-white/50" /><span className="block truncate text-[9px] font-medium text-white/90">{segment.id} · {role.name}</span><span onPointerDown={(event) => { event.stopPropagation(); setDragState({ id: segment.id, mode: "end", x: event.clientX, startMs: segment.startMs, endMs: segment.endMs }); }} className="absolute inset-y-0 right-0 w-1 cursor-ew-resize bg-white/50" /></button>; })}<div className="absolute bottom-0 top-0 w-px bg-white" style={{ left: `${(playhead / visibleDurationMs) * 100}%` }} /></div></div></div></Card>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#11141b] p-1"><button onClick={() => setActiveTab("transcript")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${activeTab === "transcript" ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Languages className="h-4 w-4" />字幕与配音</button><button onClick={() => setActiveTab("mix")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${activeTab === "mix" ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><SlidersHorizontal className="h-4 w-4" />背景混音</button><button onClick={() => setActiveTab("clone")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${activeTab === "clone" ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><WandSparkles className="h-4 w-4" />声音克隆</button></div>
        {activeTab === "transcript" && <Card className="border-white/10 bg-[#11141b]"><CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="text-base text-white">对白时间轴 <span className="ml-2 text-xs font-normal text-slate-500">{segments.length} segments</span></CardTitle><div className="flex items-center gap-2"><Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><Check className="mr-1 h-3 w-3" />可编辑</Badge><Button size="sm" variant="ghost" className="text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => pushHistory("新增片段")}> <Plus className="mr-1 h-3.5 w-3.5" />添加片段</Button></div></CardHeader><CardContent className="space-y-2"><div className="grid grid-cols-[44px_132px_minmax(0,1fr)_minmax(0,1fr)_100px] gap-3 px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-slate-600"><span>#</span><span>时间</span><span>原文</span><span>译文</span><span>角色 / 试听</span></div>{segments.map((segment) => { const role = roles.find((item) => item.id === segment.role) ?? roles[0]; return <div key={segment.id} className={`grid w-full grid-cols-[44px_132px_minmax(0,1fr)_minmax(0,1fr)_100px] items-center gap-3 rounded-xl border p-3 text-left ${selectedId === segment.id ? "border-violet-400/40 bg-violet-400/[0.08]" : "border-transparent bg-white/[0.02] hover:border-white/10"}`} onClick={() => setSelectedId(segment.id)}><span className="text-xs font-medium text-slate-500">{segment.id.toString().padStart(2, "0")}</span><span className="font-mono text-[11px] text-slate-400">{toClock(segment.startMs)}<br /><span className="text-slate-600">→ {toClock(segment.endMs)}</span></span><span className="truncate text-xs text-slate-300">{segment.source}</span><span className="truncate text-xs text-white">{segment.target}</span><span className="flex items-center gap-1.5 text-xs text-slate-300"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />{role.name}<Button size="icon" variant="ghost" className="ml-auto h-6 w-6 text-slate-400 hover:bg-white/10 hover:text-white" onClick={(event) => { event.stopPropagation(); if (playingSegment === segment.id) { previewAudioRef.current?.pause(); setPlayingSegment(null); } else void playSentence(segment); }}>{playingSegment === segment.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Button></span></div>; })}</CardContent></Card>}
        {activeTab === "mix" && <Card className="border-white/10 bg-[#11141b]"><CardHeader><CardTitle className="text-base text-white">背景混音</CardTitle></CardHeader><CardContent className="space-y-6"><div><div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">背景音乐与环境声</span><span className="font-mono text-cyan-300">{backgroundVolume[0]}%</span></div><Slider value={backgroundVolume} onValueChange={setBackgroundVolume} max={120} step={1} /></div><div><div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">普通话配音</span><span className="font-mono text-violet-300">{voiceVolume[0]}%</span></div><Slider value={voiceVolume} onValueChange={setVoiceVolume} max={140} step={1} /></div><div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 text-slate-200"><Layers3 className="h-4 w-4 text-cyan-300" />分离策略</div><p className="text-xs leading-5">保留 no_vocals 层，再按对白窗口做动态衰减，后续由处理节点完成最终混音。</p></div></CardContent></Card>}
        {activeTab === "clone" && <Card className="border-white/10 bg-[#11141b]"><CardHeader><CardTitle className="text-base text-white">声音克隆设置</CardTitle></CardHeader><CardContent><div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100"><WandSparkles className="mb-2 h-5 w-5 text-amber-300" /><p className="font-medium">真实处理节点试听</p><p className="mt-1 text-xs leading-5 text-amber-100/60">单句试听会调用配置好的 OpenVoice / GPT-SoVITS 处理节点，生成音频后在浏览器播放；未配置节点时会明确提示，不再回退到浏览器语音。</p></div><div className="mt-4 grid grid-cols-2 gap-3"><Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"><Upload className="mr-2 h-4 w-4" />上传参考音频</Button><Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"><AudioLines className="mr-2 h-4 w-4" />提取角色样本</Button></div></CardContent></Card>}
      </section>
      <aside className="space-y-5"><Card className="border-white/10 bg-[#11141b]"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base text-white">片段编辑</CardTitle><Badge style={{ color: selectedRole.color, borderColor: `${selectedRole.color}55`, backgroundColor: `${selectedRole.color}15` }}>{selectedRole.name}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><Label className="text-[11px] text-slate-500">开始 (ms)</Label><Input type="number" value={selected.startMs} onChange={(event) => updateSelected("startMs", Number(event.target.value))} className="mt-1 border-white/10 bg-black/20 font-mono text-xs text-slate-200" /></div><div><Label className="text-[11px] text-slate-500">结束 (ms)</Label><Input type="number" value={selected.endMs} onChange={(event) => updateSelected("endMs", Number(event.target.value))} className="mt-1 border-white/10 bg-black/20 font-mono text-xs text-slate-200" /></div></div><div><Label className="text-[11px] text-slate-500">角色</Label><Select value={selected.role} onValueChange={(value) => updateSelected("role", value)}><SelectTrigger className="mt-1 border-white/10 bg-black/20 text-slate-200"><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name} · {role.voice}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-[11px] text-slate-500">原文</Label><Textarea value={selected.source} onChange={(event) => updateSelected("source", event.target.value)} className="mt-1 min-h-20 resize-none border-white/10 bg-black/20 text-xs leading-5 text-slate-300" /></div><div><Label className="text-[11px] text-slate-500">普通话译文</Label><Textarea value={selected.target} onChange={(event) => updateSelected("target", event.target.value)} className="mt-1 min-h-20 resize-none border-violet-400/30 bg-violet-400/[0.04] text-xs leading-5 text-white" /></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-500">当前片段音量</span><span className="font-mono text-cyan-300">{selected.voiceGain}%</span></div><Slider value={[selected.voiceGain]} onValueChange={(value) => updateSelected("voiceGain", value[0] ?? 100)} min={0} max={160} step={1} /></div><div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"><span className="text-slate-500">识别置信度</span><span className="font-mono text-emerald-300">{selected.confidence}%</span></div><Button className="w-full bg-violet-500 text-white hover:bg-violet-400" onClick={() => void saveCurrentVersion()}><Save className="mr-2 h-4 w-4" />保存当前版本</Button></CardContent></Card><Card className="border-white/10 bg-[#11141b]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-white"><Settings2 className="h-4 w-4 text-slate-400" />处理队列</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">音频预处理</span><span className="text-emerald-300">完成</span></div><Progress value={100} className="h-1.5 bg-white/10" /></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">转写与翻译</span><span className="text-emerald-300">可编辑</span></div><Progress value={100} className="h-1.5 bg-white/10" /></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">配音与混音</span><span className="text-slate-500">{exportTaskId ? `${exportProgress}%` : exportUrl ? "完成" : "待开始"}</span></div><Progress value={exportProgress} className="h-1.5 bg-white/10" /></div><Separator className="bg-white/10" /><div className="flex gap-2"><Button variant="outline" className="flex-1 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10" onClick={() => exportTaskId ? void cancelExport() : void startExport()}>{exportTaskId ? "取消导出" : "开始导出"}</Button>{exportUrl && <Button asChild className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400"><a href={exportUrl} download><Download className="mr-2 h-4 w-4" />下载视频</a></Button>}</div></CardContent></Card><div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.14] to-cyan-400/[0.08] p-4"><p className="text-sm font-medium text-white">编辑历史</p><p className="mt-1 text-xs leading-5 text-slate-400">每次拖拽、文本修改和手动保存都会产生可回退快照。</p><Button variant="ghost" className="mt-2 px-0 text-xs text-violet-200 hover:bg-transparent hover:text-white" onClick={() => setShowHistory(true)}><History className="mr-1.5 h-3.5 w-3.5" />查看 {history.length} 个版本</Button></div></aside>
    </main>
    {showHistory && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#11141b] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">编辑历史与版本回退</h2><p className="mt-1 text-xs text-slate-500">选择一个快照恢复时间轴和对白内容。</p></div><Button size="icon" variant="ghost" className="text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => setShowHistory(false)}><X className="h-4 w-4" /></Button></div><div className="max-h-80 space-y-2 overflow-auto">{(remoteVersions.data?.length ?? 0) > 0 && <p className="px-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300">远程版本</p>}{remoteVersions.data?.slice().reverse().map((version) => <div key={`remote-${version.id}`} className="flex items-center justify-between rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-3"><div><p className="text-sm text-slate-200">{version.label}</p><p className="mt-1 text-[11px] text-slate-500">{new Date(version.createdAt).toLocaleString()}</p></div><Button size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10" onClick={() => void restoreRemoteSnapshot(version.id)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />回退</Button></div>)}{history.length === 0 && (remoteVersions.data?.length ?? 0) === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">还没有历史版本。修改片段或点击保存版本后，这里会出现快照。</div> : [...history].reverse().map((snapshot) => <div key={snapshot.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"><div><p className="text-sm text-slate-200">{snapshot.label}</p><p className="mt-1 text-[11px] text-slate-500">{snapshot.createdAt.toLocaleString()} · {snapshot.segments.length} 个片段</p></div><Button size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10" onClick={() => void restoreSnapshot(snapshot)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />回退</Button></div>)}</div></div></div>}
  </div>;
}
