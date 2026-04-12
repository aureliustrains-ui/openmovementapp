import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.resolve(serverDir, "../client/src/pages/app/Settings.tsx");
const apiPath = path.resolve(serverDir, "../client/src/lib/api.ts");
const chatDisplayNamePath = path.resolve(serverDir, "../client/src/lib/chatDisplayName.ts");
const clientChatPath = path.resolve(serverDir, "../client/src/pages/client/Chat.tsx");
const adminClientProfilePath = path.resolve(
  serverDir,
  "../client/src/pages/admin/ClientProfile.tsx",
);
const avatarPath = path.resolve(serverDir, "../client/src/components/ui/avatar.tsx");
const routesPath = path.resolve(serverDir, "../server/routes.ts");

test("My Profile binds query to session user id and does not use broad cache key", () => {
  const source = fs.readFileSync(settingsPath, "utf8");
  assert.ok(source.includes("myProfileQuery(sessionUser.id)"));
  assert.ok(source.includes("if (profile.id !== sessionUser.id) return;"));
  assert.equal(source.includes("viewedUser"), false);
  assert.equal(source.includes("...myProfileQuery,"), false);
});

test("My Profile form includes first name, last name, and bio while omitting removed metrics", () => {
  const source = fs.readFileSync(settingsPath, "utf8");
  assert.ok(source.includes("<Label>Last name</Label>"));
  assert.ok(source.includes("<Label>First name</Label>"));
  assert.ok(source.includes("<Label>Bio</Label>"));
  assert.equal(source.includes("<Label>Age</Label>"), false);
  assert.equal(source.includes("<Label>Height</Label>"), false);
  assert.equal(source.includes("<Label>Weight</Label>"), false);
  assert.equal(source.includes("<Label>Goals</Label>"), false);
  assert.equal(source.includes("<Label>Infos</Label>"), false);
  assert.equal(source.includes("These details are saved to your signed-in account."), false);
  assert.ok(
    source.includes('<div className="grid grid-cols-1 md:grid-cols-2 gap-4">'),
    "First name and Last name should share one responsive row",
  );
  assert.ok(
    source.indexOf("<Label>Last name</Label>") < source.indexOf("<Label>Bio</Label>"),
    "Bio should render lower on the form than Last name",
  );
  assert.ok(
    source.indexOf("<Label>First name</Label>") < source.indexOf("<Label>Bio</Label>"),
    "Bio should render lower on the form than First name",
  );
});

test("My Profile supports persisted avatar removal/reset", () => {
  const source = fs.readFileSync(settingsPath, "utf8");
  assert.ok(source.includes("const onRemoveAvatar = async () =>"));
  assert.ok(source.includes("updateProfile.mutateAsync({ avatar: null })"));
});

test("My Profile includes simple avatar preview and save flow without zoom controls", () => {
  const source = fs.readFileSync(settingsPath, "utf8");
  assert.ok(source.includes("Preview Photo"));
  assert.equal(source.includes("Drag to reposition your photo inside the avatar frame."), false);
  assert.ok(source.includes("avatar-editor-preview"));
  assert.equal(source.includes("avatar-editor-zoom"), false);
  assert.equal(source.includes("Reset Framing"), false);
  assert.ok(source.includes("Save Photo"));
});

test("My Profile avatar editor supports drag-based repositioning without extra controls", () => {
  const source = fs.readFileSync(settingsPath, "utf8");
  assert.ok(source.includes("onPointerDown={handleAvatarPointerDown}"));
  assert.ok(source.includes("onPointerMove={handleAvatarPointerMove}"));
  assert.ok(source.includes("onPointerUp={handleAvatarPointerUp}"));
  assert.ok(source.includes("toBlob("));
});

test("shared avatar image uses object-cover to avoid distortion", () => {
  const source = fs.readFileSync(avatarPath, "utf8");
  assert.ok(source.includes("object-cover object-center"));
  assert.ok(source.includes("resolveClientAssetUrl"));
});

