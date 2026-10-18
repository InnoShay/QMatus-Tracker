/** Shared by the server root layout and the client greeting (not a client module). */
export const HELLO_SEEN_KEY = "qm-hello";

/** Runs before first paint on full page loads, so the app never flashes before the greeting. */
export const BOOT_SCRIPT = `try{if(!sessionStorage.getItem("${HELLO_SEEN_KEY}"))document.documentElement.dataset.boot="1"}catch(e){}`;
