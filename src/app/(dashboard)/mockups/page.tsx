"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import LoadingScreen from "@/components/common/loading-screen";
import { apiFetch } from "@/lib/api";

type ShirtPreset = {
  id: string;
  name: string;
  colorHex: string;
  viewSide: "FRONT" | "BACK";
  isDark: boolean;
  imageSrc: string;
  printBox: { x: number; y: number; w: number; h: number };
};

const shirtPresets: ShirtPreset[] = [
  {
    id: "black-dropshoulder-front",
    name: "Black Shirt (Front View)",
    colorHex: "#18181b",
    viewSide: "FRONT",
    isDark: true,
    imageSrc: "/mockups/black-dropshoulder-front.jpg",
    printBox: { x: 0.28, y: 0.24, w: 0.44, h: 0.54 },
  },
  {
    id: "black-hanger",
    name: "Black Shirt (Hanger)",
    colorHex: "#18181b",
    viewSide: "FRONT",
    isDark: true,
    imageSrc: "/mockups/black-hanger.jpg",
    printBox: { x: 0.32, y: 0.35, w: 0.36, h: 0.44 },
  },
  {
    id: "white-hanger",
    name: "White Shirt (Hanger)",
    colorHex: "#f8fafc",
    viewSide: "FRONT",
    isDark: false,
    imageSrc: "/mockups/white-hanger.jpg",
    printBox: { x: 0.32, y: 0.35, w: 0.36, h: 0.44 },
  },
  {
    id: "black-dropshoulder-back",
    name: "Black Drop Shoulder (Back)",
    colorHex: "#18181b",
    viewSide: "BACK",
    isDark: true,
    imageSrc: "/mockups/black-dropshoulder-back.png",
    printBox: { x: 0.26, y: 0.20, w: 0.48, h: 0.58 },
  },
  {
    id: "black-longsleeve",
    name: "Black Long Sleeve (Hanger)",
    colorHex: "#18181b",
    viewSide: "FRONT",
    isDark: true,
    imageSrc: "/mockups/black-longsleeve.jpg",
    printBox: { x: 0.32, y: 0.24, w: 0.36, h: 0.52 },
  },
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
  rotation: number;
  blendMode: BlendMode;
  opacity: number;
  removeWhiteBg: boolean;
  removeBlackBg: boolean;
  bgThreshold: number;
  flipX: boolean;
  flipY: boolean;
  visible: boolean;
};

