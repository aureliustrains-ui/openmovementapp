import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { myProfileQuery, useUpdateMyProfile, useUploadMyAvatar } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProfileForm = {
  name: string;
  email: string;
  avatar: string;
  bio: string;
  height: string;
  weight: string;
  goals: string;
  infos: string;
};

function emptyForm(): ProfileForm {
  return {
    name: "",
    email: "",
    avatar: "",
    bio: "",
    height: "",
    weight: "",
    goals: "",
    infos: "",
  };
}

export default function MyProfilePage() {
  const { sessionUser, impersonating, syncSessionUser } = useAuth();
  const { toast } = useToast();
  const { data: profile } = useQuery({ ...myProfileQuery, enabled: !!sessionUser });
  const updateProfile = useUpdateMyProfile();
  const uploadAvatar = useUploadMyAvatar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<ProfileForm>(emptyForm());

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
      email: profile.email || "",
      avatar: profile.avatar || "",
      bio: profile.bio || "",
      height: profile.height || "",
      weight: profile.weight || "",
      goals: profile.goals || "",
      infos: profile.infos || "",
    });
  }, [profile]);

  if (!sessionUser) return null;

  const save = async () => {
    try {
      const updatedProfile = await updateProfile.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        avatar: form.avatar.trim() || null,
        bio: form.bio.trim() || null,
        height: form.height.trim() || null,
        weight: form.weight.trim() || null,
        goals: form.goals.trim() || null,
        infos: form.infos.trim() || null,
      });
      syncSessionUser({
        id: updatedProfile.id || sessionUser.id,
        name: updatedProfile.name || form.name.trim(),
        email: updatedProfile.email || form.email.trim(),
        role: sessionUser.role,
        status: sessionUser.status,
        avatar: updatedProfile.avatar || null,
      });
      setForm((prev) => ({ ...prev, avatar: updatedProfile.avatar || "" }));
      toast({ title: "Profile saved" });
    } catch (error: any) {
      const message = error?.message?.includes("409")
        ? "Email already in use"
        : "Could not save profile";
      toast({ title: message, variant: "destructive" });
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
    try {
      const result = await uploadAvatar.mutateAsync(file);
      const avatarPath = result?.avatar || result?.user?.avatar || "";
      setForm((prev) => ({ ...prev, avatar: avatarPath }));
      syncSessionUser({
        id: sessionUser.id,
        name: form.name.trim() || sessionUser.name,
        email: form.email.trim() || sessionUser.email,
        role: sessionUser.role,
        status: sessionUser.status,
        avatar: avatarPath || null,
      });
      toast({ title: "Profile photo updated" });
    } catch {
      toast({ title: "Could not upload profile photo", variant: "destructive" });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500">Manage your profile details.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>These details are saved to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
            <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} disabled={impersonating} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} disabled={impersonating} />
            </div>
            <div className="space-y-2">
              <Label>Height</Label>
              <Input value={form.height} onChange={(e) => setForm((prev) => ({ ...prev, height: e.target.value }))} placeholder="e.g. 182 cm" disabled={impersonating} />
            </div>
            <div className="space-y-2">
              <Label>Weight</Label>
              <Input value={form.weight} onChange={(e) => setForm((prev) => ({ ...prev, weight: e.target.value }))} placeholder="e.g. 79 kg" disabled={impersonating} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <img
                src={form.avatar || "https://placehold.co/80x80?text=Avatar"}
                alt="Profile avatar"
                className="h-16 w-16 rounded-full border border-slate-200 object-cover bg-slate-100"
              />
              <div className="flex items-center gap-2">
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
                    onClick={() => setForm((prev) => ({ ...prev, avatar: "" }))}
                    disabled={impersonating}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} className="min-h-[96px]" disabled={impersonating} />
          </div>

          <div className="space-y-2">
            <Label>Goals</Label>
            <Textarea value={form.goals} onChange={(e) => setForm((prev) => ({ ...prev, goals: e.target.value }))} className="min-h-[96px]" disabled={impersonating} />
          </div>

          <div className="space-y-2">
            <Label>Infos</Label>
            <Textarea value={form.infos} onChange={(e) => setForm((prev) => ({ ...prev, infos: e.target.value }))} className="min-h-[96px]" disabled={impersonating} />
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
    </div>
  );
}
