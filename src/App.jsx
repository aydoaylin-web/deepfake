import HotspotImage from "./components/HotspotImage";
import translations, { LANGUAGES } from "./data/translations";
import IMAGE_HOTSPOTS from "./data/imageHotspots";
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadContentPack } from './content';
import {
  Bell, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Heart, Home,
  Maximize2, MessageCircle, MoreHorizontal, Plus, RefreshCw, Send,
  ShieldCheck, Sparkles, UserRound, X, ZoomIn, ZoomOut, Globe2, ScanSearch, HelpCircle, Info, Search
} from 'lucide-react';
import SourceCheckPanel from "./components/SourceCheckPanel";
import ProfileCheckPanel from "./components/ProfileCheckPanel";
import OriginCheckPanel from "./components/OriginCheckPanel";
import { matchReason } from "./data/conceptMatcher";
const STORAGE_KEY = 'deepfake-defender-react-state-v6';
const TARGET_SCORE = 20;
const MAX_TIPS = 5;
const ANALYSIS_TOOLS = [
  { id: "image", label: "Bildanalyse", icon: ScanSearch },
  { id: "source", label: "Quellenprüfung", icon: Globe2 },
  { id: "profile", label: "Profilprüfung", icon: UserRound },
  { id: "origin", label: "Bildherkunft", icon: Search },
];
const TASK_META = {
  news: { label: "Newskarte", notificationTitle: "Neuer gemeldeter Beitrag", notificationText: "Ein möglicherweise manipulierter Beitrag wurde zur Prüfung gemeldet." },
  liveCheck: { label: "Live-Check", notificationTitle: "Dringende Live-Prüfung", notificationText: "Ein viraler Beitrag muss schnell untersucht werden." },
  perspective: { label: "Perspektivwechsel", notificationTitle: "Wirkungsanalyse erforderlich", notificationText: "Untersuche die mögliche Absicht hinter dem Beitrag." },
  realityDefense: { label: "Reality Defense", notificationTitle: "Schutzstrategie erforderlich", notificationText: "Entwickle eine Regel zum Schutz vor ähnlichen Fällen." },
};
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
function imagePath(path) { return `${import.meta.env.BASE_URL}${String(path || "").replace(/^\//, "")}`; }
function playNotificationSound() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); osc.start(); osc.stop(ctx.currentTime + 0.4); } catch { /* Audio nicht verfügbar */ } }

function createUuid() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    "id-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}


