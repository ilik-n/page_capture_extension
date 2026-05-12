// popup.js - Handles the popup interface logic

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startButton');
  const cancelButton = document.getElementById('cancelButton');
  const pageCountInput = document.getElementById('pageCount');
  const autoModeCheckbox = document.getElementById('autoMode');
  const statusDiv = document.getElementById('status');
  const customDelayCheckbox = document.getElementById('customDelayMode');
  const delaySelect = document.getElementById('captureDelay');
  const rtlGroup = document.getElementById('rtlGroup');
  const mouseClickGroup = document.getElementById('mouseClickGroup');
  const pickOnPageBtn = document.getElementById('pickOnPageBtn');

  // Toggle between arrow-key and mouse-click navigation UI
  document.querySelectorAll('input[name="navMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const isClick = this.value === 'click';
      rtlGroup.style.display = isClick ? 'none' : '';
      mouseClickGroup.style.display = isClick ? '' : 'none';
      startButton.style.display = isClick ? 'none' : '';
    });
  });

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

  function collectSettings() {
    const autoMode = autoModeCheckbox.checked;
    const pageCountValue = pageCountInput.value;
    return {
      autoMode,
      pageCount: autoMode ? 999999 : parseInt(pageCountValue),
      pageCountValue,
      rtlMode: document.getElementById('rtlMode').checked,
      twoRectangles: document.getElementById('twoRectangles').checked,
      debugMode: document.getElementById('debugMode').checked,
      captureDelay: customDelayCheckbox.checked ? parseInt(delaySelect.value) : 300
    };
  }

  startButton.addEventListener('click', async function() {
    const s = collectSettings();
    if (!s.autoMode && (!s.pageCountValue || s.pageCount < 1)) {
      showStatus('Please enter a valid number of pages or enable auto-mode', 'error');
      return;
    }
    showStatus(s.autoMode ? 'Preparing auto-capture (will stop on duplicates)...' : 'Preparing to capture...', 'info');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

      chrome.tabs.sendMessage(tab.id, {
        action: 'startSelection',
        pageCount: s.pageCount,
        rtlMode: s.rtlMode,
        autoCaptureMode: s.autoMode,
        twoRectangles: s.twoRectangles,
        debugMode: s.debugMode,
        captureDelay: s.captureDelay,
        mouseClickMode: false
      });

      showStatus('Draw a rectangle on the page...', 'info');
      startButton.style.display = 'none';
      cancelButton.style.display = 'block';
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
      console.error(error);
    }
  });

  pickOnPageBtn.addEventListener('click', async function() {
    const s = collectSettings();
    if (!s.autoMode && (!s.pageCountValue || s.pageCount < 1)) {
      showStatus('Please enter a valid number of pages or enable auto-mode', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

      chrome.tabs.sendMessage(tab.id, {
        action: 'startClickPick',
        pageCount: s.pageCount,
        autoCaptureMode: s.autoMode,
        twoRectangles: s.twoRectangles,
        debugMode: s.debugMode,
        captureDelay: s.captureDelay
      });

      window.close();
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
