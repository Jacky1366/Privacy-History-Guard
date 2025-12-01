// Input fields
const keywordInput = document.getElementById('keyword');
const clearKeywordBtn = document.getElementById('clearKeyword');

// Buttons
const cleanHistoryBtn = document.getElementById('cleanHistory');
const previewBtn = document.getElementById('previewResults');
const themeToggleBtn = document.getElementById('themeToggle');

// Display areas
const statusDiv = document.getElementById('status');
const keywordListDiv = document.getElementById('keywordList');

// Modal elements
const previewModal = document.getElementById('previewModal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModal');

// Auto-delete elements
const autoDeleteToggleBtn = document.getElementById('autoDeleteToggle');
const autoDeleteStatusDiv = document.getElementById('autoDeleteStatus');
const autoDeleteProgressDiv = document.getElementById('autoDeleteProgress');


document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup opened - initializing...');

    // Load saved keywords from backend
    loadKeywords();

    // Load theme preference
    loadTheme();
});


function loadKeywords() {
    console.log('Loading keywords from backend...');

    // Send message to background.js
    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'getKeywords' },
        (response) => {
            if (response.success) {
                console.log('Keywords loaded:', response.keywords);
                displayKeywords(response.keywords);
            } else {
                console.error('Failed to load keywords:', response.error);
                showStatus('Failed to load keywords', 'error');
            }
        }
    );
}

/**
 * Display the keyword list with remove buttons
 * @param {string[]} keywords - Array of keywords to display
 */
function displayKeywords(keywords) {
    // Clear the display area
    keywordListDiv.innerHTML = '';

    // If no keywords, show helpful message
    if (keywords.length === 0) {
        keywordListDiv.innerHTML = '<p class="help-text">No keywords added yet. Add keywords above to get started!</p>';
        return;
    }

    // Create a title
    const title = document.createElement('p');
    title.style.fontWeight = '500';
    title.style.marginBottom = '10px';
    title.textContent = 'Active Keywords:';
    keywordListDiv.appendChild(title);

    // Create a tag for each keyword
    keywords.forEach(keyword => {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.innerHTML = `${keyword} <span style="cursor: pointer; margin-left: 5px; font-weight: bold;" data-keyword="${keyword}">×</span>`;
        keywordListDiv.appendChild(tag);

        // Add click listener to the X button
        const removeBtn = tag.querySelector('[data-keyword]');
        removeBtn.addEventListener('click', () => removeKeyword(keyword));
    });
}

/**
 * Add keywords from the input field
 */
function addKeywords() {
    const input = keywordInput.value.trim();

    // Check if input is empty
    if (!input) {
        showStatus('Please enter at least one keyword', 'error');
        return;
    }

    // Split by comma and clean up each keyword
    const keywords = input
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

    if (keywords.length === 0) {
        showStatus('Please enter valid keywords', 'error');
        return;
    }

    console.log('Adding keywords:', keywords);

    // Add each keyword to backend
    let addedCount = 0;
    let totalToAdd = keywords.length;

    keywords.forEach(keyword => {
        // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
        chrome.runtime.sendMessage(
            {
                action: 'addKeyword',
                keyword: keyword
            },
            (response) => {
                addedCount++;

                if (response.success) {
                    console.log(`Added keyword: ${keyword}`);
                } else {
                    console.error(`Failed to add ${keyword}:`, response.error);
                }

                // When all keywords are processed, refresh the display
                if (addedCount === totalToAdd) {
                    keywordInput.value = ''; // Clear input
                    loadKeywords(); // Reload the list
                    showStatus(`Added ${keywords.length} keyword(s)!`, 'success');
                }
            }
        );
    });
}

//=============================================================================
// SECTION 6: REMOVE KEYWORD
//=============================================================================
/**
 * Remove a keyword from the list
 * @param {string} keyword - The keyword to remove
 */
function removeKeyword(keyword) {
    console.log('Removing keyword:', keyword);

    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        {
            action: 'removeKeyword',
            keyword: keyword
        },
        (response) => {
            if (response.success) {
                console.log(`Removed keyword: ${keyword}`);
                loadKeywords(); // Refresh the list
                showStatus(`Removed "${keyword}"`, 'success');
            } else {
                console.error('Failed to remove keyword:', response.error);
                showStatus('Failed to remove keyword', 'error');
            }
        }
    );
}

/**
 * Clean history using all saved keywords
 */