export default function App() {
  const saved = loadState();
  const irisAudioRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const [irisListening, setIrisListening] = useState(false);
  const [irisSpeaking, setIrisSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [posts,setPosts]=useState([]); const [tasks,setTasks]=useState([]); const [profiles,setProfiles]=useState([]); const [dataStories,setDataStories]=useState([]); const [guides,setGuides]=useState([]); const [contentSettings,setContentSettings]=useState({}); const [contentManifest,setContentManifest]=useState(null); const [loading,setLoading]=useState(true); const [loadingError,setLoadingError]=useState('');
  const [lang, setLang] = useState(saved.lang || 'de');
  const t = (key) => (translations[lang]?.[key]) ?? translations.de[key] ?? key;
  const [activeTab,setActiveTab]=useState('feed'); const [feedMode,setFeedMode]=useState('forYou'); const [visibleCount,setVisibleCount]=useState(5);
  const [activeTask,setActiveTask]=useState(null); const [activePost,setActivePost]=useState(null); const [selectedAnswers,setSelectedAnswers]=useState([]); const [reason,setReason]=useState(''); const [feedback,setFeedback]=useState(null);
  const [taskPhase,setTaskPhase]=useState('inspect'); const [usedTools,setUsedTools]=useState([]); const [openTool,setOpenTool]=useState(null); const [verdict,setVerdict]=useState(''); const [taskOrigin,setTaskOrigin]=useState('push');
  const [score,setScore]=useState(saved.score??0); const [completed,setCompleted]=useState(saved.completed||[]); const [caseResults,setCaseResults]=useState(saved.caseResults||[]); const [agencyRules,setAgencyRules]=useState(saved.agencyRules||[]);
  const [liked,setLiked]=useState(saved.liked||[]); const [savedPosts,setSavedPosts]=useState(saved.savedPosts||[]); const [commentLikes,setCommentLikes]=useState(saved.commentLikes||[]); const [customComments,setCustomComments]=useState(saved.customComments||{});
  const [seconds,setSeconds]=useState(180);
  const [intro,setIntro]=useState(saved.introSeen!==true);
  const [demoStep,setDemoStep]=useState(-1);
  const [showResume,setShowResume]=useState(hasSavedProgress());
  const [simulationConfirmed,setSimulationConfirmed]=useState(false);
  const [selectedPost,setSelectedPost]=useState(null);
  const [commentsPost,setCommentsPost]=useState(null);  const [activeNotification,setActiveNotification]=useState(null); const [notifiedTasks,setNotifiedTasks]=useState([]); const [notificationHistory,setNotificationHistory]=useState(saved.notificationHistory||[]); const [unreadNotificationCount,setUnreadNotificationCount]=useState(saved.unreadNotificationCount||0); const [confidence,setConfidence]=useState(3); const [evaluating,setEvaluating]=useState(false);
  const [researchEvents,setResearchEvents]=useState(saved.researchEvents||[]); const [sessionId]=useState(saved.sessionId||createUuid()); const [participantCode,setParticipantCode]=useState(saved.participantCode||`P-${createUuid().slice(0,6).toUpperCase()}`); const [aiStatus,setAiStatus]=useState({api:'checking',ollama:false});
  const [zoom,setZoom]=useState(1); const [heartBurst,setHeartBurst]=useState(null); const [storyPulse,setStoryPulse]=useState(0); const [commentDraft,setCommentDraft]=useState('');
  const [runOrder,setRunOrder]=useState(saved.runOrder||[]); const [runId,setRunId]=useState(saved.runId||createUuid()); const [runSummary,setRunSummary]=useState(null); const [tipsRemaining,setTipsRemaining]=useState(saved.tipsRemaining??MAX_TIPS); const [revealedHints,setRevealedHints]=useState([]);
  const notificationTimeout=useRef(null); const loaderRef=useRef(null); const taskStartedAt=useRef(null);

  function hasSavedProgress(){const s=loadState();return (((s.completed?.length)||0)>0 || (s.score??0)!==0 || ((s.caseResults?.length)||0)>0);}

  const taskMap=useMemo(()=>Object.fromEntries(tasks.map(t=>[t.id,t])),[tasks]);
  const feedPosts=useMemo(()=>feedMode==='following'?posts.filter((_,i)=>i%2===0):posts,[posts,feedMode]);
  const visiblePosts=feedPosts.slice(0,visibleCount);
  const nextMissionId=useMemo(()=>runOrder.find(id=>!completed.includes(id))||null,[runOrder,completed]);
  const totalMissionCount=tasks.length;
  const progressPercent=totalMissionCount?Math.min(100,Math.round((completed.length/totalMissionCount)*100)):0;
  const profileMap=useMemo(()=>Object.fromEntries(profiles.map(profile=>[profile.id,profile])),[profiles]);
  const stories=useMemo(()=>[...dataStories].sort((a,b)=>(a.priority??99)-(b.priority??99)).map((story,index)=>{const profile=profileMap[story.profileId]||{};return {name:story.label||profile.displayName||profile.username||'Story',letter:index===0?<Plus size={20}/>:String(profile.displayName||profile.username||'?').slice(0,2).toUpperCase(),className:profile.accent||'blue',status:story.status||'new'};}),[dataStories,profileMap]);
  const taskMeta=contentSettings.taskTypes||TASK_META;
  const targetScore=Number(contentSettings.targetScore)||TARGET_SCORE;

  useEffect(()=>{ setLoading(true); loadContentPack().then(pack=>{
    const {posts:p,tasks:t,profiles:profileData,stories:storyData,guides:guideData,settings,manifest}=pack;
    const followed=new Set(t.map(task=>task.followUpTaskId).filter(Boolean));
    const pushTaskIds=new Set(p.map(post=>post.taskId).filter(Boolean));
    const primary=t.filter(task=>pushTaskIds.has(task.id)&&!followed.has(task.id)).map(task=>task.id);
    const postsWithSavedComments=p.map(post=>({...post,comments:[...(post.comments||[]),...(saved.customComments?.[post.id]||[])]}));setPosts(settings.randomizeFeed===false?postsWithSavedComments:shuffle(postsWithSavedComments));setTasks(t);setProfiles(profileData);setDataStories(storyData);setGuides(guideData);setContentSettings(settings);setContentManifest(manifest);setRunOrder(current=>current.length?current:(settings.randomizePrimaryMissions===false?primary:shuffle(primary)));setLoading(false);
  }).catch(e=>{setLoadingError(e.message);setLoading(false);}); },[]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        score,
        completed,
        caseResults,
        agencyRules,
        liked,
        savedPosts,
        commentLikes,
        customComments,
        introSeen: !intro,
        lang,
        researchEvents,
        sessionId,
        participantCode,
        runOrder,
        runId,
        tipsRemaining,
      })
    );
  }, [
    score,
    completed,
    caseResults,
    agencyRules,
    liked,
    savedPosts,
    commentLikes,
    customComments,
    intro,
    lang,
    researchEvents,
    sessionId,
    participantCode,
    runOrder,
    runId,
    tipsRemaining,
  ]);
  
  useEffect(() => {
    return () => {
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        // Spracherkennung war bereits beendet.
      }

      if (irisAudioRef.current) {
        irisAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(()=>{ fetch('/api/health').then(r=>r.json()).then(setAiStatus).catch(()=>setAiStatus({api:'offline',ollama:false})); },[]);
  useEffect(()=>{ if(!saved.sessionId) logResearchEvent('session_started',{participantCode,runId,userAgent:navigator.userAgent,viewport:`${window.innerWidth}x${window.innerHeight}`}); },[]);
  useEffect(()=>{ if(!activeTask||feedback)return; setSeconds(activeTask.timeLimit||240); const id=setInterval(()=>setSeconds(v=>Math.max(0,v-1)),1000); return()=>clearInterval(id); },[activeTask,feedback]);
  useEffect(()=>{ if(seconds===0&&activeTask&&!feedback)submitTask(true); },[seconds]);
  useEffect(()=>{ const blocked=selectedPost||activeTask||intro||commentsPost||showResume; document.body.style.overflow=blocked?'hidden':''; return()=>{document.body.style.overflow='';}; },[selectedPost,activeTask,intro,commentsPost,showResume]);
  useEffect(()=>{ const id=setInterval(()=>setStoryPulse(v=>v+1),2600); return()=>clearInterval(id); },[]);
  useEffect(()=>{ const onKey=(e)=>{if(e.key==='Escape'){setSelectedPost(null);setCommentsPost(null);if(activeTask)setActiveTask(null);} if(selectedPost&&e.key==='ArrowRight')navigatePost(1); if(selectedPost&&e.key==='ArrowLeft')navigatePost(-1);}; window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey); });

  useEffect(()=>{
    if(activeTab!=='feed'||!posts.length||!tasks.length||intro)return;
    const observer=new IntersectionObserver(entries=>{const hit=entries.find(e=>e.isIntersecting&&e.intersectionRatio>=.55);if(!hit||activeNotification||activeTask)return;const taskId=hit.target.dataset.taskId;if(!taskId||completed.includes(taskId)||notifiedTasks.includes(taskId))return;if(nextMissionId&&taskId!==nextMissionId)return;clearTimeout(notificationTimeout.current);notificationTimeout.current=setTimeout(()=>{const task=tasks.find(t=>t.id===taskId);const post=posts.find(p=>p.id===hit.target.dataset.postId);if(task&&post){const notification={id:`${task.id}-${Date.now()}`,taskId:task.id,postId:post.id,type:task.type,title:t('pushTitle_'+task.type),text:t('pushText_'+task.type),username:post.username,caption:post.caption,media:post.media,time:new Date().toLocaleTimeString(lang==='de'?'de-DE':'en-GB',{hour:'2-digit',minute:'2-digit'})};setActiveNotification({task,post});setNotificationHistory(items=>[notification,...items.filter(item=>item.taskId!==task.id)].slice(0,20));setUnreadNotificationCount(count=>count+1);setNotifiedTasks(items=>[...new Set([...items,taskId])]);}},700);},{threshold:[.55]});
    document.querySelectorAll('[data-task-id]').forEach(el=>observer.observe(el)); return()=>{observer.disconnect();clearTimeout(notificationTimeout.current);};
  },[activeTab,posts,tasks,intro,activeNotification,activeTask,completed,notifiedTasks,nextMissionId]);

  useEffect(() => {
    if (activeTab !== 'feed' || intro || !posts.length || !tasks.length) return;
    let timeoutId;
    const scheduleNext = () => {
      const delay = 12000 + Math.random() * 13000;
      timeoutId = setTimeout(() => {
        if (!activeNotification && !activeTask) {
          const candidateId = runOrder.find(id => !completed.includes(id) && !notifiedTasks.includes(id));
          if (candidateId) {
            const task = tasks.find(t => t.id === candidateId);
            const post = posts.find(p => p.id === task?.postId);
            if (task && post) {
              setActiveNotification({ task, post });
              setUnreadNotificationCount(count => count + 1);
              playNotificationSound();
              setNotifiedTasks(items => [...new Set([...items, candidateId])]);
              logResearchEvent('push_notification_shown', { taskId: task.id, postId: post.id, trigger: 'timer' });
            }
          }
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [activeTab, intro, posts, tasks, runOrder, completed, notifiedTasks, activeNotification, activeTask]);

  useEffect(()=>{ if(!loaderRef.current)return; const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)setVisibleCount(v=>Math.min(posts.length,v+3));},{rootMargin:'300px'}); observer.observe(loaderRef.current); return()=>observer.disconnect(); },[posts.length]);

  useEffect(()=>{
      const onReturn=()=>{
        if(document.visibilityState!=='visible')return;
        if(activeTask||intro||selectedPost||commentsPost)return;
        if(hasSavedProgress())setShowResume(true);
      };
      document.addEventListener('visibilitychange',onReturn);
      window.addEventListener('focus',onReturn);
      return()=>{document.removeEventListener('visibilitychange',onReturn);window.removeEventListener('focus',onReturn);};
    },[activeTask,intro,selectedPost,commentsPost]);

  function startIrisAudio() {
    const audio = irisAudioRef.current;

    if (!audio) {
      setSpeechError(lang === 'de'
        ? 'Die Iris-Audiodatei wurde nicht gefunden.'
        : 'The Iris audio file could not be found.');
      return;
    }

    audio.currentTime = 0;
    setSpeechError('');

    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch(error => {
        console.error('Iris-Audio konnte nicht gestartet werden:', error);
        setIrisSpeaking(false);
        setSpeechError(lang === 'de'
          ? 'Das Audio wurde vom Browser blockiert. Tippe erneut auf „Sprachsteuerung aktivieren“.'
          : 'The browser blocked the audio. Tap “Enable voice control” again.');
      });
    }
  }

  function activateIrisListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(lang === 'de'
        ? 'Dieser Browser unterstützt die Spracherkennung nicht.'
        : 'This browser does not support speech recognition.');
      return;
    }

    if (irisListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'de' ? 'de-DE' : 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIrisListening(true);
      setSpeechError('');
    };

    recognition.onresult = event => {
      const lastResult = event.results[event.results.length - 1];
      const spokenText = lastResult[0].transcript.toLowerCase().trim();

      console.log('Erkannt:', spokenText);

      const wakeWordDetected =
        spokenText.includes('hallo iris') ||
        spokenText.includes('hello iris') ||
        spokenText.includes('halo iris');

      if (wakeWordDetected) {
        recognition.stop();
        startIrisAudio();
      }
    };

    recognition.onerror = event => {
      console.error('Fehler bei der Spracherkennung:', event.error);
      setIrisListening(false);

      const message = event.error === 'not-allowed'
        ? (lang === 'de'
          ? 'Bitte erlaube den Mikrofonzugriff.'
          : 'Please allow microphone access.')
        : event.error === 'no-speech'
          ? (lang === 'de'
            ? 'Es wurde keine Sprache erkannt. Versuche es erneut.'
            : 'No speech was detected. Please try again.')
          : (lang === 'de'
            ? 'Die Spracherkennung konnte nicht gestartet werden.'
            : 'Speech recognition could not be started.');

      setSpeechError(message);
    };

    recognition.onend = () => {
      setIrisListening(false);
    };

    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error('Spracherkennung konnte nicht gestartet werden:', error);
      setIrisListening(false);
    }
  }

  function stopIrisListening() {
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // Spracherkennung war bereits beendet.
    }

    setIrisListening(false);
  }

  function stopIrisAudio() {
    const audio = irisAudioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIrisSpeaking(false);
  }

  function logResearchEvent(type,payload={}){setResearchEvents(events=>[...events,{id:createUuid(),sessionId,participantCode,runId,type,timestamp:new Date().toISOString(),...payload}]);}
  function clearResearchData(){if(!window.confirm('Delete all locally stored research events for this session?'))return;setResearchEvents([]);}
  function normalizeAnswer(v=''){return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
  function localRuleEvaluation(task,text){const n=normalizeAnswer(text);const words=new Set(n.split(' ').filter(Boolean));const w=(task.acceptedWords||[]).find(c=>{const x=normalizeAnswer(c);return x.includes(' ')?n.includes(x):words.has(x);});const p=(task.acceptedPhrases||[]).find(c=>n.includes(normalizeAnswer(c)));return w||p?{status:'accepted',accepted:true,feedback:'',mode:w?'accepted-word':'accepted-phrase',matchedCriterion:w||p}:null;}
  async function evaluateWrittenReason(task,text){const local=localRuleEvaluation(task,text);if(local)return local;const r=await fetch('/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:task.id,instruction:task.instruction,answer:text,acceptedWords:task.acceptedWords||[],acceptedPhrases:task.acceptedPhrases||[],referenceAnswers:task.referenceAnswers||[],rubric:task.rubric||[]})});if(!r.ok)throw new Error('Semantic evaluation is currently unavailable.');return r.json();}
  function downloadFile(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
  function exportResearchJson(){downloadFile(`deepfake-defender-${participantCode}-${sessionId}.json`,JSON.stringify({schemaVersion:'1.0',exportedAt:new Date().toISOString(),participantCode,sessionId,runId,contentPack:{name:contentManifest?.name,version:contentManifest?.version},score,completed,caseResults,agencyRules,researchEvents},null,2),'application/json');}
  function exportResearchCsv(){const h=['timestamp','participantCode','sessionId','runId','type','taskId','postId','correct','points','confidence','responseTimeMs','timeRemaining','evaluationMode','reason'];const rows=researchEvents.map(e=>h.map(k=>JSON.stringify(e[k]??'')).join(','));downloadFile(`deepfake-defender-${participantCode}-${sessionId}.csv`,[h.join(','),...rows].join('\n'),'text/csv;charset=utf-8');}

  const completedNewsRounds=caseResults.filter(result=>result.type==='news').length;
  const freeHintRounds=completedNewsRounds<3;
  const hintMode=freeHintRounds?'free':tipsRemaining>0?'limited':'empty';
  const hintButtonLabel=freeHintRounds?t('hintShowFree'):tipsRemaining>0?`${t('hintUse')} (${tipsRemaining}/${MAX_TIPS})`:t('hintNoneLeft');

  function useHint(toolId){
    if(revealedHints.includes(toolId)){setRevealedHints(items=>items.filter(id=>id!==toolId));return;}
    if(hintMode==='empty')return;
    if(!freeHintRounds)setTipsRemaining(value=>Math.max(0,value-1));
    setRevealedHints(items=>[...items,toolId]);
    logResearchEvent('hint_used',{taskId:activeTask?.id,postId:activePost?.id,toolId,free:freeHintRounds,tipsRemainingAfter:freeHintRounds?tipsRemaining:Math.max(0,tipsRemaining-1)});
  }

  function openTask(taskId,postOverride=null,origin='push'){const task=taskMap[taskId];if(!task||completed.includes(taskId))return;const post=postOverride||posts.find(p=>p.id===task.postId)||null;setActiveNotification(null);if(origin==='push')setUnreadNotificationCount(count=>Math.max(0,count-1));setActiveTask(task);setActivePost(post);setSelectedAnswers([]);setReason('');setConfidence(3);setFeedback(null);setTaskPhase(task.type==='news'?'inspect':'answer');setUsedTools([]);setOpenTool(null);setRevealedHints([]);setVerdict('');setTaskOrigin(origin);taskStartedAt.current=Date.now();logResearchEvent('task_opened',{taskId:task.id,postId:post?.id||task.postId,origin});}
  function useAnalysisTool(toolId){ if(!activeTask)return; setOpenTool(current=>current===toolId?null:toolId); if(!usedTools.includes(toolId)){setUsedTools(items=>[...items,toolId]);logResearchEvent('analysis_tool_used',{taskId:activeTask.id,postId:activePost?.id,toolId,order:usedTools.length+1});} }
  function toggleAnswer(id){if(!activeTask)return;setSelectedAnswers(cur=>activeTask.answerMode==='multipleChoice'?(cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]):[id]);if(feedback?.validation)setFeedback(null);}
  function isCorrectAnswer(task,answers){const correct=task.correctAnswers||[];if(task.answerMode==='multipleChoice'){const required=task.minimumCorrectSelections||correct.length;return answers.filter(a=>correct.includes(a)).length>=required&&answers.every(a=>correct.includes(a));}return answers.some(a=>correct.includes(a));}
  async function submitTask(expired=false){if(!activeTask||feedback||evaluating)return;const open=activeTask.answerMode==='openAnalysis';if(!expired&&activeTask.type==='news'&&!verdict){setFeedback({validation:true,text:t('valChooseVerdict')});return;}if(!expired&&!open&&!selectedAnswers.length){setFeedback({validation:true,text:t('valSelectAnswer')});return;}if(!expired&&(open||activeTask.answerMode==='singleChoiceWithReason')&&reason.trim().length<(activeTask.minimumReasonLength||0)){setFeedback({validation:true,text:t('valTypeClue')});return;}const isNews=activeTask.type==='news'&&!!activeTask.correctVerdict;const reasonEval=(isNews&&reason.trim())?matchReason(activePost?.id||activeTask.postId,reason):null;const verdictCorrect=!isNews||verdict===activeTask.correctVerdict;let correct,delta,point1=0,point2=0;if(isNews){point1=(!expired&&verdictCorrect)?1:0;point2=(!expired&&reasonEval&&reasonEval.matched)?1:0;delta=point1+point2;correct=!expired&&verdictCorrect;}else{const reasoningCorrect=isCorrectAnswer(activeTask,selectedAnswers);correct=!expired&&verdictCorrect&&reasoningCorrect;delta=correct?activeTask.pointsCorrect:activeTask.pointsWrong;}setScore(v=>v+delta);setCompleted(items=>[...new Set([...items,activeTask.id])]);const responseTimeMs=taskStartedAt.current?Date.now()-taskStartedAt.current:null;setCaseResults(items=>[...items.filter(i=>i.taskId!==activeTask.id),{taskId:activeTask.id,postId:activeTask.postId,title:activeTask.title,type:activeTask.type,correct,delta,answers:selectedAnswers,verdict,analysisTools:usedTools,reason,confidence,responseTimeMs,verdictCorrect,reasonMatched:point2===1,matchedConceptId:reasonEval?.conceptId||null,point1,point2}]);if(correct&&activeTask.type==='realityDefense'){const rule=activeTask.ruleToSaveFromAnswer?reason.trim():activeTask.ruleToSave;if(rule)setAgencyRules(items=>[...new Set([...items,rule])]);}logResearchEvent('task_submitted',{taskId:activeTask.id,postId:activeTask.postId,origin:taskOrigin,correct,points:delta,answers:selectedAnswers.join('|'),verdict,correctVerdict:activeTask.correctVerdict||'',analysisTools:usedTools.join('|'),reason,confidence,responseTimeMs,timeRemaining:seconds,verdictCorrect,reasonMatched:point2===1,matchedConceptId:reasonEval?.conceptId||'',matchedVia:reasonEval?.via||'',reasonHadSlangOnly:reasonEval?.hadSlangOnly||false,point1,point2});
    const projectedCompleted=[...new Set([...completed,activeTask.id])];
    const projectedScore=score+delta;
    if(projectedScore>=targetScore||projectedScore<=-10||projectedCompleted.length>=tasks.length){setRunSummary({score:projectedScore,correct:caseResults.filter(item=>item.correct).length+(correct?1:0),total:projectedCompleted.length,targetReached:projectedScore>=targetScore,lost:projectedScore<=-10});}
    const VL={echt:t('verdictEcht'),manipuliert:t('verdictManipuliert'),suspekt:t('verdictSuspekt')};const actualReason=reasonEval&&reasonEval.feedback?(reasonEval.feedback[lang]||reasonEval.feedback.de):(verdictCorrect?activeTask.feedbackCorrect:activeTask.feedbackWrong);setFeedback({correct,delta,point1,point2,verdictCorrect,reasonMatched:point2===1,correctVerdictLabel:VL[activeTask.correctVerdict]||activeTask.correctVerdict,yourReason:reason.trim(),actualReason,expired});setEvaluating(false);}
  function closeTask(){const next=feedback?.correct?activeTask?.followUpTaskId:null;const post=activePost;setActiveTask(null);setActivePost(null);setFeedback(null);setTaskPhase('inspect');setUsedTools([]);setOpenTool(null);setRevealedHints([]);setVerdict('');if(next&&!completed.includes(next))setTimeout(()=>openTask(next,post),300);}
  function toggle(list,setter,id){setter(list.includes(id)?list.filter(x=>x!==id):[...list,id]);}
  function startNewRun(){
    const followed=new Set(tasks.map(task=>task.followUpTaskId).filter(Boolean));
    const pushTaskIds=new Set(posts.map(post=>post.taskId).filter(Boolean));
    const primary=tasks.filter(task=>pushTaskIds.has(task.id)&&!followed.has(task.id)).map(task=>task.id);
    const newRunId=createUuid();
    setPosts(items=>shuffle(items));setRunOrder(shuffle(primary));setRunId(newRunId);setVisibleCount(5);setNotifiedTasks([]);setActiveNotification(null);
    setScore(0);setCompleted([]);setCaseResults([]);setAgencyRules([]);setTipsRemaining(MAX_TIPS);setRevealedHints([]);setUnreadNotificationCount(0);setNotificationHistory([]);setRunSummary(null);setActiveTab('feed');
    logResearchEvent('new_run_started',{runId:newRunId,previousCompletedTasks:completed.length,previousScore:score});window.scrollTo({top:0,behavior:'smooth'});
  }
  function addComment(){
    const text=commentDraft.trim();
    if(!commentsPost||!text)return;
    const postId=commentsPost.id;
    const newComment={id:createUuid(),username:'agency_team',text,time:'now'};
    setCustomComments(current=>({...current,[postId]:[...(current[postId]||[]),newComment]}));
    setPosts(items=>items.map(post=>post.id===postId?{...post,comments:[...(post.comments||[]),newComment]}:post));
    setCommentsPost(current=>current?.id===postId?{...current,comments:[...(current.comments||[]),newComment]}:current);
    setSelectedPost(current=>current?.id===postId?{...current,comments:[...(current.comments||[]),newComment]}:current);
    setCommentDraft('');
