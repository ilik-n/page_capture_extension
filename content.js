// content.js - Runs on the webpage to handle rectangle selection and capture

// Prevent multiple injections
if (window.captureExtensionLoaded) {
  console.log('Capture extension already loaded');
} else {
  window.captureExtensionLoaded = true;

  let isSelecting = false;
  let startX, startY;
  let selectionBox = null;
  let selectionBox2 = null; // For second rectangle in two-rect mode
  let overlay = null;
  let captureArea = null;
  let pageCount = 0;
  let currentPage = 0;
  let rtlMode = false;
  let captureCancelled = false;
  let autoCaptureMode = false; // True when page count is not specified
  let twoRectangles = false;
  let captureArea2 = null; // Second rectangle
  let isSelectingSecondRect = false;
  let pendingCaptures = new Set(); // Track which captures are in progress
  let debugMode = false; // Enable/disable debug logging
  let magnifierThrottleTimer = null;
  let magnifierScreenshot = null; // Cache last screenshot for magnifier

  // Helper function for debug logging
  function debugLog(...args) {
    if (debugMode) {
      console.log(...args);
    }
  }

  // Listen for messages from popup and background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startSelection') {
      pageCount = message.pageCount;
      rtlMode = message.rtlMode || false;
      autoCaptureMode = message.autoCaptureMode || false;
      twoRectangles = message.twoRectangles || false;
      debugMode = message.debugMode || false;
      captureCancelled = false;
      captureDelay = message.captureDelay || 800;
  
      console.log('🔧 Capture delay set to:', captureDelay, 'ms');
      
      // Send debugMode to background script
      chrome.runtime.sendMessage({ action: 'setDebugMode', enabled: debugMode });
      
      initializeSelection();
    } else if (message.action === 'cropImage') {
      cropImage(message.dataUrl, message.area, message.pageNumber);
    } else if (message.action === 'cancelCapture') {
      captureCancelled = true;
      cancelCapture();
    } else if (message.action === 'duplicateDetected') {
      handleDuplicateDetected(message.pageNumber);
    } else if (message.action === 'captureComplete') {
      handleCaptureComplete(message.pageNumber);
    }
  });

  function handleDuplicateDetected(pageNumber) {
    console.log('🛑 Duplicate file detected at page', pageNumber, '- stopping capture');

    // Stop the capture
    captureCancelled = true;

    // Update progress message
    const progressDiv = document.getElementById('captureProgress');
    if (progressDiv) {
      progressDiv.textContent = `✓ Auto-stopped at page ${pageNumber} (duplicate detected)`;
      progressDiv.style.background = '#FF9800'; // Orange color

      setTimeout(() => {
        if (progressDiv && progressDiv.parentNode) {
          progressDiv.remove();
        }
        if (selectionBox && selectionBox.parentNode) {
          selectionBox.remove();
        }
        if (selectionBox2 && selectionBox2.parentNode) {
          selectionBox2.remove();
        }
      }, 3000);
    }

    // Remove cancel button
    const cancelBtn = document.getElementById('floatingCancelBtn');
    if (cancelBtn && cancelBtn.parentNode) {
      cancelBtn.remove();
    }
  }

  function handleCaptureComplete(pageNumber) {
    console.log('✓ Capture complete for page', pageNumber);
    
    // Remove this page number from pending captures
    pendingCaptures.delete(pageNumber);
    
    debugLog('Pending captures remaining:', Array.from(pendingCaptures));
    
    // If all captures for current page are done, move to next page
    if (pendingCaptures.size === 0) {
      proceedToNextPage();
    }
  }

  function cancelCapture() {
    console.log('Capture cancelled by user');

    // Set the flag to stop further captures
    captureCancelled = true;

    // Clean up ALL UI elements
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.remove();
    }
    if (selectionBox2 && selectionBox2.parentNode) {
      selectionBox2.remove();
    }

    const progressDiv = document.getElementById('captureProgress');
    if (progressDiv && progressDiv.parentNode) {
      progressDiv.remove();
    }

    const cancelBtn = document.getElementById('floatingCancelBtn');
    if (cancelBtn && cancelBtn.parentNode) {
      cancelBtn.remove();
    }

    // Show cancellation message briefly
    const cancelDiv = document.createElement('div');
    cancelDiv.style.cssText = `
      position: fixed;
      top: 5px;
      right: 400px;
      background: #ff9800;
      color: white;
      padding: 8px 15px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      z-index: 1000002;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    cancelDiv.textContent = '✗ Capture cancelled';
    document.body.appendChild(cancelDiv);

    setTimeout(() => {
      if (cancelDiv && cancelDiv.parentNode) {
        cancelDiv.remove();
      }
    }, 2000);
  }

  function cropImage(dataUrl, area, pageNumber) {
    debugLog('Cropping image for page', pageNumber);

    const img = new Image();

    img.onload = function () {
      // Create a canvas to crop the image
      const canvas = document.createElement('canvas');
      canvas.width = area.width;
      canvas.height = area.height;
      const ctx = canvas.getContext('2d');

      // Get the device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      debugLog('Device pixel ratio:', dpr);
      debugLog('Crop area:', area);

      // Draw the cropped portion
      ctx.drawImage(
        img,
        area.x * dpr,
        area.y * dpr,
        area.width * dpr,
        area.height * dpr,
        0,
        0,
        area.width,
        area.height
      );

      // Convert canvas to data URL
      const croppedDataUrl = canvas.toDataURL('image/png');

      debugLog('Image cropped, sending to background for download');

      // Send the cropped image back to background script for download
      chrome.runtime.sendMessage({
        action: 'downloadImage',
        dataUrl: croppedDataUrl,
        pageNumber: pageNumber
      });
    };

    img.onerror = function () {
      console.error('Failed to load image for cropping');
    };

    img.src = dataUrl;
  }

  function initializeSelection() {
    // Clean up any existing elements first
    cleanupSelection();

    // Create overlay that covers entire page
    overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999999;
      cursor: crosshair;
    `;

    // Create the selection box
    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: fixed;
      border: 1px solid #ff0000;
      background: rgba(255, 0, 0, 0.1);
      z-index: 1000000;
      display: none;
      pointer-events: none;
    `;

    // Create instruction text
    const instructionText = document.createElement('div');
    instructionText.id = 'captureInstruction';
    instructionText.textContent = 'Click and drag to select capture area — Esc to cancel';
    instructionText.style.cssText = `
      position: fixed;
      top: 5px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff0000;
      color: white;
      padding: 8px 15px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 1000001;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(instructionText);

    // Esc key cancels drawing at any point
    function onEscKey(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onEscKey);
        cleanupSelection();

        // Toast message
        const toast = document.createElement('div');
        toast.textContent = '✕ Selection cancelled';
        toast.style.cssText = `
          position: fixed;
          top: 5px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff9800;
          color: white;
          padding: 8px 20px;
          border-radius: 5px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          z-index: 1000010;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      }
    }
    document.addEventListener('keydown', onEscKey);

    // Mouse event handlers
    overlay.addEventListener('mousedown', startSelection);
    document.addEventListener('mousemove', updateSelection);
    document.addEventListener('mouseup', endSelection);
  }

  function startSelection(e) {
    e.preventDefault();
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    // Use second box if drawing second rectangle, otherwise use first
    const activeBox = isSelectingSecondRect ? selectionBox2 : selectionBox;

    activeBox.style.left = startX + 'px';
    activeBox.style.top = startY + 'px';
    activeBox.style.width = '0px';
    activeBox.style.height = '0px';
    activeBox.style.display = 'block';

    debugLog('Selection started at:', startX, startY);
  }

  function updateSelection(e) {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    // Use second box if drawing second rectangle, otherwise use first
    const activeBox = isSelectingSecondRect ? selectionBox2 : selectionBox;

    activeBox.style.left = left + 'px';
    activeBox.style.top = top + 'px';
    activeBox.style.width = width + 'px';
    activeBox.style.height = height + 'px';
  }

  function endSelection(e) {
    if (!isSelecting) return;
    isSelecting = false;

    debugLog('Selection ended');

    // Get final coordinates from the CORRECT box
    const activeBox = isSelectingSecondRect ? selectionBox2 : selectionBox;
    const rect = activeBox.getBoundingClientRect();

    if (rect.width < 10 || rect.height < 10) {
      alert('Selection too small. Please try again.');
      cleanupSelection();
      initializeSelection();
      return;
    }

    // Store the first or second capture area
    if (!isSelectingSecondRect) {
      // This is the first rectangle
      captureArea = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };

      debugLog('First capture area:', captureArea);

      if (twoRectangles) {
        selectionBox.style.background = 'transparent';
        selectionBox.style.border = '1px solid #00ff00'; // Green for first
        selectionBox.style.pointerEvents = 'auto'; // Enable interaction for resizing
        
        // Add resize handles to first box
        addResizeHandles(selectionBox);

        // Update instruction
        const instruction = document.getElementById('captureInstruction');
        if (instruction) {
          instruction.textContent = 'Now draw the SECOND rectangle';
          instruction.style.background = '#00ff00';
        }

        // CREATE SECOND SELECTION BOX for drawing the second rectangle
        selectionBox2 = document.createElement('div');
        selectionBox2.style.cssText = `
    position: fixed;
    border: 1px solid #ff0000;
    background: rgba(255, 0, 0, 0.1);
    z-index: 1000000;
    display: none;
    pointer-events: none;
  `;
        document.body.appendChild(selectionBox2);

        isSelectingSecondRect = true;
        // Don't remove overlay - let them draw again
        return; // Exit here, wait for second rectangle
      }

    } else {
      // This is the second rectangle
      captureArea2 = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };

      debugLog('Second capture area:', captureArea2);

      // Make second box transparent with red border
      selectionBox2.style.background = 'transparent';
      selectionBox2.style.border = '1px solid #ff0000';
    }

    // Remove overlay and instruction
    overlay.remove();
    const instruction = document.getElementById('captureInstruction');
    if (instruction) instruction.remove();

    // Add resize handles to the rectangles
    addResizeHandles(isSelectingSecondRect ? selectionBox2 : selectionBox);

    // Show confirmation
    showConfirmation();
  }

  function addResizeHandles(box) {
    // Enable pointer events for the box
    box.style.pointerEvents = 'auto';
    box.style.cursor = 'move';
    
    // Create magnifying glass element
    const magnifier = document.createElement('div');
    magnifier.id = 'resize-magnifier';
    magnifier.style.cssText = `
      position: fixed;
      width: 150px;
      height: 150px;
      border: 2px solid #000;
      border-radius: 50%;
      background: white;
      z-index: 1000002;
      display: none;
      pointer-events: none;
      overflow: hidden;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    
    const magnifierCanvas = document.createElement('canvas');
    magnifierCanvas.width = 150;
    magnifierCanvas.height = 150;
    magnifier.appendChild(magnifierCanvas);
    document.body.appendChild(magnifier);
    
    // Create 8 resize handles (corners and edges)
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const handleSize = 8;
    
    handles.forEach(position => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${position}`;
      handle.style.cssText = `
        position: absolute;
        width: ${handleSize}px;
        height: ${handleSize}px;
        background: #ffffff;
        border: 1px solid #000000;
        z-index: 1000001;
      `;
      
      // Position handles
      if (position.includes('n')) handle.style.top = `-${handleSize/2}px`;
      if (position.includes('s')) handle.style.bottom = `-${handleSize/2}px`;
      if (position.includes('w')) handle.style.left = `-${handleSize/2}px`;
      if (position.includes('e')) handle.style.right = `-${handleSize/2}px`;
      if (position === 'n' || position === 's') handle.style.left = `calc(50% - ${handleSize/2}px)`;
      if (position === 'w' || position === 'e') handle.style.top = `calc(50% - ${handleSize/2}px)`;
      
      // Set cursor
      const cursors = {
        'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize',
        'e': 'e-resize', 'se': 'se-resize', 's': 's-resize',
        'sw': 'sw-resize', 'w': 'w-resize'
      };
      handle.style.cursor = cursors[position];
      
      // Show magnifier on hover
      handle.addEventListener('mouseenter', (e) => {
        showMagnifier(magnifier, magnifierCanvas, e.clientX, e.clientY);
      });
      
      handle.addEventListener('mouseleave', () => {
        if (!handle.dataset.dragging) {
          magnifier.style.display = 'none';
        }
      });
      
      // Add resize functionality
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handle.dataset.dragging = 'true';
        startResize(box, position, e, magnifier, magnifierCanvas);
      });
      
      box.appendChild(handle);
    });
    
    // Add drag functionality for the whole box
    box.addEventListener('mousedown', (e) => {
      if (e.target === box) {
        e.preventDefault();
        startDrag(box, e);
      }
    });
  }
  
  function showMagnifier(magnifier, canvas, x, y) {
    magnifier.style.display = 'block';

    // Position magnifier with smart edge-flipping
    let magX = x + 20;
    let magY = y + 20;
    if (magX + 160 > window.innerWidth) magX = x - 170;
    if (magY + 160 > window.innerHeight) magY = y - 170;
    magnifier.style.left = magX + 'px';
    magnifier.style.top = magY + 'px';

    // Draw cached screenshot immediately (feels responsive)
    drawMagnifierContent(canvas, x, y, magnifierScreenshot);

    // Throttle: only request a new screenshot every 100ms
    if (magnifierThrottleTimer) return;
    magnifierThrottleTimer = setTimeout(() => {
      magnifierThrottleTimer = null;

      chrome.runtime.sendMessage({ action: 'captureForMagnifier' }, (response) => {
        if (response && response.dataUrl) {
          magnifierScreenshot = response.dataUrl;
          drawMagnifierContent(canvas, x, y, magnifierScreenshot);
        }
      });
    }, 100);
  }

  function drawMagnifierContent(canvas, x, y, screenshotDataUrl) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;  // 150
    const h = canvas.height; // 150
    const zoom = 3; // 3x magnification
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, w, h);

    if (screenshotDataUrl) {
      const img = new Image();
      img.onload = () => {
        // Region of screen to show: (150/zoom) x (150/zoom) px centered on cursor
        const regionW = w / zoom;
        const regionH = h / zoom;
        const srcX = (x * dpr) - (regionW * dpr / 2);
        const srcY = (y * dpr) - (regionH * dpr / 2);

        ctx.drawImage(
          img,
          srcX, srcY,       // source top-left in screenshot pixels
          regionW * dpr,    // source width
          regionH * dpr,    // source height
          0, 0,             // dest top-left
          w, h              // dest size (zoomed)
        );

        // Crosshair on top of image
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Coordinates strip at bottom
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, h - 22, w, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(x)}, ${Math.round(y)}`, w / 2, h - 7);
      };
      img.src = screenshotDataUrl;
    } else {
      // Fallback: grey placeholder while first screenshot loads
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.fillStyle = '#333333';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(x)}, ${Math.round(y)}`, w / 2, h / 2 + 5);
    }
  }
  
  function startResize(box, position, e, magnifier, magnifierCanvas) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = box.getBoundingClientRect();
    
    function onMouseMove(e) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newLeft = startRect.left;
      let newTop = startRect.top;
      let newWidth = startRect.width;
      let newHeight = startRect.height;
      
      if (position.includes('w')) {
        newLeft += deltaX;
        newWidth -= deltaX;
      }
      if (position.includes('e')) {
        newWidth += deltaX;
      }
      if (position.includes('n')) {
        newTop += deltaY;
        newHeight -= deltaY;
      }
      if (position.includes('s')) {
        newHeight += deltaY;
      }
      
      // Apply constraints
      if (newWidth > 10) {
        box.style.left = newLeft + 'px';
        box.style.width = newWidth + 'px';
      }
      if (newHeight > 10) {
        box.style.top = newTop + 'px';
        box.style.height = newHeight + 'px';
      }
      
      // Update magnifier position and content
      showMagnifier(magnifier, magnifierCanvas, e.clientX, e.clientY);
      
      // Update capture area
      updateCaptureArea(box);
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      magnifier.style.display = 'none';
      
      // Clear dragging flag
      const handles = box.querySelectorAll('.resize-handle');
      handles.forEach(h => delete h.dataset.dragging);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  function startDrag(box, e) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = box.getBoundingClientRect();
    
    function onMouseMove(e) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      box.style.left = (startRect.left + deltaX) + 'px';
      box.style.top = (startRect.top + deltaY) + 'px';
      
      // Update capture area
      updateCaptureArea(box);
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  function updateCaptureArea(box) {
    const rect = box.getBoundingClientRect();
    const newArea = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    
    // Update the appropriate capture area
    if (box === selectionBox) {
      captureArea = newArea;
    } else if (box === selectionBox2) {
      captureArea2 = newArea;
    }
  }

  function showConfirmation() {
    const bar = document.createElement('div');
    bar.id = 'captureConfirmBar';
    bar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: rgba(30, 30, 30, 0.92);
      color: white;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1000003;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-sizing: border-box;
      box-shadow: 0 -3px 12px rgba(0,0,0,0.4);
    `;

    let hint;
    if (twoRectangles) {
      hint = autoCaptureMode
        ? '✓ Two areas selected &nbsp;·&nbsp; Adjust the rectangles above, then start when ready &nbsp;·&nbsp; Auto-stop on duplicates'
        : `✓ Two areas selected &nbsp;·&nbsp; Adjust the rectangles above, then start when ready &nbsp;·&nbsp; ${pageCount} pages`;
    } else {
      hint = autoCaptureMode
        ? '✓ Capture area selected &nbsp;·&nbsp; Adjust the rectangle above, then start when ready &nbsp;·&nbsp; Auto-stop on duplicates'
        : `✓ Capture area selected &nbsp;·&nbsp; Adjust the rectangle above, then start when ready &nbsp;·&nbsp; ${pageCount} pages`;
    }

    bar.innerHTML = `
      <span style="opacity: 0.85;">${hint}</span>
      <span style="display: flex; align-items: center; gap: 14px; flex-shrink: 0; margin-left: 24px;">
        <label style="display: flex; align-items: center; gap: 7px; opacity: 0.85; white-space: nowrap;">
          &#x21A9; Go back
          <input id="rewindPages" type="number" min="0" value="0" style="width: 54px; padding: 5px 7px; border-radius: 4px; border: none; font-size: 14px; text-align: center; color: #111;">
          pages first
        </label>
        <button id="confirmCapture" style="padding: 8px 22px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">&#9654; Start Capture</button>
        <button id="cancelCapture" style="padding: 8px 18px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">&#x2715; Cancel</button>
      </span>
    `;

    document.body.appendChild(bar);

    document.getElementById('confirmCapture').addEventListener('click', () => {
      const rewindCount = Math.max(0, parseInt(document.getElementById('rewindPages').value) || 0);
      bar.remove();

      // Hide both selection rectangles before starting capture
      if (selectionBox && selectionBox.parentNode) {
        selectionBox.style.display = 'none';
      }
      if (selectionBox2 && selectionBox2.parentNode) {
        selectionBox2.style.display = 'none';
      }

      if (rewindCount > 0) {
        rewindThenCapture(rewindCount);
      } else {
        startCapture();
      }
    });

    document.getElementById('cancelCapture').addEventListener('click', () => {
      bar.remove();
      cleanupSelection();
    });

    // Esc also cancels from the confirmation bar
    function onEscAtConfirm(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onEscAtConfirm);
        bar.remove();
        cleanupSelection();

        const toast = document.createElement('div');
        toast.textContent = '✕ Selection cancelled';
        toast.style.cssText = `
          position: fixed;
          top: 5px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff9800;
          color: white;
          padding: 8px 20px;
          border-radius: 5px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          z-index: 1000010;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      }
    }
    document.addEventListener('keydown', onEscAtConfirm);
  }

  function cleanupSelection() {
    // Reset two-rectangle state
    isSelectingSecondRect = false;
    captureArea2 = null;

    if (overlay && overlay.parentNode) overlay.remove();
    if (selectionBox && selectionBox.parentNode) selectionBox.remove();
    if (selectionBox2 && selectionBox2.parentNode) selectionBox2.remove();
    const instruction = document.getElementById('captureInstruction');
    if (instruction && instruction.parentNode) instruction.remove();
    const confirmBar = document.getElementById('captureConfirmBar');
    if (confirmBar && confirmBar.parentNode) confirmBar.remove();

    // Remove event listeners
    document.removeEventListener('mousemove', updateSelection);
    document.removeEventListener('mouseup', endSelection);

    captureArea = null;
    isSelecting = false;
  }

  function rewindThenCapture(rewindCount) {
    // Show a rewind progress indicator
    const rewindDiv = document.createElement('div');
    rewindDiv.id = 'rewindProgress';
    rewindDiv.style.cssText = `
      position: fixed;
      top: 5px;
      right: 20px;
      background: #FF9800;
      color: white;
      padding: 8px 15px;
      border-radius: 5px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      z-index: 1000002;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(rewindDiv);

    let remaining = rewindCount;

    function rewindStep() {
      if (remaining <= 0) {
        rewindDiv.remove();
        startCapture();
        return;
      }

      rewindDiv.textContent = `↩ Rewinding... ${remaining} page${remaining !== 1 ? 's' : ''} to go`;

      // Press the OPPOSITE direction to go back
      const key = rtlMode ? 'ArrowRight' : 'ArrowLeft';
      const keyCode = rtlMode ? 39 : 37;

      const eventDown = new KeyboardEvent('keydown', {
        key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true
      });
      document.dispatchEvent(eventDown);

      const eventUp = new KeyboardEvent('keyup', {
        key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true
      });
      document.dispatchEvent(eventUp);

      remaining--;
      setTimeout(rewindStep, 300); // 300ms between each rewind key — fast but reliable
    }

    rewindStep();
  }

  async function startCapture() {
    currentPage = 0;

    // Reset file size tracking in background script
    chrome.runtime.sendMessage({ action: 'resetFileSizes' });

// Create a floating cancel button that stays visible during capture
const cancelBtn = document.createElement('button');
cancelBtn.id = 'floatingCancelBtn';
cancelBtn.textContent = '✗ Stop Capture';
cancelBtn.style.cssText = `
  position: fixed;
  top: 5px;
  background: #f44336;
  color: white;
  padding: 8px 15px;
  border: none;
  border-radius: 5px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  z-index: 1000002;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
`;

cancelBtn.addEventListener('click', () => {
  captureCancelled = true;
  cancelCapture();
});

document.body.appendChild(cancelBtn);

// Position cancel button dynamically next to progress box
function positionCancelButton() {
  const progressDiv = document.getElementById('captureProgress');
  if (progressDiv) {
    const progressRect = progressDiv.getBoundingClientRect();
    const progressRight = window.innerWidth - progressRect.left; // Distance from right edge
    cancelBtn.style.right = (progressRight + 10) + 'px'; // 10px gap
  }
}

// Initial positioning (will be called again after progress box is created)
setTimeout(positionCancelButton, 50);

    cancelBtn.addEventListener('click', () => {
      captureCancelled = true;
      cancelCapture();
    });

    document.body.appendChild(cancelBtn);

    await captureCurrentPage();
  }

  async function captureCurrentPage() {
    // Check if cancelled
    if (captureCancelled) {
      debugLog('Capture already cancelled, stopping');
      return;
    }

    // Show progress indicator
    let progressDiv = document.getElementById('captureProgress');
    if (!progressDiv) {
      progressDiv = document.createElement('div');
      progressDiv.id = 'captureProgress';
      progressDiv.style.cssText = `
        position: fixed;
        top: 5px;
        right: 20px;
        background: #2196F3;
        color: white;
        padding: 8px 15px;
        border-radius: 5px;
        font-size: 14px;
        font-family: Arial, sans-serif;
        z-index: 1000002;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(progressDiv);
    }

    if (autoCaptureMode) {
      progressDiv.textContent = `Capturing page ${currentPage + 1}... (auto-detect mode)`;
    } else {
      progressDiv.textContent = `Capturing page ${currentPage + 1} of ${pageCount}...`;
    }

    // Send message to background script to capture
    // If two rectangles, we need to capture both from the SAME screenshot
    if (twoRectangles) {
      const page1 = (currentPage * 2) + 1;
      const page2 = (currentPage * 2) + 2;
      
      // Add both to pending set
      pendingCaptures.add(page1);
      pendingCaptures.add(page2);
      
      debugLog('Starting two-rectangle capture for pages', page1, 'and', page2);
      
      // Send BOTH areas in one request - will capture screen once and crop twice
      chrome.runtime.sendMessage({
        action: 'captureTwoAreas',
        area1: captureArea,
        area2: captureArea2,
        pageNumber1: page1,
        pageNumber2: page2,
        totalPages: pageCount,
        rtlMode: rtlMode
      });
    } else {
      // Single rectangle mode (original behavior)
      const pageNum = currentPage + 1;
      pendingCaptures.add(pageNum);
      
      debugLog('Starting single-rectangle capture for page', pageNum);
      
      chrome.runtime.sendMessage({
        action: 'captureArea',
        area: captureArea,
        pageNumber: pageNum,
        totalPages: pageCount,
        twoRectMode: false
      });
    }

    currentPage++;
    
    // Note: We don't call proceedToNextPage() here anymore
    // It will be called by handleCaptureComplete() when all captures finish
  }

  function proceedToNextPage() {
    debugLog('All captures complete, proceeding to next page');
    
    if (captureCancelled) {
      debugLog('Capture stopped');
      return;
    }

    // Continue if in auto mode OR if we haven't reached page count
    const shouldContinue = autoCaptureMode || currentPage < pageCount;

    if (shouldContinue) {
      // Simulate arrow key press
      simulateArrowKey();

      // Wait for page to load, then capture next
      setTimeout(() => {
        captureCurrentPage();
      }, captureDelay); // Use the variable or default to 800ms
    } else {
      // All done - remove floating cancel button
      const cancelBtn = document.getElementById('floatingCancelBtn');
      if (cancelBtn && cancelBtn.parentNode) cancelBtn.remove();

      const progressDiv = document.getElementById('captureProgress');
      if (progressDiv) {
        progressDiv.textContent = '✓ Capture complete!';
        progressDiv.style.background = '#4CAF50';
        setTimeout(() => {
          progressDiv.remove();
          if (selectionBox && selectionBox.parentNode) selectionBox.remove();
          if (selectionBox2 && selectionBox2.parentNode) selectionBox2.remove();
        }, 2000);
      }
    }
  }

  function simulateArrowKey() {
    // Choose arrow direction based on RTL mode
    const key = rtlMode ? 'ArrowLeft' : 'ArrowRight';
    const keyCode = rtlMode ? 37 : 39;

    const event = new KeyboardEvent('keydown', {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);

    // Also trigger keyup
    const eventUp = new KeyboardEvent('keyup', {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(eventUp);
  }
}
