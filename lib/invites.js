import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";

// Best-effort notification email via /api/send-invite. Never throws — a
// failed email shouldn't undo the Firestore invite/membership write, which
// is the part that actually matters functionally.
async function notifyInvite({ to, projectName, alreadyMember }) {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch("/api/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ to, projectName, alreadyMember }),
    });
  } catch (err) {
    console.error("Failed to send invite email", err);
  }
}

// Deterministic invite doc ID (projectId + normalized email) so the
// Firestore security rules can look up "is there a real pending invite
// for this project + email" without needing an arbitrary query.
function inviteId(projectId, normalizedEmail) {
  return `${projectId}_${normalizedEmail}`;
}

export async function acceptPendingInvites(user) {
  if (!user?.email) return;
  const email = user.email.toLowerCase();
  const invitesQ = query(
    collection(db, "invites"),
    where("email", "==", email),
    where("status", "==", "pending")
  );
  let snap;
  try {
    snap = await getDocs(invitesQ);
  } catch (e) {
    // Expected for unverified accounts: the security rules require
    // email_verified == true to read invites matched by email, so this
    // query is denied until the user verifies. Not an error condition —
    // just means "no invites visible yet." acceptPendingInvites() runs
    // again on every dashboard load, so it'll pick these up once verified.
    return;
  }
  for (const inviteDoc of snap.docs) {
    const invite = inviteDoc.data();
    try {
      await updateDoc(doc(db, "projects", invite.projectId), {
        memberIds: arrayUnion(user.uid),
        [`roles.${user.uid}`]: "member",
      });
      await updateDoc(doc(db, "invites", inviteDoc.id), { status: "accepted" });
    } catch (e) {
      console.error("Failed to accept invite", inviteDoc.id, e);
    }
  }
}

export async function inviteTeammate({ projectId, projectName, email, invitedBy }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");

  const usersQ = query(collection(db, "users"), where("email", "==", normalizedEmail));
  const usersSnap = await getDocs(usersQ);

  if (!usersSnap.empty) {
    const existingUid = usersSnap.docs[0].id;
    await updateDoc(doc(db, "projects", projectId), {
      memberIds: arrayUnion(existingUid),
      [`roles.${existingUid}`]: "member",
    });
    await notifyInvite({ to: normalizedEmail, projectName, alreadyMember: true });
    return { status: "added" };
  }

  await setDoc(doc(db, "invites", inviteId(projectId, normalizedEmail)), {
    projectId,
    projectName,
    email: normalizedEmail,
    invitedBy,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  await notifyInvite({ to: normalizedEmail, projectName, alreadyMember: false });
  return { status: "pending" };
}
