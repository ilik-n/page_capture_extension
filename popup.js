// popup.js - Handles the popup interface logic

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startButton');
  const cancelButton = document.getElementById('cancelButton');
  const pageCountInput = document.getElementById('pageCount');
  const autoModeCheckbox = document.getElementById('autoMode');
  const statusDiv = document.getElementById('status');
  const customDelayCheckbox = document.getElementById('customDelayMode');
const delaySelect = document.getElementById('captureDelay');

  // Handle auto-mode checkbox toggle
  autoModeCheckbox.addEventListener('change', function() {
    if (this.checked) {
      pageCountInput.disabled = true;
      pageCountInput.value = '';
      pageCountInput.placeholder = 'Auto-detect (unlimited)';
    } else {
      pageCountInput.disabled = false;
      pageCountInput.value = '10';
      pageCountInput.placeholder = 'Enter number of pages';
    }
  });

  startButton.addEventListener('click', async function() {
    const autoMode = autoModeCheckbox.checked;
    const pageCountValue = pageCountInput.value;
    const pageCount = autoMode ? 999999 : parseInt(pageCountValue); // Use high number for auto mode
    const rtlMode = document.getElementById('rtlMode').checked;
    
    // Validate input
    if (!autoMode && (!pageCountValue || pageCount < 1)) {
      showStatus('Please enter a valid number of pages or enable auto-mode', 'error');
      return;
    }

    if (autoMode) {
      showStatus('Preparing auto-capture (will stop on duplicates)...', 'info');
    } else {
      showStatus('Preparing to capture...', 'info');
    }

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Inject the content script that will handle rectangle selection
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Send message to content script to start rectangle selection
      chrome.tabs.sendMessage(tab.id, {
        action: 'startSelection',
        pageCount: pageCount,
        rtlMode: rtlMode,
        autoCaptureMode: autoMode,
        twoRectangles: document.getElementById('twoRectangles').checked,
        debugMode: document.getElementById('debugMode').checked,
        captureDelay: customDelayCheckbox.checked ? parseInt(delaySelect.value) : 300
      });

      showStatus('Draw a rectangle on the page...', 'info');
      
      // Show cancel button, hide start button
      startButton.style.display = 'none';
      cancelButton.style.display = 'block';
      
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
      console.error(error);
    }
  });

  cancelButton.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send cancel message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'cancelCapture'
      });
      
      showStatus('Capture cancelled', 'info');
      cancelButton.style.display = 'none';
      startButton.style.display = 'block';
      
    } catch (error) {
      console.error('Cancel error:', error);
    }
  });

  // Handle custom delay checkbox toggle
  customDelayCheckbox.addEventListener('change', function() {
    delaySelect.disabled = !this.checked;
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type === 'info' ? 'status-info' : 
                          type === 'success' ? 'status-success' : 'status-error';
    statusDiv.style.display = 'block';
  }
});
