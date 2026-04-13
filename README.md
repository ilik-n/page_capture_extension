# Page Capture Extension

A powerful Chrome extension for capturing sequential screenshots with intelligent auto-stop detection, resizable selection frames, and two-column layout support.

## 🎯 Features

### Core Functionality
- **Sequential Screenshot Capture**: Automatically captures screenshots while navigating through pages
- **Auto-Stop Detection**: Intelligently stops capturing when duplicate pages are detected (same file size)
- **Two-Column Support**: Capture left and right columns separately for two-column layouts (books, PDFs, magazines)
- **RTL Navigation**: Support for Right-to-Left reading order
- **Configurable Capture Speed**: Choose from Fast (0.3s), Normal (0.8s), Slow (1.5s), Very Slow (3s), or Ultra Slow (5s) between pages
- **Flexible Page Count**: Set exact page count or use auto-mode for unlimited capture
- **Manual Control**: Stop capture at any time with the floating stop button

### Advanced Selection Features
- **Resizable Selection Frames**: Drag 8 handles (corners + edges) to precisely adjust capture areas after drawing
- **Drag to Move**: Click and drag the selection rectangle to reposition it
- **Magnifying Glass**: Visual aid appears when resizing, showing coordinates and a crosshair for pixel-perfect positioning
- **Thin Sharp Borders**: Clean 1px borders with no shadow for clear visibility
- **Independent Adjustment**: Both rectangles in two-column mode can be resized and moved separately

### Safety & Reliability
- **Tab Focus Warning**: Orange warning appears if you switch tabs during capture to prevent errors
- **Automatic Retry**: Handles temporary tab errors by retrying up to 3 times
- **Smart Synchronization**: Callback-based capture system ensures perfect timing regardless of content loading speed
- **Debug Mode**: Optional detailed console logging for troubleshooting

### Technical Features
- **File Size Detection**: Uses file size comparison (±100 bytes tolerance) to detect document end
- **Interleaved Numbering**: Two-column captures are numbered sequentially (page_0001.png, page_0002.png, etc.)
- **High-DPI Support**: Works correctly on Retina and high-resolution displays

## 📥 Installation

### From Source (Developer Mode)