test("chat read API sends only clientId in payload", () => {
  const source = fs.readFileSync(apiPath, "utf8");
  const hookBlockMatch = source.match(/export function useMarkChatRead\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(hookBlockMatch, "useMarkChatRead should exist");
  const hookBlock = hookBlockMatch ? hookBlockMatch[0] : "";
  assert.ok(hookBlock.includes("body: JSON.stringify({ clientId: data.clientId })"));
  assert.equal(hookBlock.includes("body: JSON.stringify(data)"), false);
});

test("client chat marks unread as read on open using session identity", () => {
  const source = fs.readFileSync(clientChatPath, "utf8");
  assert.ok(source.includes("const { sessionUser, viewedUser } = useAuth();"));
  assert.ok(
    source.includes("markRead.mutate({ userId: sessionUser.id, clientId: chatClientId });"),
  );
});

test("chat uses Enter to send and Shift+Enter for newline in both client and admin composers", () => {
  const clientSource = fs.readFileSync(clientChatPath, "utf8");
  const adminSource = fs.readFileSync(adminClientProfilePath, "utf8");

  assert.ok(clientSource.includes('if (e.key !== "Enter") return;'));
  assert.ok(clientSource.includes("if (e.shiftKey) return;"));
  assert.ok(clientSource.includes("submitMessage();"));

  assert.ok(adminSource.includes('if (e.key !== "Enter") return;'));
  assert.ok(adminSource.includes("if (e.shiftKey) return;"));
  assert.ok(adminSource.includes("submitChatMessage();"));
});

test("chat message bubbles preserve newline formatting", () => {
  const clientSource = fs.readFileSync(clientChatPath, "utf8");
  const adminSource = fs.readFileSync(adminClientProfilePath, "utf8");

  assert.ok(clientSource.includes("whitespace-pre-wrap break-words"));
  assert.ok(adminSource.includes("whitespace-pre-wrap break-words"));
});

test("admin chat marks thread as read on tab open without message-count guard", () => {
  const source = fs.readFileSync(adminClientProfilePath, "utf8");
  assert.equal(source.includes("chatMessages.length > 0"), false);
  assert.ok(source.includes('if (activeTab === "chat" && sessionUser && clientId)'));
  assert.ok(source.includes("latestClientChatMessageTime"));
  assert.ok(
    source.includes("}, [activeTab, sessionUser?.id, clientId, latestClientChatMessageTime]);"),
  );
});

test("chat avatars open profile preview in both client and admin chat views", () => {
  const clientSource = fs.readFileSync(clientChatPath, "utf8");
  const adminSource = fs.readFileSync(adminClientProfilePath, "utf8");

  assert.ok(clientSource.includes("button-open-chat-profile-"));
  assert.ok(clientSource.includes("<DialogTitle>Profile</DialogTitle>"));
  assert.ok(adminSource.includes("button-open-chat-profile-"));
  assert.ok(adminSource.includes("<DialogTitle>Profile</DialogTitle>"));
});

test("chat sender display prefers stored first name for coach/client labels", () => {
  const clientSource = fs.readFileSync(clientChatPath, "utf8");
  const adminSource = fs.readFileSync(adminClientProfilePath, "utf8");
  const helperSource = fs.readFileSync(chatDisplayNamePath, "utf8");

  assert.ok(clientSource.includes("getChatDisplayFirstName(msg)"));
  assert.ok(adminSource.includes("getChatDisplayFirstName(msg)"));
  assert.ok(helperSource.includes("profile?.firstName"));
  assert.ok(helperSource.includes("profile?.infos"));
});

test("message API includes sender profile summary for chat preview", () => {
  const source = fs.readFileSync(routesPath, "utf8");
  assert.ok(source.includes("senderProfile: profileSource"));
  assert.ok(source.includes("firstName: getProfileFirstName(profileSource) || null"));
  assert.ok(source.includes("getProfileFirstName(profileSource)"));
  assert.ok(source.includes("hasLegacyCoachMessages"));
  assert.ok(source.includes("adminByAlias"));
  assert.ok(source.includes("resolveMessageSender"));
  assert.ok(source.includes("const matchedSender = senderById.get(message.senderUserId);"));
  assert.ok(source.includes("if (matchedSender) {"));
  assert.ok(source.includes("bio: profileSource.bio"));
  assert.ok(source.includes("height: profileSource.height"));
  assert.ok(source.includes("weight: profileSource.weight"));
});

test("avatar upload route persists avatar and returns updated user payload", () => {
  const source = fs.readFileSync(routesPath, "utf8");
  assert.ok(
    source.includes(
      'const avatarDataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;',
    ),
  );
  assert.ok(
    source.includes(
      "const updated = await storage.updateUser(authUser.id, { avatar: avatarDataUrl });",
    ),
  );
  assert.ok(source.includes("res.json({ avatar: updated.avatar, user: toPublicUser(updated) });"));
});
