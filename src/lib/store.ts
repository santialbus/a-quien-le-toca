import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import type { Draw, Group, Member, Penalty, Task, RouletteState } from "./types";

function database() {
  if (!db) throw new Error("Firebase no está configurado. Añade las variables NEXT_PUBLIC_FIREBASE_*.");
  return db;
}
const col = (groupId: string, name: string) => collection(database(), "groups", groupId, name);

export async function createGroup(name: string, uid: string, memberName: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groupId = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
  const ref = doc(database(), "groups", groupId);
  await setDoc(ref, { name, ownerId: uid, createdAt: serverTimestamp(), defaultTasksAdded: false });
  await setDoc(doc(ref, "members", uid), { uid, name: memberName, joinedAt: serverTimestamp() });
  return groupId;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const normalizedId = groupId.trim().toUpperCase();
  const snapshot = await getDoc(
    doc(database(), "groups", normalizedId)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  } as Group;
}

export async function joinGroup(
  groupId: string,
  uid: string,
  name: string
) {
  const normalizedId = groupId.trim().toUpperCase();

  const group = await getGroup(normalizedId);

  if (!group) {
    throw new Error("No existe ningún grupo con ese código.");
  }

  await setDoc(
    doc(database(), "groups", normalizedId, "members", uid),
    {
      uid,
      name,
      joinedAt: serverTimestamp()
    },
    { merge: true }
  );

  return group;
}

