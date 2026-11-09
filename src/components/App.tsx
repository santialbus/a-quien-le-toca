"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { AlertCircle, ArrowLeft, Check, ChevronDown, CirclePlus, Copy, Crown, Gavel, Home, LoaderCircle, Plus, RotateCw, Settings, ShieldAlert, Sparkles, Trash2, Trophy, Users, Volume2, Wallet, X } from "lucide-react";
import { auth, firebaseConfigured } from "@/lib/firebase";
import {
  addMember,
  addPenalty,
  addTask,
  createGroup,
  getGroup,
  joinGroup,
  listenDraws,
  listenGroups,
  listenMembers,
  listenPenalties,
  listenTasks,
  listenRoulette,
  startRoulette,
  finishRoulette,
  removeMember,
  removeTask,
  updateDrawTask,
  addDefaultTasksToGroup,
} from "@/lib/store";
import { buzz, fanfare, tick } from "@/lib/audio";

import type { Draw, Group, Member, Penalty, Task, RouletteState } from "@/lib/types";
import AdBanner from "@/components/AdBanner";

const LOSER_PHRASES = [
  "Enhorabuena... te ha tocado sufrir.",
  "Hoy los astros están en tu contra.",
  "Alguien tenía que hacerlo. Y te ha tocado a ti.",
  "La suerte es una traidora.",
  "No corras, sabemos que estás ahí.",
  "El universo acaba de asignarte trabajo.",
  "Se busca voluntario... ¡demasiado tarde!",
  "Tus compañeros te agradecen el sacrificio.",
  "Hoy no libras, campeón.",
  "La ruleta no tiene corazón.",
  "Tu destino estaba escrito. Y era fregar.",
  "Sonríe, podría haberle tocado a otro.",
  "No es mala suerte, es organización doméstica.",
  "Hoy te ha tocado ser una persona responsable.",
  "El karma tiene una lista y estás en ella.",
  "¡Premio! Una tarea para ti.",
  "No hay escapatoria. La ruleta ha hablado.",
  "Tus vacaciones de las tareas han terminado.",
  "Alguien tiene que mantener esto en orden.",
  "Qué bonito es compartir... las tareas.",
  "La vida te da sorpresas. Esta no es buena.",
  "Hoy eres el héroe que nadie pidió.",
  "Un aplauso para el nuevo esclavo del hogar.",
  "La suerte ha decidido tomarse el día libre contigo.",
  "No llores, solo es una tarea... o eso dicen.",
  "Tu equipo cree en ti. Nosotros no tanto.",
  "El descanso puede esperar. La tarea no.",
  "Has sido elegido. No puedes rechazar el destino.",
  "¡Qué suerte la tuya! Bueno... no.",
  "La gloria es temporal. La tarea es tuya."
];

function getLoserPhrase(spinId: string) {
  let hash = 0;

  for (let i = 0; i < spinId.length; i++) {
    hash = (hash * 31 + spinId.charCodeAt(i)) >>> 0;
  }

  return LOSER_PHRASES[hash % LOSER_PHRASES.length];
}

const DEFAULT_TASKS = [
  "Bajar la basura",
  "Fregar los platos",
  "Pasear al perro",
  "Pagar los cafés",
  "Hacer la compra"
];

type Tab = "ruleta" | "grupo" | "ranking";
const cx = (...v: (string | false | undefined)[]) => v.filter(Boolean).join(" ");

