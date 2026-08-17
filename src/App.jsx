import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { storage } from "./storage";

/* ============================================================================
   MONOPOLY BANKER — local-first digital banker for physical-board Monopoly.
   Single-file app. Persistence via IndexedDB (this browser, this device).
   ========================================================================== */

/* ---------------------------------- THEME --------------------------------- */
// Two palettes sharing the same key set, so every existing C.xxx reference
// throughout the app repaints correctly with no per-usage changes needed.
const THEMES = {
  // Ultraviolet futuristic "digital banking terminal" — the flagship look.
  dark: {
    bg: "#050414",
    bgSoft: "#0A0824",
    panel: "#120F30",
    card: "#171340",
    cardHi: "#201A52",
    border: "#3B2E72",
    borderSoft: "#251E52",
    brass: "#9B3DF5",       // primary accent (was gold, now ultraviolet)
    brassLight: "#C99BFF",  // secondary accent / highlights
    cream: "#F2ECFF",       // primary text
    muted: "#A79ADB",
    mutedDim: "#6F63A8",
    good: "#33E8A8",
    bad: "#FF5C82",
    warn: "#FFC857",
    white: "#FFFFFF",
    accentCyan: "#2FE0F0",
    accentMagenta: "#E23BD9",
    accentBlue: "#3F6EFF",
    accentEmerald: "#2FE6A0",
    onAccent: "#0B0620",
  },
  light: {
    bg: "#F6F3FD",
    bgSoft: "#EDE8FA",
    panel: "#FFFFFF",
    card: "#FFFFFF",
    cardHi: "#F3EEFE",
    border: "#DCD2F3",
    borderSoft: "#E9E2FA",
    brass: "#7C3AED",
    brassLight: "#9B5CF0",
    cream: "#1C1533",
    muted: "#6B6289",
    mutedDim: "#8F87AC",
    good: "#0FA36E",
    bad: "#E23B5D",
    warn: "#B9790E",
    white: "#FFFFFF",
    accentCyan: "#0EA5B7",
    accentMagenta: "#C026B0",
    accentBlue: "#3457D5",
    accentEmerald: "#0F9D6B",
    onAccent: "#FFFFFF",
  },
};

function getStoredThemeMode() {
  try { return localStorage.getItem("mb-theme") || "system"; } catch { return "system"; }
}
function resolveThemeMode(mode) {
  if (mode === "dark" || mode === "light") return mode;
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { return "dark"; }
}
// Mutated in place (not reassigned) so the many `C.xxx` reads scattered
// through this file always see the current theme without prop-drilling.
let C = { ...THEMES[resolveThemeMode(getStoredThemeMode())] };

// Vibrant, distinct per-player identity colors (ultraviolet / cyan / magenta
// / electric blue / emerald / amber…), assigned by player order at game
// creation and kept stable for that game.
const PLAYER_COLORS = ["#B98CFF", "#2FE0F0", "#FF4DD8", "#4E86FF", "#2FE6A0", "#FFC857", "#FF6E6E", "#7CF29A"];

