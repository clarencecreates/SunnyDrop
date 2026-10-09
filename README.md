# SunnyDrop

A local PDF workspace for macOS. Drag PDFs into a sun-shaped menu or tell a small local AI what to change. Review the proposed pages, approve the plan, and export a new PDF. Originals are preserved.

## Implemented

- Tauri 2 + React native macOS workspace and file drops.
- Sun rays for Merge, Split/extract, Reorder, Fill, Compress, and Delete pages.
- PDF thumbnails, drag-to-reorder, and local output previews.
- Interactive text fields, checkboxes, and existing dropdown/list options.
- Ollama + Qwen3.5 4B locally generates structured action plans, including multi-step plans.
- Strict action validation, real document IDs, page bounds, and approval before export.
- Email, phone, and account-pattern checks with page-level findings and reviewed page exclusion.
- Three fictional sample PDFs and a fillable form in samples/.

## Run

Requires macOS 13+, Node 22 or 24, Rust, and [Ollama](https://ollama.com/download/mac). Download sizes depend on the Ollama model build; allow several GB for the models. this prototype was developed on a Mac with 16 GB RAM.

```sh
npm ci
ollama pull qwen3.5:4b
ollama pull nomic-embed-text:v1.5
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 ollama serve
```

In a second terminal:

```sh
npm run tauri dev
```

Download dependencies and the model once while online. After that, PDF operations and inference run locally. The native backend calls only 127.0.0.1:11434, bypasses HTTP proxies, and has no cloud model fallback. Fonts, icons, and PDF workers are bundled.

For this Mac's installed runtime, scripts/start-local-ai.sh can start the downloaded Ollama binary. The runtime/ directory is not included in the repository.

## Build a standalone Mac app

```sh
npm run tauri build
open src-tauri/target/release/bundle/macos/SunnyDrop.app
```

For a faster development bundle: `npm run tauri build -- --debug`. It also embeds the frontend and runs without Vite. Builds are ad-hoc signed, not notarized.

## Using SunnyDrop

1. Open the app and follow the interactive first-use guide.
2. Start dragging a PDF from Finder or the Desktop, then hold **Shift** to reveal the sun menu.
3. Drop onto Chat, Split, Compress, Fill, Sign, Reorder, Delete, or Merge. Make changes in the dedicated popup.
4. For Chat edits, review and confirm the proposed action plan. Export a new copy to save your result.

The menu bar includes **How to use SunnyDrop**, **Open workspace**, and **Show drop menu**. The workspace is an optional larger interface.

The AI can only suggest supported PDF actions. It cannot execute shell commands, browse, upload documents, or delete filesystem files. Delete removes selected PDF pages. Intermediate steps refer to the previous output as result.

## Verification

```sh
npm test
npm run samples
npm run test:ai
npm run build
npx vite preview --host 127.0.0.1 --port 1421
# In another terminal:
npx playwright install webkit
npm run test:ui
```

The UI tests run in an isolated WebKit browser. They do not control Finder or verify a native Finder drop. Local inference tests call the downloaded model, not mocked AI responses. Verification artifacts are written to artifacts/ and excluded from Git.

## Limits

- Compression is lossless object-stream repacking, not image recompression; it may produce no size reduction.
- Text extraction is not OCR. Scans without a text layer need an OCR feature that is not implemented.
- AI context includes filename and page metadata, bounded text excerpts, and locally retrieved passages. A model can misunderstand instructions; inspect every plan.
- Privacy detection is heuristic. Findings highlight affected thumbnails and list matched text; they do not locate or erase individual text boxes. Excluding a page is not secure redaction.
- Page copying may lose bookmarks, interactive fields, signatures, or other document-level features. Fill supports existing interactive fields and added text on flat forms, plus experimental original-text block editing.
- Existing PDF passwords are not bypassed. This prototype supports up to 12 PDFs, 60 MB each, and 250 pages per PDF for previews.
- The app starts in the menu bar. Begin dragging a PDF from Finder/Desktop, then hold Shift to reveal the eight-ray overlay. The menu-bar ‘Show drop menu’ item is a fallback. The native monitor uses the drag pasteboard, mouse state, movement, and modifier flags; detection is a heuristic and a live Finder drag has not yet been verified on this Mac.
- The overlay uses the user-supplied eight-ray SVG silhouette with independently clipped targets and an inactive center. Drop onto Chat, Split, Compress, Fill, Sign, Reorder, Delete, or Merge to open a compact popup. Sign supports drawn, typed, and imported PNG/JPEG visual signatures, with page selection, dragging, and sizing. These are visual marks, not certificate-based digital signatures. Fill and Sign use larger dedicated page editors with controls beside the PDF. Fill edits supported interactive fields directly on the page, and can place movable text on flat or scanned pages. Text placement currently supports Latin characters. Chat answers document questions with validated page citations using the local Ollama model, or proposes reviewed edit plans. Scanned PDFs without text need OCR, which is not implemented.
- Transparent macOS windows currently enable Tauri’s macOS private API feature; this prototype is not an App Store submission. Menu and popups are independent windows; the optional full workspace is available from the menu bar.

See [DISCLOSURE.md](DISCLOSURE.md) and the disclosures below for reused components, models, and development tools.

### Experimental original text editing

In Fill, choose **Edit original text**, select a highlighted text block, and change its text in the sidebar. Preview and export a new copy. PDFium runs locally from a bundled WebAssembly file and modifies the original text object; this does not place a white rectangle over old text. Existing font, size, color, and position are retained. Export verifies that replacement text survives reopening. This is a block editor, not a paragraph reflow engine: scanned pages, nested graphics, and fonts that cannot represent the replacement text are not supported yet. Review the preview for overlaps when using longer text.

Chat uses local Nomic embeddings to index page-aware text chunks in memory, then retrieves relevant passages before answering. Indexes are reused within a popup session and are not written to disk. Summaries sample across the document. Search supports up to 200 pages / 200,000 extracted characters per PDF, returns up to 20 semantic matches with document coverage, and respects the existing context budget. Local model calls are serialized to avoid competing inference workloads. This adopts the documented retrieval approach from Stirling; no Stirling proprietary code is copied.

Chat edit requests use the dedicated validated JSON planner. The model receives recent conversation and document metadata; invalid plans receive one validation-guided correction attempt before being rejected. Summaries require an overview plus 3–5 bullet fields; summaries and short documents bypass embedding generation. Retrieved context is capped at 12,000 characters, divided across attached documents.

AI workflow orchestration sends an original-filename document manifest with IDs, page counts, field metadata and bounded extracted text. The strict chat registry supports merge, split/extract, reorder, delete pages, fill interactive fields and lossless compression. Plans use tool/input/arguments steps; `result` refers only to the immediately preceding output. Every step is checked before execution, including intermediate page bounds and fields. Chat shows a filename-based action preview and requires Confirm changes before the local PDF engine executes. Export copy saves a separate file. Unsupported workflows do not execute partial changes; secure redaction is not implemented.

## Disclosures

### Models used

- **Qwen3.5 4B** (`qwen3.5:4b`): document questions, summaries, and structured PDF action planning through Ollama. Model weights are downloaded separately and are not included in this repository. See the [model distribution](https://ollama.com/library/qwen3.5:4b) for its license and download details.
- **Nomic Embed Text v1.5** (`nomic-embed-text:v1.5`): local embeddings for retrieving relevant PDF text. [Model source and license](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5).

### Technologies and frameworks

- **Tauri 2, Rust, Objective-C/AppKit**: macOS windows, menu bar, drag monitoring, native dialogs, and local model communication.
- **React, TypeScript, Vite**: desktop interface and build tooling.
- **pdf-lib, Mozilla PDF.js, EmbedPDF/PDFium WebAssembly**: PDF operations, form filling, rendering, text extraction, and experimental original-text editing.
- **Zod and zod-to-json-schema**: structured plans and validation. **Lucide** supplies interface icons.
- **Vitest, Playwright/WebKit, and tsx**: automated tests and development scripts. Rust dependencies include serde, serde_json, base64, rfd, and reqwest.

### APIs and cloud services

SunnyDrop uses the **local Ollama HTTP API** at `127.0.0.1:11434` for inference and embeddings, plus native macOS APIs and Tauri IPC. **No cloud AI API, cloud document processing, or runtime document-upload service is used.** Dependencies and model weights require an initial download; installed PDF tools and local inference work without Wi-Fi. GitHub is used for source hosting when published, not for processing documents.

### Existing code and assets

SunnyDrop uses the open-source dependencies listed above; their licenses and sources are detailed in [DISCLOSURE.md](DISCLOSURE.md). PDFium notices are included in `src-tauri/licenses/`.

- **Tangerine** inspired the floating menu interaction and visual direction. No Tangerine application code or website JavaScript was copied.
- **LocalPDF and Stirling-PDF** were researched as references. Their application code and binaries are not included; Stirling's documented retrieval approach informed the local chat design.
- The **eight-ray SVG silhouette and SunnyDrop app icon** were supplied by the user. Their provenance and any third-party rights must be checked separately; the project license does not override asset rights.
- Ray sounds were generated locally as PCM WAV tones. Demo PDFs contain fictional sample information.
- `main.swift` retains an earlier Swift/PDFKit experiment and is not compiled into the Tauri app. The native drag monitor and SunnyDrop interface/orchestration were developed for this project.

### AI development tools

**OpenAI Codex** assisted with implementation, debugging, UI iteration, documentation, and testing. This development assistance is separate from SunnyDrop's runtime: user document processing and chatbot inference run locally through the installed PDF engines and Ollama.
