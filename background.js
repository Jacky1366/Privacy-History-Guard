//background.js is a large file that contains all the logic for the extension

console.log("🚀 Extension loaded!");


class HistoryManager { // HistoryManager is a class that handles all the history related operations, and is responsible for talking to the Chrome history API
    /*
    ✅ Talking to Chrome's history API
    ✅ Deleting URLs
    ✅ Searching history
    ✅ Nothing else!
    */
    constructor() {
        console.log("✅ HistoryManager created");
        this.historyAPI = chrome.history; // access to Chrome's built-in API to access browser history and store in historyAPI object
    }

    async deleteUrl(url) {
        try {
            await chrome.history.deleteUrl({ url: url }); // call chromw Chrome's API to delete a URL, Chrom API needs a object
            console.log(`✅ Deleted: ${url}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error deleting ${url}:`, error);
            return { success: false, error: error.message };
        }
    }

    async searchHistory(text, maxResults = 100) {//Searches your browser history for URLs that contain specific text
        try {
            // Search Chrome's history
            const results = await this.historyAPI.search({
                text: text,
                maxResults: maxResults
            });

            console.log(`🔍 Found ${results.length} results for: "${text}"`);
            return { success: true, results: results };

        } catch (error) {
            console.error(`❌ Error searching for "${text}":`, error);
            return { success: false, error: error.message, results: [] };
        }
    }

