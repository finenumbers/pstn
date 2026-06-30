"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolbarOutlineButton } from "@/components/ranges/ToolbarOutlineButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  serializeDatasetParam,
  type DatasetRef,
} from "@/packages/shared/contracts/dataset.schema";

interface ExternalApiHelpDialogProps {
  phoneMask?: string;
  dataset?: DatasetRef;
  disabled?: boolean;
}

function ExampleBlock({
  title,
  curlExample,
}: {
  title: string;
  curlExample: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!curlExample) return;
    try {
      await navigator.clipboard.writeText(curlExample);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!curlExample}
          className="h-7 shrink-0"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
        {curlExample}
      </pre>
    </div>
  );
}

export function ExternalApiHelpDialog({
  phoneMask = "",
  dataset = { kind: "current" },
  disabled,
}: ExternalApiHelpDialogProps) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);
  const [exactCurl, setExactCurl] = useState("");
  const [searchCurl, setSearchCurl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadExamples = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (phoneMask.trim()) {
        params.set("phoneMask", phoneMask.trim());
      }
      const datasetParam = serializeDatasetParam(dataset);
      if (datasetParam !== "current") {
        params.set("dataset", datasetParam);
      }
      const query = params.toString();
      const response = await fetch(
        `/api/v1/lookup/examples${query ? `?${query}` : ""}`
      );
      if (!response.ok) {
        setConfigured(false);
        setApiBaseUrl(null);
        setExactCurl("");
        setSearchCurl("");
        setLoadError("Не удалось загрузить примеры API. Попробуйте позже.");
        return;
      }
      const payload = (await response.json()) as {
        configured?: boolean;
        baseUrl?: string | null;
        exactCurl?: string;
        searchCurl?: string;
      };
      setConfigured(payload.configured === true);
      setApiBaseUrl(payload.baseUrl ?? null);
      setExactCurl(payload.exactCurl ?? "");
      setSearchCurl(payload.searchCurl ?? "");
    } catch {
      setConfigured(false);
      setApiBaseUrl(null);
      setExactCurl("");
      setSearchCurl("");
      setLoadError(
        "Не удалось загрузить примеры API. Проверьте соединение и повторите."
      );
    } finally {
      setLoading(false);
    }
  }, [phoneMask, dataset]);

  useEffect(() => {
    if (open) {
      void loadExamples();
    }
  }, [open, loadExamples]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ToolbarOutlineButton disabled={disabled}>
          <Code2 className="h-4 w-4 shrink-0" />
          API
        </ToolbarOutlineButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Внешний API</DialogTitle>
          <DialogDescription>
            Read-only lookup по номерам. Авторизация:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              Authorization: Bearer &lt;ключ&gt;
            </code>{" "}
            или{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              X-Api-Key: &lt;ключ&gt;
            </code>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="space-y-1">
            <h3 className="font-medium">Точный номер</h3>
            <p className="text-muted-foreground">
              <code className="text-xs">GET /api/v1/lookup?phone=&lt;10 цифр&gt;</code>{" "}
              — один диапазон или HTTP 404.
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="font-medium">Поиск по маске</h3>
            <p className="text-muted-foreground">
              <code className="text-xs">
                GET /api/v1/lookup/search?phone=&lt;маска&gt;&amp;page=1&amp;pageSize=50
              </code>{" "}
              — список диапазонов и{" "}
              <code className="text-xs">meta.totalRows</code>. Символ{" "}
              <code className="text-xs">X</code> — любая цифра (как в блоке «Найти
              номер»). <code className="text-xs">pageSize</code> max 100.
            </p>
          </section>

          <section className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Примеры ниже — готовые curl с ключом и адресом внешнего API
              {apiBaseUrl ? "" : " (задайте EXTERNAL_API_BASE_URL для публичного IP или домена)"}.
              Маска в примере search подставляется из поля «Найти номер», если там
              есть цифры. Полный 10-значный номер в поле «Найти номер» подставляется
              также в пример точного lookup; иначе — номер по умолчанию.
            </p>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : configured && searchCurl ? (
              <div className="space-y-4">
                <ExampleBlock title="Точный номер" curlExample={exactCurl} />
                <ExampleBlock title="Поиск по маске" curlExample={searchCurl} />
              </div>
            ) : loadError ? (
              <p className="text-xs text-red-800" role="alert">
                {loadError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                API lookup не настроен (не задан ключ EXTERNAL_API_KEY на сервере).
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