export default function MockupStudioPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ShirtPreset>(shirtPresets[0]);
  const [customShirtImg, setCustomShirtImg] = useState<HTMLImageElement | null>(null);
  const [customShirtFileName, setCustomShirtFileName] = useState<string>("");

  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [showPrintGuide, setShowPrintGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<"SHIRT" | "LAYERS">("SHIRT");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [layerStartPos, setLayerStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Save / Export State
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

  const [presetImages, setPresetImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    shirtPresets.forEach((preset) => {
      const img = new Image();
      img.src = preset.imageSrc;
      img.onload = () => {
        setPresetImages((prev) => ({ ...prev, [preset.id]: img }));
      };
    });
  }, []);

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
      const activePresetImg = presetImages[selectedPreset.id];
      if (activePresetImg) {
        ctx.drawImage(activePresetImg, 0, 0, width, height);
      } else {
        drawDefaultShirtBase(ctx, width, height, selectedPreset);
      }
    }

    // 2. Draw Printable Bounding Area Guide (Optional)
    if (showPrintGuide) {
      ctx.save();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      const boxDef = selectedPreset.printBox || { x: 0.28, y: 0.25, w: 0.44, h: 0.5 };
      const printBox = { x: width * boxDef.x, y: height * boxDef.y, w: width * boxDef.w, h: height * boxDef.h };
      ctx.strokeRect(printBox.x, printBox.y, printBox.w, printBox.h);

      ctx.fillStyle = "#2563eb";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(`PRINT AREA · ${selectedPreset.viewSide}`, printBox.x + 10, printBox.y + 22);
      ctx.restore();
    }

    // 3. Render Artwork Layers
    layers.forEach((layer) => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      const compositeMode: GlobalCompositeOperation = layer.blendMode === "normal" ? "source-over" : (layer.blendMode as GlobalCompositeOperation);
      ctx.globalCompositeOperation = compositeMode;

      const centerX = layer.x + layer.width / 2;
      const centerY = layer.y + layer.height / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);

      let renderImage: CanvasImageSource = layer.img;
      if (layer.removeWhiteBg || layer.removeBlackBg) {
        renderImage = processImageKeying(layer.img, layer.removeWhiteBg, layer.removeBlackBg, layer.bgThreshold);
      }

      ctx.drawImage(renderImage, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.restore();

      // 4. Active Layer Selection Box & Handles
      if (layer.id === activeLayerId) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.strokeRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);

        // Corner Handles
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        const handleSize = 12;
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

        // Top Rotation Handle Knob
        ctx.beginPath();
        ctx.moveTo(0, -layer.height / 2);
        ctx.lineTo(0, -layer.height / 2 - 28);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -layer.height / 2 - 28, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    });
  }, [layers, activeLayerId, selectedPreset, customShirtImg, showPrintGuide, presetImages]);

  // Procedural Shirt Fallback
  function drawDefaultShirtBase(ctx: CanvasRenderingContext2D, w: number, h: number, preset: ShirtPreset) {
    ctx.save();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Keying Function to Strip Solid Backgrounds (White/Black)
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
          data[i + 3] = 0;
        }
      }
      if (removeBlack) {
        if (r <= threshold && g <= threshold && b <= threshold) {
          data[i + 3] = 0;
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
        const cW = canvas?.width || 1080;
        const cH = canvas?.height || 1350;

        let targetW = 380;
        let targetH = (img.height / img.width) * targetW;
        if (targetH > 500) {
          targetH = 500;
          targetW = (img.width / img.height) * targetH;
        }

        const newLayer: Layer = {
          id: `layer-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          img,
          x: cW * 0.5 - targetW / 2,
          y: cH * 0.35 - targetH / 2,
          width: targetW,
          height: targetH,
          rotation: 0,
          blendMode: selectedPreset.isDark ? "screen" : "multiply",
          opacity: 1,
          removeWhiteBg: !file.type.includes("png"),
          removeBlackBg: false,
          bgThreshold: 30,
          flipX: false,
          flipY: false,
          visible: true,
        };

        setLayers((prev) => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
        setActiveTab("LAYERS");
        setMessage(`Added layer "${file.name}"!`);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleCustomShirtUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setCustomShirtFileName(file.name);
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

    const boxDef = selectedPreset.printBox || { x: 0.28, y: 0.25, w: 0.44, h: 0.5 };

    let targetW = activeLayer.width;
    let targetH = activeLayer.height;

    let x = cW * (boxDef.x + boxDef.w / 2) - targetW / 2;
    let y = cH * (boxDef.y + boxDef.h / 3) - targetH / 2;

    if (position === "POCKET") {
      targetW = 160;
      targetH = (activeLayer.img.height / activeLayer.img.width) * targetW;
      x = cW * (boxDef.x + boxDef.w * 0.75) - targetW / 2;
      y = cH * (boxDef.y + boxDef.h * 0.2) - targetH / 2;
    } else if (position === "FULL") {
      targetW = cW * (boxDef.w * 0.95);
      targetH = (activeLayer.img.height / activeLayer.img.width) * targetW;
      x = cW * (boxDef.x + boxDef.w / 2) - targetW / 2;
      y = cH * (boxDef.y + boxDef.h / 2) - targetH / 2;
    }

    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, width: targetW, height: targetH, x, y, rotation: 0 } : l)),
    );
  }

  function centerLayerHorizontally() {
    if (!activeLayerId || !activeLayer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, x: canvas.width / 2 - l.width / 2 } : l)),
    );
  }

  function centerLayerVertically() {
    if (!activeLayerId || !activeLayer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, y: canvas.height * 0.4 - l.height / 2 } : l)),
    );
  }

  // Clean Render Function (Without Selection Outlines, Handles, or Print Guides)
  function generateCleanRenderDataUrl(): string | null {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1080;
    exportCanvas.height = 1350;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return null;

    if (customShirtImg) {
      ctx.drawImage(customShirtImg, 0, 0, 1080, 1350);
    } else {
      const activePresetImg = presetImages[selectedPreset.id];
      if (activePresetImg) {
        ctx.drawImage(activePresetImg, 0, 0, 1080, 1350);
      } else {
        drawDefaultShirtBase(ctx, 1080, 1350, selectedPreset);
      }
    }

    layers.forEach((layer) => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      const exportCompositeMode: GlobalCompositeOperation = layer.blendMode === "normal" ? "source-over" : (layer.blendMode as GlobalCompositeOperation);
      ctx.globalCompositeOperation = exportCompositeMode;

      const centerX = layer.x + layer.width / 2;
      const centerY = layer.y + layer.height / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);

      let renderImage: CanvasImageSource = layer.img;
      if (layer.removeWhiteBg || layer.removeBlackBg) {
        renderImage = processImageKeying(layer.img, layer.removeWhiteBg, layer.removeBlackBg, layer.bgThreshold);
      }

      ctx.drawImage(renderImage, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.restore();
    });

    return exportCanvas.toDataURL("image/png");
  }

  // Export High-Res Rendered Image
  function exportHighResMockup() {
    const dataUrl = generateCleanRenderDataUrl();
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.download = `apna-wear-mockup-${selectedPreset.id}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    setMessage("Exported high-resolution 1080x1350 PNG mockup!");
  }

  // Save Direct to ERP Catalog & Upload to Cloudinary
  async function handleSaveAsProductDesign() {
    if (!productForm.name) {
      setError("Please enter a product design name.");
      return;
    }
    const renderDataUrl = generateCleanRenderDataUrl();
    if (!renderDataUrl) {
      setError("Failed to generate mockup render.");
      return;
    }

    setSavingProduct(true);
    setError("");
    setMessage("");

    try {
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
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* SHADCN CLEAN TOP HEADER BAR */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 32px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "1.2rem" }}>🐶</span>
          </div>
          <div>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Mockup Studio Pro
            </h1>
            <p style={{ fontSize: "0.78rem", margin: 0, color: "#64748b" }}>
              Professional Apparel Mockup Designer
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={() => setShowPrintGuide(!showPrintGuide)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "20px",
              backgroundColor: showPrintGuide ? "#2563eb" : "#0f172a",
              color: "#ffffff",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            type="button"
          >
            <span>🖨️</span>
            <span>Guide: {showPrintGuide ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={exportHighResMockup}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 20px",
              borderRadius: "8px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
            }}
            type="button"
          >
            <span>📥</span>
            <span>Export 1080×1350 PNG</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "10px" }}>
            <span style={{ cursor: "pointer", fontSize: "1.1rem" }}>⚙️</span>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "#0f172a",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              M
            </div>
          </div>
        </div>
      </header>

      {error ? <div className="error-box page-message" style={{ margin: "16px 32px 0 32px" }}>{error}</div> : null}
      {message ? <div className="success-box page-message" style={{ margin: "16px 32px 0 32px" }}>{message}</div> : null}

      {/* MAIN THREE-COLUMN STUDIO LAYOUT */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr 340px",
          gap: "24px",
          padding: "24px 32px",
          alignItems: "start",
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >

        {/* LEFT SIDEBAR: SHIRT BASE & ARTWORK TABS */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* TAB BUTTONS (MATCHING REFERENCE IMAGE) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
            <button
              onClick={() => setActiveTab("SHIRT")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: activeTab === "SHIRT" ? "#ffffff" : "transparent",
                color: activeTab === "SHIRT" ? "#2563eb" : "#64748b",
                boxShadow: activeTab === "SHIRT" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
              type="button"
            >
              <span>👕</span>
              <span>Base Shirt</span>
            </button>
            <button
              onClick={() => setActiveTab("LAYERS")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: activeTab === "LAYERS" ? "#ffffff" : "transparent",
                color: activeTab === "LAYERS" ? "#2563eb" : "#64748b",
                boxShadow: activeTab === "LAYERS" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
              type="button"
            >
              <span>📝</span>
              <span>Artwork ({layers.length})</span>
            </button>
          </div>

          {activeTab === "SHIRT" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>
                  SELECT APPAREL PRESET
                </span>

                {shirtPresets.map((preset) => {
                  const isSelected = selectedPreset.id === preset.id && !customShirtImg;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setCustomShirtImg(null);
                      }}
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        backgroundColor: "#ffffff",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "0 1px 2px rgba(0,0,0,0.02)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <img
                        alt={preset.name}
                        src={preset.imageSrc}
                        style={{ width: "48px", height: "54px", objectFit: "cover", borderRadius: "6px", backgroundColor: "#f8fafc" }}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: "block", fontSize: "0.85rem", color: "#0f172a", fontWeight: 600 }}>
                          {preset.name}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {preset.viewSide === "FRONT" ? "Front View" : "Back View"}
                        </span>
                      </div>
                      
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          backgroundColor: preset.isDark ? "#0f172a" : "#e2e8f0",
                          color: preset.isDark ? "#ffffff" : "#475569",
                        }}
                      >
                        {preset.isDark ? "DARK" : "LIGHT"}
                      </span>

                      {isSelected ? (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.65rem",
                            fontWeight: "bold",
                          }}
                        >
                          ✓
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* UPLOAD CUSTOM MOCKUP BASE */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>
                  UPLOAD CUSTOM MOCKUP BASE
                </span>
                
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "12px",
                    backgroundColor: "#ffffff",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: "#475569",
                  }}
                >
                  <span style={{ padding: "4px 10px", backgroundColor: "#f1f5f9", borderRadius: "6px", fontWeight: 600, color: "#0f172a" }}>
                    ☁️ Choose File
                  </span>
                  <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>
                    {customShirtFileName || "No file chosen"}
                  </span>
                  <input accept="image/*" style={{ display: "none" }} type="file" onChange={handleCustomShirtUpload} />
                </label>
              </div>

              {/* TIPS CARD MATCHING REFERENCE IMAGE */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "12px 14px",
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fef3c7",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>💡</span>
                <div>
                  <strong style={{ display: "block", fontSize: "0.78rem", color: "#92400e" }}>Tips</strong>
                  <p style={{ fontSize: "0.74rem", color: "#b45309", margin: 0, lineHeight: 1.3 }}>
                    High quality front-facing product image works best.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>
                GRAPHIC ARTWORK LAYERS
              </span>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                }}
              >
                <span>➕ Upload Pinterest Artwork</span>
                <input accept="image/*" style={{ display: "none" }} type="file" onChange={handleArtworkUpload} />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {layers.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setActiveLayerId(l.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      backgroundColor: "#ffffff",
                      borderRadius: "10px",
                      border: activeLayerId === l.id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      cursor: "pointer",
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers((prev) => prev.map((item) => (item.id === l.id ? { ...item, visible: !item.visible } : item)));
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}
                      type="button"
                    >
                      {l.visible ? "👁️" : "🙈"}
                    </button>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers((prev) => prev.filter((item) => item.id !== l.id));
                        if (activeLayerId === l.id) setActiveLayerId(null);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontWeight: "bold" }}
                      type="button"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                {!layers.length ? (
                  <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center", margin: "20px 0" }}>
                    No graphic layers added yet.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </aside>

        {/* CENTER STAGE WORKBENCH MATCHING REFERENCE IMAGE */}
        <section
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
          }}
        >
          {/* HEADER TITLE & PLACEMENT TOOLBAR */}
          <div style={{ width: "100%", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", letterSpacing: "0.05em", display: "block", marginBottom: "12px" }}>
              STAGE - 1080×1350 HD
            </span>

            {/* PLACEMENT PILLS */}
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              <button
                onClick={() => applyPresetPlacement("CHEST")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "20px",
                  backgroundColor: "#ffffff",
                  border: "1.5px solid #2563eb",
                  color: "#2563eb",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                type="button"
              >
                <span>🎯</span>
                <span>Center Chest</span>
              </button>
              <button
                onClick={() => applyPresetPlacement("POCKET")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                type="button"
              >
                <span>🛡️</span>
                <span>Pocket</span>
              </button>
              <button
                onClick={() => applyPresetPlacement("FULL")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                type="button"
              >
                <span>👕</span>
                <span>Oversized</span>
              </button>
            </div>
          </div>

          {/* CANVAS CONTAINER */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "520px",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid #f1f5f9",
            }}
          >
            <canvas
              ref={canvasRef}
              height={1350}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                width: "100%",
                aspectRatio: "4 / 5",
                height: "auto",
                display: "block",
                cursor: isDragging ? "grabbing" : "grab",
                backgroundColor: "#f8fafc",
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease",
              }}
              width={1080}
            />
          </div>

          {/* STAGE FOOTER: TIPS & ZOOM WIDGET */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "520px", marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "0.78rem" }}>
              <span>👆</span>
              <span>Click and drag artwork directly on canvas</span>
            </div>

            {/* ZOOM PILL WIDGET */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                color: "#475569",
                fontWeight: 600,
              }}
            >
              <button onClick={() => setZoomLevel((z) => Math.max(70, z - 10))} style={{ border: "none", background: "none", cursor: "pointer", fontWeight: "bold" }} type="button">
                −
              </button>
              <span>{zoomLevel}%</span>
              <button onClick={() => setZoomLevel((z) => Math.min(130, z + 10))} style={{ border: "none", background: "none", cursor: "pointer", fontWeight: "bold" }} type="button">
                +
              </button>
            </div>
          </div>

        </section>

        {/* RIGHT SIDEBAR: LAYER PROPERTIES & SAVE TO ERP */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* LAYER CARD MATCHING REFERENCE IMAGE */}
          <article style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", letterSpacing: "0.05em", display: "block", marginBottom: "16px" }}>
              LAYER
            </span>

            {activeLayer ? (
              <div className="form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="field">
                  <label className="field-label" style={{ fontSize: "0.78rem" }}>Blend Mode (Photoshop)</label>
                  <select
                    className="select"
                    style={{ fontSize: "0.82rem", padding: "8px 10px" }}
                    value={activeLayer.blendMode}
                    onChange={(e) =>
                      setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, blendMode: e.target.value as BlendMode } : l)))
                    }
                  >
                    <option value="normal">Normal (Standard Overlay)</option>
                    <option value="multiply">Multiply (Best for White Shirts)</option>
                    <option value="screen">Screen (Best for Dark Shirts)</option>
                    <option value="overlay">Overlay (High Contrast)</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                  </select>
                </div>

                <div className="field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label className="field-label" style={{ fontSize: "0.78rem" }}>Opacity</label>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{Math.round(activeLayer.opacity * 100)}%</span>
                  </div>
                  <input
                    max="1"
                    min="0"
                    step="0.05"
                    style={{ width: "100%", accentColor: "#2563eb" }}
                    type="range"
                    value={activeLayer.opacity}
                    onChange={(e) =>
                      setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, opacity: Number(e.target.value) } : l)))
                    }
                  />
                </div>

                <div style={{ paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                  <label className="field-label" style={{ fontSize: "0.78rem" }}>Auto Background Removal</label>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.75rem" }}>
                      <input
                        checked={activeLayer.removeWhiteBg}
                        type="checkbox"
                        onChange={(e) =>
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, removeWhiteBg: e.target.checked } : l)))
                        }
                      />
                      Strip White
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.75rem" }}>
                      <input
                        checked={activeLayer.removeBlackBg}
                        type="checkbox"
                        onChange={(e) =>
                          setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, removeBlackBg: e.target.checked } : l)))
                        }
                      />
                      Strip Black
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                  <button className="button button-secondary compact-button" onClick={centerLayerHorizontally} type="button">
                    ↔️ Center H
                  </button>
                  <button className="button button-secondary compact-button" onClick={centerLayerVertically} type="button">
                    ↕️ Center V
                  </button>
                </div>
              </div>
            ) : (
              /* EMPTY STATE MATCHING REFERENCE IMAGE */
              <div style={{ textAlign: "center", padding: "20px 10px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", border: "2px dashed #cbd5e1", margin: "0 auto 12px auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                  🎛️
                </div>
                <strong style={{ display: "block", fontSize: "0.88rem", color: "#0f172a", marginBottom: "6px" }}>
                  No Layer Selected
                </strong>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0, lineHeight: 1.4 }}>
                  Upload or select a graphic layer to open Photoshop blend modes, threshold, opacity, and rotation controls.
                </p>
              </div>
            )}
          </article>

          {/* SAVE TO ERP CATALOG CARD MATCHING REFERENCE IMAGE */}
          <article style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>
                SAVE TO ERP CATALOG
              </span>

              {/* CLOUDINARY ACTIVE BADGES MATCHING IMAGE */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 600 }}>☁️ Cloudinary</span>
                <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", padding: "2px 6px", borderRadius: "10px", fontSize: "0.65rem", fontWeight: 700 }}>
                  ACTIVE
                </span>
              </div>
            </div>

            <div className="form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="field">
                <label className="field-label" style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                  PRODUCT TITLE *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Stranger Things Graphic Tee"
                  style={{ fontSize: "0.85rem", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="field">
                  <label className="field-label" style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                    REG. PRICE (PKR)
                  </label>
                  <input
                    className="input"
                    style={{ fontSize: "0.85rem", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    type="number"
                    value={productForm.regularSellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, regularSellingPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field-label" style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                    DROP SHOULDER
                  </label>
                  <input
                    className="input"
                    style={{ fontSize: "0.85rem", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    type="number"
                    value={productForm.dropShoulderSellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, dropShoulderSellingPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* PRIMARY BLUE SAVE BUTTON MATCHING REFERENCE IMAGE */}
              <button
                disabled={savingProduct || !layers.length || !productForm.name}
                onClick={() => void handleSaveAsProductDesign()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: "4px",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                  opacity: savingProduct || !layers.length || !productForm.name ? 0.6 : 1,
                }}
                type="button"
              >
                <span>☁️</span>
                <span>{savingProduct ? "Uploading to Cloudinary..." : "Upload to Cloudinary & Save Product"}</span>
              </button>

              {/* CHECKLIST MATCHING REFERENCE IMAGE */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "#334155" }}>
                  <span style={{ color: "#2563eb", fontWeight: "bold" }}>✓</span>
                  <span>High resolution export (1080×1350)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "#334155" }}>
                  <span style={{ color: "#2563eb", fontWeight: "bold" }}>✓</span>
                  <span>Cloudinary auto backup</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "#334155" }}>
                  <span style={{ color: "#2563eb", fontWeight: "bold" }}>✓</span>
                  <span>Save directly to ERP catalog</span>
                </div>
              </div>
            </div>
          </article>

        </aside>

      </div>
    </div>
  );
}