function cleanHistory() {
    console.log('Starting history cleanup...');

    // Show loading state
    showStatus('Cleaning history...', 'info');
    cleanHistoryBtn.disabled = true;
    cleanHistoryBtn.textContent = 'Cleaning...';

    // Send cleanHistory message to backend
    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'cleanHistory' },
        (response) => {
            // Re-enable button
            cleanHistoryBtn.disabled = false;
            cleanHistoryBtn.textContent = 'Clean History';

            if (response.success) {
                console.log('Cleanup complete:', response);
                const count = response.deletedCount || 0;

                if (count === 0) {
                    showStatus('No matching history entries found', 'info');
                } else {
                    showStatus(`✓ Deleted ${count} history ${count === 1 ? 'entry' : 'entries'}!`, 'success');
                }
            } else {
                console.error('Cleanup failed:', response.error);
                showStatus(`Error: ${response.error}`, 'error');
            }
        }
    );
}

/**
 * Preview what would be deleted (without actually deleting)
 */
function previewResults() {
    console.log('Previewing results...');

    // Show loading in modal
    modalBody.innerHTML = '<p>Loading preview...</p>';
    previewModal.classList.add('active');

    // Get keywords first
    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'getKeywords' },
        (response) => {
            if (!response.success || response.keywords.length === 0) {
                modalBody.innerHTML = '<p class="help-text">No keywords configured. Add keywords first!</p>';
                return;
            }

            // Now search for matching history entries
            // We'll search for each keyword and combine results
            const keywords = response.keywords;
            let allResults = [];
            let searchesCompleted = 0;

            keywords.forEach(keyword => {
                // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
                chrome.runtime.sendMessage(
                    {
                        action: 'searchHistory',
                        text: keyword,
                        maxResults: 1000 // Show up to 1000 results per keyword in preview
                    },
                    (searchResponse) => {
                        searchesCompleted++;

                        if (searchResponse.success && searchResponse.results) {
                            allResults = allResults.concat(searchResponse.results);
                        }

                        // When all searches complete, display results
                        if (searchesCompleted === keywords.length) {
                            displayPreviewResults(allResults, keywords);
                        }
                    }
                );
            });
        }
    );
}

/**
 * Display preview results in the modal
 * @param {Array} results - History entries that would be deleted
 * @param {Array} keywords - Keywords being searched
 */
function displayPreviewResults(results, keywords) {
    if (results.length === 0) {
        modalBody.innerHTML = `
      <p class="help-text">
        No matching history entries found for:<br>
        <strong>${keywords.join(', ')}</strong>
      </p>
    `;
        return;
    }

    // Remove duplicates (same URL might match multiple keywords)
    const uniqueResults = Array.from(new Set(results.map(r => r.url)))
        .map(url => results.find(r => r.url === url));

    let html = `
    <p style="margin-bottom: 15px;">
      Found <strong>${uniqueResults.length}</strong> entries that would be deleted:
    </p>
  `;

    uniqueResults.forEach(item => {
        const title = item.title || 'Untitled';
        const url = item.url;
        const visitCount = item.visitCount || 0;

        html += `
      <div class="preview-item" style="padding: 10px; margin: 5px 0; border-radius: 8px; background: rgba(255,107,107,0.1);">
        <div style="font-weight: 500; margin-bottom: 3px;">${escapeHtml(title)}</div>
        <div style="font-size: 12px; opacity: 0.8; word-break: break-all;">${escapeHtml(url)}</div>
        <div style="font-size: 11px; opacity: 0.6; margin-top: 3px;">Visited ${visitCount} time(s)</div>
      </div>
    `;
    });

    modalBody.innerHTML = html;
}

/**
 * Show a status message to the user
 * @param {string} message - The message to show
 * @param {string} type - 'success', 'error', or 'info'
 */
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    // Clear status after 5 seconds
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
    }, 5000);
}

/**
 * Toggle between dark and light mode
 */
function toggleTheme() {
    const body = document.body;

    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeToggleBtn.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        themeToggleBtn.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }
}

/**
 * Load saved theme preference
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;

    if (savedTheme === 'light') {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeToggleBtn.textContent = '☀️';
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        themeToggleBtn.textContent = '🌙';
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Close the preview modal
 */
function closeModal() {
    previewModal.classList.remove('active');
}

// Connect all buttons to their functions

// Clean History button
cleanHistoryBtn.addEventListener('click', cleanHistory);

// Preview button
previewBtn.addEventListener('click', previewResults);

// Theme toggle button
themeToggleBtn.addEventListener('click', toggleTheme);

// Clear input button
clearKeywordBtn.addEventListener('click', () => {
    keywordInput.value = '';
    keywordInput.focus();
});

// Close modal button
closeModalBtn.addEventListener('click', closeModal);

// Close modal when clicking outside
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        closeModal();
    }
});

// Add keywords when pressing Enter in the input field
keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addKeywords();
    }
});