const GROUP_COLORS = {
  brown: "#8B5A2B",
  lightblue: "#AAE0FA",
  pink: "#D93A96",
  orange: "#F0A030",
  red: "#E23B2E",
  yellow: "#F5E03C",
  green: "#3C9E4A",
  blue: "#2E5FB8",
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; }
    .font-display { font-family: 'Fraunces', serif; }
    .font-mono { font-family: 'IBM Plex Mono', monospace; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    @keyframes riseIn { from { opacity:0; transform:translateY(8px);} to {opacity:1; transform:translateY(0);} }
    @keyframes fadeIn { from { opacity:0;} to {opacity:1;} }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    .anim-rise { animation: riseIn .28s ease both; }
    .anim-fade { animation: fadeIn .2s ease both; }
    button:focus-visible, input:focus-visible, select:focus-visible, [tabindex]:focus-visible {
      outline: 2px solid ${C.brassLight}; outline-offset: 2px;
    }
    input, select { font-family: inherit; }
  `}</style>
);

/* --------------------------------- BOARD DATA ------------------------------ */
const BOARD = [
  { id:0, name:"GO", type:"go" },
  { id:1, name:"Mediterranean Avenue", type:"property", group:"brown", price:60, rent:[2,10,30,90,160,250], houseCost:50, mortgage:30 },
  { id:2, name:"Community Chest", type:"chest" },
  { id:3, name:"Baltic Avenue", type:"property", group:"brown", price:60, rent:[4,20,60,180,320,450], houseCost:50, mortgage:30 },
  { id:4, name:"Income Tax", type:"tax", amount:200 },
  { id:5, name:"Reading Railroad", type:"railroad", price:200, mortgage:100 },
  { id:6, name:"Oriental Avenue", type:"property", group:"lightblue", price:100, rent:[6,30,90,270,400,550], houseCost:50, mortgage:50 },
  { id:7, name:"Chance", type:"chance" },
  { id:8, name:"Vermont Avenue", type:"property", group:"lightblue", price:100, rent:[6,30,90,270,400,550], houseCost:50, mortgage:50 },
  { id:9, name:"Connecticut Avenue", type:"property", group:"lightblue", price:120, rent:[8,40,100,300,450,600], houseCost:50, mortgage:60 },
  { id:10, name:"Jail / Just Visiting", type:"jail" },
  { id:11, name:"St. Charles Place", type:"property", group:"pink", price:140, rent:[10,50,150,450,625,750], houseCost:100, mortgage:70 },
  { id:12, name:"Electric Company", type:"utility", price:150, mortgage:75 },
  { id:13, name:"States Avenue", type:"property", group:"pink", price:140, rent:[10,50,150,450,625,750], houseCost:100, mortgage:70 },
  { id:14, name:"Virginia Avenue", type:"property", group:"pink", price:160, rent:[12,60,180,500,700,900], houseCost:100, mortgage:80 },
  { id:15, name:"Pennsylvania Railroad", type:"railroad", price:200, mortgage:100 },
  { id:16, name:"St. James Place", type:"property", group:"orange", price:180, rent:[14,70,200,550,750,950], houseCost:100, mortgage:90 },
  { id:17, name:"Community Chest", type:"chest" },
  { id:18, name:"Tennessee Avenue", type:"property", group:"orange", price:180, rent:[14,70,200,550,750,950], houseCost:100, mortgage:90 },
  { id:19, name:"New York Avenue", type:"property", group:"orange", price:200, rent:[16,80,220,600,800,1000], houseCost:100, mortgage:100 },
  { id:20, name:"Free Parking", type:"free" },
  { id:21, name:"Kentucky Avenue", type:"property", group:"red", price:220, rent:[18,90,250,700,875,1050], houseCost:150, mortgage:110 },
  { id:22, name:"Chance", type:"chance" },
  { id:23, name:"Indiana Avenue", type:"property", group:"red", price:220, rent:[18,90,250,700,875,1050], houseCost:150, mortgage:110 },
  { id:24, name:"Illinois Avenue", type:"property", group:"red", price:240, rent:[20,100,300,750,925,1100], houseCost:150, mortgage:120 },
  { id:25, name:"B&O Railroad", type:"railroad", price:200, mortgage:100 },
  { id:26, name:"Atlantic Avenue", type:"property", group:"yellow", price:260, rent:[22,110,330,800,975,1150], houseCost:150, mortgage:130 },
  { id:27, name:"Ventnor Avenue", type:"property", group:"yellow", price:260, rent:[22,110,330,800,975,1150], houseCost:150, mortgage:130 },
  { id:28, name:"Water Works", type:"utility", price:150, mortgage:75 },
  { id:29, name:"Marvin Gardens", type:"property", group:"yellow", price:280, rent:[24,120,360,850,1025,1200], houseCost:150, mortgage:140 },
  { id:30, name:"Go To Jail", type:"gotojail" },
  { id:31, name:"Pacific Avenue", type:"property", group:"green", price:300, rent:[26,130,390,900,1100,1275], houseCost:200, mortgage:150 },
  { id:32, name:"North Carolina Avenue", type:"property", group:"green", price:300, rent:[26,130,390,900,1100,1275], houseCost:200, mortgage:150 },
  { id:33, name:"Community Chest", type:"chest" },
  { id:34, name:"Pennsylvania Avenue", type:"property", group:"green", price:320, rent:[28,150,450,1000,1200,1400], houseCost:200, mortgage:160 },
  { id:35, name:"Short Line Railroad", type:"railroad", price:200, mortgage:100 },
  { id:36, name:"Chance", type:"chance" },
  { id:37, name:"Park Place", type:"property", group:"blue", price:350, rent:[35,175,500,1100,1300,1500], houseCost:200, mortgage:175 },
  { id:38, name:"Luxury Tax", type:"tax", amount:100 },
  { id:39, name:"Boardwalk", type:"property", group:"blue", price:400, rent:[50,200,600,1400,1700,2000], houseCost:200, mortgage:200 },
];
const BOARD_BY_ID = Object.fromEntries(BOARD.map(s => [s.id, s]));
const OWNABLE = BOARD.filter(s => ["property","railroad","utility"].includes(s.type));
const GROUPS = [...new Set(BOARD.filter(s => s.group).map(s => s.group))];
const GROUP_LABEL = { brown:"Brown", lightblue:"Light Blue", pink:"Pink", orange:"Orange", red:"Red", yellow:"Yellow", green:"Green", blue:"Dark Blue" };

const TOKENS = [
  { id:"car", label:"Car", icon:"🚗" }, { id:"dog", label:"Dog", icon:"🐕" },
  { id:"hat", label:"Top Hat", icon:"🎩" }, { id:"ship", label:"Battleship", icon:"🚢" },
  { id:"boot", label:"Boot", icon:"👢" }, { id:"iron", label:"Iron", icon:"🧴" },
  { id:"wheelbarrow", label:"Wheelbarrow", icon:"🛒" }, { id:"cat", label:"Cat", icon:"🐈" },
  { id:"thimble", label:"Thimble", icon:"🧵" }, { id:"cannon", label:"Cannon", icon:"💣" },
];

const RULES_DEFAULT = { startCash: 1500, goAmount: 200, unmortgageInterestPct: 10, freeParkingJackpot: false };

/* -------------------------------- UTILITIES -------------------------------- */
const money = (n) => {
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return (neg ? "-$" : "$") + v.toLocaleString("en-US");
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const nowISO = () => new Date().toISOString();
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

/* -------------------------------- STORAGE ---------------------------------- */
const STORE = {
  async listIndex() {
    try {
      const r = await storage.get("games-index");
      return r ? JSON.parse(r.value) : [];
    } catch { return []; }
  },
  async saveIndex(idx) {
    try { await storage.set("games-index", JSON.stringify(idx)); } catch (e) { console.error(e); }
  },
  async loadGame(id) {
    try {
      const r = await storage.get("game:" + id);
      return r ? JSON.parse(r.value) : null;
    } catch { return null; }
  },
  async saveGame(state) {
    try {
      await storage.set("game:" + state.id, JSON.stringify(state));
      const idx = await STORE.listIndex();
      const meta = {
        id: state.id, name: state.name, playerCount: state.players.length,
        status: state.status, lastPlayed: state.lastPlayed, createdAt: state.createdAt,
      };
      const next = [meta, ...idx.filter(g => g.id !== state.id)];
      await STORE.saveIndex(next);
    } catch (e) { console.error(e); }
  },
  async deleteGame(id) {
    try {
      await storage.delete("game:" + id);
      const idx = await STORE.listIndex();
      await STORE.saveIndex(idx.filter(g => g.id !== id));
    } catch (e) { console.error(e); }
  },
};

/* ------------------------------- GAME ENGINE -------------------------------
   Pure functions: (state, ...args) => { state: newState, error?: string }
   Every financial action goes through here so nothing touches state directly.
------------------------------------------------------------------------------ */
function clonePlayers(state) { return state.players.map(p => ({ ...p, stats: { ...p.stats } })); }
function findPlayer(state, id) { return state.players.find(p => p.id === id); }
function activePlayers(state) { return state.players.filter(p => !p.bankrupt); }

function pushHistory(state, entry) {
  const h = { id: uid(), turn: state.turn, time: nowISO(), ...entry };
  return { ...state, history: [h, ...state.history] };
}

function touchStats(player, patch) {
  const s = { ...player.stats, ...patch };
  s.highestCash = Math.max(s.highestCash ?? 0, patch.cash ?? player.cash);
  return s;
}

function isMonopoly(state, group, ownerId) {
  const spaces = OWNABLE.filter(s => s.group === group);
  return spaces.length > 0 && spaces.every(s => state.properties[s.id].owner === ownerId);
}

function railroadCountForOwner(state, ownerId) {
  return OWNABLE.filter(s => s.type === "railroad" && state.properties[s.id].owner === ownerId).length;
}
function utilityCountForOwner(state, ownerId) {
  return OWNABLE.filter(s => s.type === "utility" && state.properties[s.id].owner === ownerId).length;
}

function calcRent(state, spaceId, diceTotal) {
  const space = BOARD_BY_ID[spaceId];
  const pstate = state.properties[spaceId];
  if (!pstate.owner || pstate.mortgaged) return 0;
  if (space.type === "property") {
    if (pstate.hotel) return space.rent[5];
    if (pstate.houses > 0) return space.rent[pstate.houses];
    const monopoly = isMonopoly(state, space.group, pstate.owner);
    return monopoly ? space.rent[0] * 2 : space.rent[0];
  }
  if (space.type === "railroad") {
    const n = railroadCountForOwner(state, pstate.owner);
    return [0, 25, 50, 100, 200][n];
  }
  if (space.type === "utility") {
    const n = utilityCountForOwner(state, pstate.owner);
    const mult = n >= 2 ? 10 : 4;
    return (diceTotal || 7) * mult;
  }
  return 0;
}

function netWorth(state, playerId) {
  const p = findPlayer(state, playerId);
  let total = p.cash;
  OWNABLE.forEach(s => {
    const ps = state.properties[s.id];
    if (ps.owner === playerId) {
      total += ps.mortgaged ? s.mortgage : s.price;
      if (s.type === "property") {
        total += (ps.houses || 0) * s.houseCost;
        if (ps.hotel) total += 4 * s.houseCost;
      }
    }
  });
  return total;
}

function playerProperties(state, playerId) {
  return OWNABLE.filter(s => state.properties[s.id].owner === playerId);
}

// --- Core mutating-style engine calls (return {state, error}) ---

function engineAdjustCash(state, playerId, delta, reasonLabel, opts = {}) {
  if (playerId === "bank") return { state };
  const players = clonePlayers(state);
  const p = players.find(pl => pl.id === playerId);
  if (!p) return { state, error: "Player not found." };
  const newCash = p.cash + delta;
  if (newCash < 0 && !opts.allowNegative) {
    return { state, error: `${p.name} does not have enough available cash for this.` };
  }
  p.cash = newCash;
  p.stats = touchStats(p, { cash: newCash });
  return { state: { ...state, players } };
}

function engineTransfer(state, fromId, toId, amount, reason) {
  if (amount <= 0) return { state, error: "Amount must be greater than zero." };
  const fromP = fromId === "bank" ? null : findPlayer(state, fromId);
  if (fromId !== "bank" && (!fromP || fromP.cash < amount)) {
    return { state, error: `${fromP ? fromP.name : "Player"} does not have enough available cash. Try raising money through a mortgage or trade.` };
  }
  let s = state;
  if (fromId !== "bank") {
    const r = engineAdjustCash(s, fromId, -amount, reason);
    if (r.error) return r;
    s = r.state;
  }
  if (toId !== "bank") {
    const r = engineAdjustCash(s, toId, amount, reason);
    if (r.error) return r;
    s = r.state;
  }
  const fromName = fromId === "bank" ? "Bank" : findPlayer(s, fromId).name;
  const toName = toId === "bank" ? "Bank" : findPlayer(s, toId).name;
  s = pushHistory(s, { type: "transfer", text: `${fromName} paid ${toName} ${money(amount)}${reason ? " — " + reason : ""}`, amount, from: fromId, to: toId });
  return { state: s };
}

function engineBuyProperty(state, playerId, spaceId) {
  const space = BOARD_BY_ID[spaceId];
  const pstate = state.properties[spaceId];
  if (pstate.owner) return { state, error: `${space.name} is already owned.` };
  const player = findPlayer(state, playerId);
  if (!player) return { state, error: "Player not found." };
  if (player.cash < space.price) return { state, error: `${player.name} does not have enough cash to buy ${space.name}.` };
  let s = engineAdjustCash(state, playerId, -space.price, "purchase").state;
  s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, owner: playerId } } };
  const players = clonePlayers(s).map(p => p.id === playerId ? { ...p, stats: touchStats(p, { propertiesBought: (p.stats.propertiesBought || 0) + 1 }) } : p);
  s = { ...s, players };
  s = pushHistory(s, { type: "purchase", text: `${player.name} purchased ${space.name} for ${money(space.price)}`, amount: space.price, property: spaceId });
  return { state: s };
}

function enginePayRent(state, payerId, spaceId, diceTotal) {
  const space = BOARD_BY_ID[spaceId];
  const pstate = state.properties[spaceId];
  if (!pstate.owner) return { state, error: `${space.name} is not owned by anyone.` };
  if (pstate.owner === payerId) return { state, error: "You can't pay rent to yourself." };
  if (pstate.mortgaged) return { state, error: `${space.name} is mortgaged — no rent is due.` };
  const rent = calcRent(state, spaceId, diceTotal);
  const payer = findPlayer(state, payerId);
  const owner = findPlayer(state, pstate.owner);
  if (payer.cash < rent) {
    return { state, error: "INSUFFICIENT_FUNDS", rent, payerId, ownerId: pstate.owner, spaceId };
  }
  let s = engineTransfer(state, payerId, pstate.owner, rent, `Rent — ${space.name}`).state;
  const players = clonePlayers(s).map(p => {
    if (p.id === payerId) return { ...p, stats: touchStats(p, { rentPaid: (p.stats.rentPaid || 0) + rent }) };
    if (p.id === pstate.owner) return { ...p, stats: touchStats(p, { rentCollected: (p.stats.rentCollected || 0) + rent }) };
    return p;
  });
  s = { ...s, players };
  return { state: s, rent };
}

function enginePassGo(state, playerId) {
  const amt = state.rules.goAmount;
  let s = engineAdjustCash(state, playerId, amt, "GO").state;
  const players = clonePlayers(s).map(p => p.id === playerId ? { ...p, stats: touchStats(p, { goCollected: (p.stats.goCollected || 0) + amt }) } : p);
  s = { ...s, players };
  const player = findPlayer(s, playerId);
  s = pushHistory(s, { type: "go", text: `${player.name} passed GO and collected ${money(amt)}`, amount: amt });
  return { state: s };
}

function enginePayTax(state, playerId, spaceId) {
  const space = BOARD_BY_ID[spaceId];
  const r = engineTransfer(state, playerId, "bank", space.amount, space.name);
  if (r.error) return r;
  let s = r.state;
  const players = clonePlayers(s).map(p => p.id === playerId ? { ...p, stats: touchStats(p, { taxesPaid: (p.stats.taxesPaid || 0) + space.amount }) } : p);
  s = { ...s, players };
  return { state: s };
}

function engineMortgage(state, spaceId) {
  const space = BOARD_BY_ID[spaceId];
  const pstate = state.properties[spaceId];
  if (!pstate.owner) return { state, error: "Property is not owned." };
  if (pstate.mortgaged) return { state, error: "Already mortgaged." };
  if (pstate.houses > 0 || pstate.hotel) return { state, error: "Sell houses/hotels on this property before mortgaging." };
  let s = engineAdjustCash(state, pstate.owner, space.mortgage, "mortgage").state;
  s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, mortgaged: true } } };
  const owner = findPlayer(s, pstate.owner);
  s = pushHistory(s, { type: "mortgage", text: `${owner.name} mortgaged ${space.name} (+${money(space.mortgage)})`, amount: space.mortgage, property: spaceId });
  return { state: s };
}

function engineUnmortgage(state, spaceId) {
  const space = BOARD_BY_ID[spaceId];
  const pstate = state.properties[spaceId];
  if (!pstate.mortgaged) return { state, error: "Property is not mortgaged." };
  const interest = Math.round(space.mortgage * (state.rules.unmortgageInterestPct / 100));
  const total = space.mortgage + interest;
  const owner = findPlayer(state, pstate.owner);
  if (owner.cash < total) return { state, error: `${owner.name} does not have enough cash to lift the mortgage (${money(total)} required).` };
  let s = engineAdjustCash(state, pstate.owner, -total, "unmortgage").state;
  s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, mortgaged: false } } };
  s = pushHistory(s, { type: "unmortgage", text: `${owner.name} lifted the mortgage on ${space.name} (-${money(total)})`, amount: total, property: spaceId });
  return { state: s };
}

function engineBuild(state, spaceId, mode) {
  // mode: 'house' | 'hotel' | 'sellHouse' | 'sellHotel'
  const space = BOARD_BY_ID[spaceId];
  const pstate = state.properties[spaceId];
  if (space.type !== "property") return { state, error: "Only color properties can be built on." };
  if (!pstate.owner) return { state, error: "Property is not owned." };
  if (pstate.mortgaged) return { state, error: "Cannot build on a mortgaged property." };
  const owner = findPlayer(state, pstate.owner);
  if (!isMonopoly(state, space.group, pstate.owner)) return { state, error: `${owner.name} needs the full ${GROUP_LABEL[space.group]} monopoly before building.` };
  const groupSpaces = OWNABLE.filter(s => s.group === space.group);
  const groupState = () => groupSpaces.map(s => state.properties[s.id]);

  if (mode === "house") {
    if (pstate.hotel) return { state, error: "This property already has a hotel." };
    if (pstate.houses >= 4) return { state, error: "Build a hotel instead — this property already has 4 houses." };
    const minHouses = Math.min(...groupState().map(p => p.hotel ? 5 : p.houses));
    if (pstate.houses > minHouses) return { state, error: "Even-building rule: build evenly across the color group first." };
    if (owner.cash < space.houseCost) return { state, error: `${owner.name} does not have enough cash to build (${money(space.houseCost)}).` };
    let s = engineAdjustCash(state, pstate.owner, -space.houseCost, "house").state;
    s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, houses: pstate.houses + 1 } } };
    const players = clonePlayers(s).map(p => p.id === pstate.owner ? { ...p, stats: touchStats(p, { housesBuilt: (p.stats.housesBuilt || 0) + 1 }) } : p);
    s = { ...s, players };
    s = pushHistory(s, { type: "build", text: `${owner.name} built a house on ${space.name} (-${money(space.houseCost)})`, amount: space.houseCost, property: spaceId });
    return { state: s };
  }
  if (mode === "hotel") {
    if (pstate.hotel) return { state, error: "Already a hotel." };
    if (pstate.houses < 4) return { state, error: "Needs 4 houses before upgrading to a hotel." };
    if (owner.cash < space.houseCost) return { state, error: `${owner.name} does not have enough cash to build a hotel (${money(space.houseCost)}).` };
    let s = engineAdjustCash(state, pstate.owner, -space.houseCost, "hotel").state;
    s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, houses: 0, hotel: true } } };
    const players = clonePlayers(s).map(p => p.id === pstate.owner ? { ...p, stats: touchStats(p, { hotelsBuilt: (p.stats.hotelsBuilt || 0) + 1 }) } : p);
    s = { ...s, players };
    s = pushHistory(s, { type: "build", text: `${owner.name} upgraded ${space.name} to a hotel (-${money(space.houseCost)})`, amount: space.houseCost, property: spaceId });
    return { state: s };
  }
  if (mode === "sellHouse") {
    if (pstate.houses <= 0) return { state, error: "No houses to sell." };
    const maxHouses = Math.max(...groupState().map(p => p.hotel ? 5 : p.houses));
    if (pstate.houses < maxHouses) return { state, error: "Even-building rule: sell evenly across the color group first." };
    const refund = Math.round(space.houseCost / 2);
    let s = engineAdjustCash(state, pstate.owner, refund, "sell house", { allowNegative: true }).state;
    s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, houses: pstate.houses - 1 } } };
    s = pushHistory(s, { type: "build", text: `${owner.name} sold a house on ${space.name} (+${money(refund)})`, amount: refund, property: spaceId });
    return { state: s };
  }
  if (mode === "sellHotel") {
    if (!pstate.hotel) return { state, error: "No hotel to sell." };
    const refund = Math.round(space.houseCost / 2);
    let s = engineAdjustCash(state, pstate.owner, refund, "sell hotel", { allowNegative: true }).state;
    s = { ...s, properties: { ...s.properties, [spaceId]: { ...pstate, hotel: false, houses: 4 } } };
    s = pushHistory(s, { type: "build", text: `${owner.name} sold the hotel on ${space.name}, back to 4 houses (+${money(refund)})`, amount: refund, property: spaceId });
    return { state: s };
  }
  return { state, error: "Unknown build action." };
}

function engineCompleteTrade(state, trade) {
  // trade: { a: {playerId, cash, propertyIds:[]}, b: {playerId, cash, propertyIds:[]} }
  const A = findPlayer(state, trade.a.playerId), B = findPlayer(state, trade.b.playerId);
  if (!A || !B) return { state, error: "Both traders must be selected." };
  if (trade.a.cash > A.cash) return { state, error: `${A.name} does not have enough cash for this trade.` };
  if (trade.b.cash > B.cash) return { state, error: `${B.name} does not have enough cash for this trade.` };
  for (const pid of trade.a.propertyIds) {
    if (state.properties[pid].owner !== A.id) return { state, error: `${A.name} does not own ${BOARD_BY_ID[pid].name}.` };
  }
  for (const pid of trade.b.propertyIds) {
    if (state.properties[pid].owner !== B.id) return { state, error: `${B.name} does not own ${BOARD_BY_ID[pid].name}.` };
  }
  let s = state;
  if (trade.a.cash > 0) s = engineTransfer(s, A.id, B.id, trade.a.cash, "trade").state;
  if (trade.b.cash > 0) s = engineTransfer(s, B.id, A.id, trade.b.cash, "trade").state;
  const props = { ...s.properties };
  trade.a.propertyIds.forEach(pid => { props[pid] = { ...props[pid], owner: B.id }; });
  trade.b.propertyIds.forEach(pid => { props[pid] = { ...props[pid], owner: A.id }; });
  s = { ...s, properties: props };
  const namesA = trade.a.propertyIds.map(id => BOARD_BY_ID[id].name);
  const namesB = trade.b.propertyIds.map(id => BOARD_BY_ID[id].name);
  const summary = `${A.name} ⇄ ${B.name}: ${[
    namesA.length ? `${A.name} gave ${namesA.join(", ")}` : null,
    namesB.length ? `${B.name} gave ${namesB.join(", ")}` : null,
    trade.a.cash ? `${A.name} paid ${money(trade.a.cash)}` : null,
    trade.b.cash ? `${B.name} paid ${money(trade.b.cash)}` : null,
  ].filter(Boolean).join("; ")}`;
  s = pushHistory(s, { type: "trade", text: summary });
  return { state: s };
}

function engineDeclareBankruptcy(state, playerId, creditorId, causeLabel) {
  const player = findPlayer(state, playerId);
  if (!player) return { state, error: "Player not found." };
  let s = state;
  const props = { ...s.properties };
  const owned = playerProperties(s, playerId);
  if (creditorId === "bank") {
    owned.forEach(sp => {
      props[sp.id] = { owner: null, mortgaged: false, houses: 0, hotel: false };
    });
  } else {
    owned.forEach(sp => {
      const ps = props[sp.id];
      props[sp.id] = { ...ps, owner: creditorId };
    });
  }
  s = { ...s, properties: props };
  const cashToCreditor = player.cash;
  const players = clonePlayers(s).map(p => {
    if (p.id === playerId) return { ...p, cash: 0, bankrupt: true, bankruptTurn: s.turn };
    if (p.id === creditorId && cashToCreditor > 0) return { ...p, cash: p.cash + cashToCreditor, stats: touchStats(p, { cash: p.cash + cashToCreditor }) };
    return p;
  });
  s = { ...s, players };
  const creditorName = creditorId === "bank" ? "the Bank" : findPlayer(s, creditorId).name;
  s = pushHistory(s, { type: "bankruptcy", text: `${player.name} declared bankruptcy to ${creditorName}${causeLabel ? " — " + causeLabel : ""}`, amount: cashToCreditor });
  // end-game check happens in UI layer after this returns
  return { state: s };
}

/* ------------------------------- UI PRIMITIVES ------------------------------ */
function Btn({ children, onClick, variant = "default", size = "md", disabled, style, full, type = "button", ...rest }) {
  const base = {
    default: { bg: C.card, color: C.cream, border: C.border },
    brass: { bg: `linear-gradient(135deg, ${C.brass}, ${C.accentMagenta})`, color: C.onAccent, border: C.brass },
    ghost: { bg: "transparent", color: C.muted, border: "transparent" },
    danger: { bg: "rgba(240,114,95,0.12)", color: C.bad, border: "rgba(240,114,95,0.4)" },
    good: { bg: "rgba(95,217,138,0.12)", color: C.good, border: "rgba(95,217,138,0.4)" },
  }[variant];
  const pad = { sm: "6px 10px", md: "10px 16px", lg: "14px 22px" }[size];
  const fs = { sm: 13, md: 14.5, lg: 16 }[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: base.bg, color: base.color, border: `1px solid ${base.border}`,
        padding: pad, borderRadius: 10, fontSize: fs, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1, width: full ? "100%" : "auto", transition: "transform .08s ease, filter .15s ease",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, ...style,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.98)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      {...rest}
    >
      {children}
    </button>
  );
}

function Modal({ title, subtitle, onClose, children, width = 460, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(4,14,10,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)" }}
      onClick={onClose}
      className="anim-fade"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="anim-rise"
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderBottom: "none",
          borderRadius: "18px 18px 0 0", width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto",
          padding: "22px 20px calc(20px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h2 className="font-display" style={{ margin: 0, fontSize: 21, color: C.cream, fontWeight: 700 }}>{title}</h2>
            {subtitle && <div style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, width: 32, height: 32, borderRadius: 9, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 18, display: "flex", gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, color: C.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: C.card, border: `1px solid ${C.border}`, color: C.cream,
  borderRadius: 10, padding: "11px 12px", fontSize: 15, outline: "none",
};

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ background: "rgba(240,114,95,0.12)", border: "1px solid rgba(240,114,95,0.35)", color: "#FFB4A6", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, marginBottom: 14, lineHeight: 1.45 }}>
      {message}
    </div>
  );
}

function PropertyChip({ spaceId, state }) {
  const s = BOARD_BY_ID[spaceId];
  const ps = state.properties[spaceId];
  const color = s.group ? GROUP_COLORS[s.group] : (s.type === "railroad" ? C.brass : "#8FD3D8");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 10px", fontSize: 13 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ color: C.cream }}>{s.name}</span>
      {ps.mortgaged && <span style={{ color: C.bad, fontSize: 11, fontWeight: 700 }}>MORTGAGED</span>}
      {ps.hotel && <span style={{ color: C.brassLight, fontSize: 11 }}>🏨</span>}
      {!ps.hotel && ps.houses > 0 && <span style={{ color: C.brassLight, fontSize: 11 }}>{"🏠".repeat(ps.houses)}</span>}
    </div>
  );
}

function PlayerBadge({ player, size = 20 }) {
  const t = TOKENS.find(t => t.id === player.token);
  const color = player.color || C.brassLight;
  const ring = Math.round(size * 1.65);
  return (
    <span
      title={player.name}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: ring, height: ring, borderRadius: "50%",
        background: player.bankrupt ? "transparent" : `${color}26`,
        border: `1.5px solid ${player.bankrupt ? C.mutedDim : color}`,
        boxShadow: player.bankrupt ? "none" : `0 0 8px ${color}55`,
        filter: player.bankrupt ? "grayscale(1) opacity(0.5)" : "none",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: size }}>{t ? t.icon : "●"}</span>
    </span>
  );
}

function ThemeToggle({ mode, onChange, compact }) {
  const opts = [["dark", "🌙"], ["light", "☀️"], ["system", "⚙️"]];
  return (
    <div style={{ display: "inline-flex", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
      {opts.map(([id, icon]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={id[0].toUpperCase() + id.slice(1)}
          style={{
            border: "none", cursor: "pointer", borderRadius: 7,
            padding: compact ? "5px 7px" : "6px 10px", fontSize: 13,
            background: mode === id ? `linear-gradient(135deg, ${C.brass}, ${C.accentBlue})` : "transparent",
            color: mode === id ? C.onAccent : C.muted,
          }}
        >{icon}</button>
      ))}
    </div>
  );
}

/* ------------------------------------ HOME ---------------------------------- */
function HomeScreen({ games, onNewGame, onContinue, onOpenSaved, onDeleteRequest, themeMode, setThemeMode }) {
  const recent = games.slice(0, 3);
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 50% -10%, ${C.bgSoft}, ${C.bg})`, display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 20px 40px", position: "relative" }}>
      {setThemeMode && (
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <ThemeToggle mode={themeMode} onChange={setThemeMode} compact />
        </div>
      )}
      <div style={{ textAlign: "center", marginBottom: 40 }} className="anim-rise">
        <div style={{ fontSize: 13, letterSpacing: 3, color: C.brass, fontWeight: 700, marginBottom: 10 }}>ESTABLISHED FOR THE TABLETOP</div>
        <h1 className="font-display" style={{ fontSize: 46, color: C.cream, margin: 0, fontWeight: 700, letterSpacing: 0.5 }}>MONOPOLY BANKER</h1>
        <p style={{ color: C.muted, fontSize: 15.5, marginTop: 10 }}>Your digital banker. Your physical board.</p>
      </div>

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }} className="anim-rise">
        <Btn variant="brass" size="lg" full onClick={onNewGame}>➕ NEW GAME</Btn>
        <Btn size="lg" full disabled={!recent.length} onClick={() => recent[0] && onContinue(recent[0].id)}>▶ CONTINUE GAME{recent.length ? ` — ${recent[0].name}` : ""}</Btn>
        <Btn size="lg" full onClick={onOpenSaved}>🗂 SAVED GAMES</Btn>
      </div>

      {recent.length > 0 && (
        <div style={{ width: "100%", maxWidth: 420, marginTop: 40 }} className="anim-rise">
          <div style={{ fontSize: 12.5, letterSpacing: 2, color: C.muted, fontWeight: 700, marginBottom: 12 }}>RECENT GAMES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recent.map(g => (
              <div key={g.id} onClick={() => onContinue(g.id)} style={{ cursor: "pointer", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: C.cream, fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                  <div style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>{g.playerCount} Players · {g.status === "completed" ? "Completed" : "In Progress"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.mutedDim, fontSize: 11.5 }}>{new Date(g.lastPlayed).toLocaleDateString()}</div>
                  <div style={{ color: C.brass, fontSize: 18 }}>›</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 48, color: C.mutedDim, fontSize: 12 }}>Runs fully offline · Game data stays on this device</div>
    </div>
  );
}

function SavedGamesScreen({ games, onBack, onContinue, onDuplicate, onDelete, themeMode, setThemeMode }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 18px 60px" }}>
      <TopBar title="SAVED GAMES" onBack={onBack} right={setThemeMode && <ThemeToggle mode={themeMode} onChange={setThemeMode} compact />} />
      {games.length === 0 && <div style={{ color: C.muted, textAlign: "center", marginTop: 60 }}>No saved games yet. Start a new game from the home screen.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "20px auto 0" }}>
        {games.map(g => (
          <div key={g.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: C.cream, fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                <div style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>{g.playerCount} Players · {g.status === "completed" ? "Completed" : "In Progress"} · Last played {new Date(g.lastPlayed).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn size="sm" variant="brass" onClick={() => onContinue(g.id)}>CONTINUE</Btn>
              <Btn size="sm" onClick={() => onDuplicate(g.id)}>DUPLICATE</Btn>
              {confirmDelete === g.id ? (
                <>
                  <Btn size="sm" variant="danger" onClick={() => { onDelete(g.id); setConfirmDelete(null); }}>CONFIRM DELETE</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>CANCEL</Btn>
                </>
              ) : (
                <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(g.id)}>DELETE</Btn>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 900, margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.brass, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>‹ Back</button>
      <div className="font-display" style={{ color: C.cream, fontWeight: 700, fontSize: 17, letterSpacing: 0.5 }}>{title}</div>
      <div style={{ minWidth: 60, textAlign: "right" }}>{right}</div>
    </div>
  );
}

/* ------------------------------------ SETUP ---------------------------------- */
function SetupWizard({ onCancel, onLaunch, themeMode, setThemeMode }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [players, setPlayers] = useState([{ id: uid(), name: "", token: "" }, { id: uid(), name: "", token: "" }]);
  const [startCash, setStartCash] = useState(1500);
  const [error, setError] = useState("");

  const usedTokens = new Set(players.map(p => p.token).filter(Boolean));
  const addPlayer = () => { if (players.length >= 8) return; setPlayers([...players, { id: uid(), name: "", token: "" }]); };
  const removePlayer = (id) => setPlayers(players.filter(p => p.id !== id));
  const updatePlayer = (id, patch) => setPlayers(players.map(p => p.id === id ? { ...p, ...patch } : p));

  const step1Valid = name.trim().length > 0;
  const step2Valid = players.length >= 2 && players.every(p => p.name.trim() && p.token);

  const goStart = () => {
    if (!step1Valid) { setError("Give your game a name to continue."); return; }
    if (!step2Valid) { setError("Every player needs a name and a token, and you need at least 2 players."); return; }
    setError("");
    onLaunch({ name: name.trim(), players: players.map(p => ({ ...p, name: p.name.trim() })), startCash: Number(startCash) || 1500 });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 18px 100px" }}>
      <TopBar title={`NEW GAME · STEP ${step + 1} OF 3`} onBack={onCancel} right={setThemeMode && <ThemeToggle mode={themeMode} onChange={setThemeMode} compact />} />
      <div style={{ maxWidth: 560, margin: "26px auto 0" }} className="anim-rise" key={step}>
        <ErrorBanner message={error} />

        {step === 0 && (
          <div>
            <h3 className="font-display" style={{ color: C.cream, fontSize: 22, marginBottom: 4 }}>Name your game</h3>
            <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 18 }}>Something you'll recognize on the home screen later.</p>
            <Field label="Game Name">
              <input autoFocus style={inputStyle} placeholder="e.g. Saturday Monopoly" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <Field label="Starting Cash">
              <input type="number" step={25} style={inputStyle} value={startCash} onChange={e => setStartCash(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="font-display" style={{ color: C.cream, fontSize: 22, marginBottom: 4 }}>Add players</h3>
            <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 18 }}>2–8 players. Everyone needs a unique token.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {players.map((p, i) => (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ color: C.brass, fontWeight: 700, fontSize: 12.5, letterSpacing: 1 }}>PLAYER {i + 1}</span>
                    {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ background: "none", border: "none", color: C.bad, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>REMOVE</button>}
                  </div>
                  <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Player name" value={p.name} onChange={e => updatePlayer(p.id, { name: e.target.value })} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {TOKENS.map(t => {
                      const takenByOther = usedTokens.has(t.id) && p.token !== t.id;
                      const selected = p.token === t.id;
                      return (
                        <button key={t.id} disabled={takenByOther} onClick={() => updatePlayer(p.id, { token: t.id })}
                          title={t.label}
                          style={{
                            aspectRatio: "1", borderRadius: 10, fontSize: 20, cursor: takenByOther ? "not-allowed" : "pointer",
                            background: selected ? "rgba(201,162,75,0.18)" : C.card,
                            border: `1.5px solid ${selected ? C.brass : C.border}`, opacity: takenByOther ? 0.3 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{t.icon}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {players.length < 8 && <Btn full style={{ marginTop: 14 }} onClick={addPlayer}>+ ADD PLAYER</Btn>}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-display" style={{ color: C.cream, fontSize: 22, marginBottom: 4 }}>{name}</h3>
            <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 18 }}>Review before you start.</p>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>PLAYERS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {players.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PlayerBadge player={p} size={22} /><span style={{ color: C.cream, fontSize: 14.5 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>STARTING CASH</div>
                <div className="font-mono" style={{ color: C.good, fontSize: 20, marginTop: 6, fontWeight: 600 }}>{money(startCash)}</div>
              </div>
              <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>RULESET</div>
                <div style={{ color: C.cream, fontSize: 15, marginTop: 6 }}>Classic Monopoly</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.bg, borderTop: `1px solid ${C.borderSoft}`, padding: "14px 18px calc(14px + env(safe-area-inset-bottom))", display: "flex", gap: 10, maxWidth: 560, margin: "0 auto" }}>
        {step > 0 && <Btn onClick={() => setStep(step - 1)}>‹ EDIT</Btn>}
        {step < 2 && <Btn variant="brass" full onClick={() => { setError(""); if (step === 0 && !step1Valid) { setError("Give your game a name to continue."); return; } if (step === 1 && !step2Valid) { setError("Every player needs a name and a token."); return; } setStep(step + 1); }}>CONTINUE ›</Btn>}
        {step === 2 && <Btn variant="brass" full size="lg" onClick={goStart}>🎲 START GAME</Btn>}
      </div>
    </div>
  );
}

/* --------------------------------- GAME SCREEN -------------------------------- */
function makeNewGameState({ name, players, startCash }) {
  const rules = { ...RULES_DEFAULT, startCash };
  const props = {};
  OWNABLE.forEach(s => { props[s.id] = { owner: null, mortgaged: false, houses: 0, hotel: false }; });
  return {
    id: uid(),
    name,
    status: "active",
    createdAt: nowISO(),
    lastPlayed: nowISO(),
    startTime: nowISO(),
    turn: 1,
    currentPlayerIndex: 0,
    rules,
    players: players.map((p, i) => ({
      id: p.id, name: p.name, token: p.token, color: PLAYER_COLORS[i % PLAYER_COLORS.length], cash: startCash, bankrupt: false, bankruptTurn: null, inJail: false,
      stats: { cash: startCash, highestCash: startCash, rentPaid: 0, rentCollected: 0, propertiesBought: 0, housesBuilt: 0, hotelsBuilt: 0, taxesPaid: 0, goCollected: 0, tradesCompleted: 0, bankruptcies: 0 },
    })),
    properties: props,
    history: [{ id: uid(), turn: 1, time: nowISO(), type: "system", text: `Game "${name}" started with ${players.length} players.` }],
    winnerId: null,
  };
}

const QUICK_ACTIONS = [
  { id: "buy", icon: "🏠", label: "Buy Property" },
  { id: "rent", icon: "💵", label: "Pay Rent" },
  { id: "transfer", icon: "💰", label: "Transfer" },
  { id: "trade", icon: "🔄", label: "Trade" },
  { id: "mortgage", icon: "🏦", label: "Mortgage" },
  { id: "unmortgage", icon: "💳", label: "Unmortgage" },
  { id: "build", icon: "🏘️", label: "Build" },
  { id: "tax", icon: "🧾", label: "Tax" },
  { id: "jail", icon: "🚔", label: "Jail" },
  { id: "card", icon: "🎴", label: "Card" },
  { id: "go", icon: "➕", label: "Pass GO" },
  { id: "bankrupt", icon: "💀", label: "Bankruptcy" },
];

function GameScreen({ game, setGame, onExit, themeMode, setThemeMode }) {
  const [modal, setModal] = useState(null); // {type, ...}
  const [drawerPlayer, setDrawerPlayer] = useState(null);
  const [tab, setTab] = useState("dashboard"); // dashboard | board | history | stats
  const [elapsed, setElapsed] = useState(0);
  const saveTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - new Date(game.startTime).getTime()), 1000);
    return () => clearInterval(t);
  }, [game.startTime]);

  const commit = useCallback((newState, opts = {}) => {
    const withMeta = { ...newState, lastPlayed: nowISO() };
    setGame(withMeta);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => STORE.saveGame(withMeta), 150);
    if (!opts.skipEndCheck) checkEndGame(withMeta);
  }, [setGame]);

  const checkEndGame = (state) => {
    const active = state.players.filter(p => !p.bankrupt);
    if (active.length === 1 && state.status === "active" && state.players.length > 1) {
      const finalState = { ...state, status: "completed", winnerId: active[0].id };
      setGame(finalState);
      STORE.saveGame(finalState);
    }
  };

  const run = (fn) => {
    const r = fn(game);
    if (r.error && r.error !== "INSUFFICIENT_FUNDS") { setModal(m => ({ ...m, _error: r.error })); return r; }
    if (!r.error) { commit(r.state); setModal(null); }
    return r;
  };

  const active = activePlayers(game);
  const currentPlayer = game.players[game.currentPlayerIndex];
  const endTurn = () => {
    let idx = game.currentPlayerIndex;
    let next = (idx + 1) % game.players.length;
    let loops = 0;
    while (game.players[next].bankrupt && loops < game.players.length) { next = (next + 1) % game.players.length; loops++; }
    const wrapped = next <= idx;
    let s = { ...game, currentPlayerIndex: next, turn: wrapped ? game.turn + 1 : game.turn };
    commit(s);
  };

  if (game.status === "completed") {
    return <EndGameScreen game={game} onExit={onExit} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 92 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: `linear-gradient(${C.bg}, ${C.bg}ee)`, borderBottom: `1px solid ${C.borderSoft}`, padding: "14px 16px 10px", backdropFilter: "blur(6px)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={onExit} style={{ background: "none", border: "none", color: C.brass, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>‹ Exit</button>
            <div className="font-display" style={{ color: C.cream, fontWeight: 700, fontSize: 16 }}>{game.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="font-mono" style={{ color: C.mutedDim, fontSize: 12.5 }}>{fmtDuration(elapsed)}</span>
              {setThemeMode && <ThemeToggle mode={themeMode} onChange={setThemeMode} compact />}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <div style={{ color: C.muted, fontSize: 13 }}>TURN <b style={{ color: C.brassLight }}>{game.turn}</b></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 12px" }}>
              <PlayerBadge player={currentPlayer} size={16} />
              <span style={{ color: C.cream, fontSize: 13, fontWeight: 700 }}>{currentPlayer.name}'s turn</span>
            </div>
            <Btn size="sm" variant="ghost" onClick={endTurn}>End Turn ›</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.panel, padding: 4, borderRadius: 12, border: `1px solid ${C.border}` }}>
          {[["dashboard", "Dashboard"], ["board", "Board"], ["history", "History"], ["stats", "Stats"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: tab === k ? `linear-gradient(135deg, ${C.brass}, ${C.accentBlue})` : "transparent", color: tab === k ? C.onAccent : C.muted,
            }}>{l}</button>
          ))}
        </div>

        {tab === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
              {game.players.map(p => (
                <PlayerCard key={p.id} player={p} game={game} isCurrent={p.id === currentPlayer.id} onClick={() => setDrawerPlayer(p.id)} />
              ))}
            </div>
            <div style={{ fontSize: 12.5, letterSpacing: 1.5, color: C.muted, fontWeight: 700, marginBottom: 10 }}>QUICK ACTIONS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.id} onClick={() => setModal({ type: a.id })} style={{
                  background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 8px",
                  color: C.cream, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 24 }}>{a.icon}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "board" && <BoardView game={game} onSelectSpace={(id) => setModal({ type: "propertyDetail", spaceId: id })} />}
        {tab === "history" && <HistoryView game={game} />}
        {tab === "stats" && <StatsView game={game} />}
      </div>

      {modal && (
        <ActionModal modal={modal} setModal={setModal} game={game} run={run} commit={commit} onClose={() => setModal(null)} />
      )}
      {drawerPlayer && (
        <PlayerDrawer playerId={drawerPlayer} game={game} onClose={() => setDrawerPlayer(null)} onOpenAction={(type, extra) => { setDrawerPlayer(null); setModal({ type, ...extra }); }} />
      )}
    </div>
  );
}

