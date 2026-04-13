// background.js - Handles screenshot capture and file saving with duplicate detection

// Store file sizes to detect duplicates
let fileSizes = [];
let lastTwoSizes = [];
let lastTwoSizesRect2 = []; // Track second rectangle separately for duplicate detection

// Track download completion
let downloadCallbacks = new Map(); // downloadId -> {tabId, pageNumber}

// Debug mode flag
let debugMode = false;

// Helper function for debug logging
function debugLog(...args) {
  if (debugMode) {
    console.log(...args);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureArea') {
    captureScreenshot(message.area, message.pageNumber, message.totalPages, sender.tab.id);
  } else if (message.action === 'captureTwoAreas') {
    captureTwoAreas(message.area1, message.area2, message.pageNumber1, message.pageNumber2, sender.tab.id);
  } else if (message.action === 'downloadImage') {
    downloadImage(message.dataUrl, message.pageNumber, sender.tab.id);
  } else if (message.action === 'resetFileSizes') {
    // Reset file size tracking when starting a new capture session
    fileSizes = [];
    lastTwoSizes = [];
    lastTwoSizesRect2 = [];
    downloadCallbacks.clear();
    debugLog('File size tracking reset');
  } else if (message.action === 'setDebugMode') {
    debugMode = message.enabled;
    debugLog('Debug mode:', debugMode ? 'enabled' : 'disabled');
  } else if (message.action === 'captureForMagnifier') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true; // Keep message channel open for async response
  }
});

// Listen for download completion
chrome.downloads.onChanged.addListener((downloadDelta) => {
  // Check if download completed
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    const downloadId = downloadDelta.id;
    
    // Check if we're tracking this download
    if (downloadCallbacks.has(downloadId)) {
      const { tabId, pageNumber } = downloadCallbacks.get(downloadId);
      
      console.log('✓ Download actually completed:', downloadId, 'Page:', pageNumber);
      
      // Send completion message to content script
      chrome.tabs.sendMessage(tabId, {
        action: 'captureComplete',
        pageNumber: pageNumber
      });
      
      // Clean up
      downloadCallbacks.delete(downloadId);
    }
  }
});

async function captureScreenshot(area, pageNumber, totalPages, tabId, retryCount = 0) {
  try {
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });

    console.log('Screenshot captured, sending to content script for cropping');

    // Send the captured image back to content script for cropping
    chrome.tabs.sendMessage(tabId, {
      action: 'cropImage',
      dataUrl: dataUrl,
      area: area,
      pageNumber: pageNumber
    });

  } catch (error) {
    console.error('Capture error:', error);
    
    // Retry if tab is busy (user dragging, etc.)
    if (error.message.includes('cannot be edited') && retryCount < 3) {
      console.log(`Retrying capture (attempt ${retryCount + 1}/3)...`);
      setTimeout(() => {
        captureScreenshot(area, pageNumber, totalPages, tabId, retryCount + 1);
      }, 200); // Wait 200ms and retry
    }
  }
}

async function captureTwoAreas(area1, area2, pageNumber1, pageNumber2, tabId, retryCount = 0) {
  try {
    // Capture the visible tab ONCE
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });

    debugLog('Screenshot captured ONCE for two areas');
    debugLog('Area 1:', area1, 'for page', pageNumber1);
    debugLog('Area 2:', area2, 'for page', pageNumber2);

    // Send the SAME screenshot to be cropped twice for both areas
    chrome.tabs.sendMessage(tabId, {
      action: 'cropImage',
      dataUrl: dataUrl,
      area: area1,
      pageNumber: pageNumber1
    });

    // Small delay then send for second crop
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: 'cropImage',
        dataUrl: dataUrl,
        area: area2,
        pageNumber: pageNumber2
      });
    }, 50); // Tiny delay to avoid message collision

  } catch (error) {
    console.error('Capture error:', error);
    
    // Retry if tab is busy
    if (error.message.includes('cannot be edited') && retryCount < 3) {
      console.log(`Retrying two-area capture (attempt ${retryCount + 1}/3)...`);
      setTimeout(() => {
        captureTwoAreas(area1, area2, pageNumber1, pageNumber2, tabId, retryCount + 1);
      }, 200);
    }
  }
}

function downloadImage(dataUrl, pageNumber, tabId) {
  // Generate filename with leading zeros for proper sorting
  const filename = `page_${String(pageNumber).padStart(4, '0')}.png`;

  // Calculate file size from base64 data URL
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const fileSize = binaryString.length;

  debugLog('Downloading:', filename, 'Size:', fileSize, 'bytes');

  // Store the file size
  fileSizes.push(fileSize);

  // Determine which tracking array to use based on page number
  // Odd page numbers = first rectangle, Even = second rectangle (in two-rect mode)
  const isFirstRect = (pageNumber % 2 === 1);
  const trackingArray = isFirstRect ? lastTwoSizes : lastTwoSizesRect2;

  trackingArray.push(fileSize);

  // Keep only last two sizes for comparison
  if (trackingArray.length > 2) {
    trackingArray.shift();
  }

  debugLog(`Last two file sizes (rect ${isFirstRect ? '1' : '2'}):`, trackingArray);

  // Check for duplicate (same size with small tolerance of ±100 bytes)
  // For two-rectangle mode: BOTH rectangles must be duplicates
  let isDuplicate = false;

  if (lastTwoSizes.length === 2 && lastTwoSizesRect2.length === 2) {
    // Two-rectangle mode: check both
    const sizeDiff1 = Math.abs(lastTwoSizes[0] - lastTwoSizes[1]);
    const sizeDiff2 = Math.abs(lastTwoSizesRect2[0] - lastTwoSizesRect2[1]);
    const tolerance = 100; // bytes

    if (sizeDiff1 <= tolerance && sizeDiff2 <= tolerance) {
      isDuplicate = true;
      console.log('⚠️ DUPLICATE DETECTED in BOTH rectangles!');
      console.log(`  Rect 1 difference: ${sizeDiff1} bytes`);
      console.log(`  Rect 2 difference: ${sizeDiff2} bytes`);
    }
  } else if (lastTwoSizes.length === 2 && lastTwoSizesRect2.length < 2) {
    // Single-rectangle mode: check only first rectangle
    const sizeDiff = Math.abs(lastTwoSizes[0] - lastTwoSizes[1]);
    const tolerance = 100; // bytes

    if (sizeDiff <= tolerance) {
      isDuplicate = true;
      console.log('⚠️ DUPLICATE DETECTED! Size difference:', sizeDiff, 'bytes');
    }
  }

  // Download the file
  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false  // Auto-save to Downloads folder
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download error:', chrome.runtime.lastError);
      
      // Even on error, send completion to avoid hanging
      chrome.tabs.sendMessage(tabId, {
        action: 'captureComplete',
        pageNumber: pageNumber
      });
    } else {
      debugLog('Download initiated with ID:', downloadId, 'Filename:', filename);
      
      // If duplicate detected, notify content script to stop
      if (isDuplicate) {
        chrome.tabs.sendMessage(tabId, {
          action: 'duplicateDetected',
          pageNumber: pageNumber,
          fileSize: fileSize
        });
      }
      
      // Store callback info for when download actually completes
      downloadCallbacks.set(downloadId, {
        tabId: tabId,
        pageNumber: pageNumber
      });
    }
  });
}
