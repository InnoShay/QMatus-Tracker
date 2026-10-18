"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { ZoneOption } from "@/lib/timezones";
import { updateProfile } from "./actions";
import { TimeZonePicker } from "./time-zone-picker";

export function ProfileForm({
  name,
  title,
  timezone,
  zones,
}: {
  name: string;
  title: string | null;
  timezone: string;
  zones: ZoneOption[];
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex max-w-[520px] flex-col gap-4"
      noValidate
      action={(f) =>
        startTransition(async () => {
          setErrors({});
          const res = await updateProfile({ display_name: f.get("display_name"), title: f.get("title"), timezone: f.get("timezone") });
          if (res.ok) toast("Profile saved.");
          else {
            setErrors(res.error.fieldErrors ?? {});
            if (!res.error.fieldErrors) toast(res.error.message, "error");
          }
        })
      }
    >
      <Field label="Name" error={errors.display_name}>
        {(p) => <Input {...p} name="display_name" defaultValue={name} maxLength={80} autoComplete="name" />}
      </Field>
      <Field label="Title" optional error={errors.title}>
        {(p) => <Input {...p} name="title" defaultValue={title ?? ""} maxLength={80} />}
      </Field>
      <Field label="Time zone" hint="Due dates and timestamps are shown in this zone." error={errors.timezone}>
        {(p) => <TimeZonePicker {...p} name="timezone" defaultValue={timezone} zones={zones} />}
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…" className="self-start">
        Save profile
      </Button>
    </form>
  );
}
