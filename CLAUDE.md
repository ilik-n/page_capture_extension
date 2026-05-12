# Chrome Page Capture Extension — CLAUDE.md

## Project Overview

A Chrome extension for sequentially capturing pages of content navigated via keyboard or mouse (e.g. PDF viewers, e-readers, image galleries). Saves cropped screenshots as numbered PNG files to the Downloads folder.

**GitHub:** `github.com/ilik-n/page_capture_extension`
**Version:** 2.0.0

---

## File Structure

```
chrome-page-capture-extension/
├── manifest.json       # Permissions: activeTab, downloads, scripting, host_permissions: <all_urls>
├── popup.html          # Extension UI (380px wide)
├── popup.js            # Reads settings, sends startSelection message to content.js
├── content.js          # Main logic: selection drawing, resize handles, magnifier, capture loop
├── background.js       # Screenshot capture (captureVisibleTab), duplicate detection, downloads
├── README.md
├── LICENSE             # MIT
├── .gitignore
└── icons/              # 16x16, 48x48, 128x128 PNG
```

---

## Architecture & Message Flow

```
popup.js
  └─→ content.js (startSelection message with all settings)
        └─→ User draws rectangle(s) → resize/adjust → confirm via bottom bar
              └─→ [optional rewind] rewindThenCapture()
                    └─→ startCapture() → captureCurrentPage()
                          └─→ background.js (captureArea / captureTwoAreas)
                                └─→ chrome.tabs.captureVisibleTab()
                                └─→ content.js (cropImage)
                                └─→ downloadImage() → chrome.downloads.download()
                                      └─→ chrome.downloads.onChanged → captureComplete
                                            └─→ content.js → proceedToNextPage()
                                                  └─→ simulateArrowKey() → loop
```

---

## Key Features

### Capture Modes
- **Single rectangle** — captures one crop area per page
- **Two rectangles** — captures left and right columns separately; files interleaved (page_0001=left, page_0002=right, etc.)
- **Auto-stop** — duplicate detection via file size comparison (±100 byte tolerance); both rectangles must match in two-rect mode
- **Fixed page count** — stops after N pages

### Navigation
- **LTR mode** — advances with `ArrowRight`
- **RTL mode** — advances with `ArrowLeft`
- **Mouse click mode** *(planned — next session)* — user picks a click coordinate on the page; extension fires `mousedown` + `mouseup` + `click` at that point instead of arrow keys

### Rectangle Selection & Adjustment
- Click and drag on the overlay to draw a rectangle
- **8 resize handles** (corners + edges) with correct cursors
- Drag rectangle body to move the whole frame
- **Magnifier** — shows real zoomed screenshot (3× magnification) of the page under the handle, with red crosshair and coordinates strip; throttled to one `captureVisibleTab` call per 100ms; caches last screenshot for instant display
- `Esc` at any point during drawing or at the confirmation bar cancels and shows an orange `✕ Selection cancelled` toast (2s)

### Confirmation Bottom Bar
Replaces the old floating modal that obscured the top of the content area. A dark full-width bar fixed to the bottom of the screen containing:
- Hint text (areas selected, page count or auto-stop note)
- **↩ Go back [N] pages first** — rewinds N pages in the opposite direction before capture starts (LTR→left, RTL→right); shows orange `↩ Rewinding... X pages to go` indicator
- **▶ Start Capture** button
- **✕ Cancel** button
- `Esc` key also cancels from this stage

### Capture Speed
Configurable via checkbox + dropdown in popup:
- Fast: 300ms
- Normal: 800ms (default when checkbox unchecked)
- Slow: 1500ms
- Very Slow: 3000ms
- Ultra Slow: 5000ms

### Other
- **Tab focus warning** — orange overlay if user switches tabs during capture
- **Retry logic** — up to 3 retries (200ms delay) on `"tab cannot be edited"` errors
- **Debug logging** — all `console.log` wrapped in `debugLog()`, toggled via popup checkbox
- **Progress indicator** — top-right badge showing current/total pages during capture

---

## Important Constants

| Location | Constant | Value | Purpose |
|---|---|---|---|
| `background.js` ~145 | `tolerance` | `100` bytes | Duplicate detection threshold |
| `content.js` | `zoom` | `3` | Magnifier zoom level |
| `content.js` | throttle | `100ms` | Magnifier screenshot refresh rate |
| `content.js` | rewind delay | `300ms` | Delay between rewind key presses |
| `background.js` | retry delay | `200ms` | Delay between capture retries |
| `background.js` | retry max | `3` | Max retries on tab errors |
| `background.js` | two-area delay | `50ms` | Delay between sending two crop messages |

---

## State Variables (content.js)

```js
isSelecting          // Currently drawing a rectangle
selectionBox         // First rectangle DOM element
selectionBox2        // Second rectangle DOM element
overlay              // Dark fullscreen overlay during drawing
captureArea          // {x, y, width, height} of first rectangle
captureArea2         // {x, y, width, height} of second rectangle
isSelectingSecondRect // Drawing the second rectangle
pageCount            // Target pages (0 = auto)
currentPage          // Pages captured so far
rtlMode              // Right-to-left navigation
autoCaptureMode      // Stop on duplicate instead of page count
twoRectangles        // Two-column mode
captureDelay         // ms between page advances
captureCancelled     // Abort flag checked throughout loop
pendingCaptures      // Set of in-progress page numbers
debugMode            // Console logging toggle
magnifierThrottleTimer  // Throttle handle for screenshot requests
magnifierScreenshot     // Cached screenshot dataUrl for magnifier
```

---

## File Naming

Format: `page_0001.png`, `page_0002.png`, ...

Two-column interleaving:
- Odd pages (0001, 0003, ...) = left rectangle
- Even pages (0002, 0004, ...) = right rectangle

---

## Planned Features (not yet implemented)

### Mouse Click Navigation
- New radio group in popup: **Arrow keys** (default) / **Mouse click**
- When "Mouse click" selected: **[Pick on page]** button closes popup, activates crosshair mode, user clicks once to record coordinate
- Coordinate stored, used each page advance: fires `mousedown` + `mouseup` + `click` at that position
- Works alongside all other modes (two-rect, rewind, auto-stop, etc.)

---

## Working Style Notes

- Return complete files, not step-by-step diffs
- One focused change at a time; verify before moving on
- Preserve all existing functionality when adding features
- Keep debug logging wrapped in `debugLog()` throughout