export function listenGroups(
  uid: string,
  callback: (groups: Group[]) => void
) {
  return onSnapshot(
    query(
      collection(database(), "groups"),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc")
    ),
    snap => {
      callback(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as Group))
      );
    }
  );
}
export function listenMembers(id: string, cb: (v: Member[]) => void) {
  return onSnapshot(col(id, "members"), s => cb(s.docs.map(d => d.data() as Member)));
}
export function listenTasks(id: string, cb: (v: Task[]) => void) {
  return onSnapshot(query(col(id, "tasks"), orderBy("createdAt", "asc")), s => cb(s.docs.map(d => ({id:d.id,...d.data()} as Task))));
}
export function listenPenalties(id: string, cb: (v: Penalty[]) => void) {
  return onSnapshot(query(col(id, "penalties"), orderBy("createdAt", "desc")), s => cb(s.docs.map(d => ({id:d.id,...d.data()} as Penalty))));
}
export function listenDraws(id: string, cb: (v: Draw[]) => void) {
  return onSnapshot(query(col(id, "draws"), orderBy("createdAt", "desc")), s => cb(s.docs.map(d => ({id:d.id,...d.data()} as Draw))));
}
export async function addMember(id: string, uid: string, name: string) {
  await setDoc(doc(database(), "groups", id, "members", uid), {uid, name, joinedAt:serverTimestamp()});
}
export async function removeMember(id: string, uid: string) {
  await deleteDoc(doc(database(), "groups", id, "members", uid));
}
export async function addTask(id: string, title: string) {
  await addDoc(col(id, "tasks"), {title, createdAt:serverTimestamp()});
}
export async function removeTask(id: string, taskId: string) {
  await deleteDoc(doc(database(), "groups", id, "tasks", taskId));
}
export async function addPenalty(id: string, p: Omit<Penalty, "id" | "createdAt">) {
  await addDoc(col(id, "penalties"), {...p, createdAt:serverTimestamp()});
}
export async function saveDraw(id: string, d: Omit<Draw, "id" | "createdAt">) {
  const ref = await addDoc(col(id, "draws"), {
    ...d,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateDrawTask(groupId: string, drawId: string, taskTitle: string) {
  await updateDoc(
    doc(database(), "groups", groupId, "draws", drawId),
    { taskTitle }
  );
}

export async function addDefaultTasksToGroup(
  groupId: string,
  defaultTasks: string[]
) {
  const dbInstance = database();
  const groupRef = doc(dbInstance, "groups", groupId);

  // Leemos las tareas existentes fuera de la transacción.
  const tasksSnapshot = await getDocs(col(groupId, "tasks"));

  const existingTitles = new Set(
    tasksSnapshot.docs.map(task => task.data().title as string)
  );

  await runTransaction(dbInstance, async transaction => {
    const groupSnapshot = await transaction.get(groupRef);

    if (!groupSnapshot.exists()) {
      throw new Error("No existe el grupo.");
    }

    if (groupSnapshot.data().defaultTasksAdded === true) {
      return;
    }

    for (const title of defaultTasks) {
      if (!existingTitles.has(title)) {
        const taskRef = doc(col(groupId, "tasks"));

        transaction.set(taskRef, {
          title,
          createdAt: serverTimestamp()
        });
      }
    }

    transaction.update(groupRef, {
      defaultTasksAdded: true
    });
  });
}


export function listenRoulette(
  groupId: string,
  callback: (state: RouletteState | null) => void
) {
  return onSnapshot(
    doc(database(), "groups", groupId, "roulette", "current"),
    snapshot => {
      callback(
        snapshot.exists()
          ? snapshot.data() as RouletteState
          : null
      );
    }
  );
}

export async function startRoulette(
  groupId: string,
  draw: Omit<Draw, "id" | "createdAt">
) {
  const dbInstance = database();

  const rouletteRef = doc(
    dbInstance,
    "groups",
    groupId,
    "roulette",
    "current"
  );

  const drawRef = doc(col(groupId, "draws"));

  await runTransaction(dbInstance, async transaction => {
    const snapshot = await transaction.get(rouletteRef);

    if (snapshot.exists()) {
      const current = snapshot.data() as RouletteState;

      if (current.status === "spinning") {
        const startedAt = current.startedAt as
          | { toMillis?: () => number }
          | undefined;

        const elapsed = startedAt?.toMillis
          ? Date.now() - startedAt.toMillis()
          : 0;

        if (elapsed < current.durationMs + 1000) {
          throw new Error("Ya hay un sorteo en marcha.");
        }

        // Si un sorteo anterior quedó interrumpido,
        // guardamos igualmente su resultado.
        transaction.set(
          doc(dbInstance, "groups", groupId, "draws", current.drawId),
          {
            winnerUid: current.winnerUid,
            winnerName: current.winnerName,
            taskTitle: current.taskTitle,
            createdBy: current.createdBy,
            createdAt: serverTimestamp()
          }
        );
      }
    }

    transaction.set(rouletteRef, {
      status: "spinning",
      spinId: Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        byte => byte.toString(16).padStart(2, "0")
      ).join(""),
      startedAt: serverTimestamp(),
      durationMs: 3400,
      winnerUid: draw.winnerUid,
      winnerName: draw.winnerName,
      taskTitle: draw.taskTitle,
      createdBy: draw.createdBy,
      drawId: drawRef.id
    });
  });
}

export async function finishRoulette(
  groupId: string,
  spinId: string
) {
  console.log("[finishRoulette] Intentando finalizar:", {
    groupId,
    spinId
  });
  const dbInstance = database();

  const rouletteRef = doc(
    dbInstance,
    "groups",
    groupId,
    "roulette",
    "current"
  );

  await runTransaction(dbInstance, async transaction => {
    const snapshot = await transaction.get(rouletteRef);

    if (!snapshot.exists()) return;

    const current = snapshot.data() as RouletteState;

    if (
      current.status !== "spinning" ||
      current.spinId !== spinId
    ) {
      return;
    }

    transaction.set(
      doc(dbInstance, "groups", groupId, "draws", current.drawId),
      {
        winnerUid: current.winnerUid,
        winnerName: current.winnerName,
        taskTitle: current.taskTitle,
        createdBy: current.createdBy,
        createdAt: serverTimestamp()
      }
    );

    transaction.update(rouletteRef, {
      status: "finished",
      finishedAt: serverTimestamp()
    });
  });
}