1. **Download the extension**
   ```bash
   git clone https://github.com/yourusername/page-capture-extension.git
   cd page-capture-extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the extension directory

3. **Grant permissions**
   - Chrome will ask for permission to "Read and change all your data on websites you visit"
   - This is required for the screenshot API and is only used during active capture

4. **Start using**
   - The extension icon will appear in your toolbar
   - Click it to open the capture interface

## 🚀 Usage

### Basic Capture (Single Rectangle)

1. **Open the extension popup** - Click the extension icon
2. **Configure settings**:
   - Set number of pages (or enable auto-capture mode)
   - Enable RTL if needed
   - Optional: Enable custom capture speed and select desired delay
3. **Click "Start Selection"**
4. **Draw a rectangle** on the page around the area you want to capture
5. **Adjust if needed**:
   - Drag the 8 resize handles to fine-tune the selection
   - Click and drag the rectangle itself to move it
   - Use the magnifying glass for precise positioning
6. **Confirm and start** - The extension will automatically:
   - Capture the selected area
   - Press the arrow key to navigate
   - Repeat until complete or stopped

### Two-Column Capture

1. **Enable "Capture two rectangles"** checkbox
2. **Click "Start Selection"**
3. **Draw first rectangle** (e.g., left column) - turns green
   - Resize and adjust as needed using the handles
4. **Draw second rectangle** (e.g., right column) - turns red
   - Resize and adjust independently
5. **Confirm and start** - The extension will:
   - Capture both rectangles from each page
   - Save with interleaved numbering (odd = left, even = right)
   - Continue until end is detected

### Auto-Capture Mode

Perfect when you don't know the exact page count:

1. **Enable "Auto-capture mode"** checkbox
2. **Start selection** as normal
3. The extension will **automatically stop** when it detects duplicate pages
4. No more capturing the last page repeatedly!

### Custom Capture Speed

For slow-loading pages or manual review:

1. **Enable "Custom capture speed"** checkbox
2. **Select speed** from dropdown:
   - Fast (0.3s) - For quick, stable pages
   - Normal (0.8s) - Default speed
   - Slow (1.5s) - For slower loading content
   - Very Slow (3s) - For heavy PDFs or images
   - Ultra Slow (5s) - For very slow connections or manual review
3. **Leave unchecked** to use default fast mode (0.3s)

### Important: Keep Tab Focused!

**⚠️ Do not switch tabs or windows during capture!**
- An orange warning will appear if you switch away
- The warning disappears when you return to the capture tab
- Switching tabs can cause capture errors

## 📁 File Output

Files are saved to your **Downloads folder** with the naming format:
- Single rectangle: `page_0001.png`, `page_0002.png`, `page_0003.png`, ...
- Two rectangles: `page_0001.png` (left), `page_0002.png` (right), `page_0003.png` (left), ...

## ⚙️ Settings

| Setting | Description |
|---------|-------------|
| **Capture two rectangles** | Enable two-column layout capture |
| **Right-to-Left (RTL) navigation** | Use left arrow instead of right arrow for navigation |
| **Auto-capture mode** | Automatically stop when duplicates detected |
| **Number of pages** | Exact page count (disabled in auto-mode) |
| **Custom capture speed** | Enable configurable delay between page captures |
| **Capture speed** | Select delay: Fast (0.3s), Normal (0.8s), Slow (1.5s), Very Slow (3s), Ultra Slow (5s) |
| **Enable debug logging** | Show detailed console logs for troubleshooting |

## 🔧 How It Works

### Capture Flow

1. User draws selection rectangle(s) on the page
2. User can resize and reposition rectangles using handles (magnifier appears)
3. Extension captures visible tab screenshot
4. Screenshot is cropped to selected area(s)
5. File is saved to Downloads folder
6. Arrow key is simulated to navigate to next page
7. Waits for configurable delay (or default 0.3s)
8. Process repeats

### Resizable Selection System

- **8 resize handles**: Corners (NW, NE, SE, SW) and edges (N, E, S, W)
- **Drag handles** to resize the selection area
- **Drag rectangle body** to move entire selection
- **Magnifying glass** appears during resize:
  - Shows current X/Y coordinates
  - Displays grid pattern and crosshair
  - Positioned 20px offset from cursor

### Tab Focus Protection

- **Visibility listener** detects when tab loses focus
- **Orange warning overlay** appears immediately:
  - "⚠️ WARNING ⚠️ Keep this tab focused during capture!"
  - "Switching tabs may cause errors"
- **Auto-dismissal** when tab regains focus
- **Cleanup** removes all listeners on completion/cancel

### Duplicate Detection

- Calculates file size of each PNG screenshot
- Compares last two consecutive file sizes
- If difference ≤ 100 bytes, considered duplicate
- For two-column mode: **both** rectangles must be duplicates to stop
- Automatically stops capture when duplicate detected

### Error Handling & Retry

- If tab error occurs ("Tabs cannot be edited right now"):
  - Automatically retries up to 3 times
  - 200ms delay between retries
  - Works for both single and two-area captures
- Graceful degradation on persistent errors

### Synchronization System

Instead of hardcoded delays, the extension uses a callback-based system:
- Each capture waits for actual file download completion
- Works reliably with slow-loading images or PDFs
- Adapts automatically to system and network speed
- Optional custom delay for page navigation

## 🎨 Use Cases

- **Digital Books**: Capture pages from online readers (supports two-column layouts)
- **PDF Viewers**: Extract pages from browser-based PDF viewers
- **Slide Presentations**: Capture presentation slides sequentially
- **Long Documents**: Capture scrolling content page by page
- **Manga/Comics**: Two-column support perfect for side-by-side pages
- **Research Papers**: Capture academic papers with two-column layouts
- **Slow-Loading Content**: Use custom speed settings for heavy PDFs or image galleries

## 🐛 Troubleshooting

### Extension doesn't start
- Make sure you're on a regular webpage (not chrome:// pages)
- Check that you've granted the required permissions
- Refresh the page and try again
- Check browser console for errors (enable Debug mode)

### "Tabs cannot be edited right now" error
- This should auto-retry up to 3 times
- If persistent, make sure no other extension is interfering
- Ensure the tab is fully loaded before starting capture

### Captures stop too early
- File sizes might be too similar - this is rare
- Increase tolerance in `background.js` (line 145: `const tolerance = 100;`)
- Use fixed page count instead of auto-mode

### Captures don't stop at document end
- The last two pages might have genuinely different content
- Use manual stop button
- Set a page count limit

### Tab focus warning appears
- This is intentional - keep the capture tab focused
- Switch back to the tab to dismiss the warning
- Don't work in other tabs/windows during capture

### Two rectangles capture same area
- Make sure you draw the second rectangle in a different position
- Use resize handles to adjust after drawing
- Check console logs (enable Debug mode) to verify coordinates

### Magnifier doesn't show actual screen content
- This is by design - browser APIs don't allow real-time screen magnification
- The magnifier shows coordinates and grid for precise positioning
- Focus on the handle position relative to your content

### Captures too fast or too slow
- Enable "Custom capture speed" checkbox
- Select appropriate speed for your content
- Use Ultra Slow (5s) for manual verification of each capture

## 🛠️ Technical Details

### Architecture

- **manifest.json**: Extension configuration with Manifest V3
- **popup.html/js**: User interface with all settings
- **content.js**: Runs on webpage - handles rectangle selection, resizing, and capture coordination
- **background.js**: Service worker - handles screenshot API, file downloads, and retry logic

### Key Technologies

- Chrome Extensions Manifest V3
- Chrome Tabs API (for screenshots)
- Chrome Downloads API (for file saving)
- HTML5 Canvas (for image cropping and magnifier)
- Keyboard Event Simulation (for navigation)
- Visibility API (for tab focus detection)

### Permissions Explained

- **activeTab**: Access current tab when extension icon is clicked
- **downloads**: Save captured images to Downloads folder
- **scripting**: Inject content script for rectangle selection
- **host_permissions ("&lt;all_urls&gt;")**: Required for screenshot API during automated capture

### Browser Compatibility

- Chrome 88+ (Manifest V3 required)
- Other Chromium browsers (Edge, Brave, etc.) should work but are untested

## 📝 Development

### File Structure
```
page-capture-extension/
├── manifest.json          # Extension configuration
├── background.js          # Screenshot & download handler with retry logic
├── content.js            # Page interaction, selection, resize, & capture logic
├── popup.html            # Extension popup interface (380px width)
├── popup.js              # Popup logic with all settings
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE               # MIT License
└── README.md            # This file
```

### Key Code Locations

**popup.js:**
- Custom delay checkbox/dropdown handling
- Settings passed to content script

**content.js:**
- `addResizeHandles()`: Creates 8 resize handles and magnifier
- `startCapture()`: Initializes visibility warning system
- `proceedToNextPage()`: Uses configurable `captureDelay`
- `updateCaptureArea()`: Updates coordinates during resize

**background.js:**
- `captureScreenshot()`: Retry logic for tab errors
- `downloadImage()`: Duplicate detection with tolerance
- `chrome.downloads.onChanged`: Callback-based synchronization

### Debug Mode

Enable "Enable debug logging" in the popup to see detailed console output:
- Rectangle selection coordinates
- Capture start/completion events
- File sizes and duplicate detection
- Pending captures status
- Magnifier coordinate tracking
- Visibility change events
- Retry attempts
- Error messages

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Areas for Improvement
- Custom file naming patterns
- Folder organization options
- Image format options (JPEG, WebP)
- Compression settings
- Batch processing multiple documents
- Cloud storage integration
- Actual screen magnification (if browser APIs allow)
- UI improvements
- Chapter/section markers

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👤 Author

Created to solve the problem of capturing multi-page documents and books from web readers with automatic duplicate detection, precise selection control, and reliable operation.

## 🙏 Acknowledgments

- Built with patience through iterative debugging and testing
- Inspired by the need for better document capture tools
- Thanks to the Chrome Extensions community
- Special recognition for collaborative development approach

## 📞 Support

If you encounter issues:
1. Enable Debug mode and check console logs
2. Check the Troubleshooting section above
3. Ensure you're keeping the tab focused during capture
4. Try adjusting capture speed for your content type
5. Open an issue on GitHub with:
   - Chrome version
   - Extension version
   - Steps to reproduce
   - Console logs (if relevant)
   - Screenshots (if applicable)
   - Whether tab focus warning appeared

---

**Happy Capturing! 📸**

**Pro Tips:**
- Use two-column mode for books and research papers
- Enable auto-mode when you don't know page count
- Use slower speeds for heavy PDFs or slow connections
- Resize selections after drawing for pixel-perfect captures
- Watch the magnifier coordinates for precise positioning
- Keep the tab focused - the warning is there to help you!
