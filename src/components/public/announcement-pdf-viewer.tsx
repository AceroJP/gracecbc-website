"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

type PdfLoadingTask = import("pdfjs-dist").PDFDocumentLoadingTask;

type PdfLoadingTaskEntry = {
  task: PdfLoadingTask;
  references: number;
  destroyTimer?: ReturnType<typeof setTimeout>;
};

const loadingTasks = new Map<string, PdfLoadingTaskEntry>();

function acquireLoadingTask(
  url: string,
  pdfjs: typeof import("pdfjs-dist"),
) {
  let entry = loadingTasks.get(url);
  if (!entry) {
    entry = {
      task: pdfjs.getDocument({ url }),
      references: 0,
    };
    loadingTasks.set(url, entry);
  }

  if (entry.destroyTimer) {
    clearTimeout(entry.destroyTimer);
    entry.destroyTimer = undefined;
  }
  entry.references += 1;
  return entry;
}

function releaseLoadingTask(url: string, entry: PdfLoadingTaskEntry) {
  entry.references -= 1;
  if (entry.references > 0) {
    return;
  }

  entry.destroyTimer = setTimeout(() => {
    if (entry.references > 0) {
      return;
    }

    loadingTasks.delete(url);
    void entry.task.destroy();
  }, 1000);
}

export default function AnnouncementPdfViewer({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [viewerWidth, setViewerWidth] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let taskEntry: PdfLoadingTaskEntry | undefined;

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) {
          return;
        }

        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        taskEntry = acquireLoadingTask(url, pdfjs);
        const loadedDocument = await taskEntry.task.promise;
        if (!cancelled) {
          setDocument(loadedDocument);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("Unable to display announcement PDF.", loadError);
          setError(true);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      if (taskEntry) {
        releaseLoadingTask(url, taskEntry);
      }
    };
  }, [url]);

  useEffect(() => {
    if (!scrollRoot) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setViewerWidth(entry.contentRect.width - 16);
    });
    resizeObserver.observe(scrollRoot);

    return () => resizeObserver.disconnect();
  }, [scrollRoot]);

  return (
    <div className="grid gap-3">
      {error ? (
        <p
          className="rounded-lg border border-border p-4 text-sm text-muted-foreground"
          role="alert"
        >
          This PDF could not be displayed here. Use the link below to open it.
        </p>
      ) : (
        <div
          aria-label={`${title} PDF pages`}
          className="h-[65dvh] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted p-2 [-webkit-overflow-scrolling:touch]"
          role="region"
          ref={setScrollRoot}
          tabIndex={0}
        >
          {!document ? (
            <p
              aria-live="polite"
              className="p-4 text-center text-sm text-muted-foreground"
            >
              Loading PDF…
            </p>
          ) : (
            Array.from({ length: document.numPages }, (_, index) => (
              <PdfPage
                document={document}
                key={index + 1}
                pageNumber={index + 1}
                scrollRoot={scrollRoot}
                width={viewerWidth}
              />
            ))
          )}
        </div>
      )}
      <a
        className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        Open original PDF
      </a>
    </div>
  );
}

function PdfPage({
  document,
  pageNumber,
  scrollRoot,
  width,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  scrollRoot: HTMLDivElement | null;
  width: number;
}) {
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [pageRatio, setPageRatio] = useState<number>();
  const [visible, setVisible] = useState(
    pageNumber === 1 || typeof IntersectionObserver === "undefined",
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    document
      .getPage(pageNumber)
      .then((loadedPage) => {
        if (cancelled) {
          return;
        }

        const viewport = loadedPage.getViewport({ scale: 1 });
        setPage(loadedPage);
        setPageRatio(viewport.width / viewport.height);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          console.error(`Unable to load PDF page ${pageNumber}.`, loadError);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [document, pageNumber]);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || visible) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot, rootMargin: "400px 0px" },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, [scrollRoot, visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!page || !canvas || !context || !visible || width <= 0) {
      return;
    }

    const originalViewport = page.getViewport({ scale: 1 });
    const displayWidth = Math.min(width, originalViewport.width * 1.5);
    const viewport = page.getViewport({
      scale: displayWidth / originalViewport.width,
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform:
        pixelRatio === 1
          ? undefined
          : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    });
    renderTask.promise.catch((renderError: unknown) => {
      if (
        !(renderError instanceof Error) ||
        renderError.name !== "RenderingCancelledException"
      ) {
        console.error(`Unable to render PDF page ${pageNumber}.`, renderError);
        setError(true);
      }
    });

    return () => renderTask.cancel();
  }, [page, pageNumber, visible, width]);

  return (
    <div
      aria-label={`Page ${pageNumber}`}
      className="mb-3 flex w-full justify-center last:mb-0"
      ref={pageContainerRef}
      style={pageRatio ? { aspectRatio: pageRatio } : undefined}
    >
      {error ? (
        <p className="p-4 text-sm text-muted-foreground">
          Page {pageNumber} could not be rendered.
        </p>
      ) : (
        <canvas
          className="h-auto max-w-full bg-white shadow-sm"
          ref={canvasRef}
        />
      )}
    </div>
  );
}