function PlayerCard({ player, game, isCurrent, onClick }) {
  const props = playerProperties(game, player.id);
  const nw = netWorth(game, player.id);
  const low = player.cash < 150 && !player.bankrupt;
  const pc = player.color || C.brassLight;
  return (
    <div onClick={onClick} style={{
      cursor: "pointer", background: player.bankrupt ? "rgba(255,255,255,0.02)" : C.panel,
      borderTop: `3px solid ${player.bankrupt ? C.mutedDim : pc}`,
      borderRight: `1.5px solid ${isCurrent ? pc : C.border}`, borderBottom: `1.5px solid ${isCurrent ? pc : C.border}`, borderLeft: `1.5px solid ${isCurrent ? pc : C.border}`,
      borderRadius: 16, padding: 14, position: "relative",
      opacity: player.bankrupt ? 0.55 : 1,
      boxShadow: isCurrent ? `0 0 0 3px ${pc}22, 0 0 18px ${pc}33` : "none",
    }}>
      {isCurrent && <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 800, color: pc, letterSpacing: 1 }}>● TURN</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <PlayerBadge player={player} size={22} />
        <span style={{ color: C.cream, fontWeight: 700, fontSize: 14.5 }}>{player.name}</span>
      </div>
      {player.bankrupt ? (
        <div style={{ color: C.bad, fontWeight: 700, fontSize: 12.5 }}>BANKRUPT</div>
      ) : (
        <>
          <div className="font-mono" style={{ color: low ? C.warn : C.good, fontSize: 21, fontWeight: 600 }}>{money(player.cash)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 11.5, marginTop: 6 }}>
            <span>{props.length} Properties</span>
            <span>NW {money(nw)}</span>
          </div>
          {player.inJail && <div style={{ marginTop: 6, fontSize: 11, color: C.warn, fontWeight: 700 }}>🚔 IN JAIL</div>}
        </>
      )}
    </div>
  );
}

