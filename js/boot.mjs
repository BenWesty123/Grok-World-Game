const game = new URLSearchParams(location.search).get("game");
if (game === "flags") await import("./flags.mjs");
else await import("./game.mjs");
