/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Settings as SettingsType, AppView, ThemeMode } from "../types";
import { PEN_PRESETS } from "../constants/colors";
import { PALETTES, getPaletteById } from "../constants/palettes";
import { Save, AlertCircle, Settings as SettingsIcon, SunMedium, Moon, MonitorSmartphone, Sparkles, Eye, EyeOff, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { validateGeminiKey } from "../utils/aiInsights";

interface SettingsViewProps {
  initialSettings: SettingsType;
  onSave: (settings: SettingsType) => void;
  onCancel: () => void;
  // A callback to update parent state in real time as the user drags
  onColorChangeLive: (color: string) => void;
}

// HSL to hex converter
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Hex to HSL parser
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((x) => x + x).join("");
  }
  let r = parseInt(hex.slice(0, 2), 16) / 255;
  let g = parseInt(hex.slice(2, 4), 16) / 255;
  let b = parseInt(hex.slice(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { h: 48, s: 100, l: 92 }; // fallback yellow
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export default function SettingsView({
  initialSettings,
  onSave,
  onCancel,
  onColorChangeLive,
}: SettingsViewProps) {
  const [selectedPostItColor, setSelectedPostItColor] = useState(initialSettings.postItColor);
  const [selectedPenColor, setSelectedPenColor] = useState(initialSettings.penColor);
  const [selectedFont, setSelectedFont] = useState(initialSettings.fontFamily);
  const [selectedPaletteId, setSelectedPaletteId] = useState(initialSettings.paletteId || "pastel");
  const [paperTextureEnabled, setPaperTextureEnabled] = useState(
    initialSettings.paperTexture === undefined ? true : initialSettings.paperTexture
  );
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(initialSettings.theme || "system");

  // BYOK for AI Insights (fallback on browsers without Chrome Built-in AI)
  const [aiSectionOpen, setAiSectionOpen] = useState(!!initialSettings.geminiApiKey);
  const [geminiKey, setGeminiKey] = useState(initialSettings.geminiApiKey || "");
  const [showKey, setShowKey] = useState(false);
  const [keyTestState, setKeyTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [keyTestMsg, setKeyTestMsg] = useState("");

  const activePalette = getPaletteById(selectedPaletteId);

  const [hexInput, setHexInput] = useState(initialSettings.postItColor);
  const [isHexError, setIsHexError] = useState(false);

  const wheelRef = useRef<HTMLDivElement>(null);
  const [isWheelDragging, setIsWheelDragging] = useState(false);

  // Position coordinates of selecting indicator dot on color wheel
  const [dotPos, setDotPos] = useState({ x: 88, y: 88 }); // central offset

  // Refresh picker selector dot position based on selected post-it color
  useEffect(() => {
    const { h, s } = hexToHsl(selectedPostItColor);
    const radius = 80; // half of wheel width minus padding
    const angleRad = (h * Math.PI) / 180;
    
    // Scale distance based on saturation
    const dist = (s / 100) * radius;
    // Align with 12 o'clock starting position of the conic gradient (rotating clockwise):
    const x = 88 + dist * Math.sin(angleRad);
    const y = 88 - dist * Math.cos(angleRad);
    
    setDotPos({ x, y });
  }, [selectedPostItColor]);

  // Live updates hex input if color changes
  useEffect(() => {
    setHexInput(selectedPostItColor);
    setIsHexError(false);
  }, [selectedPostItColor]);

  // Handler for custom dragging on color wheel
  const handleColorWheelInteraction = (clientX: number, clientY: number) => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const rect = wheel.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const maxRadius = cx - 8; // clamp boundary padding

    // Angle of selection starting at 12 o'clock and moving clockwise:
    let angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    // Saturation level (distance from center)
    const sat = Math.round(Math.min((dist / maxRadius) * 100, 100));

    // Maintain vibrant yet pastel tones
    const finalLightness = 72; 

    // Convert selection coordinates to pastel hex
    const finalHex = hslToHex(angleDeg, sat, finalLightness);
    
    setSelectedPostItColor(finalHex);
    onColorChangeLive(finalHex);
  };

  // Drag listeners on Window level for smooth visual tracker mapping
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isWheelDragging) {
        handleColorWheelInteraction(e.clientX, e.clientY);
      }
    };

    const handleGlobalUp = () => {
      if (isWheelDragging) {
        setIsWheelDragging(false);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isWheelDragging && e.touches.length > 0) {
        const touch = e.touches[0];
        handleColorWheelInteraction(touch.clientX, touch.clientY);
      }
    };

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchmove", handleGlobalTouchMove);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [isWheelDragging]);

  // User Preset Swatches Click
  const handlePresetSelect = (hex: string) => {
    setSelectedPostItColor(hex);
    onColorChangeLive(hex);
  };

  // Keyboard hex field change fallback
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHexInput(value);

    // Parse values like "#abc", "abc", "#abcdef", "abcdef"
    const hexPattern = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    if (hexPattern.test(value)) {
      setIsHexError(false);
      let formatted = value;
      if (!formatted.startsWith("#")) {
        formatted = "#" + formatted;
      }
      setSelectedPostItColor(formatted.toLowerCase());
      onColorChangeLive(formatted.toLowerCase());
    } else {
      setIsHexError(true);
    }
  };

  // Save Settings Clicked
  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHexError) return;

    onSave({
      postItColor: selectedPostItColor,
      penColor: selectedPenColor,
      fontFamily: selectedFont,
      paletteId: selectedPaletteId,
      paperTexture: paperTextureEnabled,
      theme: selectedTheme,
      geminiApiKey: geminiKey.trim() || undefined,
    });
  };

  // Test the pasted Gemini key with a tiny ping — one-shot, doesn't block save.
  const handleTestKey = async () => {
    const trimmed = geminiKey.trim();
    if (!trimmed) return;
    setKeyTestState("testing");
    setKeyTestMsg("");
    try {
      const ok = await validateGeminiKey(trimmed);
      if (ok) {
        setKeyTestState("ok");
        setKeyTestMsg("Chave OK — pronto pra usar!");
      } else {
        setKeyTestState("fail");
        setKeyTestMsg("Chave inválida ou sem quota. Confirme em Google AI Studio.");
      }
    } catch (err: any) {
      setKeyTestState("fail");
      setKeyTestMsg(String(err?.message || err));
    }
  };

  const THEME_OPTIONS: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: "light",  label: "Light",  icon: <SunMedium className="w-4 h-4" /> },
    { id: "dark",   label: "Dark",   icon: <Moon className="w-4 h-4" /> },
    { id: "system", label: "Auto",   icon: <MonitorSmartphone className="w-4 h-4" /> },
  ];

  return (
    <form
      onSubmit={handleSaveClick}
      id="settings-container-form"
      className="w-full max-w-md mx-auto py-6 px-4 select-none"
    >
      {/* Translucent Frosted Glass Card Panel */}
      <div
        id="settings-card-panel"
        className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border border-white/40 dark:border-slate-800/40 rounded-3xl p-6 md:p-8 flex flex-col gap-6"
        style={{
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)"
        }}
      >
        {/* Title */}
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/50" id="settings-header">
          <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-300 animate-spin-slow" />
          <h2 className="font-sans font-bold text-lg text-slate-800 dark:text-slate-100">
            Appearance
          </h2>
        </div>

        {/* Section -1: Light/Dark Theme Selector */}
        <div className="flex flex-col gap-2" id="settings-section-theme">
          <label className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
            App Theme
          </label>
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl" id="settings-theme-segment">
            {THEME_OPTIONS.map((opt) => (
              <button
                id={`theme-option-${opt.id}`}
                key={opt.id}
                type="button"
                aria-label={`${opt.label} theme`}
                onClick={() => setSelectedTheme(opt.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedTheme === opt.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 0: Palette Theme Selector */}
        <div className="flex flex-col gap-2" id="settings-section-palette">
          <label className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
            Color Palette Theme
          </label>
          <div className="flex flex-wrap gap-2 py-1" id="settings-palette-row">
            {PALETTES.map((palette) => {
              const isSelected = selectedPaletteId === palette.id;
              return (
                <button
                  id={`palette-${palette.id}`}
                  key={palette.id}
                  type="button"
                  aria-label={`Select ${palette.name} palette`}
                  onClick={() => setSelectedPaletteId(palette.id)}
                  className={`flex flex-col items-start gap-1 px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-slate-800 bg-slate-50 dark:bg-slate-800 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-0.5">
                    {palette.colors.map((c) => (
                      <span
                        key={c.hex}
                        className="w-3.5 h-3.5 rounded-full border border-black/5"
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    {palette.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 1: Preset Colors Selection (from active palette) */}
        <div className="flex flex-col gap-2" id="settings-section-postitcolor">
          <label className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
            Post-it Color
          </label>
          <div className="flex items-center gap-3 py-1" id="settings-preset-colors-row">
            {activePalette.colors.map((preset) => (
              <button
                id={`preset-color-${preset.name}`}
                key={preset.hex}
                type="button"
                aria-label={`Select ${preset.name} Background`}
                onClick={() => handlePresetSelect(preset.hex)}
                className={`w-9 h-9 rounded-full border-2 transition-all cursor-pointer shadow-sm shrink-0 hover:scale-105 active:scale-95 ${
                  selectedPostItColor === preset.hex
                    ? "border-slate-800 scale-105 shadow"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
          </div>
        </div>

        {/* Custom Visual HSL Color Wheel with Conic Gradient */}
        <div className="flex flex-col items-center justify-center gap-4 bg-slate-50/50 dark:bg-slate-950/20 py-5 rounded-2xl border border-slate-100" id="color-wheel-wrapper">
          <div
            id="color-wheel-ring"
            ref={wheelRef}
            onMouseDown={(e) => {
              setIsWheelDragging(true);
              handleColorWheelInteraction(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              setIsWheelDragging(true);
              const touch = e.touches[0];
              handleColorWheelInteraction(touch.clientX, touch.clientY);
            }}
            className="relative w-44 h-44 rounded-full border-4 border-white dark:border-slate-800 shadow-lg cursor-crosshair overflow-hidden touch-none"
            style={{
              // conic-gradient and radial-gradient combined to render a pastel wheel palette
              background: `
                radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.1) 85%, rgba(255,255,255,0) 100%),
                conic-gradient(from 0deg, #ff9999, #ffff99, #99ff99, #99ffff, #9999ff, #ff99ff, #ff9999)
              `,
            }}
          >
            {/* Visual Selector Dot indicator */}
            <div
              id="color-wheel-picker-dot"
              className="absolute w-5 h-5 -mt-2.5 -ml-2.5 rounded-full border-2 border-slate-800 bg-white shadow-md pointer-events-none transition-[width,height] active:w-6 active:h-6"
              style={{
                left: `${dotPos.x}px`,
                top: `${dotPos.y}px`,
              }}
            />
          </div>

          {/* Color Live Preview & Manual Hex Fallback Form Input */}
          <div className="flex items-center gap-3 w-full px-5" id="color-wheel-preview-row">
            {/* Live preview dot */}
            <div
              id="color-wheel-preview-dot"
              aria-hidden="true"
              className="w-10 h-10 rounded-xl border border-slate-200 shadow-md shrink-0 transition-colors duration-200"
              style={{ backgroundColor: selectedPostItColor }}
            />

            {/* Hex fallback input with label for keyboards */}
            <div className="flex-1 flex flex-col gap-1" id="hex-fallback-input-container">
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Hex Code Fallback
              </span>
              <div className="relative">
                <input
                  id="settings-color-input-hex"
                  type="text"
                  maxLength={7}
                  className={`w-full font-mono text-sm px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-900 focus:outline-none ${
                    isHexError
                      ? "border-red-400 focus:ring-1 focus:ring-red-400 text-red-500"
                      : "border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 text-slate-800 dark:text-slate-100"
                  }`}
                  value={hexInput}
                  onChange={handleHexInputChange}
                  placeholder="#fef3c7"
                  aria-label="Hex color fallback value"
                />
                {isHexError && (
                  <AlertCircle className="w-4 h-4 text-red-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pen Color (3 presets) */}
        <div className="flex flex-col gap-2" id="settings-section-pencolor">
          <label className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
            Pen Color
          </label>
          <div className="flex items-center gap-4 py-1" id="settings-pen-presets-row">
            {PEN_PRESETS.map((pen) => (
              <button
                id={`pen-color-${pen.label}`}
                key={pen.label}
                type="button"
                aria-label={`Select ${pen.label} Ink`}
                onClick={() => setSelectedPenColor(pen.hex)}
                className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer shadow-sm relative shrink-0 hover:scale-105 active:scale-95 flex items-center justify-center ${
                  selectedPenColor === pen.hex
                    ? "border-slate-800 bg-slate-50 dark:bg-slate-800 scale-105"
                    : "border-slate-200 dark:border-slate-800 bg-transparent"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: pen.hex }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Typography Selection */}
        <div className="flex flex-col gap-2" id="settings-section-font">
          <label className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
            Pen Font Family
          </label>
          <select
            id="settings-select-font-family"
            aria-label="Choose font style"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 text-slate-800 dark:text-slate-100 shadow-sm cursor-pointer"
            value={selectedFont}
            onChange={(e) => setSelectedFont(e.target.value)}
          >
            <option value="sans-serif" className="font-default py-2" id="font-option-sans">
              Default Sans-serif (Arial)
            </option>
            <option value="serif" className="font-elegant py-2" id="font-option-serif">
              Elegant Serif (Times)
            </option>
            <option value="cursive" className="font-handwritten py-2" id="font-option-handwritten">
              Handwritten (Gloria Hallelujah)
            </option>
          </select>
        </div>

        {/* Section 4: Paper Texture Toggle */}
        <div className="flex items-center justify-between gap-3" id="settings-section-papertexture">
          <div className="flex flex-col">
            <label htmlFor="settings-toggle-papertexture" className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
              Paper Texture
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Shader-rendered grain. Each palette has its own paper feel.
            </span>
          </div>
          <button
            id="settings-toggle-papertexture"
            type="button"
            role="switch"
            aria-checked={paperTextureEnabled}
            onClick={() => setPaperTextureEnabled((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer ${
              paperTextureEnabled ? "bg-slate-800 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-200 shadow transition-transform duration-200 ${
                paperTextureEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Section 5: AI Insights (advanced / opt-in). Chrome Built-in AI runs
            without a key; other browsers can paste a free Gemini API key. */}
        <div className="flex flex-col gap-2" id="settings-section-ai">
          <button
            type="button"
            onClick={() => setAiSectionOpen((v) => !v)}
            className="flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <label className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                Advanced: sua própria chave de IA
              </label>
            </div>
            {aiSectionOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {aiSectionOpen && (
            <div className="flex flex-col gap-2.5 mt-1 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                O Coach IA já funciona automaticamente, sem configurar nada. Esta opção é só pra quem
                prefere usar a própria chave da Gemini API em vez da nossa. A chave fica só neste dispositivo.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="settings-input-gemini-key"
                    type={showKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      setKeyTestState("idle");
                      setKeyTestMsg("");
                    }}
                    placeholder="AIza... (cole sua Gemini API key)"
                    className="w-full font-mono text-xs px-3 py-2 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 dark:text-slate-100"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {geminiKey && (
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? "Hide key" : "Show key"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={!geminiKey.trim() || keyTestState === "testing"}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-[11px] font-semibold cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {keyTestState === "testing" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Testar
                </button>
              </div>

              {keyTestState === "ok" && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {keyTestMsg}
                </div>
              )}
              {keyTestState === "fail" && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-medium">
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{keyTestMsg}</span>
                </div>
              )}

              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline w-fit"
              >
                Obter chave grátis no Google AI Studio →
              </a>
            </div>
          )}
        </div>

        {/* Action Form Footer (Save & cancel buttons) */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-200/50" id="settings-actions">
          <button
            id="settings-btn-cancel"
            type="button"
            aria-label="Cancel changes"
            onClick={onCancel}
            className="flex-1 text-center py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-all shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            id="settings-btn-submit"
            type="submit"
            aria-label="Save changes"
            disabled={isHexError}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow text-white cursor-pointer ${
              isHexError
                ? "bg-slate-300 pointer-events-none"
                : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </form>
  );
}
