"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type ShirtPreset = {
  id: string;
  name: string;
  colorHex: string;
  viewSide: "FRONT" | "BACK";
  isDark: boolean;
};

const shirtPresets: ShirtPreset[] = [
  { id: "black-front", name: "Black Shirt (Front)", colorHex: "#18181b", viewSide: "FRONT", isDark: true },
  { id: "black-back", name: "Black Shirt (Back)", colorHex: "#18181b", viewSide: "BACK", isDark: true },
  { id: "white-front", name: "White Shirt (Front)", colorHex: "#f8fafc", viewSide: "FRONT", isDark: false },
  { id: "white-back", name: "White Shirt (Back)", colorHex: "#f8fafc", viewSide: "BACK", isDark: false },
  { id: "navy-front", name: "Navy Blue (Front)", colorHex: "#0f172a", viewSide: "FRONT", isDark: true },
  { id: "grey-front", name: "Heather Grey (Front)", colorHex: "#94a3b8", viewSide: "FRONT", isDark: false },
  { id: "olive-front", name: "Olive Green (Front)", colorHex: "#3f6212", viewSide: "FRONT", isDark: true },
];

type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-burn" | "hard-light" | "difference";

type Layer = {
  id: string;
  name: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  blendMode: BlendMode;
  opacity: number; // 0 to 1
  removeWhiteBg: boolean;
  removeBlackBg: boolean;
  bgThreshold: number; // 0 to 255
  flipX: boolean;
  flipY: boolean;
};

