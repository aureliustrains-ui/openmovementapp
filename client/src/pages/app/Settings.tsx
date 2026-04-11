import { type ChangeEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  myProfileQuery,
  useChangePassword,
  useUpdateMyProfile,
  useUploadMyAvatar,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type ProfileForm = {
  name: string;
  firstName: string;
  age: string;
  avatar: string;
  bio: string;
  height: string;
  weight: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function emptyForm(): ProfileForm {
  return {
    name: "",
    firstName: "",
    age: "",
    avatar: "",
    bio: "",
    height: "",
    weight: "",
  };
}

function emptyPasswordForm(): PasswordForm {
  return {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const normalized = error.message.trim();
  const match = normalized.match(/:\s([^:]+)$/);
  if (match?.[1]) return match[1].trim();
  return normalized || fallback;
}

export default function MyProfilePage() {
  const AVATAR_PREVIEW_SIZE = 280;
  const AVATAR_OUTPUT_SIZE = 512;
  const { sessionUser, impersonating, syncSessionUser } = useAuth();
  const { toast } = useToast();
  const { data: profile } = useQuery({
    ...(sessionUser ? myProfileQuery(sessionUser.id) : myProfileQuery("anonymous")),
    enabled: !!sessionUser?.id,
  });
  const updateProfile = useUpdateMyProfile();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadMyAvatar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm());
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [passwordFormSuccess, setPasswordFormSuccess] = useState<string | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string | null>(null);
  const [avatarPendingFile, setAvatarPendingFile] = useState<File | null>(null);
  const [avatarDraftNatural, setAvatarDraftNatural] = useState<{ width: number; height: number } | null>(null);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const [avatarDragStart, setAvatarDragStart] = useState<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);
  const [savingAvatarEdit, setSavingAvatarEdit] = useState(false);

  useEffect(() => {
    setForm(emptyForm());
  }, [sessionUser?.id]);

  useEffect(() => {
    if (!profile || !sessionUser) return;
    if (profile.id !== sessionUser.id) return;
    setForm({
      name: profile.name || sessionUser.name || "",
      firstName: profile.infos || "",
      age: profile.goals || "",
      avatar: profile.avatar || "",
      bio: profile.bio || "",
      height: profile.height || "",
      weight: profile.weight || "",
    });
  }, [profile, sessionUser?.id]);

  if (!sessionUser) return null;

  const save = async () => {
    try {
      const updatedProfile = await updateProfile.mutateAsync({
        name: form.name.trim() || sessionUser.name,
        infos: form.firstName.trim() || null,
        goals: form.age.trim() || null,
        bio: form.bio.trim() || null,
        height: form.height.trim() || null,
        weight: form.weight.trim() || null,
      });
      syncSessionUser({
        id: updatedProfile.id || sessionUser.id,
        name: updatedProfile.name || sessionUser.name,
        email: updatedProfile.email || sessionUser.email,
        role: sessionUser.role,
        status: sessionUser.status,
        avatar: updatedProfile.avatar || null,
      });
      toast({ title: "Profile saved" });
    } catch (error: any) {
      const message = error?.message?.includes("409")
        ? "Email already in use"
        : "Could not save profile";
      toast({ title: message, variant: "destructive" });
    }
  };

  const savePassword = async () => {
    setPasswordFormError(null);
    setPasswordFormSuccess(null);

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFormError("All password fields are required.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordFormError("Password must be between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFormError("New password and confirmation do not match.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      setPasswordForm(emptyPasswordForm());
      setPasswordFormSuccess("Password updated successfully.");
      toast({ title: "Password updated successfully" });
    } catch (error: unknown) {
      setPasswordFormError(getErrorMessage(error, "Could not update password."));
    }
  };

  const onUploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    if (impersonating) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type. Use png, jpg, or webp.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Avatar is too large (max 5MB)", variant: "destructive" });
      event.target.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (avatarDraftUrl) {
        URL.revokeObjectURL(avatarDraftUrl);
      }
      setAvatarDraftUrl(previewUrl);
      setAvatarPendingFile(file);
      setAvatarDraftNatural({ width: image.naturalWidth, height: image.naturalHeight });
      setAvatarOffset({ x: 0, y: 0 });
      setAvatarDragStart(null);
      setAvatarEditorOpen(true);
      event.target.value = "";
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      toast({ title: "Could not load image", variant: "destructive" });
      event.target.value = "";
    };
    image.src = previewUrl;
  };

  const clearAvatarDraft = () => {
    if (avatarDraftUrl) {
      URL.revokeObjectURL(avatarDraftUrl);
    }
    setAvatarDraftUrl(null);
    setAvatarPendingFile(null);
    setAvatarDraftNatural(null);
    setAvatarOffset({ x: 0, y: 0 });
    setAvatarDragStart(null);
    setAvatarEditorOpen(false);
  };

  const previewDimensions = useMemo(() => {
    if (!avatarDraftNatural) {
      return { width: AVATAR_PREVIEW_SIZE, height: AVATAR_PREVIEW_SIZE };
    }
    const baseScale = Math.max(
      AVATAR_PREVIEW_SIZE / avatarDraftNatural.width,
      AVATAR_PREVIEW_SIZE / avatarDraftNatural.height,
    );
    return {
      width: avatarDraftNatural.width * baseScale,
      height: avatarDraftNatural.height * baseScale,
    };
  }, [avatarDraftNatural]);

  const clampAvatarOffset = (x: number, y: number) => {
    const maxX = Math.max(0, (previewDimensions.width - AVATAR_PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (previewDimensions.height - AVATAR_PREVIEW_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const getSourceCrop = () => {
    if (!avatarDraftNatural) {
      return { sx: 0, sy: 0, sw: AVATAR_PREVIEW_SIZE, sh: AVATAR_PREVIEW_SIZE };
    }
    const imageLeft = (AVATAR_PREVIEW_SIZE - previewDimensions.width) / 2 + avatarOffset.x;
    const imageTop = (AVATAR_PREVIEW_SIZE - previewDimensions.height) / 2 + avatarOffset.y;

    const sourcePerPreviewX = avatarDraftNatural.width / previewDimensions.width;
    const sourcePerPreviewY = avatarDraftNatural.height / previewDimensions.height;

    const sx = Math.max(0, -imageLeft * sourcePerPreviewX);
    const sy = Math.max(0, -imageTop * sourcePerPreviewY);
    const sw = AVATAR_PREVIEW_SIZE * sourcePerPreviewX;
    const sh = AVATAR_PREVIEW_SIZE * sourcePerPreviewY;

    return { sx, sy, sw, sh };
  };

  const handleAvatarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!avatarDraftUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setAvatarDragStart({
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: avatarOffset.x,
      startY: avatarOffset.y,
    });
  };

  const handleAvatarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!avatarDragStart) return;
    const deltaX = event.clientX - avatarDragStart.pointerX;
    const deltaY = event.clientY - avatarDragStart.pointerY;
    const next = clampAvatarOffset(avatarDragStart.startX + deltaX, avatarDragStart.startY + deltaY);
    setAvatarOffset(next);
  };

  const handleAvatarPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (avatarDragStart) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setAvatarDragStart(null);
  };

  const saveAvatarEdit = async () => {
    if (!avatarPendingFile || !avatarDraftNatural || !avatarDraftUrl) return;
    setSavingAvatarEdit(true);
    try {
      const image = new Image();
      image.src = avatarDraftUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to decode image"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");

      const crop = getSourceCrop();
      context.drawImage(
        image,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Could not create avatar image"));
            return;
          }
          resolve(result);
        }, "image/png");
      });

      const croppedFile = new File([blob], "avatar.png", { type: "image/png" });
      const result = await uploadAvatar.mutateAsync(croppedFile);
      const avatarPath = result?.avatar || result?.user?.avatar || "";
      setForm((prev) => ({ ...prev, avatar: avatarPath }));
      syncSessionUser({
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        status: sessionUser.status,
        avatar: avatarPath || null,
      });
      toast({ title: "Profile photo updated" });
      clearAvatarDraft();
    } catch {
      toast({ title: "Could not upload profile photo", variant: "destructive" });
    } finally {
      setSavingAvatarEdit(false);
    }
  };

  const onRemoveAvatar = async () => {
    if (impersonating) return;
    try {
      const updatedProfile = await updateProfile.mutateAsync({ avatar: null });
      setForm((prev) => ({ ...prev, avatar: "" }));
      syncSessionUser({
        id: updatedProfile.id || sessionUser.id,
        name: updatedProfile.name || sessionUser.name,
        email: updatedProfile.email || sessionUser.email,
        role: sessionUser.role,
        status: sessionUser.status,
        avatar: null,
      });
      toast({ title: "Profile photo removed" });
    } catch {
      toast({ title: "Could not remove profile photo", variant: "destructive" });
    }
  };

  useEffect(() => {
    return () => {
      if (avatarDraftUrl) {
        URL.revokeObjectURL(avatarDraftUrl);
      }
    };
  }, [avatarDraftUrl]);

  const initials = (sessionUser.name || sessionUser.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Profile</h1>
        <p className="text-slate-500">Manage your account profile and security details.</p>
      </div>

      <Card id="profile" className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Avatar className="h-16 w-16 border border-slate-200 bg-slate-100">
                <AvatarImage src={form.avatar || undefined} alt="Profile avatar" />
                <AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onUploadAvatar}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatar.isPending || impersonating}
                >
                  {uploadAvatar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload photo
                </Button>
                {form.avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onRemoveAvatar}
                    disabled={impersonating || updateProfile.isPending}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="e.g. Aurelius"
                disabled={impersonating}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Hanak"
                disabled={impersonating}
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Label>Bio</Label>
            <Textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} className="min-h-[96px]" disabled={impersonating} />
          </div>

          {impersonating && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              You are impersonating a client. Profile edits are disabled to prevent changing the wrong account.
            </div>
          )}

          <div className="pt-2">
            <Button onClick={save} disabled={updateProfile.isPending || impersonating}>
              {updateProfile.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="security" className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">Change your account password.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                }
                disabled={changePassword.isPending || impersonating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                disabled={changePassword.isPending || impersonating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                disabled={changePassword.isPending || impersonating}
              />
            </div>
          </div>

          {passwordFormError && (
            <p className="text-sm text-red-600">{passwordFormError}</p>
          )}
          {passwordFormSuccess && !passwordFormError && (
            <p className="text-sm text-emerald-700">{passwordFormSuccess}</p>
          )}

          {impersonating && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              You are impersonating a client. Password changes are disabled to prevent updating the
              wrong account.
            </div>
          )}

          <div className="pt-1">
            <Button
              type="button"
              onClick={savePassword}
              disabled={changePassword.isPending || impersonating}
            >
              {changePassword.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={avatarEditorOpen} onOpenChange={(open) => !open && clearAvatarDraft()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                className="relative h-[280px] w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner touch-none select-none"
                data-testid="avatar-editor-preview"
                onPointerDown={handleAvatarPointerDown}
                onPointerMove={handleAvatarPointerMove}
                onPointerUp={handleAvatarPointerUp}
                onPointerCancel={handleAvatarPointerUp}
                style={{ cursor: avatarDragStart ? "grabbing" : "grab" }}
              >
                {avatarDraftUrl && avatarDraftNatural && (
                  <img
                    src={avatarDraftUrl}
                    alt="Avatar preview"
                    draggable={false}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                    style={{
                      width: `${previewDimensions.width}px`,
                      height: `${previewDimensions.height}px`,
                      transform: `translate(-50%, -50%) translate(${avatarOffset.x}px, ${avatarOffset.y}px)`,
                    }}
                  />
                )}
                <div className="pointer-events-none absolute inset-0 ring-1 ring-black/10" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearAvatarDraft} disabled={savingAvatarEdit || uploadAvatar.isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={saveAvatarEdit} disabled={savingAvatarEdit || uploadAvatar.isPending || !avatarPendingFile}>
              {savingAvatarEdit || uploadAvatar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