    async deleteRange(startTime, endTime) {//Deletes all browser history within a specific time range
        try {
            // Delete all history items in the time range
            await this.historyAPI.deleteRange({
                startTime: startTime,
                endTime: endTime
            });

            console.log(`🗑️ Deleted history from ${new Date(startTime)} to ${new Date(endTime)}`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error deleting range:`, error);
            return { success: false, error: error.message };
        }
    }
}

class URLMatcher { // URLMatcher is a class that handles all the URL matching operations and tells the HistoryManager to delete it
    /*
    ✅ Storing the list of keywords
    ✅ Checking if a URL contains any keyword
    ✅ Pattern matching logic
    ✅ Nothing else!
    */
    constructor() {
        console.log("✅ URLMatcher created");
        /**
         * Array of blacklisted keyword patterns
         * @type {string[]}
         */
        this.patterns = [];
    }

    /**
     * @param {string} pattern 
     * @returns {Object} { success: boolean, pattern: string }
     */
    addPattern(pattern) {// Add a keyword to the blacklist
        // Convert to lowercase for case-insensitive matching
        const normalizedPattern = pattern.toLowerCase().trim();

        // Check if pattern already exists in the list
        if (!this.patterns.includes(normalizedPattern)) {
            this.patterns.push(normalizedPattern);
            console.log(`➕ Added pattern: "${normalizedPattern}"`);
            return { success: true, pattern: normalizedPattern };
        } else {
            console.log(`⚠️ Pattern already exists: "${normalizedPattern}"`);
            return { success: false, message: "Pattern already exists" };
        }
    }

    matches(url, title = "") {//Checks if a URL or page title contains any blacklisted keyword
        // Normalize URL and title for comparison
        const normalizedUrl = url.toLowerCase();
        const normalizedTitle = title.toLowerCase();

        // Find all patterns that match
        const matchedPatterns = this.patterns.filter(i => {
            return normalizedUrl.includes(i) || normalizedTitle.includes(i);
        });

        // Return result
        if (matchedPatterns.length > 0) {
            console.log(`✅ Match found! URL contains: ${matchedPatterns.join(", ")}`);
            return { matches: true, matchedPatterns: matchedPatterns };
        } else {
            console.log(`❌ No match for: ${url}`);
            return { matches: false, matchedPatterns: [] };
        }

    }


    removePattern(pattern) {// Remove a keyword from the blacklist
        const normalizedPattern = pattern.toLowerCase().trim();
        const index = this.patterns.indexOf(normalizedPattern);

        if (index !== -1) {
            this.patterns.splice(index, 1); //splice removes the item from the array, splice(index, number of items)
            console.log(`➖ Removed pattern: "${normalizedPattern}"`);
            return { success: true, pattern: normalizedPattern };
        } else {
            console.log(`⚠️ Pattern not found: "${normalizedPattern}"`);
            return { success: false, message: "Pattern not found" };
        }
    }

    getAllPatterns() {
        return [...this.patterns];  // Returns a NEW array (copy)
    }



}

class StorageManager { // StorageManager is a class that handles all the storage related operations
    /*
     ✅ Saving user's keywords to Chrome's storage
     ✅ Loading keywords when extension starts
     ✅ Saving statistics (how many URLs deleted)
    */
    constructor() {
        console.log("✅ StorageManager created");
        this.storage = chrome.storage.local; // Access to Chrome storage API, the built in database

        // Storage keys (like variable names in the database)
        this.BLACKLIST_KEY = "blacklist_patterns";
        this.STATS_KEY = "statistics";
        console.log("✅ StorageManager initialized");
    }

    /**
   * Save blacklist keywords to Chrome storage
   * @param {string[]} keywords - Array of keywords to save
   * @returns {Promise<{success: boolean, keywords?: string[], error?: string}>}
   */
    saveBlacklist(keywords) {
        return new Promise((resolve, reject) => {
            // Validate input: check if keywords is an array
            if (!Array.isArray(keywords)) {
                reject({
                    success: false,
                    error: 'Keywords must be an array'
                });
                return;
            }

            // Create the data object to save
            const dataToSave = {
                [this.BLACKLIST_KEY]: keywords  // Uses the key "blacklist"
            };

            // Save to Chrome storage
            this.storage.set(dataToSave, () => {
                // Check for errors
                if (chrome.runtime.lastError) {
                    console.error('❌ Failed to save blacklist:', chrome.runtime.lastError);
                    reject({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    console.log('✅ Blacklist saved:', keywords);
                    resolve({
                        success: true,
                        keywords: keywords
                    });
                }
            });
        });
    }


    /**
   * Load blacklist keywords from Chrome storage
   * @returns {Promise<{success: boolean, keywords?: string[], error?: string}>}
   */
    loadBlacklist() {
        return new Promise((resolve, reject) => {
            // Ask Chrome to get the data
            this.storage.get([this.BLACKLIST_KEY], (result) => {
                // Check for errors
                if (chrome.runtime.lastError) {
                    console.error('❌ Failed to load blacklist:', chrome.runtime.lastError);
                    reject({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                    return;
                }

                // Get the keywords (default to empty array if nothing saved yet)
                const keywords = result[this.BLACKLIST_KEY] || [];

                console.log('✅ Blacklist loaded:', keywords);
                resolve({
                    success: true,
                    keywords: keywords
                });
            });
        });
    }



    /**
   * Get statistics from Chrome storage
   * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
   */
    getStatistics() {
        return new Promise((resolve, reject) => {
            this.storage.get([this.STATS_KEY], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Failed to load statistics:', chrome.runtime.lastError);
                    reject({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                    return;
                }

                // Default statistics if nothing saved yet
                const stats = result[this.STATS_KEY] || {
                    deletedCount: 0,
                    lastDeleted: null
                };

                console.log('✅ Statistics loaded:', stats);
                resolve({
                    success: true,
                    stats: stats
                });
            });
        });
    }



    /**
   * Update statistics in Chrome storage
   * @param {number} count - Number of URLs deleted
   * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
   */
    updateStatistics(count) {
        return new Promise((resolve, reject) => {
            // First, load current statistics
            this.getStatistics()
                .then((result) => {
                    const currentStats = result.stats;

                    // Update the count
                    const updatedStats = {
                        deletedCount: currentStats.deletedCount + count,
                        lastDeleted: new Date().toISOString()
                    };

                    // Save the updated statistics
                    const dataToSave = {
                        [this.STATS_KEY]: updatedStats
                    };

                    this.storage.set(dataToSave, () => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Failed to update statistics:', chrome.runtime.lastError);
                            reject({
                                success: false,
                                error: chrome.runtime.lastError.message
                            });
                        } else {
                            console.log('✅ Statistics updated:', updatedStats);
                            resolve({
                                success: true,
                                stats: updatedStats
                            });
                        }
                    });
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

}

// Create one instance of each class - these will be used throughout the extension
const historyManager = new HistoryManager();
const urlMatcher = new URLMatcher();
const storageManager = new StorageManager();

console.log("🎉 All classes initialized successfully!"); // log that all classes are initialized successfully




//load saved keywords into memory
async function initializeExtension() {
    console.log('🚀 Extension starting up...');

    // Step 1: Load saved keywords from storage
    const result = await storageManager.loadBlacklist();

    // Step 2: Check if we got keywords successfully]
    if (result.success && result.keywords) {
        console.log('📥 Found saved keywords:', result.keywords); // eg. keywords=["youtube", "facebook", "reddit"]

        // Step 3: Add each keyword to URLMatcher's memory
        for (const keyword of result.keywords) {
            urlMatcher.addPattern(keyword);
            // eg. urlMatcher.addPattern("youtube");
            // eg. urlMatcher.addPattern("facebook");
            // now URLMatcher now has: ["youtube", "facebook"]
        }
        console.log('✅ Extension ready! Watching for:', urlMatcher.getAllPatterns());
    } else {
        console.log('ℹ️ No saved keywords found. Extension ready (empty blacklist).');
    }
}


//this is the "brain" that coordinates all three classes
async function cleanHistory() {
    console.log('🧹 Starting history cleanup...');

    // Step 1: Get all keywords from URLMatcher
    const keywords = urlMatcher.getAllPatterns();

    if (keywords.length === 0) {
        console.log('ℹ️ No keywords configured. Nothing to clean.');
        return { success: true, deletedCount: 0, message: 'No keywords configured' };
    }

    console.log('🔍 Searching for keywords:', keywords); // eg. Searching for keywords: ['youtube', 'facebook', 'reddit']
    // Step 2: Search and delete for each keyword
    let deletedCount = 0;

    for (const keyword of keywords) {
        console.log(`\n🔎 Searching history for: "${keyword}"`);

        // Search browser history
        const searchResult = await historyManager.searchHistory(keyword);
        //searchResult.results = [
        // { url: 'youtube.com/watch?v=123', title: 'Cat Video' },
        // { url: 'youtube.com/watch?v=456', title: 'Dog Video' },
        // { url: 'youtube.com/watch?v=789', title: 'Bird Video' }]


        if (searchResult.success && searchResult.results.length > 0) {
            console.log(`   Found ${searchResult.results.length} history entries`);

            // Check and delete each matching URL
            for (const item of searchResult.results) {// item = { url: 'youtube.com/watch?v=123', title: 'Cat Video' }
                const matchResult = urlMatcher.matches(item.url, item.title);

                if (matchResult.matches) {
                    console.log(`   ❌ Deleting: ${item.url}`);
                    await historyManager.deleteUrl(item.url); // calls historyManager.deleteUrl(item.url) to delete the URL
                    deletedCount++;
                }
            }
        } else {
            console.log(`   No matches found for "${keyword}"`);
        }
    }

    // Step 3: Update statistics
    if (deletedCount > 0) {
        await storageManager.updateStatistics(deletedCount);
        console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} URLs`);
    } else {
        console.log('\nℹ️ Cleanup complete! No matching URLs found.');
    }

    return { // Sends results back to whoever called this function
        success: true,
        deletedCount: deletedCount,
        message: `Deleted ${deletedCount} history entries`
    };
}




// Message listener - the "ears" for popup commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {// Chrome's built-in message listener
    console.log('📨 Received message:', request);
    /*
    The parameters (information we receive):
    request = The message that was sent (what does popup want?)
    sender = The sender of the message (popup)
    sendResponse = A function to send a response back to the popup  
    */

