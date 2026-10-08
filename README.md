# DocToText

A local Mac app that converts documents to plain text and Markdown — PDF, Word
(.doc/.docx), PowerPoint (.pptx), and scanned images (PNG/JPEG via OCR).
Everything runs on your machine. No file content or extracted text is ever
sent anywhere, and no API keys are required.

## How it works

1. **Upload** — drag a file onto the window, or click "Browse" to pick one.
2. **Processing** — the file is converted in batches (page-by-page for PDFs,
   slide-by-slide for PowerPoint) so even very large files don't freeze the
   app. There's no file size cap.
3. **Result** — the extracted text appears in a scrollable box. Copy it to
   the clipboard, or save it as a `.md` file straight into `~/Downloads`.

If a file fails to convert, you'll see a clear error message with a button
to try another file — no restart needed.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 18 or newer (you have this already — checked
  during setup)

## Run it locally

```bash
cd ~/Projects/DocToText
npm install
npm start
```

That launches the app in a window, exactly like it'll run once packaged.

## One-time OCR setup (for PNG/JPEG image files)

Text recognition for images uses Tesseract, running fully offline. It needs
one small language-data file (~4 MB) on disk first — a one-time download,
not something the app fetches automatically:

```bash
mkdir -p ~/Projects/DocToText/assets/tessdata
curl -L -o ~/Projects/DocToText/assets/tessdata/eng.traineddata.gz \
  https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz
```

After that, OCR runs completely locally — no network calls, ever, for
actual image/document processing. If you try to convert an image before
running this, the app shows you this exact command in its error screen.

## Building the double-clickable .app

```bash
cd ~/Projects/DocToText
npm run dist
```

This uses `electron-builder` and produces:

- `dist/mac-arm64/DocToText.app` (or `dist/mac/DocToText.app` on Intel Macs)
  — the app itself, ready to double-click or drag into `/Applications`
- `dist/DocToText-1.0.0-arm64.dmg` — a disk image installer with the same
  app inside, if you'd rather double-click a `.dmg` and drag to Applications

To install it properly:

```bash
open dist/mac-arm64/DocToText.app  # or the equivalent dist/mac/ path
```

or open the `.dmg` from Finder and drag `DocToText.app` into `Applications`.

### First launch: "can't be opened" warning

This build isn't signed with an Apple Developer certificate (that costs
$99/year), so the first time you open it, macOS Gatekeeper will say it
can't verify the developer. To open it anyway:

1. Right-click (or Control-click) `DocToText.app` in Finder
2. Choose **Open**
3. Click **Open** again in the dialog that appears

You only need to do this once — after that it opens normally.

## Supported formats

| Format | How text is extracted |
|---|---|
| `.pdf` | Direct text extraction via `pdfjs-dist`, page by page in batches of 10 |
| `.docx` | Direct extraction via `mammoth` |
| `.doc` (legacy binary format) | `word-extractor`, which reads the old binary format mammoth can't |
| `.pptx` | Every slide's text plus speaker notes, read in the actual slide order (not just file order), in batches of 5 slides |
| `.png` / `.jpg` / `.jpeg` | OCR via `tesseract.js`, fully offline |

## Privacy

- No file you convert, and no text extracted from it, ever leaves your
  computer — there are no network calls anywhere in the conversion path.
- No API keys, no accounts, no telemetry.
- The only network activity in this whole project is the one-time OCR
  language-data download above, and that's a command you run yourself,
  not something the app does silently.

## Project structure

```
main.js              Electron main process — window, file dialog, IPC, save-to-Downloads
preload.js            Safe bridge exposing a small api to the renderer (no direct Node access)
renderer/              The 3-screen UI (upload / processing / result)
src/index.js           Picks a converter based on file extension
src/converters/         One file per format: pdf.js, docx.js, doc.js, pptx.js, image.js
assets/tessdata/        OCR language data lives here (see one-time setup above)
```

## Troubleshooting

- **"Unsupported file type"** — only PDF, DOC, DOCX, PPTX, PNG, JPG, JPEG are
  supported; the error names the exact extension it saw.
- **OCR error about missing language data** — run the one-time setup command
  above.
- **A specific file fails to convert** — the error screen shows the actual
  underlying error message (e.g. a corrupted or password-protected PDF).
  Click "Try another file" to keep going without restarting the app.