export default function App() {
  const [uid, setUid] = useState(""); const [authError, setAuthError] = useState("");
  const [groups, setGroups] = useState<Group[]>([]); const [active, setActive] = useState("");
  const [members, setMembers] = useState<Member[]>([]); const [tasks, setTasks] = useState<Task[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]); const [draws, setDraws] = useState<Draw[]>([]);
  const [tab, setTab] = useState<Tab>("ruleta"); const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<Member | null>(null);
  const [winnerTask, setWinnerTask] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [spinning, setSpinning] = useState(false); const [rotation, setRotation] = useState(0);
  const [modal, setModal] = useState<"create" | "join" | "member" | "task" | "fine" | null>(null);
  const [groupName, setGroupName] = useState(""); const [personName, setPersonName] = useState("");
  const [joinCode, setJoinCode] = useState(""); const [taskName, setTaskName] = useState("");
  const [fineType, setFineType] = useState<"money" | "challenge">("money");
  const [fineAmount, setFineAmount] = useState("2"); const [fineDescription, setFineDescription] = useState("Invita a un café");
  const [fineTarget, setFineTarget] = useState(""); const [notice, setNotice] = useState("");
  const [activeGroupData, setActiveGroupData] = useState<Group | null>(null);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [defaultTasksAdded, setDefaultTasksAdded] = useState(false);
  const [rouletteState, setRouletteState] = useState<RouletteState | null>(null);
  const [spinDuration, setSpinDuration] = useState(3400);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);

  const lastAnimatedSpin = useRef("");
  const lastCelebratedSpin = useRef("");
  const initialFinishedSpin = useRef("");

  useEffect(() => {
    if (!uid || !firebaseConfigured) return;

    const saved = window.localStorage.getItem("activeGroup");
    if (saved) setActive(saved);

    const savedJoined = JSON.parse(
      window.localStorage.getItem("joinedGroups") || "[]"
    ) as string[];

    Promise.all(savedJoined.map(id => getGroup(id)))
      .then(results => {
        setJoinedGroups(results.filter((g): g is Group => g !== null));
      });

    return listenGroups(uid, setGroups);
  }, [uid]);
  useEffect(() => {
    if (!active) {
      setActiveGroupData(null);
      return;
    }

    let cancelled = false;

    getGroup(active)
      .then(group => {
        if (!cancelled) {
          setActiveGroupData(group);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setNotice(
            error instanceof Error
              ? error.message
              : "No se pudo recuperar el grupo."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active]);
  useEffect(() => {
    const firebaseAuth = auth;

    if (!firebaseConfigured || !firebaseAuth) return;

    return onAuthStateChanged(firebaseAuth, async user => {
      if (user) {
        setUid(user.uid);
      } else {
        try {
          const result = await signInAnonymously(firebaseAuth);
          setUid(result.user.uid);
        } catch (e) {
          setAuthError(
            e instanceof Error ? e.message : "No se pudo iniciar sesión."
          );
        }
      }
    });
  }, []);
  useEffect(() => {
    if (active) window.localStorage.setItem("activeGroup", active);
    else window.localStorage.removeItem("activeGroup");
  }, [active]);
  useEffect(() => {
    if (!active) {
      setMembers([]);
      setTasks([]);
      setPenalties([]);
      setDraws([]);
      setRouletteState(null);
      setSpinning(false);
      setWinner(null);
      return;
    }

    setRouletteState(null);

    let firstRouletteSnapshot = true;

    const unsubs = [
      listenMembers(active, setMembers),
      listenTasks(active, setTasks),
      listenPenalties(active, setPenalties),
      listenDraws(active, setDraws),
      listenRoulette(active, state => {
        if (firstRouletteSnapshot) {
          firstRouletteSnapshot = false;

          initialFinishedSpin.current =
            state?.status === "finished" ? state.spinId : "";
        }

        setRouletteState(state);
      }),
    ];

    return () => unsubs.forEach(fn => fn());
  }, [active]);

  useEffect(() => {
    if (!rouletteState || !active) return;

    if (rouletteState.status === "spinning") {
      setWinnerModalOpen(false);
      // Evita iniciar dos veces la animación del mismo sorteo.
      if (lastAnimatedSpin.current === rouletteState.spinId) return;

      lastAnimatedSpin.current = rouletteState.spinId;

      const startedAt = rouletteState.startedAt as
        | { toMillis?: () => number }
        | undefined;

      const elapsed = startedAt?.toMillis
        ? Math.max(0, Date.now() - startedAt.toMillis())
        : 0;

      const remaining = Math.max(
        0,
        rouletteState.durationMs - elapsed
      );

      setWinner(null);
      setSpinning(true);
      setSpinDuration(Math.max(remaining, 1));

      // Todos los dispositivos utilizan el mismo incremento.
      const extra =
        1440 +
        [...rouletteState.spinId].reduce(
          (sum, char) => sum + char.charCodeAt(0),
          0
        ) % 1080;

      setRotation(r => r + extra);

      buzz(25);

      const interval = window.setInterval(() => {
        tick();
      }, 110);

      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);

        finishRoulette(active, rouletteState.spinId).catch(error => {
          console.trace("TRAZA DEL ERROR");
          console.error("ERROR COMPLETO:", error);
          console.error("ERROR STRING:", String(error));
          console.error(
            "ERROR JSON:",
            JSON.stringify(error, Object.getOwnPropertyNames(error))
          );
        });
      }, remaining);

      return () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      };
    }

    // El sorteo ha terminado: todos muestran el mismo resultado.
    setSpinning(false);

    setWinner({
      uid: rouletteState.winnerUid,
      name: rouletteState.winnerName,
    } as Member);

    setWinnerTask(rouletteState.taskTitle);

    if (initialFinishedSpin.current === rouletteState.spinId) {
      // Es el último resultado guardado, no un sorteo nuevo.
      initialFinishedSpin.current = "";
      setWinnerModalOpen(false);
    } else {
      // Es un sorteo que acaba de terminar.
      setWinnerModalOpen(true);
    }

    // Solo reproduce la celebración si este dispositivo vio el giro.
    if (
      lastAnimatedSpin.current === rouletteState.spinId &&
      lastCelebratedSpin.current !== rouletteState.spinId
    ) {
      lastCelebratedSpin.current = rouletteState.spinId;
      fanfare();
      buzz([40, 35, 80]);
    }
  }, [rouletteState, active]);

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTask("");
    } else if (!tasks.some(task => task.title === selectedTask)) {
      setSelectedTask(tasks[0].title);
    }
  }, [tasks, selectedTask]);

  const group =
    groups.find(g => g.id === active) ??
    (activeGroupData?.id === active ? activeGroupData : undefined);
  const taskList = tasks;
  const sorted = useMemo(() => {
    const now = new Date();
    const monthly = penalties.filter(p => {
      const date = (p.createdAt as { toDate?: () => Date } | undefined)?.toDate?.();
      return date ? date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() : false;
    });
    return members.map(m => ({
      ...m, count: monthly.filter(p => p.targetUid === m.uid).length,
      euros: monthly.filter(p => p.targetUid === m.uid && p.type === "money").reduce((s, p) => s + (p.amount || 0), 0)
    })).sort((a, b) => b.count - a.count);
  }, [members, penalties]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNotice("");
    try { await fn(); } catch (e) { setNotice(e instanceof Error ? e.message : "Ha ocurrido un error."); }
    finally { setBusy(false); }
  };
  const create = () => run(async () => {
    if (!groupName.trim() || !personName.trim()) throw new Error("Indica el nombre del grupo y el tuyo.");
    const id = await createGroup(groupName.trim(), uid, personName.trim());
    setActive(id); setModal(null); setGroupName(""); setPersonName(""); setTab("ruleta");
  });
  const join = () => run(async () => {
    if (!joinCode.trim() || !personName.trim()) {
      throw new Error("Necesitamos el código y tu nombre.");
    }

    const joinedGroup = await joinGroup(
      joinCode,
      uid,
      personName.trim()
    );

    setActiveGroupData(joinedGroup);
    setJoinedGroups(previous => {
      const updated = [
        ...previous.filter(g => g.id !== joinedGroup.id),
        joinedGroup
      ];

      window.localStorage.setItem(
        "joinedGroups",
        JSON.stringify(updated.map(g => g.id))
      );

      return updated;
    });
    setActive(joinedGroup.id);
    setModal(null);
    setJoinCode("");
    setPersonName("");
    setTab("ruleta");
  });

  const spin = async () => {
    if (spinning || members.length < 1 || !selectedTask || !group) return;

    const chosen = members[Math.floor(Math.random() * members.length)];

    await run(async () => {
      await startRoulette(active, {
        winnerUid: chosen.uid,
        winnerName: chosen.name,
        taskTitle: selectedTask,
        createdBy: uid,
      });
    });
  };

  const addFine = () => run(async () => {
    const target = members.find(m => m.uid === fineTarget);
    if (!target) throw new Error("Selecciona a quién sancionar.");

    const amount = fineType === "money" ? Number(fineAmount) : undefined;

    if (fineType === "money" && (!amount || amount <= 0)) {
      throw new Error("Introduce una cantidad válida.");
    }

    if (!fineDescription.trim()) {
      throw new Error("Describe la multa o el reto.");
    }

    await addPenalty(active, {
      targetUid: target.uid,
      targetName: target.name,
      type: fineType,
      description: fineDescription.trim(),
      createdBy: uid,
      ...(fineType === "money" ? { amount } : {})
    });

    setModal(null);
    setFineTarget("");
    setFineDescription("Invita a un café");
    setFineType("money");
  });
  const copyCode = async () => { await navigator.clipboard.writeText(active); setNotice("Código copiado. ¡Compártelo!"); };
  const allGroups = useMemo(() => {
    const uniqueGroups = new Map();

    [...groups, ...joinedGroups].forEach(group => {
      uniqueGroups.set(group.id, group);
    });

    return Array.from(uniqueGroups.values());
  }, [groups, joinedGroups]);
  const addDefaultTasks = () =>
    run(async () => {
      await addDefaultTasksToGroup(active, DEFAULT_TASKS);

      setActiveGroupData(previous =>
        previous?.id === active
          ? { ...previous, defaultTasksAdded: true }
          : previous
      );

      setNotice("Tareas predeterminadas añadidas.");
    });

  if (!firebaseConfigured) return <SetupScreen />;
  if (authError) return <main className="min-h-screen grid place-items-center p-6"><div className="glass rounded-3xl p-6 max-w-md"><AlertCircle className="text-rose-400 mb-3" /><h1 className="text-xl font-bold">No se pudo conectar</h1><p className="text-zinc-400 mt-2 text-sm">{authError}</p><p className="text-zinc-500 text-xs mt-4">Comprueba Firebase Authentication y habilita el proveedor Anónimo.</p></div></main>;
  if (!uid) return <main className="min-h-screen grid place-items-center"><LoaderCircle className="animate-spin text-lime-300" /></main>;

  return <main className="min-h-screen pb-40">
    <header className="sticky top-0 z-30 px-5 pt-5 pb-4 bg-[#090b12]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-xl mx-auto flex items-center justify-between">
        <div><div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-lime-300 text-black grid place-items-center font-black">¿!</span><span className="font-black tracking-tight">¿A quién le toca?</span></div><p className="text-[11px] text-zinc-500 mt-1 ml-10">EL DESTINO ESTÁ ECHADO</p></div>
        {group && <button onClick={() => setTab("grupo")} className="glass rounded-full px-3 py-2 text-xs flex items-center gap-2 max-w-40"><span className="truncate">{group.name}</span><ChevronDown size={14} /></button>}
      </div>
    </header>

    <div className="max-w-xl mx-auto px-5 pt-5">
      {!group ? <div className="pt-10">
        <div className="text-center mb-8"><div className="mx-auto w-24 h-24 rounded-[2rem] bg-lime-300/10 border border-lime-300/20 grid place-items-center mb-5"><Sparkles size={42} className="text-lime-300" /></div><h1 className="text-3xl font-black tracking-tight">Que decida <span className="text-lime-300">la suerte.</span></h1><p className="text-zinc-400 mt-3 text-sm leading-6">Reparte tareas, evita discusiones y descubre quién se escaquea más.</p></div>
        <div className="grid grid-cols-2 gap-3"><button onClick={() => setModal("create")} className="rounded-2xl bg-lime-300 text-black p-5 text-left font-bold"><CirclePlus /><span className="block mt-4">Crear grupo</span><span className="text-xs font-normal opacity-70">Empieza desde cero</span></button><button onClick={() => setModal("join")} className="glass rounded-2xl p-5 text-left font-bold"><Users className="text-lime-300" /><span className="block mt-4">Unirme</span><span className="text-xs text-zinc-500 font-normal">Tengo un código</span></button></div>

        {allGroups.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
              Mis grupos
            </p>

            {allGroups.map(g => (
              <button
                key={g.id}
                onClick={() => setActive(g.id)}
                className="glass rounded-2xl p-4 w-full flex justify-between mb-2"
              >
                <span>{g.name}</span>
                <span className="text-lime-300 text-xs">{g.id} →</span>
              </button>
            ))}
          </div>
        )}
      </div> : <>
        <div className="flex items-center justify-between mb-5">
          <div><p className="text-xs text-zinc-500 uppercase tracking-widest">Sala activa</p><h1 className="text-2xl font-black mt-1">{group.name}</h1><button onClick={copyCode} className="text-xs text-lime-300 flex items-center gap-1 mt-1"><Copy size={12} /> Código {group.id}</button></div>
          <button onClick={() => { setActive(""); setWinner(null); }} className="glass rounded-xl p-3 text-zinc-400" aria-label="Cambiar de grupo"><ArrowLeft size={18} /></button>
        </div>
        {notice && <div className="mb-4 rounded-xl bg-rose-400/10 border border-rose-400/20 p-3 text-sm text-rose-200 flex justify-between gap-2"><span>{notice}</span><button onClick={() => setNotice("")}><X size={15} /></button></div>}
        {tab === "ruleta" && <section>
          <div className="flex justify-between items-center mb-4"><span className="text-xs text-zinc-500 uppercase tracking-widest">Sorteo exprés</span><span className="text-xs text-zinc-500">{members.length} participantes</span></div>
          <div className="glass wheel-glow rounded-[2rem] p-6 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 bg-lime-300/10 blur-3xl rounded-full" />
            <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72">
              <div className="absolute z-10 top-0 left-1/2 -translate-x-1/2 -translate-y-1"><div className="w-0 h-0 border-l-[13px] border-r-[13px] border-t-[24px] border-l-transparent border-r-transparent border-t-lime-300 drop-shadow-lg" /></div>
              <div className={cx("absolute inset-2 rounded-full border-[10px] border-[#292f3c] bg-[conic-gradient(from_0deg,#a3e635_0deg_60deg,#252c38_60deg_120deg,#a3e635_120deg_180deg,#252c38_180deg_240deg,#a3e635_240deg_300deg,#252c38_300deg_360deg)] transition-transform duration-[3400ms] ease-[cubic-bezier(.12,.75,.12,1)] grid place-items-center", spinning && "brightness-125")} style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: `${spinDuration}ms`,
              }}>
                <div className="w-24 h-24 rounded-full bg-[#111520] border border-white/10 shadow-2xl grid place-items-center"><span className="text-3xl">🎯</span></div>
              </div>
              <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
            </div>
            <div className="text-center mt-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest">
                ¿QUÉ TAREA VAMOS A REPARTIR?
              </p>

              {taskList.length > 0 ? (
                <select
                  value={selectedTask}
                  onChange={e => setSelectedTask(e.target.value)}
                  disabled={spinning || busy}
                  className="w-full mt-3 bg-[#111520] border border-lime-300/30 rounded-xl p-3 text-white font-semibold outline-none focus:border-lime-300"
                >
                  {taskList.map(task => (
                    <option key={task.id} value={task.title}>
                      {task.title}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-zinc-300">
                    Este grupo todavía no tiene tareas.
                  </p>
                  <button
                    onClick={() => setTab("grupo")}
                    className="mt-3 text-sm font-bold text-lime-300"
                  >
                    + Añadir tareas en Grupo
                  </button>
                </div>
              )}

              <p className="text-xs text-zinc-500 uppercase tracking-widest mt-5">
                {spinning ? "EL DESTINO ESTÁ DECIDIENDO…" : "¿QUIÉN SE ENCARGA?"}
              </p>

              <button
                disabled={spinning || busy || members.length === 0 || !selectedTask}
                onClick={spin}
                className="mt-4 w-full rounded-2xl bg-lime-300 hover:bg-lime-200 disabled:opacity-40 text-black font-black text-lg py-4 flex items-center justify-center gap-2 shadow-lg shadow-lime-300/10"
              >
                <RotateCw size={20} className={spinning ? "animate-spin" : ""} />
                {spinning ? "Girando…" : "¡GIRAR LA RULETA!"}
              </button>

              <p className="text-[10px] text-zinc-600 mt-3 flex items-center justify-center gap-1">
                <Volume2 size={12} />
                Activa el sonido al tocar girar · vibración si está disponible
              </p>
            </div>
          </div>


          {winner && winnerModalOpen && (
            <>
              {/* Confeti por toda la pantalla */}
              <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
                {Array.from({ length: 55 }).map((_, i) => (
                  <span
                    key={i}
                    className="confetti-piece"
                    style={{
                      left: `${(i * 37) % 100}%`,
                      animationDelay: `${(i % 12) * 0.08}s`,
                      animationDuration: `${2.2 + (i % 5) * 0.2}s`,
                      ["--drift" as string]: `${(i % 2 === 0 ? 1 : -1) * (30 + (i % 6) * 15)}px`,
                      ["--rotation" as string]: `${360 + (i % 4) * 180}deg`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>

              {/* Modal del ganador */}
              <div className="fixed inset-0 z-[60] isolate flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="winner-title"
                  className="relative z-[61] w-full max-w-md rounded-3xl border border-lime-300/30 bg-zinc-900 p-6 text-center shadow-2xl animate-in"
                >
                  <button
                    type="button"
                    onClick={() => setWinnerModalOpen(false)}
                    aria-label="Cerrar resultado"
                    className="absolute right-3 top-3 z-[70] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-xl text-zinc-300 transition hover:bg-white/20 hover:text-white"
                  >
                    ✕
                  </button>

                  <div className="mb-3 text-5xl animate-winner-pop">
                    🏆
                  </div>

                  <p className="text-xs uppercase tracking-widest text-lime-300">
                    La suerte ha hablado
                  </p>

                  <p className="mt-2 text-sm italic text-zinc-400">
                    {rouletteState?.spinId
                      ? getLoserPhrase(rouletteState.spinId)
                      : "El destino está echado..."}
                  </p>

                  <h2
                    id="winner-title"
                    className="mt-3 text-3xl font-black text-white animate-winner-name"
                  >
                    {winner.name}
                  </h2>

                  <p className="mt-5 text-sm text-zinc-400">
                    ¿Qué tarea le toca?
                  </p>

                  <div className="mt-3 rounded-2xl border border-lime-300/20 bg-lime-300/10 p-5 animate-winner-task">
                    <p className="text-xl font-bold text-lime-300">
                      {winnerTask}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setWinnerModalOpen(false);
                      setFineTarget(winner.uid);
                      setModal("fine");
                    }}
                    className="mt-5 w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    ¿Se ha escaqueado? Poner multa
                  </button>

                  <p className="mt-4 text-xs text-zinc-500">
                    El destino está echado 🎲
                  </p>
                </div>
              </div>
            </>
          )}


          {members.length === 0 && <p className="text-center text-sm text-zinc-500 mt-5">Añade participantes en la pestaña Grupo para empezar.</p>}
          <div className="mt-6"><div className="flex justify-between mb-3"><h3 className="font-bold">Últimos sorteos</h3><span className="text-xs text-zinc-500">{draws.length} registros</span></div>{draws.slice(0, 4).map(d => <div key={d.id} className="glass rounded-xl p-3 mb-2 flex justify-between text-sm"><span>{d.winnerName} <span className="text-zinc-500">· {d.taskTitle}</span></span><Check size={16} className="text-lime-300" /></div>)}</div>
        </section>}
        {tab === "grupo" && <section>
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-black">Tu grupo</h2><button onClick={() => setModal("member")} className="bg-lime-300 text-black rounded-xl px-3 py-2 text-sm font-bold flex gap-1 items-center"><Plus size={16} /> Añadir</button></div>
          <div className="glass rounded-2xl p-4 mb-6"><div className="flex justify-between"><div><p className="text-xs text-zinc-500">Código para invitar</p><p className="text-2xl font-black tracking-[.2em] mt-1">{group.id}</p></div><button onClick={copyCode} className="self-center bg-white/10 p-3 rounded-xl"><Copy size={17} /></button></div><p className="text-xs text-zinc-500 mt-3">Comparte el código y la otra persona podrá unirse desde su móvil.</p></div>
          <h3 className="font-bold mb-3">Participantes ({members.length})</h3>
          {members.map(m => <div key={m.uid} className="glass rounded-xl p-3 mb-2 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-lime-300/15 text-lime-300 grid place-items-center font-bold">{m.name.slice(0, 1).toUpperCase()}</div><span className="flex-1 font-medium">{m.name}{m.uid === group.ownerId && <Crown size={12} className="inline ml-2 text-amber-300" />}</span>{m.uid !== group.ownerId && <button onClick={() => run(() => removeMember(active, m.uid))} className="text-zinc-600 p-2"><Trash2 size={16} /></button>}</div>)}
          <div className="mt-8 mb-3">
            <h3 className="text-xl font-black">El deber te llama</h3>
            <p className="text-xs text-zinc-500 mt-1">No te hagas el sordo</p>
          </div>

          {tasks.length === 0 ? (
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-zinc-400">
                ¿Descansar? Aquí hemos venido a sufrir
              </p>

              {group?.defaultTasksAdded !== true && (
                <button
                  onClick={addDefaultTasks}
                  disabled={busy}
                  className="text-lime-300 text-sm mt-3 font-semibold"
                >
                  + Añadir tareas predeterminadas
                </button>
              )}
            </div>
          ) : (
            <>
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="glass rounded-xl p-3 mb-2 flex justify-between text-sm"
                >
                  <span>{task.title}</span>

                  <button
                    onClick={() => run(() => removeTask(active, task.id))}
                    className="text-zinc-600"
                    aria-label={`Eliminar tarea ${task.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </>
          )}

          <button
            onClick={() => setModal("task")}
            className="mt-3 w-full rounded-xl bg-lime-300/10 border border-lime-300/20 p-3 text-sm font-bold text-lime-300"
          >
            <Plus size={15} className="inline mr-1" />
            Añadir más sufrimiento
          </button>
        </section>}

        {tab === "ranking" && <section>
          {/* Cabecera */}
          <div className="text-center py-6">
            <div className="w-20 h-20 rounded-3xl bg-rose-400/10 border border-rose-300/20 text-rose-300 grid place-items-center mx-auto">
              <Trophy size={38} />
            </div>

            <p className="text-xs uppercase tracking-widest text-zinc-500 mt-4">
              Hall of Shame
            </p>

            <h2 className="text-3xl font-black mt-1">
              Los más <span className="text-rose-300">escaqueados</span>
            </h2>

            <p className="text-sm text-zinc-500 mt-2">
              Aquí la fama cuesta dinero... o trabajo.
            </p>
          </div>

          {/* Ranking */}
          {sorted.some(m => m.count > 0) ? (
            <>
              {/* Líder */}
              {sorted.filter(m => m.count > 0).slice(0, 1).map(m => (
                <div
                  key={m.uid}
                  className="relative overflow-hidden rounded-3xl border border-rose-300/30 bg-gradient-to-br from-rose-400/15 to-purple-500/5 p-6 mb-4 text-center"
                >
                  <div className="absolute -top-12 -right-12 w-36 h-36 bg-rose-400/10 blur-3xl rounded-full" />

                  <div className="relative">
                    <div className="text-5xl mb-3">👑</div>

                    <p className="text-xs uppercase tracking-widest text-rose-300 font-bold">
                      El rey del escaqueo
                    </p>

                    <h3 className="text-2xl font-black mt-2">
                      {m.name}
                    </h3>

                    <p className="text-sm text-zinc-400 mt-2">
                      {m.count >= 5
                        ? "Lo tuyo ya no es mala suerte. Es un estilo de vida."
                        : m.count >= 3
                          ? "Estás haciendo méritos para no tocar un solo plato."
                          : "Has empezado fuerte. Tus compañeros no olvidan."}
                    </p>

                    <div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-black/20 px-5 py-3">
                      <div>
                        <p className="text-3xl font-black text-rose-300">
                          {m.count}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Multas
                        </p>
                      </div>

                      <div className="w-px h-10 bg-white/10" />

                      <div>
                        <p className="text-2xl font-black text-white">
                          {m.euros.toFixed(2)} €
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                          En multas
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Resto del ranking */}
              <h3 className="font-bold mb-3">El resto de sospechosos</h3>

              {sorted.filter(m => m.count > 0).slice(1).map((m, i) => (
                <div
                  key={m.uid}
                  className="glass rounded-2xl p-4 mb-3 flex items-center gap-3"
                >
                  <div className="text-xl w-8 text-center">
                    {i + 2 === 2 ? "🥈" : i + 2 === 3 ? "🥉" : `${i + 2}.`}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{m.name}</p>
                    <p className="text-xs text-zinc-500">
                      {m.count} multas · {m.euros.toFixed(2)} €
                    </p>
                  </div>

                  <span className="text-rose-300 font-black text-xl">
                    {m.count}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className="glass rounded-3xl p-6 text-center">
              <div className="text-5xl mb-4">😇</div>

              <h3 className="text-lg font-black">
                ¡Qué grupo de santos!
              </h3>

              <p className="text-sm text-zinc-400 mt-2">
                Todavía no hay multas. No sabemos cuánto durará esta falsa paz...
              </p>
            </div>
          )}

          {/* Registrar multa */}
          <button
            onClick={() => {
              setFineTarget("");
              setModal("fine");
            }}
            disabled={!members.length}
            className="mt-5 w-full rounded-xl bg-rose-400/10 border border-rose-300/20 text-rose-200 py-4 font-bold flex justify-center gap-2 items-center disabled:opacity-40"
          >
            <Gavel size={17} />
            Registrar escaqueo / multa
          </button>

          {/* Historial */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Historial de multas</h3>
              <span className="text-xs text-zinc-500">
                {penalties.length} registros
              </span>
            </div>

            {penalties.slice(0, 12).map(p => (
              <div
                key={p.id}
                className="glass rounded-xl p-3 mb-2 flex items-center gap-3"
              >
                <div className="rounded-lg bg-rose-300/10 text-rose-300 p-2">
                  {p.type === "money"
                    ? <Wallet size={17} />
                    : <ShieldAlert size={17} />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{p.targetName}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {p.description}
                  </p>
                </div>

                <span className="text-sm font-bold">
                  {p.type === "money"
                    ? `${(p.amount || 0).toFixed(2)} €`
                    : "Reto"}
                </span>
              </div>
            ))}

            {penalties.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">
                El historial está limpio... por ahora.
              </p>
            )}
          </div>
        </section>}

      </>}
    </div>

    {!group && (
      <div className="fixed bottom-0 inset-x-0 z-40 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-[#0c0f18]/95 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-xl mx-auto">
          <AdBanner />
        </div>
      </div>
    )}
    {group && <nav className="fixed bottom-0 inset-x-0 z-30 safe-bottom pt-3 bg-[#0c0f18]/95 backdrop-blur-xl border-t border-white/10"><div className="max-w-xl mx-auto grid grid-cols-3 px-5"><NavButton active={tab === "ruleta"} onClick={() => setTab("ruleta")} icon={<RotateCw size={20} />} label="Ruleta" /><NavButton active={tab === "grupo"} onClick={() => setTab("grupo")} icon={<Users size={20} />} label="Grupo" /><NavButton active={tab === "ranking"} onClick={() => setTab("ranking")} icon={<Trophy size={20} />} label="Ranking" /></div></nav>}
    {modal && <Modal title={modal === "create" ? "Crear grupo" : modal === "join" ? "Unirme a un grupo" : modal === "member" ? "Añadir participante" : modal === "task" ? "Nueva tarea" : "Registrar multa"} close={() => setModal(null)}>
      {(modal === "create" || modal === "join") && <>{modal === "create" && <Field label="Nombre del grupo" value={groupName} set={setGroupName} placeholder="Piso estudiantes" />}{modal === "join" && <Field label="Código del grupo" value={joinCode} set={setJoinCode} placeholder="ABC123" />}<Field label="Tu nombre" value={personName} set={setPersonName} placeholder="¿Cómo te llamas?" /><Action onClick={modal === "create" ? create : join} disabled={busy}>{busy ? "Un momento…" : modal === "create" ? "Crear grupo" : "Entrar en el grupo"}</Action></>}
      {modal === "member" && <><Field label="Nombre del participante" value={personName} set={setPersonName} placeholder="Nombre" /><Action onClick={() => run(async () => { if (!personName.trim()) throw new Error("Escribe un nombre."); await addMember(active, crypto.randomUUID(), personName.trim()); setPersonName(""); setModal(null); })} disabled={busy}>Añadir participante</Action><p className="text-xs text-zinc-500 mt-3">Para invitar a alguien a usar su propio móvil, comparte el código del grupo.</p></>}
      {modal === "task" && <><Field label="Nombre de la tarea" value={taskName} set={setTaskName} placeholder="Limpiar el baño" /><Action onClick={() => run(async () => { if (!taskName.trim()) throw new Error("Escribe una tarea."); await addTask(active, taskName.trim()); setTaskName(""); setModal(null); })} disabled={busy}>Guardar tarea</Action></>}
      {modal === "fine" && <><label className="text-xs text-zinc-400">¿Quién se ha escaqueado?</label><select value={fineTarget} onChange={e => setFineTarget(e.target.value)} className="w-full mt-2 mb-4 bg-[#111520] border border-white/10 rounded-xl p-3 outline-none"><option value="">Selecciona participante</option>{members.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}</select><label className="text-xs text-zinc-400">Tipo de multa</label><div className="grid grid-cols-2 gap-2 mt-2 mb-4"><button onClick={() => setFineType("money")} className={cx("rounded-xl p-3 border text-sm", fineType === "money" ? "border-lime-300 bg-lime-300/10 text-lime-200" : "border-white/10")}>💶 Económica</button><button onClick={() => setFineType("challenge")} className={cx("rounded-xl p-3 border text-sm", fineType === "challenge" ? "border-lime-300 bg-lime-300/10 text-lime-200" : "border-white/10")}>🎯 Reto / castigo</button></div>{fineType === "money" && <Field label="Cantidad (€)" value={fineAmount} set={setFineAmount} placeholder="2" type="number" />}<Field label={fineType === "money" ? "Motivo" : "Describe el reto"} value={fineDescription} set={setFineDescription} placeholder="Invita a un café" /><Action onClick={addFine} disabled={busy}>Registrar multa</Action></>}
    </Modal>}
  </main>;
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={cx("flex flex-col items-center gap-1 py-1 text-[11px]", active ? "text-lime-300" : "text-zinc-500")}>{icon}<span className="font-semibold">{label}</span></button>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="w-full max-w-md glass rounded-t-3xl sm:rounded-3xl p-5 pb-8 safe-bottom animate-in"><div className="flex justify-between items-center mb-5"><h2 className="text-xl font-black">{title}</h2><button onClick={close} className="p-2 rounded-xl bg-white/5"><X size={18} /></button></div>{children}</div></div>;
}
function Field({ label, value, set, placeholder, type = "text" }: { label: string; value: string; set: (s: string) => void; placeholder: string; type?: string }) {
  return <label className="block mb-4"><span className="text-xs text-zinc-400">{label}</span><input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} className="mt-2 w-full bg-[#111520] border border-white/10 rounded-xl p-3 outline-none focus:border-lime-300/50" /></label>;
}
function Action({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="w-full rounded-xl bg-lime-300 text-black font-black py-3.5 mt-2 disabled:opacity-50">{children}</button>;
}
function SetupScreen() {
  return <main className="min-h-screen p-6 grid place-items-center"><div className="max-w-lg w-full glass rounded-3xl p-6"><div className="w-12 h-12 rounded-2xl bg-lime-300 text-black grid place-items-center font-black text-xl mb-5">¿!</div><h1 className="text-2xl font-black">Conecta Firebase</h1><p className="text-sm text-zinc-400 mt-2 leading-6">La interfaz está lista. Para activar las salas compartidas, configura las variables de entorno de Firebase.</p><ol className="list-decimal ml-5 mt-5 space-y-3 text-sm text-zinc-300"><li>Crea un proyecto en Firebase Console.</li><li>Registra una aplicación web y copia su configuración.</li><li>Activa Authentication → Sign-in method → Anonymous.</li><li>Crea Firestore Database en modo producción y publica <code className="text-lime-300">firestore.rules</code>.</li><li>Copia <code className="text-lime-300">.env.example</code> a <code className="text-lime-300">.env.local</code> y rellena las claves.</li></ol><div className="mt-6 rounded-xl bg-black/30 p-3 text-xs text-zinc-400">No pegues aquí claves privadas. La configuración web de Firebase usa identificadores públicos; la protección real la proporcionan Authentication y las reglas de Firestore.</div></div></main>;
}