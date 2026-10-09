# SunnyDrop dependency and development disclosure

SunnyDrop's workspace, sun menu, action schema, PDF orchestration, privacy patterns, review flow, and Tauri command handlers were developed with OpenAI Codex assistance. The earlier Swift/PDFKit experiment is retained as historical source in `main.swift`; it is not compiled into the Tauri app.

| Reused component | Purpose | License / source |
| --- | --- | --- |
| Tauri 2 | Native window, IPC, app bundle | MIT / Apache-2.0; https://tauri.app |
| React | User interface | MIT; https://react.dev |
| pdf-lib | PDF manipulation and form fields | MIT; https://pdf-lib.js.org |
| EmbedPDF PDFium WebAssembly | Local original-text object editing | MIT wrapper / BSD-style PDFium; https://github.com/embedpdf/embed-pdf-viewer; notices in src-tauri/licenses |
| Mozilla PDF.js | Rendering and text extraction | Apache-2.0; https://github.com/mozilla/pdf.js |
| Ollama | Local model runtime | MIT; https://github.com/ollama/ollama |
| Qwen3.5 4B | Local document Q&A and action planning | Model license supplied with distribution; https://ollama.com/library/qwen3.5:4b |
| Nomic Embed Text v1.5 | Local semantic document retrieval | Apache-2.0; https://huggingface.co/nomic-ai/nomic-embed-text-v1.5 |
| Zod, zod-to-json-schema | Validation and model output schema | MIT; npm package licenses |
| Lucide | Interface icons | ISC; https://lucide.dev |
| rfd | Native open/save dialogs | MIT; https://github.com/PolyMeilex/rfd |
| reqwest | Loopback-only HTTP requests | MIT / Apache-2.0; https://github.com/seanmonstar/reqwest |
| Vite, TypeScript, Vitest, Playwright, tsx | Development and testing | Licenses supplied by their packages |

No Tangerine source or assets are included. LocalPDF and Stirling-PDF were researched; this Tauri implementation does not use their application code or binaries. SunnyDrop's PDF engine is pdf-lib and its rendering/text engine is PDF.js.

The model is downloaded separately, not bundled in the app or repository. Inference runs through Ollama at 127.0.0.1:11434. No cloud AI API is part of SunnyDrop's runtime. Codex-assisted development is distinct from the local inference feature.

Demo documents contain fictional information. The organizer determines whether work falls within the allowed hackathon build period. Preserve third-party notices when distributing dependencies or app bundles.

The eight-ray silhouette was supplied by the user. The native menu/popups were inspired by the interaction and appearance of Tangerine. No Tangerine website JavaScript or app binary code was copied. The macOS drag monitor is original Objective-C/AppKit code and is compiled locally with Clang.

Ray feedback tones are original locally generated PCM WAV files: a quiet C-major scale from C4 to C5, played with native NSSound. No downloaded audio assets are used.