export default function MockupStudioPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ShirtPreset>(shirtPresets[0]);
  const [customShirtImg, setCustomShirtImg] = useState<HTMLImageElement | null>(null);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [layerStartPos, setLayerStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Save / Export Modal
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "GRAPHIC_TEE",
    regularSellingPrice: 1300,
    dropShoulderSellingPrice: 1600,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeLayer = layers.find((l) => l.id === activeLayerId) || null;

  // Render Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Shirt Mockup Base
    if (customShirtImg) {
      ctx.drawImage(customShirtImg, 0, 0, width, height);
    } else {
      drawDefaultShirtBase(ctx, width, height, selectedPreset);
    }

    // 2. Draw Printable Bounding Area Guide
    ctx.save();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    const printBox = { x: width * 0.26, y: height * 0.2, w: width * 0.48, h: height * 0.6 };
    ctx.strokeRect(printBox.x, printBox.y, printBox.w, printBox.h);

    ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Print Area (${selectedPreset.viewSide})`, printBox.x + 8, printBox.y + 18);
    ctx.restore();

    // 3. Render Artwork Layers
    layers.forEach((layer) => {
      ctx.save();

      // Apply Layer Opacity & Blend Mode
      ctx.globalAlpha = layer.opacity;
      const compositeMode: GlobalCompositeOperation = layer.blendMode === "normal" ? "source-over" : (layer.blendMode as GlobalCompositeOperation);
      ctx.globalCompositeOperation = compositeMode;

      // Translate to Layer Center for Rotation & Scale
      const centerX = layer.x + layer.width / 2;
      const centerY = layer.y + layer.height / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);

      // Process Image with White/Black Background Removal if enabled
      let renderImage: CanvasImageSource = layer.img;
      if (layer.removeWhiteBg || layer.removeBlackBg) {
        renderImage = processImageKeying(layer.img, layer.removeWhiteBg, layer.removeBlackBg, layer.bgThreshold);
      }

      ctx.drawImage(renderImage, -layer.width / 2, -layer.height / 2, layer.width, layer.height);

      ctx.restore();

      // 4. Draw Active Selection Outline & Handles
      if (layer.id === activeLayerId) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);

        // Corner Handles
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#2563eb";
        const handleSize = 10;
        const corners = [
          { x: -layer.width / 2, y: -layer.height / 2 },
          { x: layer.width / 2, y: -layer.height / 2 },
          { x: -layer.width / 2, y: layer.height / 2 },
          { x: layer.width / 2, y: layer.height / 2 },
        ];
        corners.forEach((c) => {
          ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        });

        // Rotation Handle Top Center
        ctx.beginPath();
        ctx.moveTo(0, -layer.height / 2);
        ctx.lineTo(0, -layer.height / 2 - 24);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -layer.height / 2 - 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    });
  }, [layers, activeLayerId, selectedPreset, customShirtImg]);

  // Draw Procedural High-Res Shirt Vector Mockup Base
  function drawDefaultShirtBase(ctx: CanvasRenderingContext2D, w: number, h: number, preset: ShirtPreset) {
    ctx.save();

    // Background Container
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, w, h);

    // Shirt Body Path
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.12); // Left Neck
    ctx.quadraticCurveTo(w * 0.5, h * 0.18, w * 0.7, h * 0.12); // Collar Curve
    ctx.lineTo(w * 0.88, h * 0.22); // Right Shoulder
    ctx.lineTo(w * 0.78, h * 0.42); // Right Sleeve
    ctx.lineTo(w * 0.7, h * 0.38); // Right Armpit
    ctx.lineTo(w * 0.72, h * 0.88); // Bottom Right Hem
    ctx.lineTo(w * 0.28, h * 0.88); // Bottom Left Hem
    ctx.lineTo(w * 0.3, h * 0.38); // Left Armpit
    ctx.lineTo(w * 0.22, h * 0.42); // Left Sleeve
    ctx.lineTo(w * 0.12, h * 0.22); // Left Shoulder
    ctx.closePath();

    // Base Color Fill & Shadow
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = preset.colorHex;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = preset.isDark ? "#27272a" : "#cbd5e1";
    ctx.stroke();

    // Collar Ribbing
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.12);
    ctx.quadraticCurveTo(w * 0.5, h * 0.19, w * 0.7, h * 0.12);
    ctx.quadraticCurveTo(w * 0.5, h * 0.14, w * 0.3, h * 0.12);
    ctx.fillStyle = preset.isDark ? "#09090b" : "#e2e8f0";
    ctx.fill();

    // Fabric Textures & Folds (Subtle Realism Gradients)
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (preset.isDark) {
      grad.addColorStop(0, "rgba(255,255,255,0.06)");
      grad.addColorStop(0.5, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.2)");
    } else {
      grad.addColorStop(0, "rgba(255,255,255,0.3)");
      grad.addColorStop(0.5, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.1)");
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner Tag Label
    if (preset.viewSide === "FRONT") {
      ctx.fillStyle = preset.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("APNA WEAR", w * 0.5, h * 0.22);
      ctx.font = "9px sans-serif";
      ctx.fillText("100% COTTON · L", w * 0.5, h * 0.245);
    }

    ctx.restore();
  }

  // Keying Function to Strip Solid Backgrounds (White/Black) from Pinterest Images
  function processImageKeying(
    img: HTMLImageElement,
    removeWhite: boolean,
    removeBlack: boolean,
    threshold: number,
  ): HTMLCanvasElement {
    const offCanvas = document.createElement("canvas");
    offCanvas.width = img.naturalWidth || img.width;
    offCanvas.height = img.naturalHeight || img.height;
    const offCtx = offCanvas.getContext("2d");
    if (!offCtx) return offCanvas;

    offCtx.drawImage(img, 0, 0);
    const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (removeWhite) {
        if (r >= 255 - threshold && g >= 255 - threshold && b >= 255 - threshold) {
          data[i + 3] = 0; // Set Alpha to 0
        }
      }
      if (removeBlack) {
        if (r <= threshold && g <= threshold && b <= threshold) {
          data[i + 3] = 0; // Set Alpha to 0
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    return offCanvas;
  }

  // File Upload Handlers
  function handleArtworkUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const cW = canvas?.width || 800;
        const cH = canvas?.height || 800;

        // Auto scale to fit chest area cleanly
        let targetW = 280;
        let targetH = (img.height / img.width) * targetW;
        if (targetH > 380) {
          targetH = 380;
          targetW = (img.width / img.height) * targetH;
        }

        const newLayer: Layer = {
          id: `layer-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          img,
          x: cW * 0.5 - targetW / 2,
          y: cH * 0.32 - targetH / 2,
          width: targetW,
          height: targetH,
          rotation: 0,
          blendMode: selectedPreset.isDark ? "screen" : "multiply", // Auto best fit!
          opacity: 1,
          removeWhiteBg: !file.type.includes("png"), // Auto remove white bg if JPEG
          removeBlackBg: false,
          bgThreshold: 30,
          flipX: false,
          flipY: false,
        };

        setLayers((prev) => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
        setMessage(`Uploaded "${file.name}" artwork onto mockup!`);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleCustomShirtUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setCustomShirtImg(img);
        setMessage("Custom shirt mockup image loaded!");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  // Interactive Mouse Dragging Handlers
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeLayer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    setIsDragging(true);
    setDragStart({ x: mouseX, y: mouseY });
    setLayerStartPos({ x: activeLayer.x, y: activeLayer.y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging || !activeLayerId || !activeLayer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const dx = mouseX - dragStart.x;
    const dy = mouseY - dragStart.y;

    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, x: layerStartPos.x + dx, y: layerStartPos.y + dy } : l)),
    );
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  // Preset Placement Helper
  function applyPresetPlacement(position: "CHEST" | "POCKET" | "BACK" | "FULL") {
    if (!activeLayerId || !activeLayer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cW = canvas.width;
    const cH = canvas.height;

    let targetW = activeLayer.width;
    let targetH = activeLayer.height;

    let x = cW * 0.5 - targetW / 2;
    let y = cH * 0.35 - targetH / 2;

    if (position === "POCKET") {
      targetW = 120;
      targetH = (activeLayer.img.height / activeLayer.img.width) * targetW;
      x = cW * 0.62 - targetW / 2;
      y = cH * 0.28 - targetH / 2;
    } else if (position === "FULL") {
      targetW = 340;
      targetH = (activeLayer.img.height / activeLayer.img.width) * targetW;
      x = cW * 0.5 - targetW / 2;
      y = cH * 0.42 - targetH / 2;
    }

    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, width: targetW, height: targetH, x, y, rotation: 0 } : l)),
    );
  }

  // Export High-Res Rendered Image
  function exportHighResMockup() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create high-res export canvas without selection lines
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1600;
    exportCanvas.height = 1600;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    const scale = 2; // 2x High-Res
    if (customShirtImg) {
      ctx.drawImage(customShirtImg, 0, 0, 1600, 1600);
    } else {
      drawDefaultShirtBase(ctx, 1600, 1600, selectedPreset);
    }

    layers.forEach((layer) => {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      const exportCompositeMode: GlobalCompositeOperation = layer.blendMode === "normal" ? "source-over" : (layer.blendMode as GlobalCompositeOperation);
      ctx.globalCompositeOperation = exportCompositeMode;

      const centerX = (layer.x + layer.width / 2) * scale;
      const centerY = (layer.y + layer.height / 2) * scale;

      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);

      let renderImage: CanvasImageSource = layer.img;
      if (layer.removeWhiteBg || layer.removeBlackBg) {
        renderImage = processImageKeying(layer.img, layer.removeWhiteBg, layer.removeBlackBg, layer.bgThreshold);
      }

      ctx.drawImage(renderImage, (-layer.width / 2) * scale, (-layer.height / 2) * scale, layer.width * scale, layer.height * scale);
      ctx.restore();
    });

    const dataUrl = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `apna-wear-mockup-${selectedPreset.id}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    setMessage("High-resolution mockup PNG exported cleanly!");
  }

  // Save Direct to ERP Catalog & Upload to Cloudinary
  async function handleSaveAsProductDesign() {
    if (!productForm.name) {
      setError("Please enter a product design name.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSavingProduct(true);
    setError("");
    setMessage("");

    try {
      const renderDataUrl = canvas.toDataURL("image/png");
      const res = await apiFetch<{ success: true; message: string; design: any }>("/mockups/save-product-design", {
        method: "POST",
        body: JSON.stringify({
          name: productForm.name,
          category: productForm.category,
          regularSellingPrice: productForm.regularSellingPrice,
          dropShoulderSellingPrice: productForm.dropShoulderSellingPrice,
          mockupImage: renderDataUrl,
        }),
      });

      setMessage(res.message);
      setProductForm({ name: "", category: "GRAPHIC_TEE", regularSellingPrice: 1300, dropShoulderSellingPrice: 1600 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProduct(false);
    }
  }

  if (loading) return <LoadingScreen message="Loading Mockup Studio..." />;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>🎨 T-Shirt Mockup Studio & Designer</h1>
          <p className="muted">Upload Pinterest artwork, blend seamlessly onto shirt mockups, adjust Photoshop layers, and export high-res renders.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="button" onClick={exportHighResMockup} type="button">
            📥 Export High-Res PNG
          </button>
        </div>
      </div>

      {error ? <div className="error-box page-message">{error}</div> : null}
      {message ? <div className="success-box page-message">{message}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 340px", gap: "20px", alignItems: "start" }}>
        {/* LEFT COLUMN: SHIRT PRESETS & ARTWORK UPLOADER */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <article className="card card-padding">
            <h2 className="section-title">1. Shirt Base Mockup</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              {shirtPresets.map((preset) => (
                <button
                  key={preset.id}
                  className="button button-secondary"
                  onClick={() => {
                    setSelectedPreset(preset);
                    setCustomShirtImg(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderColor: selectedPreset.id === preset.id && !customShirtImg ? "#2563eb" : undefined,
                    backgroundColor: selectedPreset.id === preset.id && !customShirtImg ? "#eff6ff" : undefined,
                  }}
                  type="button"
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: preset.colorHex, border: "1px solid #cbd5e1" }} />
                    {preset.name}
                  </span>
                  <span className="badge">{preset.viewSide}</span>
                </button>
              ))}

              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
                <label className="field-label">Upload Custom Shirt Image</label>
                <input accept="image/*" className="input" type="file" onChange={handleCustomShirtUpload} />
              </div>
            </div>
          </article>

          <article className="card card-padding">
            <h2 className="section-title">2. Add Artwork / Graphic</h2>
            <p className="section-copy">Upload Pinterest PNG/JPEG artwork or graphic prints.</p>

            <label className="button button-primary" style={{ display: "block", textAlign: "center", cursor: "pointer", marginTop: "10px" }}>
              ➕ Upload Pinterest Artwork
              <input accept="image/*" style={{ display: "none" }} type="file" onChange={handleArtworkUpload} />
            </label>

            <div style={{ marginTop: "16px" }}>
              <label className="field-label">Active Graphic Layers ({layers.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                {layers.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setActiveLayerId(l.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: activeLayerId === l.id ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{l.name}</strong>
                    <button
                      className="button compact-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers((prev) => prev.filter((item) => item.id !== l.id));
                        if (activeLayerId === l.id) setActiveLayerId(null);
                      }}
                      style={{ backgroundColor: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {!layers.length ? <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>No graphic layers added yet.</p> : null}
              </div>
            </div>
          </article>
        </aside>

        {/* MIDDLE COLUMN: WORKBENCH CANVAS */}
        <section className="card card-padding" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginBottom: "12px", alignItems: "center" }}>
            <h2 className="section-title" style={{ margin: 0 }}>Studio Canvas Workbench</h2>
            <div style={{ display: "flex", gap: "6px" }}>
              <button className="button compact-button button-secondary" onClick={() => applyPresetPlacement("CHEST")} type="button">Center Chest</button>
              <button className="button compact-button button-secondary" onClick={() => applyPresetPlacement("POCKET")} type="button">Left Pocket</button>
              <button className="button compact-button button-secondary" onClick={() => applyPresetPlacement("FULL")} type="button">Oversized</button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            height={800}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ width: "100%", maxWidth: "520px", height: "auto", border: "2px solid #cbd5e1", borderRadius: "12px", cursor: isDragging ? "grabbing" : "grab", backgroundColor: "#f8fafc" }}
            width={800}
          />
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "8px" }}>💡 Click and drag graphic artwork inside print box to position.</p>
        </section>

        {/* RIGHT COLUMN: PHOTOSHOP CONTROLS & SAVE AS PRODUCT DESIGN */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {activeLayer ? (
            <article className="card card-padding">
              <h2 className="section-title">3. Photoshop Layer Adjustments</h2>
              <div className="form" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
                <div className="field">
                  <label className="field-label">Blend Mode (Photoshop Blend)</label>
                  <select
                    className="select"
                    value={activeLayer.blendMode}
                    onChange={(e) =>
                      setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, blendMode: e.target.value as BlendMode } : l)))
                    }
                  >
                    <option value="normal">Normal (Standard Overlay)</option>
                    <option value="multiply">Multiply (Best for White/Light Shirts)</option>
                    <option value="screen">Screen (Best for Dark/Black Shirts)</option>
                    <option value="overlay">Overlay (High Contrast Texture)</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="color-burn">Color Burn</option>
                    <option value="hard-light">Hard Light</option>
                    <option value="difference">Difference</option>
                  </select>
                  <small className="muted">Use <strong>Multiply</strong> for Pinterest prints on white shirts to remove box lines naturally!</small>
                </div>

                <div className="field">
                  <label className="field-label">Opacity ({Math.round(activeLayer.opacity * 100)}%)</label>
                  <input
                    max="1"
                    min="0"
                    step="0.05"
                    type="range"
                    value={activeLayer.opacity}
                    onChange={(e) =>
                      setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, opacity: Number(e.target.value) } : l)))
                    }
                  />
                </div>

                <div style={{ paddingTop: "8px", borderTop: "1px dashed #cbd5e1" }}>
                  <label className="field-label">Auto Background Keying</label>
                  <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        checked={activeLayer.removeWhiteBg}
                        type="checkbox"
                        onChange={(e) =>
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, removeWhiteBg: e.target.checked } : l)))
                        }
                      />
                      Strip White Background
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        checked={activeLayer.removeBlackBg}
                        type="checkbox"
                        onChange={(e) =>
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, removeBlackBg: e.target.checked } : l)))
                        }
                      />
                      Strip Black BG
                    </label>
                  </div>

                  {activeLayer.removeWhiteBg || activeLayer.removeBlackBg ? (
                    <div className="field" style={{ marginTop: "8px" }}>
                      <label className="field-label">Color Tolerance ({activeLayer.bgThreshold})</label>
                      <input
                        max="120"
                        min="5"
                        type="range"
                        value={activeLayer.bgThreshold}
                        onChange={(e) =>
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, bgThreshold: Number(e.target.value) } : l)))
                        }
                      />
                    </div>
                  ) : null}
                </div>

                <div style={{ paddingTop: "8px", borderTop: "1px dashed #cbd5e1" }}>
                  <label className="field-label">Transform & Rotate</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
                    <div className="field">
                      <label style={{ fontSize: "0.75rem" }}>Width (px)</label>
                      <input
                        className="input"
                        type="number"
                        value={Math.round(activeLayer.width)}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 50;
                          const ratio = activeLayer.img.height / activeLayer.img.width;
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, width: val, height: val * ratio } : l)));
                        }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: "0.75rem" }}>Rotation (°)</label>
                      <input
                        className="input"
                        max="180"
                        min="-180"
                        type="number"
                        value={Math.round(activeLayer.rotation)}
                        onChange={(e) =>
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, rotation: Number(e.target.value) } : l)))
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      className="button button-secondary compact-button"
                      onClick={() =>
                        setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, flipX: !l.flipX } : l)))
                      }
                      type="button"
                    >
                      ↔️ Flip Horizontal
                    </button>
                    <button
                      className="button button-secondary compact-button"
                      onClick={() =>
                        setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, flipY: !l.flipY } : l)))
                      }
                      type="button"
                    >
                      ↕️ Flip Vertical
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <article className="card card-padding">
              <h2 className="section-title">3. Photoshop Layer Adjustments</h2>
              <p className="muted" style={{ fontSize: "0.85rem", margin: "10px 0" }}>Select an artwork layer from the left to adjust Photoshop blend modes, rotation, opacity, and background keying.</p>
            </article>
          )}

          {/* SAVE AS ERP PRODUCT DESIGN & CLOUDINARY UPLOAD */}
          <article className="card card-padding" style={{ borderLeft: "4px solid #2563eb" }}>
            <h2 className="section-title">4. Save to ERP Catalog & Cloudinary</h2>
            <p className="section-copy" style={{ margin: "4px 0 12px 0" }}>
              Uploads rendered mockup to **Cloudinary CDN** and creates a Product Design ready for orders.
            </p>

            <div className="form" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="field">
                <label className="field-label">Design Title *</label>
                <input
                  className="input"
                  placeholder="e.g. Tokyo Ghoul Back Print Tee"
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div className="field">
                  <label className="field-label">Regular Price</label>
                  <input
                    className="input"
                    type="number"
                    value={productForm.regularSellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, regularSellingPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Drop Shoulder</label>
                  <input
                    className="input"
                    type="number"
                    value={productForm.dropShoulderSellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, dropShoulderSellingPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                className="button button-primary"
                disabled={savingProduct || !layers.length || !productForm.name}
                onClick={() => void handleSaveAsProductDesign()}
                style={{ marginTop: "6px" }}
                type="button"
              >
                {savingProduct ? "Uploading to Cloudinary..." : "☁️ Upload Cloudinary & Save Product"}
              </button>
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
}
