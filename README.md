# Page Capture Extension

A powerful Chrome extension for capturing sequential screenshots with intelligent auto-stop detection and two-column layout support.

## 🎯 Features

### Core Functionality
- **Sequential Screenshot Capture**: Automatically captures screenshots while navigating through pages
- **Auto-Stop Detection**: Intelligently stops capturing when duplicate pages are detected (same file size)
- **Two-Column Support**: Capture left and right columns separately for two-column layouts (books, PDFs, magazines)
- **RTL Navigation**: Support for Right-to-Left reading order
- **Flexible Page Count**: Set exact page count or use auto-mode for unlimited capture
- **Manual Control**: Stop capture at any time with the floating stop button

### Technical Features
- **Smart Synchronization**: Callback-based capture system ensures perfect timing regardless of content loading speed
- **File Size Detection**: Uses file size comparison (±100 bytes tolerance) to detect document end
- **Interleaved Numbering**: Two-column captures are numbered sequentially (page_0001.png, page_0002.png, etc.)
- **Debug Mode**: Optional detailed console logging for troubleshooting
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

3. **Start using**
   - The extension icon will appear in your toolbar
   - Click it to open the capture interface

## 🚀 Usage

### Basic Capture (Single Rectangle)

1. **Open the extension popup** - Click the extension icon
2. **Configure settings**:
   - Set number of pages (or enable auto-capture mode)
   - Enable RTL if needed
3. **Click "Start Selection"**
4. **Draw a rectangle** on the page around the area you want to capture
5. **Confirm and start** - The extension will automatically:
   - Capture the selected area
   - Press the arrow key to navigate
   - Repeat until complete or stopped

### Two-Column Capture

1. **Enable "Capture two rectangles"** checkbox
2. **Click "Start Selection"**
3. **Draw first rectangle** (e.g., left column) - turns green
4. **Draw second rectangle** (e.g., right column) - turns red
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
| **Enable debug logging** | Show detailed console logs for troubleshooting |

## 🔧 How It Works

### Capture Flow

1. User draws selection rectangle(s) on the page
2. Extension captures visible tab screenshot
3. Screenshot is cropped to selected area(s)
4. File is saved to Downloads folder
5. Arrow key is simulated to navigate to next page
6. Process repeats

### Duplicate Detection

- Calculates file size of each PNG screenshot
- Compares last two consecutive file sizes
- If difference ≤ 100 bytes, considered duplicate
- For two-column mode: **both** rectangles must be duplicates to stop
- Automatically stops capture when duplicate detected

### Synchronization System

Instead of hardcoded delays, the extension uses a callback-based system:
- Each capture waits for actual file download completion
- Works reliably with slow-loading images or PDFs
- Adapts automatically to system and network speed

## 🎨 Use Cases

- **Digital Books**: Capture pages from online readers (supports two-column layouts)
- **PDF Viewers**: Extract pages from browser-based PDF viewers
- **Slide Presentations**: Capture presentation slides sequentially
- **Long Documents**: Capture scrolling content page by page
- **Manga/Comics**: Two-column support perfect for side-by-side pages
- **Research Papers**: Capture academic papers with two-column layouts

## 🐛 Troubleshooting

### Extension doesn't start
- Make sure you're on a regular webpage (not chrome:// pages)
- Refresh the page and try again
- Check browser console for errors (enable Debug mode)

### Captures stop too early
- File sizes might be too similar - this is rare
- Increase tolerance in `background.js` (line 145: `const tolerance = 100;`)
- Use fixed page count instead of auto-mode

### Captures don't stop at document end
- The last two pages might have genuinely different content
- Use manual stop button
- Set a page count limit

### Two rectangles capture same area
- Make sure you draw the second rectangle in a different position
- Check console logs (enable Debug mode) to verify coordinates

### UI buttons overlap
- This has been fixed - cancel button positions dynamically
- If still occurring, report as an issue

## 🛠️ Technical Details

### Architecture

- **manifest.json**: Extension configuration
- **popup.html/js**: User interface
- **content.js**: Runs on webpage - handles rectangle selection and capture coordination
- **background.js**: Service worker - handles screenshot API and file downloads

### Key Technologies

- Chrome Extensions Manifest V3
- Chrome Tabs API (for screenshots)
- Chrome Downloads API (for file saving)
- HTML5 Canvas (for image cropping)
- Keyboard Event Simulation (for navigation)

### Browser Compatibility

- Chrome 88+ (Manifest V3 required)
- Other Chromium browsers (Edge, Brave, etc.) should work but are untested

## 📝 Development

### File Structure
```
page-capture-extension/
├── manifest.json          # Extension configuration
├── background.js          # Screenshot & download handler
├── content.js            # Page interaction & capture logic
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE               # MIT License
└── README.md            # This file
```

### Debug Mode

Enable "Enable debug logging" in the popup to see detailed console output:
- Rectangle selection coordinates
- Capture start/completion events
- File sizes and duplicate detection
- Pending captures status
- Error messages

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Areas for Improvement
- Custom file naming patterns
- Folder organization options
- Image format options (JPEG, WebP)
- Batch processing multiple documents
- Cloud storage integration
- UI improvements

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👤 Author

Created to solve the problem of capturing multi-page documents and books from web readers with automatic duplicate detection.

## 🙏 Acknowledgments

- Built with patience through iterative debugging
- Inspired by the need for better document capture tools
- Thanks to the Chrome Extensions community

## 📞 Support

If you encounter issues:
1. Enable Debug mode and check console logs
2. Check the Troubleshooting section above
3. Open an issue on GitHub with:
   - Chrome version
   - Steps to reproduce
   - Console logs (if relevant)
   - Screenshots (if applicable)

---

**Happy Capturing! 📸**
