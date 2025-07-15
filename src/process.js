// process.js - Adapted for Lego Island with Polling for Responsiveness and App Close Shortcut

const html = await loadHtml("body.html");

/**
 * Represents the process for the Lego Island for ArcOS third-party application.
 * This class extends the ArcOS-provided `ThirdPartyAppProcess` to manage
 * the application's lifecycle and rendering within the ArcOS environment.
 */
class proc extends ThirdPartyAppProcess {
    /**
     * @type {number | null}
     */
    resizePollIntervalId = null; // To store the interval ID for polling
    /**
     * Stores the last known dimensions of the parent body element.
     */
    lastParentWidth = 0;
    lastParentHeight = 0;

    /**
     * @type {HTMLElement | null}
     */
    appWrapper = null; // Reference to the main app container
    /**
     * @type {HTMLIFrameElement | null}
     */
    isleFrame = null; // Reference to the iframe


    /**
     * ArcOS Accelerator Store for keyboard shortcuts.
     * @type {Array<AppKeyCombination>}
     */
    acceleratorStore = []; // Initialize the acceleratorStore


    constructor(handler, pid, parentPid, app, workingDirectory, ...args) {
        super(handler, pid, parentPid, app, workingDirectory);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Renders the application's user interface.
     * This method is called by ArcOS when the application needs to display its content.
     */
    async render() {
        if (this._disposed) return;

        const body = this.getBody();
        body.innerHTML = html; // This line injects the content from body.html

        this.Log("LEGO Island rendered.", LogLevel.info);

        // Get references to the elements AFTER they are rendered into the DOM
        this.appWrapper = document.getElementById('app-wrapper');
        this.isleFrame = document.getElementById('isle-frame');

        if (this.isleFrame && this.appWrapper) {
            // Initial sizing
            this.handleResize();

            // --- START: Polling for responsiveness ---
            // Clear any existing interval to prevent duplicates on re-render
            if (this.resizePollIntervalId) {
                clearInterval(this.resizePollIntervalId);
            }

            // Start polling to detect dimension changes of the parent body element
            this.resizePollIntervalId = setInterval(() => {
                if (this._disposed) { // Ensure we don't poll if app is disposed
                    clearInterval(this.resizePollIntervalId);
                    return;
                }
                const bodyElement = this.getBody();
                const currentWidth = bodyElement.clientWidth;
                const currentHeight = bodyElement.clientHeight;

                // Only call handleResize if dimensions have actually changed
                if (currentWidth !== this.lastParentWidth || currentHeight !== this.lastParentHeight) {
                    this.Log(`[Polling Detected] Dimensions changed: ${currentWidth}x${currentHeight}`, LogLevel.info);
                    this.lastParentWidth = currentWidth;
                    this.lastParentHeight = currentHeight;
                    this.handleResize(); // Re-apply sizing
                }
            }, 100); // Check every 100ms (adjust as needed, lower is more responsive but more CPU intensive)
            // --- END: Polling ---

            // --- START: ArcAPI Keyboard Shortcuts for App Close ---
            // Clear previous accelerators to prevent duplicates on re-render
            this.acceleratorStore = [];
            this.Log("ArcAPI acceleratorStore initialized/cleared.", LogLevel.info);

            // Register Alt + Q to simply close the app
            this.acceleratorStore.push({
                alt: true, // Listen for Alt key
                key: "q",  // Listen for 'q' key
                action: async (procInstance, event) => { // Made action async
                    this.Log("ArcAPI Accelerator: Alt+Q ACTION triggered. Closing app directly.", LogLevel.info);
                    if (typeof procInstance.killSelf === 'function') {
                        await procInstance.killSelf();
                        this.Log("Lego Island process killed.", LogLevel.info);
                    } else {
                        this.Log("killSelf() method not found. Cannot close app.", LogLevel.error);
                    }
                    event.preventDefault(); // Prevent default browser behavior
                },
                global: true
            });
            this.Log("ArcAPI Accelerator: Alt+Q shortcut registered.", LogLevel.info);
            // --- END: ArcAPI Keyboard Shortcuts ---

            // Initial diagnostic logs (keep these to verify initial state)
            this.Log(`[Render] window.innerWidth: ${window.innerWidth}, window.innerHeight: ${window.innerHeight}`, LogLevel.info);
            if (this.app && this.app.size) {
                this.Log(`[Render] this.app.size properties: w=${this.app.size.w}, h=${this.app.size.h}`, LogLevel.info);
                if (typeof this.app.size.subscribe === 'function') {
                    this.Log(`[Render] this.app.size HAS a 'subscribe' method (potential ReadableStore).`, LogLevel.info);
                } else {
                    this.Log(`[Render] this.app.size DOES NOT have a 'subscribe' method.`, LogLevel.info);
                }
            } else {
                this.Log(`[Render] this.app or this.app.size is undefined at render.`, LogLevel.warning);
            }

        } else {
            this.Log("Required elements (iframe or app-wrapper) not found after render.", LogLevel.error);
        }
    }

    /**
     * Sets the iframe size based on the parent body element's client dimensions.
     */
    handleResize() {
        if (this._disposed || !this.isleFrame) return;

        const bodyElement = this.getBody(); // The div.body element injected by ArcOS

        const parentWidth = bodyElement.clientWidth;
        const parentHeight = bodyElement.clientHeight;

        // Set iframe dimensions directly
        this.isleFrame.style.width = `${parentWidth}px`;
        this.isleFrame.style.height = `${parentHeight}px`;

        // Update last observed dimensions
        this.lastParentWidth = parentWidth;
        this.lastParentHeight = parentHeight;
    }

    /**
     * Overriding the dispose method to ensure clean up of polling interval and iframe.
     */
    dispose() {
        if (this.resizePollIntervalId) {
            clearInterval(this.resizePollIntervalId);
        }

        // Clear the acceleratorStore on dispose
        this.acceleratorStore = [];

        const isleFrame = document.getElementById('isle-frame');
        if (isleFrame) {
            try {
                isleFrame.src = 'about:blank'; // Clear iframe content
                setTimeout(() => {
                    if (isleFrame.parentNode) {
                        isleFrame.parentNode.removeChild(isleFrame);
                    }
                }, 100);
            } catch (e) {
                // Log any errors during iframe cleanup, but don't prevent dispose
            }
        }

        // Call the superclass dispose method last
        super.dispose();
    }
}

return { proc };
