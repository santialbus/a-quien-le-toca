import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import type { Draw, Group, Member, Penalty, Task } from "./types";

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
  await setDoc(ref, { name, ownerId: uid, createdAt: serverTimestamp() });
  await setDoc(doc(ref, "members", uid), { uid, name: memberName, joinedAt: serverTimestamp() });
  return groupId;
}
export async function joinGroup(groupId: string, uid: string, name: string) {
  await setDoc(doc(database(), "groups", groupId.toUpperCase(), "members", uid),
    { uid, name, joinedAt: serverTimestamp() }, { merge: true });
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