// Also add keywords when input loses focus (user clicks away)
keywordInput.addEventListener('blur', () => {
    if (keywordInput.value.trim()) {
        addKeywords();
    }
});

/**
 * Toggle auto-delete on/off
 */
function toggleAutoDelete() {
    console.log('Toggling auto-delete...');

    // First check current status
    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'getAutoDeleteStatus' },
        (response) => {
            if (response.success) {
                if (response.isRunning) {
                    // Currently running, so stop it
                    stopAutoDelete();
                } else {
                    // Not running, so start it
                    startAutoDelete();
                }
            }
        }
    );
}

/**
 * Start auto-deletion
 */
function startAutoDelete() {
    console.log('Starting auto-delete...');

    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'startAutoDelete' },
        (response) => {
            if (response.success) {
                console.log('Auto-delete started!');
                updateAutoDeleteUI(true, response.progress);
                showStatus('Auto-delete started! Running in background...', 'success');

                // Start polling for status updates
                startStatusPolling();
            } else {
                console.error('Failed to start auto-delete:', response.message);
                showStatus(`Error: ${response.message}`, 'error');
            }
        }
    );
}

/**
 * Stop auto-deletion
 */
function stopAutoDelete() {
    console.log('Stopping auto-delete...');

    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'stopAutoDelete' },
        (response) => {
            if (response.success) {
                console.log('Auto-delete stopped!');
                updateAutoDeleteUI(false, response.progress);
                showStatus(`Auto-delete stopped. Deleted ${response.progress.totalDeleted} entries.`, 'info');

                // Stop polling
                stopStatusPolling();
            } else {
                console.error('Failed to stop auto-delete:', response.message);
                showStatus(`Error: ${response.message}`, 'error');
            }
        }
    );
}

/**
 * Update the auto-delete UI based on status
 */
function updateAutoDeleteUI(isRunning, progress) {
    if (isRunning) {
        // Update button
        autoDeleteToggleBtn.textContent = 'Stop';
        autoDeleteToggleBtn.style.background = '#ff6b6b';
        autoDeleteToggleBtn.style.color = 'white';

        // Show progress
        autoDeleteProgressDiv.style.display = 'block';
        autoDeleteProgressDiv.innerHTML = `
            Running... | Deleted: <strong>${progress.totalDeleted}</strong> entries | 
            Batch #${progress.currentBatch} (${progress.lastBatchSize} in last batch)
        `;

        // Update status text
        autoDeleteStatusDiv.textContent = 'Active - Processing in background';
    } else {
        // Update button
        autoDeleteToggleBtn.textContent = 'Start';
        autoDeleteToggleBtn.style.background = '';
        autoDeleteToggleBtn.style.color = '';

        // Show final stats if any
        if (progress && progress.totalDeleted > 0) {
            autoDeleteProgressDiv.style.display = 'block';
            if (progress.isComplete) {
                autoDeleteProgressDiv.innerHTML = `
                    Complete! Deleted <strong>${progress.totalDeleted}</strong> entries total
                `;
            } else {
                autoDeleteProgressDiv.innerHTML = `
                    Paused - Deleted <strong>${progress.totalDeleted}</strong> entries so far
                `;
            }
        } else {
            autoDeleteProgressDiv.style.display = 'none';
        }

        // Update status text
        autoDeleteStatusDiv.textContent = 'Deletes 250 entries every 10 seconds in the background';
    }
}

/**
 * Poll for auto-delete status updates
 */
let statusPollingInterval = null;

function startStatusPolling() {
    // Clear any existing interval
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
    }

    // Poll every 2 seconds
    statusPollingInterval = setInterval(() => {
        // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
        chrome.runtime.sendMessage(
            { action: 'getAutoDeleteStatus' },
            (response) => {
                if (response.success) {
                    updateAutoDeleteUI(response.isRunning, response.progress);

                    // If auto-delete completed, stop polling
                    if (!response.isRunning) {
                        stopStatusPolling();
                    }
                }
            }
        );
    }, 2000); // 2 seconds
}

function stopStatusPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

/**
 * Check auto-delete status on popup load
 */
function checkAutoDeleteStatus() {
    // https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
    chrome.runtime.sendMessage(
        { action: 'getAutoDeleteStatus' },
        (response) => {
            if (response.success) {
                updateAutoDeleteUI(response.isRunning, response.progress);

                // If running, start polling
                if (response.isRunning) {
                    startStatusPolling();
                }
            }
        }
    );
}

// Auto-delete toggle button
autoDeleteToggleBtn.addEventListener('click', toggleAutoDelete);

// Check status when popup loads
document.addEventListener('DOMContentLoaded', () => {
    checkAutoDeleteStatus();
});

console.log('Popup.js loaded successfully!');