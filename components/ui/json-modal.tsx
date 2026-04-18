"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckIcon, CopyIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: unknown;
  title?: string;
}

export function JsonModal({ open, onOpenChange, data, title = "Routing JSON" }: Props) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; swallow
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col gap-3">
        <DialogHeader className="flex-row items-center justify-between gap-2">
          <DialogTitle>{title}</DialogTitle>
          <Button variant="outline" size="sm" onClick={handleCopy} className="mr-8">
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy JSON"}
          </Button>
        </DialogHeader>
        <pre className="overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
          {text}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
