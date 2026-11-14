"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDevotionalComment } from "@/app/(public)/devotionals/comment-actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DevotionalCommentForm({ devotionalId }: { devotionalId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      try {
        const result = await submitDevotionalComment({ devotionalId, authorName: name, content });
        setMessage(result.message);
        if (result.status === "success") {
          setContent("");
          router.refresh();
        }
      } catch {
        setMessage("We could not post your comment. Please try again.");
      }
    });
  }

  return (
    <form className="mt-6" onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="devotional-comment-name">Your name</FieldLabel>
          <Input id="devotional-comment-name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="devotional-comment-content">Your comment</FieldLabel>
          <Textarea id="devotional-comment-content" maxLength={2000} required rows={4} value={content} onChange={(event) => setContent(event.target.value)} />
          <FieldDescription>Your name and comment will be visible to everyone.</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>{pending ? "Posting..." : "Post comment"}</Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
        </Field>
      </FieldGroup>
    </form>
  );
}