/* ------------------------------- BOARD VIEW ------------------------------- */
function BoardView({ game, onSelectSpace }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const filtered = OWNABLE.filter(s => {
    const ps = game.properties[s.id];
    if (query && !s.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "unowned") return !ps.owner;
    if (filter === "owned") return !!ps.owner;
    if (filter === "mortgaged") return ps.mortgaged;
    return true;
  });
  return (
    <div>
      <input placeholder="Search properties…" style={{ ...inputStyle, marginBottom: 10 }} value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[["all", "All"], ["unowned", "Unowned"], ["owned", "Owned"], ["mortgaged", "Mortgaged"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "6px 12px", borderRadius: 20, border: `1px solid ${filter === k ? C.brass : C.border}`,
            background: filter === k ? "rgba(201,162,75,0.15)" : "transparent", color: filter === k ? C.brassLight : C.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {filtered.map(s => {
          const ps = game.properties[s.id];
          const owner = ps.owner ? findPlayer(game, ps.owner) : null;
          const color = s.group ? GROUP_COLORS[s.group] : (s.type === "railroad" ? C.brass : "#8FD3D8");
          return (
            <div key={s.id} onClick={() => onSelectSpace(s.id)} style={{ cursor: "pointer", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ height: 6, background: color }} />
              <div style={{ padding: 12 }}>
                <div style={{ color: C.cream, fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{s.name}</div>
                <div style={{ color: C.muted, fontSize: 11.5 }}>{money(s.price)}{s.type === "property" ? ` · ${GROUP_LABEL[s.group]}` : s.type === "railroad" ? " · Railroad" : " · Utility"}</div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {owner ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><PlayerBadge player={owner} size={14} /><span style={{ fontSize: 12, color: C.cream }}>{owner.name}</span></div>
                  ) : <span style={{ fontSize: 12, color: C.mutedDim }}>Unowned</span>}
                  {ps.mortgaged && <span style={{ fontSize: 10, color: C.bad, fontWeight: 700 }}>MORTGAGED</span>}
                  {ps.hotel && <span style={{ fontSize: 12 }}>🏨</span>}
                  {!ps.hotel && ps.houses > 0 && <span style={{ fontSize: 11 }}>{"🏠".repeat(ps.houses)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- HISTORY VIEW ------------------------------ */
const TYPE_ICON = { purchase: "🏠", transfer: "💵", go: "➕", tax: "🧾", mortgage: "🏦", unmortgage: "💳", build: "🏘️", trade: "🔄", bankruptcy: "💀", system: "🎲", jail: "🚔" };
function HistoryView({ game }) {
  const [playerFilter, setPlayerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const filtered = game.history.filter(h => {
    if (typeFilter !== "all" && h.type !== typeFilter) return false;
    if (playerFilter !== "all") {
      const p = findPlayer(game, playerFilter);
      if (!p || !h.text.includes(p.name)) return false;
    }
    return true;
  });
  const types = [...new Set(game.history.map(h => h.type))];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Select value={playerFilter} onChange={setPlayerFilter} options={[{ value: "all", label: "All players" }, ...game.players.map(p => ({ value: p.id, label: p.name }))]} />
        <Select value={typeFilter} onChange={setTypeFilter} options={[{ value: "all", label: "All types" }, ...types.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]} />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {filtered.map((h, i) => {
          const showTurnHeader = i === 0 || filtered[i - 1].turn !== h.turn;
          return (
            <React.Fragment key={h.id}>
              {showTurnHeader && <div style={{ color: C.brass, fontSize: 11.5, fontWeight: 800, letterSpacing: 1.5, margin: "16px 0 8px" }}>TURN {h.turn}</div>}
              {(() => {
                const actor = game.players.find(p => h.text.includes(p.name));
                const strip = actor ? (actor.color || C.brassLight) : C.borderSoft;
                return (
                  <div style={{ display: "flex", gap: 10, padding: "10px 0 10px 10px", borderBottom: `1px solid ${C.borderSoft}`, borderLeft: `3px solid ${strip}` }}>
                    <span style={{ fontSize: 16 }}>{TYPE_ICON[h.type] || "•"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.cream, fontSize: 13.5, lineHeight: 1.4 }}>{h.text}</div>
                      <div className="font-mono" style={{ color: C.mutedDim, fontSize: 11, marginTop: 2 }}>{fmtTime(h.time)}</div>
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
        {filtered.length === 0 && <div style={{ color: C.mutedDim, textAlign: "center", padding: 40 }}>No matching transactions.</div>}
      </div>
    </div>
  );
}

/* -------------------------------- STATS VIEW -------------------------------- */
function StatsView({ game }) {
  const sorted = [...game.players].sort((a, b) => netWorth(game, b.id) - netWorth(game, a.id));
  const totalMoved = game.history.filter(h => h.amount).reduce((sum, h) => sum + h.amount, 0);
  const largest = game.history.reduce((max, h) => (h.amount && h.amount > (max?.amount || 0)) ? h : max, null);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatBox label="Total Turns" value={game.turn} />
        <StatBox label="Transactions" value={game.history.length} />
        <StatBox label="Total Moved" value={money(totalMoved)} />
        <StatBox label="Bankruptcies" value={game.players.filter(p => p.bankrupt).length} />
      </div>
      {largest && <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 20 }}>Largest transaction: <span style={{ color: C.brassLight }}>{largest.text}</span></div>}
      <div style={{ fontSize: 12.5, letterSpacing: 1.5, color: C.muted, fontWeight: 700, marginBottom: 10 }}>PLAYER STANDINGS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${p.color || C.brassLight}`, borderRadius: 14, padding: 14, opacity: p.bankrupt ? 0.55 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: C.brass, fontWeight: 800, fontSize: 13 }}>#{i + 1}</span>
                <PlayerBadge player={p} size={18} /><span style={{ color: C.cream, fontWeight: 700 }}>{p.name}</span>
              </div>
              <span className="font-mono" style={{ color: C.brassLight, fontWeight: 700 }}>{money(netWorth(game, p.id))}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11.5, color: C.muted }}>
              <div>Cash: <b style={{ color: C.cream }}>{money(p.cash)}</b></div>
              <div>Rent paid: <b style={{ color: C.cream }}>{money(p.stats.rentPaid || 0)}</b></div>
              <div>Rent earned: <b style={{ color: C.cream }}>{money(p.stats.rentCollected || 0)}</b></div>
              <div>Bought: <b style={{ color: C.cream }}>{p.stats.propertiesBought || 0}</b></div>
              <div>Houses: <b style={{ color: C.cream }}>{p.stats.housesBuilt || 0}</b></div>
              <div>Taxes: <b style={{ color: C.cream }}>{money(p.stats.taxesPaid || 0)}</b></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function StatBox({ label, value }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div className="font-mono" style={{ color: C.cream, fontSize: 20, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* -------------------------------- PLAYER DRAWER ------------------------------ */
function PlayerDrawer({ playerId, game, onClose, onOpenAction }) {
  const player = findPlayer(game, playerId);
  const props = playerProperties(game, playerId);
  const byGroup = {};
  props.forEach(s => { const k = s.group || s.type; (byGroup[k] = byGroup[k] || []).push(s); });
  const nw = netWorth(game, playerId);
  const monopolies = GROUPS.filter(g => isMonopoly(game, g, playerId)).length;
  const houses = props.reduce((n, s) => n + (game.properties[s.id].houses || 0), 0);
  const hotels = props.reduce((n, s) => n + (game.properties[s.id].hotel ? 1 : 0), 0);
  return (
    <Modal title={player.name} subtitle={player.bankrupt ? "Bankrupt" : "Player Dashboard"} onClose={onClose} width={520}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <PlayerBadge player={player} size={34} />
        <div>
          <div className="font-mono" style={{ color: C.good, fontSize: 26, fontWeight: 600 }}>{money(player.cash)}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>Net worth {money(nw)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
        <StatBox label="Properties" value={props.length} />
        <StatBox label="Monopolies" value={monopolies} />
        <StatBox label="Houses" value={houses} />
        <StatBox label="Hotels" value={hotels} />
      </div>
      {!player.bankrupt && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <Btn size="sm" variant="brass" onClick={() => onOpenAction("go", { playerId })}>➕ Pass GO</Btn>
          <Btn size="sm" onClick={() => onOpenAction("transfer", { fromId: playerId })}>💰 Transfer</Btn>
          <Btn size="sm" onClick={() => onOpenAction("jail", { playerId })}>🚔 Jail</Btn>
        </div>
      )}
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>PROPERTIES</div>
      {props.length === 0 && <div style={{ color: C.mutedDim, fontSize: 13 }}>No properties yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {props.map(s => <PropertyChip key={s.id} spaceId={s.id} state={game} />)}
      </div>
    </Modal>
  );
}

/* -------------------------------- ACTION MODAL ------------------------------- */
function ActionModal({ modal, setModal, game, run, commit, onClose }) {
  const err = modal._error;
  const players = game.players.filter(p => !p.bankrupt);
  const playerOptions = players.map(p => ({ value: p.id, label: p.name }));

  /* ---- BUY ---- */
  if (modal.type === "buy") {
    const [playerId, setPlayerId] = [modal.playerId, (v) => setModal({ ...modal, playerId: v })];
    const [spaceId, setSpaceId] = [modal.spaceId, (v) => setModal({ ...modal, spaceId: v })];
    const unowned = OWNABLE.filter(s => !game.properties[s.id].owner);
    const space = spaceId ? BOARD_BY_ID[spaceId] : null;
    const player = playerId ? findPlayer(game, playerId) : null;
    const after = player && space ? player.cash - space.price : null;
    return (
      <Modal title="Purchase Property" onClose={onClose} footer={
        <>
          <Btn full onClick={onClose}>CANCEL</Btn>
          <Btn full variant="brass" disabled={!playerId || !spaceId || after < 0} onClick={() => run(s => engineBuyProperty(s, playerId, Number(spaceId)))}>PURCHASE</Btn>
        </>
      }>
        <ErrorBanner message={err} />
        <Field label="Player"><Select value={playerId} onChange={setPlayerId} options={playerOptions} placeholder="Select player" /></Field>
        <Field label="Property"><Select value={spaceId} onChange={setSpaceId} options={unowned.map(s => ({ value: s.id, label: `${s.name} — ${money(s.price)}` }))} placeholder="Select property" /></Field>
        {space && player && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14, marginTop: 4 }}>
            <Row label="Price" value={money(space.price)} />
            <Row label="Current Cash" value={money(player.cash)} />
            <Row label="After Purchase" value={money(after)} valueColor={after < 0 ? C.bad : C.good} />
          </div>
        )}
      </Modal>
    );
  }

  /* ---- RENT ---- */
  if (modal.type === "rent") {
    const payerId = modal.payerId, setPayerId = (v) => setModal({ ...modal, payerId: v, spaceId: undefined });
    const spaceId = modal.spaceId, setSpaceId = (v) => setModal({ ...modal, spaceId: v, needsDice: undefined });
    const owned = OWNABLE.filter(s => game.properties[s.id].owner && game.properties[s.id].owner !== payerId && !game.properties[s.id].mortgaged);
    const space = spaceId ? BOARD_BY_ID[Number(spaceId)] : null;
    const isUtility = space && space.type === "utility";
    const dice = modal.dice ?? 7;
    const rentPreview = space ? calcRent(game, Number(spaceId), Number(dice)) : 0;
    const payer = payerId ? findPlayer(game, payerId) : null;
    const owner = space ? findPlayer(game, game.properties[Number(spaceId)].owner) : null;
    const shortfall = payer && rentPreview > payer.cash;

    const doPay = () => {
      const r = enginePayRent(game, payerId, Number(spaceId), Number(dice));
      if (r.error === "INSUFFICIENT_FUNDS") {
        setModal({ type: "bankrupt", playerId: payerId, creditorId: r.ownerId, amountOwed: r.rent, cause: `unable to pay rent on ${BOARD_BY_ID[r.spaceId].name}` });
        return;
      }
      if (r.error) { setModal({ ...modal, _error: r.error }); return; }
      commit(r.state);
      setModal(null);
    };

    return (
      <Modal title="Pay Rent" onClose={onClose} footer={
        <>
          <Btn full onClick={onClose}>CANCEL</Btn>
          <Btn full variant="brass" disabled={!payerId || !spaceId} onClick={doPay}>PAY RENT</Btn>
        </>
      }>
        <ErrorBanner message={err} />
        <Field label="Tenant (paying)"><Select value={payerId} onChange={setPayerId} options={playerOptions} placeholder="Who's paying?" /></Field>
        <Field label="Property"><Select value={spaceId} onChange={setSpaceId} options={owned.map(s => ({ value: s.id, label: s.name }))} placeholder="Which property?" /></Field>
        {isUtility && (
          <Field label="Dice Total (for utility rent)">
            <input type="number" min={2} max={12} style={inputStyle} value={dice} onChange={e => setModal({ ...modal, dice: e.target.value })} />
          </Field>
        )}
        {space && owner && payer && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 }}>
              <div style={{ textAlign: "center" }}><PlayerBadge player={payer} size={26} /><div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{payer.name}</div></div>
              <div style={{ color: C.brass, fontSize: 20 }}>→</div>
              <div style={{ textAlign: "center" }}><PlayerBadge player={owner} size={26} /><div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{owner.name}</div></div>
            </div>
            <Row label="Property" value={space.name} />
            <Row label="Rent Due" value={money(rentPreview)} valueColor={shortfall ? C.bad : C.brassLight} />
            {shortfall && <div style={{ color: C.warn, fontSize: 12.5, marginTop: 8 }}>{payer.name} doesn't have enough cash — you'll be guided through raising money or bankruptcy.</div>}
          </div>
        )}
      </Modal>
    );
  }

  /* ---- TRANSFER ---- */
  if (modal.type === "transfer") {
    const fromId = modal.fromId ?? "bank", setFromId = (v) => setModal({ ...modal, fromId: v });
    const toId = modal.toId ?? "bank", setToId = (v) => setModal({ ...modal, toId: v });
    const amount = modal.amount ?? "", setAmount = (v) => setModal({ ...modal, amount: v });
    const reason = modal.reason ?? "", setReason = (v) => setModal({ ...modal, reason: v });
    const amt = Number(amount) || 0;
    const fromP = fromId !== "bank" ? findPlayer(game, fromId) : null;
    const toP = toId !== "bank" ? findPlayer(game, toId) : null;
    const opts = [{ value: "bank", label: "Bank" }, ...playerOptions];
    return (
      <Modal title="Transfer Money" onClose={onClose} footer={
        <>
          <Btn full onClick={onClose}>CANCEL</Btn>
          <Btn full variant="brass" disabled={!amt || fromId === toId} onClick={() => run(s => engineTransfer(s, fromId, toId, amt, reason || "manual transfer"))}>CONFIRM</Btn>
        </>
      }>
        <ErrorBanner message={err} />
        <Field label="From"><Select value={fromId} onChange={setFromId} options={opts} /></Field>
        <Field label="To"><Select value={toId} onChange={setToId} options={opts} /></Field>
        <Field label="Amount"><input type="number" style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="$0" /></Field>
        <Field label="Reason (optional)"><input style={inputStyle} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Free Parking jackpot" /></Field>
        {amt > 0 && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
            {fromP && <Row label={fromP.name} value={`${money(fromP.cash)} → ${money(fromP.cash - amt)}`} />}
            {toP && <Row label={toP.name} value={`${money(toP.cash)} → ${money(toP.cash + amt)}`} />}
          </div>
        )}
      </Modal>
    );
  }

  /* ---- GO ---- */
  if (modal.type === "go") {
    const playerId = modal.playerId, setPlayerId = (v) => setModal({ ...modal, playerId: v });
    return (
      <Modal title="Pass GO" onClose={onClose} footer={<><Btn full onClick={onClose}>CANCEL</Btn><Btn full variant="brass" disabled={!playerId} onClick={() => run(s => enginePassGo(s, playerId))}>COLLECT {money(game.rules.goAmount)}</Btn></>}>
        <ErrorBanner message={err} />
        <Field label="Player"><Select value={playerId} onChange={setPlayerId} options={playerOptions} placeholder="Who passed GO?" /></Field>
        {playerId && (
          <div style={{ background: C.card, borderRadius: 12, padding: 16, textAlign: "center" }}>
            <PlayerBadge player={findPlayer(game, playerId)} size={30} />
            <div style={{ color: C.cream, fontWeight: 700, margin: "8px 0 4px" }}>{findPlayer(game, playerId).name} passed GO</div>
            <div className="font-mono" style={{ color: C.good, fontSize: 24, fontWeight: 700 }}>+{money(game.rules.goAmount)}</div>
          </div>
        )}
      </Modal>
    );
  }

  /* ---- TAX ---- */
  if (modal.type === "tax") {
    const playerId = modal.playerId, setPlayerId = (v) => setModal({ ...modal, playerId: v });
    const taxSpaceId = modal.taxSpaceId ?? 4, setTaxSpaceId = (v) => setModal({ ...modal, taxSpaceId: Number(v) });
    const taxSpaces = BOARD.filter(s => s.type === "tax");
    const space = BOARD_BY_ID[taxSpaceId];
    const doPay = () => {
      const r = enginePayTax(game, playerId, taxSpaceId);
      if (r.error) {
        setModal({ type: "bankrupt", playerId, creditorId: "bank", amountOwed: space.amount, cause: `unable to pay ${space.name}` });
        return;
      }
      commit(r.state); setModal(null);
    };
    return (
      <Modal title="Pay Tax" onClose={onClose} footer={<><Btn full onClick={onClose}>CANCEL</Btn><Btn full variant="brass" disabled={!playerId} onClick={doPay}>PAY</Btn></>}>
        <ErrorBanner message={err} />
        <Field label="Player"><Select value={playerId} onChange={setPlayerId} options={playerOptions} /></Field>
        <Field label="Tax"><Select value={taxSpaceId} onChange={setTaxSpaceId} options={taxSpaces.map(s => ({ value: s.id, label: `${s.name} — ${money(s.amount)}` }))} /></Field>
      </Modal>
    );
  }

  /* ---- MORTGAGE ---- */
  if (modal.type === "mortgage") {
    const spaceId = modal.spaceId, setSpaceId = (v) => setModal({ ...modal, spaceId: Number(v) });
    const mortgageable = OWNABLE.filter(s => game.properties[s.id].owner && !game.properties[s.id].mortgaged && !game.properties[s.id].houses && !game.properties[s.id].hotel);
    const space = spaceId ? BOARD_BY_ID[spaceId] : null;
    return (
      <Modal title="Mortgage Property" onClose={onClose} footer={<><Btn full onClick={onClose}>CANCEL</Btn><Btn full variant="brass" disabled={!spaceId} onClick={() => run(s => engineMortgage(s, spaceId))}>MORTGAGE</Btn></>}>
        <ErrorBanner message={err} />
        <Field label="Property"><Select value={spaceId} onChange={setSpaceId} options={mortgageable.map(s => ({ value: s.id, label: s.name }))} placeholder="Select property" /></Field>
        {space && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
            <Row label="Owner" value={findPlayer(game, game.properties[spaceId].owner).name} />
            <Row label="Mortgage Value" value={money(space.mortgage)} valueColor={C.good} />
          </div>
        )}
      </Modal>
    );
  }

  /* ---- UNMORTGAGE ---- */
  if (modal.type === "unmortgage") {
    const spaceId = modal.spaceId, setSpaceId = (v) => setModal({ ...modal, spaceId: Number(v) });
    const mortgaged = OWNABLE.filter(s => game.properties[s.id].mortgaged);
    const space = spaceId ? BOARD_BY_ID[spaceId] : null;
    const interest = space ? Math.round(space.mortgage * (game.rules.unmortgageInterestPct / 100)) : 0;
    return (
      <Modal title="Lift Mortgage" onClose={onClose} footer={<><Btn full onClick={onClose}>CANCEL</Btn><Btn full variant="brass" disabled={!spaceId} onClick={() => run(s => engineUnmortgage(s, spaceId))}>UNMORTGAGE</Btn></>}>
        <ErrorBanner message={err} />
        <Field label="Property"><Select value={spaceId} onChange={setSpaceId} options={mortgaged.map(s => ({ value: s.id, label: s.name }))} placeholder="Select property" /></Field>
        {space && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
            <Row label="Mortgage" value={money(space.mortgage)} />
            <Row label={`Interest (${game.rules.unmortgageInterestPct}%)`} value={money(interest)} />
            <Row label="Total Required" value={money(space.mortgage + interest)} valueColor={C.brassLight} />
          </div>
        )}
      </Modal>
    );
  }

  /* ---- BUILD ---- */
  if (modal.type === "build") {
    const spaceId = modal.spaceId, setSpaceId = (v) => setModal({ ...modal, spaceId: Number(v) });
    const buildable = OWNABLE.filter(s => s.type === "property" && game.properties[s.id].owner && isMonopoly(game, s.group, game.properties[s.id].owner));
    const space = spaceId ? BOARD_BY_ID[spaceId] : null;
    const ps = spaceId ? game.properties[spaceId] : null;
    return (
      <Modal title="Build Houses & Hotels" onClose={onClose}>
        <ErrorBanner message={err} />
        <Field label="Property (monopolies only)"><Select value={spaceId} onChange={setSpaceId} options={buildable.map(s => ({ value: s.id, label: `${s.name} (${GROUP_LABEL[s.group]})` }))} placeholder="Select property" /></Field>
        {space && ps && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <Row label="Current" value={ps.hotel ? "Hotel" : `${ps.houses} house${ps.houses === 1 ? "" : "s"}`} />
            <Row label="House Cost" value={money(space.houseCost)} />
          </div>
        )}
        {space && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Btn variant="good" disabled={ps.hotel || ps.houses >= 4} onClick={() => run(s => engineBuild(s, spaceId, "house"))}>+ Build House</Btn>
            <Btn variant="good" disabled={ps.hotel || ps.houses < 4} onClick={() => run(s => engineBuild(s, spaceId, "hotel"))}>+ Build Hotel</Btn>
            <Btn variant="danger" disabled={ps.hotel || ps.houses <= 0} onClick={() => run(s => engineBuild(s, spaceId, "sellHouse"))}>− Sell House</Btn>
            <Btn variant="danger" disabled={!ps.hotel} onClick={() => run(s => engineBuild(s, spaceId, "sellHotel"))}>− Sell Hotel</Btn>
          </div>
        )}
      </Modal>
    );
  }

  /* ---- JAIL ---- */
  if (modal.type === "jail") {
    const playerId = modal.playerId, setPlayerId = (v) => setModal({ ...modal, playerId: v });
    const player = playerId ? findPlayer(game, playerId) : null;
    const setJail = (val) => {
      const players = game.players.map(p => p.id === playerId ? { ...p, inJail: val } : p);
      let s = { ...game, players };
      s = pushHistory(s, { type: "jail", text: `${player.name} ${val ? "was sent to Jail" : "left Jail"}` });
      commit(s); setModal(null);
    };
    const payBail = () => {
      const r = engineTransfer(game, playerId, "bank", 50, "Jail bail");
      if (r.error) { setModal({ ...modal, _error: r.error }); return; }
      const players = r.state.players.map(p => p.id === playerId ? { ...p, inJail: false } : p);
      commit({ ...r.state, players }); setModal(null);
    };
    return (
      <Modal title="Jail" onClose={onClose}>
        <ErrorBanner message={err} />
        <Field label="Player"><Select value={playerId} onChange={setPlayerId} options={playerOptions} /></Field>
        {player && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ color: C.muted, fontSize: 13 }}>Status: <b style={{ color: player.inJail ? C.warn : C.good }}>{player.inJail ? "In Jail" : "Free"}</b></div>
            {!player.inJail && <Btn variant="danger" onClick={() => setJail(true)}>🚔 Send to Jail</Btn>}
            {player.inJail && (
              <>
                <Btn variant="good" onClick={() => setJail(false)}>✓ Left Jail (rolled doubles / used card)</Btn>
                <Btn onClick={payBail}>💵 Pay $50 Bail</Btn>
              </>
            )}
          </div>
        )}
      </Modal>
    );
  }

  /* ---- CARD (Chance/Community Chest transaction assistant) ---- */
  if (modal.type === "card") {
    const mode = modal.mode || "receive";
    const playerId = modal.playerId, setPlayerId = (v) => setModal({ ...modal, playerId: v });
    const otherId = modal.otherId, setOtherId = (v) => setModal({ ...modal, otherId: v });
    const amount = Number(modal.amount) || 0, setAmount = (v) => setModal({ ...modal, amount: v });
    const modes = [
      { id: "receive", label: "Receive from Bank" }, { id: "pay", label: "Pay Bank" },
      { id: "payPlayer", label: "Pay Player" }, { id: "receivePlayer", label: "Receive from Player" },
      { id: "custom", label: "Custom (between players)" },
    ];
    const needsOther = ["payPlayer", "receivePlayer", "custom"].includes(mode);
    const doIt = () => {
      let from = "bank", to = "bank";
      if (mode === "receive") to = playerId;
      if (mode === "pay") from = playerId;
      if (mode === "payPlayer") { from = playerId; to = otherId; }
      if (mode === "receivePlayer") { from = otherId; to = playerId; }
      if (mode === "custom") { from = playerId; to = otherId; }
      run(s => engineTransfer(s, from, to, amount, "Chance / Community Chest"));
    };
    return (
      <Modal title="Chance / Community Chest" subtitle="Draw the physical card, then apply its effect here." onClose={onClose} footer={
        <><Btn full onClick={onClose}>CANCEL</Btn><Btn full variant="brass" disabled={!playerId || !amount || (needsOther && !otherId)} onClick={doIt}>APPLY</Btn></>
      }>
        <ErrorBanner message={err} />
        <Field label="Effect">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {modes.map(m => (
              <button key={m.id} onClick={() => setModal({ ...modal, mode: m.id })} style={{
                padding: "10px 8px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                background: mode === m.id ? "rgba(201,162,75,0.18)" : C.card, border: `1px solid ${mode === m.id ? C.brass : C.border}`, color: mode === m.id ? C.brassLight : C.muted,
              }}>{m.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Player"><Select value={playerId} onChange={setPlayerId} options={playerOptions} placeholder="Select player" /></Field>
        {needsOther && <Field label="Other Player"><Select value={otherId} onChange={setOtherId} options={playerOptions.filter(o => o.value !== playerId)} placeholder="Select player" /></Field>}
        <Field label="Amount"><input type="number" style={inputStyle} value={modal.amount ?? ""} onChange={e => setAmount(e.target.value)} placeholder="As printed on the card" /></Field>
      </Modal>
    );
  }

  /* ---- TRADE ---- */
  if (modal.type === "trade") {
    const aId = modal.aId, setAId = (v) => setModal({ ...modal, aId: v, aProps: [] });
    const bId = modal.bId, setBId = (v) => setModal({ ...modal, bId: v, bProps: [] });
    const aCash = Number(modal.aCash) || 0, setACash = (v) => setModal({ ...modal, aCash: v });
    const bCash = Number(modal.bCash) || 0, setBCash = (v) => setModal({ ...modal, bCash: v });
    const aProps = modal.aProps || [], bProps = modal.bProps || [];
    const toggle = (side, id) => {
      const key = side === "a" ? "aProps" : "bProps";
      const cur = modal[key] || [];
      setModal({ ...modal, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
    };
    const A = aId ? findPlayer(game, aId) : null, B = bId ? findPlayer(game, bId) : null;
    const aOwned = A ? playerProperties(game, A.id) : [];
    const bOwned = B ? playerProperties(game, B.id) : [];
    const canComplete = A && B && A.id !== B.id && (aProps.length || bProps.length || aCash || bCash);
    const doComplete = () => {
      run(s => engineCompleteTrade(s, { a: { playerId: A.id, cash: aCash, propertyIds: aProps }, b: { playerId: B.id, cash: bCash, propertyIds: bProps } }));
    };
    return (
      <Modal title="Trade Center" onClose={onClose} width={560} footer={<><Btn full onClick={onClose}>CANCEL</Btn><Btn full variant="brass" disabled={!canComplete} onClick={doComplete}>COMPLETE TRADE</Btn></>}>
        <ErrorBanner message={err} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <Field label="Player A"><Select value={aId} onChange={setAId} options={playerOptions.filter(o => o.value !== bId)} placeholder="Select" /></Field>
            {A && <>
              <Field label={`${A.name} offers cash`}><input type="number" style={inputStyle} value={modal.aCash ?? ""} onChange={e => setACash(e.target.value)} placeholder="$0" /></Field>
              <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, marginBottom: 6 }}>PROPERTIES OFFERED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {aOwned.map(s => (
                  <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.cream, cursor: "pointer" }}>
                    <input type="checkbox" checked={aProps.includes(s.id)} onChange={() => toggle("a", s.id)} /> {s.name}{game.properties[s.id].mortgaged ? " (mortgaged)" : ""}
                  </label>
                ))}
                {aOwned.length === 0 && <div style={{ color: C.mutedDim, fontSize: 12 }}>No properties.</div>}
              </div>
            </>}
          </div>
          <div>
            <Field label="Player B"><Select value={bId} onChange={setBId} options={playerOptions.filter(o => o.value !== aId)} placeholder="Select" /></Field>
            {B && <>
              <Field label={`${B.name} offers cash`}><input type="number" style={inputStyle} value={modal.bCash ?? ""} onChange={e => setBCash(e.target.value)} placeholder="$0" /></Field>
              <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, marginBottom: 6 }}>PROPERTIES OFFERED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {bOwned.map(s => (
                  <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.cream, cursor: "pointer" }}>
                    <input type="checkbox" checked={bProps.includes(s.id)} onChange={() => toggle("b", s.id)} /> {s.name}{game.properties[s.id].mortgaged ? " (mortgaged)" : ""}
                  </label>
                ))}
                {bOwned.length === 0 && <div style={{ color: C.mutedDim, fontSize: 12 }}>No properties.</div>}
              </div>
            </>}
          </div>
        </div>
        {canComplete && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14, marginTop: 16, fontSize: 13, color: C.cream, lineHeight: 1.6 }}>
            <b style={{ color: C.brassLight }}>Summary:</b> {A.name} gives {aProps.length ? aProps.map(id => BOARD_BY_ID[id].name).join(", ") : "nothing"}{aCash ? ` + ${money(aCash)}` : ""} → {B.name} gives {bProps.length ? bProps.map(id => BOARD_BY_ID[id].name).join(", ") : "nothing"}{bCash ? ` + ${money(bCash)}` : ""}.
          </div>
        )}
      </Modal>
    );
  }

  /* ---- BANKRUPT quick-launch (choose player first) ---- */
  if (modal.type === "bankrupt" && !modal.playerId) {
    return (
      <Modal title="Bankruptcy" onClose={onClose} footer={<Btn full onClick={onClose}>CANCEL</Btn>}>
        <ErrorBanner message={err} />
        <Field label="Which player is in financial trouble?">
          <Select value="" onChange={(v) => setModal({ ...modal, playerId: v })} options={playerOptions} placeholder="Select player" />
        </Field>
      </Modal>
    );
  }

  /* ---- BANKRUPTCY workflow (with a known shortfall) ---- */
  if (modal.type === "bankrupt") {
    const player = findPlayer(game, modal.playerId);
    const creditorId = modal.creditorId || "bank";
    const owed = modal.amountOwed || 0;
    const shortfall = Math.max(0, owed - player.cash);
    const [screen, setScreen] = [modal.screen || "options", (v) => setModal({ ...modal, screen: v })];

    const declare = () => {
      let s = engineDeclareBankruptcy(game, player.id, creditorId, modal.cause);
      const finalActive = s.state.players.filter(p => !p.bankrupt);
      commit(s.state, { skipEndCheck: false });
      setModal(null);
    };

    return (
      <Modal title="Payment Required" onClose={onClose}>
        <ErrorBanner message={err} />
        {owed > 0 && (
          <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Row label="Amount owed" value={money(owed)} />
            <Row label="Available cash" value={money(player.cash)} />
            <Row label="Shortfall" value={money(shortfall)} valueColor={C.bad} />
          </div>
        )}
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>{player.name} can't cover this. Choose how to proceed — bankruptcy is never automatic.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn variant="good" onClick={() => setModal({ type: "mortgage" })}>🏦 Raise Money — Mortgage a Property</Btn>
          <Btn variant="good" onClick={() => setModal({ type: "build", _hint: "sell" })}>🏘️ Raise Money — Sell Houses</Btn>
          <Btn onClick={() => setModal({ type: "trade" })}>🔄 Raise Money — Trade</Btn>
          <Btn variant="danger" onClick={declare}>💀 Declare Bankruptcy{creditorId !== "bank" ? ` to ${findPlayer(game, creditorId)?.name}` : " to the Bank"}</Btn>
        </div>
      </Modal>
    );
  }

  /* ---- PROPERTY DETAIL ---- */
  if (modal.type === "propertyDetail") {
    const space = BOARD_BY_ID[modal.spaceId];
    const ps = game.properties[modal.spaceId];
    const owner = ps.owner ? findPlayer(game, ps.owner) : null;
    const currentRent = ps.owner ? calcRent(game, modal.spaceId, 7) : null;
    const color = space.group ? GROUP_COLORS[space.group] : (space.type === "railroad" ? C.brass : "#8FD3D8");
    return (
      <Modal title={space.name} subtitle={space.group ? GROUP_LABEL[space.group] : (space.type === "railroad" ? "Railroad" : "Utility")} onClose={onClose}>
        <div style={{ height: 8, background: color, borderRadius: 4, marginBottom: 16 }} />
        <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <Row label="Purchase Price" value={money(space.price)} />
          <Row label="Owner" value={owner ? owner.name : "Unowned"} />
          <Row label="Mortgage" value={ps.mortgaged ? "Yes" : "No"} valueColor={ps.mortgaged ? C.bad : C.cream} />
          {space.type === "property" && <Row label="Houses" value={ps.hotel ? "—" : ps.houses} />}
          {space.type === "property" && <Row label="Hotel" value={ps.hotel ? "Yes" : "No"} />}
          {ps.owner && !ps.mortgaged && <Row label="Current Rent" value={money(currentRent)} valueColor={C.brassLight} />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ps.owner && !ps.mortgaged && <Btn onClick={() => setModal({ type: "rent", spaceId: modal.spaceId })}>PAY RENT</Btn>}
          {ps.owner && !ps.mortgaged && !ps.houses && !ps.hotel && <Btn onClick={() => setModal({ type: "mortgage", spaceId: modal.spaceId })}>MORTGAGE</Btn>}
          {ps.mortgaged && <Btn onClick={() => setModal({ type: "unmortgage", spaceId: modal.spaceId })}>UNMORTGAGE</Btn>}
          {!ps.owner && <Btn variant="brass" onClick={() => setModal({ type: "buy", spaceId: modal.spaceId })}>BUY</Btn>}
          {ps.owner && space.type === "property" && <Btn onClick={() => setModal({ type: "build", spaceId: modal.spaceId })}>BUILD</Btn>}
          {ps.owner && <Btn onClick={() => setModal({ type: "trade" })}>TRADE</Btn>}
        </div>
      </Modal>
    );
  }

  return null;
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13.5 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span className="font-mono" style={{ color: valueColor || C.cream, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* -------------------------------- END GAME SCREEN ----------------------------- */
function EndGameScreen({ game, onExit }) {
  const winner = findPlayer(game, game.winnerId);
  const sorted = [...game.players].sort((a, b) => netWorth(game, b.id) - netWorth(game, a.id));
  const duration = new Date(game.lastPlayed) - new Date(game.startTime);
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1000px 500px at 50% 0%, ${C.bgSoft}, ${C.bg})`, padding: "50px 20px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }} className="anim-rise">
        <div style={{ fontSize: 44 }}>🏆</div>
        <div style={{ color: C.brass, letterSpacing: 3, fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>GAME OVER</div>
        <h1 className="font-display" style={{ color: C.cream, fontSize: 32, margin: "8px 0 2px" }}>{winner.name} wins!</h1>
        <div style={{ fontSize: 30, margin: "6px 0" }}><PlayerBadge player={winner} size={30} /></div>
        <div style={{ display: "flex", justifyContent: "center", gap: 22, margin: "20px 0 30px" }}>
          <div><div className="font-mono" style={{ color: C.good, fontSize: 20, fontWeight: 700 }}>{money(winner.cash)}</div><div style={{ color: C.muted, fontSize: 11 }}>CASH</div></div>
          <div><div className="font-mono" style={{ color: C.cream, fontSize: 20, fontWeight: 700 }}>{playerProperties(game, winner.id).length}</div><div style={{ color: C.muted, fontSize: 11 }}>PROPERTIES</div></div>
          <div><div className="font-mono" style={{ color: C.brassLight, fontSize: 20, fontWeight: 700 }}>{money(netWorth(game, winner.id))}</div><div style={{ color: C.muted, fontSize: 11 }}>NET WORTH</div></div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, textAlign: "left", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>FINAL STANDINGS</div>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < sorted.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
              <span style={{ color: C.cream, fontSize: 13.5 }}>#{i + 1} <PlayerBadge player={p} size={14} /> {p.name}{p.bankrupt ? " (bankrupt)" : ""}</span>
              <span className="font-mono" style={{ color: C.muted, fontSize: 13 }}>{money(netWorth(game, p.id))}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, color: C.mutedDim, fontSize: 12 }}>Duration {fmtDuration(duration)} · {game.turn} turns · {game.history.length} transactions</div>
        </div>
        <Btn full variant="brass" size="lg" onClick={onExit}>DONE</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------- APP ------------------------------------ */
export default function App() {
  const [screen, setScreen] = useState("loading"); // loading | home | setup | saved | game
  const [games, setGames] = useState([]);
  const [game, setGame] = useState(null);
  const [themeMode, setThemeModeState] = useState(getStoredThemeMode); // dark | light | system
  const [, forceThemeRepaint] = useState(0);

  const applyTheme = useCallback((mode) => {
    Object.assign(C, THEMES[resolveThemeMode(mode)]);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", C.bg);
    forceThemeRepaint(t => t + 1);
  }, []);

  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    try { localStorage.setItem("mb-theme", mode); } catch {}
    applyTheme(mode);
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(themeMode);
    if (themeMode !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshIndex = useCallback(async () => {
    const idx = await STORE.listIndex();
    idx.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
    setGames(idx);
    return idx;
  }, []);

  useEffect(() => { refreshIndex().then(() => setScreen("home")); }, [refreshIndex]);

  // Android hardware back button (Capacitor only — no-op in a regular browser).
  // Top-level rule: any non-home screen goes back to Home; on Home, confirm exit.
  useEffect(() => {
    if (!window.Capacitor) return;
    let remove;
    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      const sub = await CapApp.addListener("backButton", () => {
        if (screen !== "home") {
          setScreen("home");
          refreshIndex();
        } else if (window.confirm("Exit Monopoly Banker?")) {
          CapApp.exitApp();
        }
      });
      remove = () => sub.remove();
    })();
    return () => { if (remove) remove(); };
  }, [screen, refreshIndex]);

  const openGame = async (id) => {
    const g = await STORE.loadGame(id);
    if (g) { setGame(g); setScreen("game"); }
  };
  const duplicateGame = async (id) => {
    const g = await STORE.loadGame(id);
    if (!g) return;
    const copy = { ...g, id: uid(), name: g.name + " (Copy)", createdAt: nowISO(), lastPlayed: nowISO() };
    await STORE.saveGame(copy);
    refreshIndex();
  };
  const deleteGame = async (id) => { await STORE.deleteGame(id); refreshIndex(); };
  const launchNewGame = async ({ name, players, startCash }) => {
    const g = makeNewGameState({ name, players, startCash });
    await STORE.saveGame(g);
    setGame(g);
    setScreen("game");
    refreshIndex();
  };

  if (screen === "loading") {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>{FONTS}Loading…</div>;
  }

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {FONTS}
      {screen === "home" && (
        <HomeScreen games={games} onNewGame={() => setScreen("setup")} onContinue={openGame} onOpenSaved={() => setScreen("saved")} themeMode={themeMode} setThemeMode={setThemeMode} />
      )}
      {screen === "setup" && (
        <SetupWizard onCancel={() => setScreen("home")} onLaunch={launchNewGame} themeMode={themeMode} setThemeMode={setThemeMode} />
      )}
      {screen === "saved" && (
        <SavedGamesScreen games={games} onBack={() => setScreen("home")} onContinue={openGame} onDuplicate={duplicateGame} onDelete={deleteGame} themeMode={themeMode} setThemeMode={setThemeMode} />
      )}
      {screen === "game" && game && (
        <GameScreen game={game} setGame={setGame} onExit={async () => { await refreshIndex(); setScreen("home"); }} themeMode={themeMode} setThemeMode={setThemeMode} />
      )}
    </div>
  );
}
