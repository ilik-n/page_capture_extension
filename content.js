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
      border: 3px solid #ff0000;
      background: rgba(255, 0, 0, 0.2);
      z-index: 1000000;
      display: none;
      box-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
    `;

    // Create instruction text
    const instructionText = document.createElement('div');
    instructionText.id = 'captureInstruction';
    instructionText.textContent = 'Click and drag to select capture area';
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
        selectionBox.style.border = '2px solid #00ff00'; // Green for first

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
    border: 3px solid #ff0000;
    background: rgba(255, 0, 0, 0.2);
    z-index: 1000000;
    display: none;
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
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

    // Show confirmation
    showConfirmation();
  }

  function showConfirmation() {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000001;
      font-family: Arial, sans-serif;
      text-align: center;
    `;

    let message;
    if (twoRectangles) {
      message = autoCaptureMode
        ? 'Two capture areas selected. Ready to capture pages? (Will auto-stop on duplicates)'
        : `Two capture areas selected. Ready to capture ${pageCount} pages?`;
    } else {
      message = autoCaptureMode
        ? 'Capture area selected. Ready to capture pages? (Will auto-stop on duplicates)'
        : `Capture area selected. Ready to capture ${pageCount} pages?`;
    }

    confirmDiv.innerHTML = `
      <p style="margin: 0 0 15px 0; font-size: 14px;">${message}</p>
      <button id="confirmCapture" style="padding: 10px 20px; margin-right: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Start Capture</button>
      <button id="cancelCapture" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
    `;

    document.body.appendChild(confirmDiv);

    document.getElementById('confirmCapture').addEventListener('click', () => {
      confirmDiv.remove();

      // Hide both selection rectangles before starting capture
      if (selectionBox && selectionBox.parentNode) {
        selectionBox.style.display = 'none';
      }
      if (selectionBox2 && selectionBox2.parentNode) {
        selectionBox2.style.display = 'none';
      }

      startCapture();
    });

    document.getElementById('cancelCapture').addEventListener('click', () => {
      confirmDiv.remove();
      cleanupSelection();
    });
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

    // Remove event listeners
    document.removeEventListener('mousemove', updateSelection);
    document.removeEventListener('mouseup', endSelection);

    captureArea = null;
    isSelecting = false;
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
