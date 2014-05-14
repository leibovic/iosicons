const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Messaging.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function handleLinkAdded(event, browser) {
  // ---- Start copied from browser.js ----
  let target = event.originalTarget;
  if (!target.href || target.disabled)
    return;

  // Ignore on frames and other documents
  if (target.ownerDocument != browser.contentDocument)
    return;

  // Sanitize the rel string
  let list = [];
  if (target.rel) {
    list = target.rel.toLowerCase().split(/\s+/);
    let hash = {};
    list.forEach(function(value) { hash[value] = true; });
    list = [];
    for (let rel in hash)
      list.push("[" + rel + "]");
  }
  // ---- End copied from browser.js ----

  // Bail if this isn't an apple touch icon
  if (list.indexOf("[apple-touch-icon]") == -1 &&
      list.indexOf("[apple-touch-icon-precomposed]") == -1) {
    return;
  }

  Services.console.logStringMessage("Found apple touch icon: " + target.href);

  let win = browser.ownerDocument.defaultView;

  let json = {
    type: "Link:Favicon",
    tabID: win.BrowserApp.getTabForBrowser(browser).id,
    href: win.resolveGeckoURI(target.href),
    size: 114
  };
  sendMessageToJava(json);
}

function onTabOpen(event) {
  let browser = event.currentTarget;
  browser.addEventListener("DOMLinkAdded", function(e) {
    handleLinkAdded(e, browser);
  }, true);
}

function onTabClose(event) {
  let browser = event.currentTarget;
  browser.removeEventListener("DOMLinkAdded", function(e) {
    handleLinkAdded(e, browser);
  }, true);  
}

function loadIntoWindow(window) {
  window.BrowserApp.deck.addEventListener("TabOpen", onTabOpen, true);
  window.BrowserApp.deck.addEventListener("TabClose", onTabClose, true);
}

function unloadFromWindow(window) {
  window.BrowserApp.deck.removeEventListener("TabOpen", onTabOpen, true);
  window.BrowserApp.deck.addEventListener("TabClose", onTabClose, true);
}

/**
 * bootstrap.js API
 */
var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  
  onCloseWindow: function(aWindow) {
  },
  
  onWindowTitleChange: function(aWindow, aTitle) {
  }
};

function startup(aData, aReason) {
  // Load into any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }

  // Load into any new windows
  Services.wm.addListener(windowListener);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;

  // Stop listening for new windows
  Services.wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

function install(aData, aReason) {
}

function uninstall(aData, aReason) {
}