    // Check what action was requested
    if (request.action === 'cleanHistory') {
        console.log('🧹 Starting cleanup...');

        // Call our cleanHistory function
        cleanHistory()
            .then(result => { // when cleanHistory() is done,then run this:
                console.log('✅ Cleanup finished:', result);
                sendResponse(result); // send the result back to the popup
            })
            .catch(error => {
                console.error('❌ Cleanup error:', error);
                sendResponse({ success: false, error: error.message });
            });

        // IMPORTANT: Return true to keep the message channel open
        return true; // wait for the response to finish before closing the message channel because cleanHistory() is an async function (needs time to finish)
    }

    // Handle getStatistics
    if (request.action === 'getStatistics') {
        storageManager.getStatistics()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // Handle getKeywords - Get current keyword list
    if (request.action === 'getKeywords') {
        console.log('📋 Getting keywords...');
        const keywords = urlMatcher.getAllPatterns();
        sendResponse({ success: true, keywords: keywords });
        return false; // Synchronous response
    }

    // Handle addKeyword - Add new keyword
    if (request.action === 'addKeyword') {
        console.log('➕ Adding keyword:', request.keyword);

        // Add to URLMatcher memory
        const addResult = urlMatcher.addPattern(request.keyword);

        if (addResult.success) {
            // Save updated list to storage
            const allKeywords = urlMatcher.getAllPatterns();
            storageManager.saveBlacklist(allKeywords)
                .then(() => {
                    console.log('✅ Keyword added and saved');
                    sendResponse({ success: true, keyword: request.keyword });
                })
                .catch(error => {
                    console.error('❌ Failed to save keyword:', error);
                    sendResponse({ success: false, error: error.message });
                });
        } else {
            sendResponse({ success: false, error: 'Keyword already exists' });
        }

        return true; // Async response
    }

    // Handle removeKeyword - Remove keyword
    if (request.action === 'removeKeyword') {
        console.log('➖ Removing keyword:', request.keyword);

        // Remove from URLMatcher memory
        const removeResult = urlMatcher.removePattern(request.keyword);

        if (removeResult.success) {
            // Save updated list to storage
            const allKeywords = urlMatcher.getAllPatterns();
            storageManager.saveBlacklist(allKeywords)
                .then(() => {
                    console.log('✅ Keyword removed and saved');
                    sendResponse({ success: true, keyword: request.keyword });
                })
                .catch(error => {
                    console.error('❌ Failed to save after removal:', error);
                    sendResponse({ success: false, error: error.message });
                });
        } else {
            sendResponse({ success: false, error: 'Keyword not found' });
        }

        return true; // Async response
    }

    // Handle searchHistory - Search without deleting (for preview)
    if (request.action === 'searchHistory') {
        console.log('🔍 Searching history for:', request.text);

        historyManager.searchHistory(request.text, request.maxResults || 10)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));

        return true; // Async response
    }

    // Unknown action
    console.log('⚠️ Unknown action:', request.action);
    sendResponse({ success: false, error: 'Unknown action' });
});

console.log('👂 Message listener ready!'); // log that the message listener is ready










console.log("👂 Background script is ready and listening...");

// Initialize extension when it loads
initializeExtension();
