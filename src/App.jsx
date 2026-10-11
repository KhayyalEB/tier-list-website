import { useEffect, useRef, useState } from "react";
import localforage from "localforage";
import html2canvas from "html2canvas";

function App() {
  const tierColors = [
    { name: "Orange", value: "#f2b674" },
    { name: "Gold", value: "#efd47a" },
    { name: "Yellow", value: "#e8ea71" },
    { name: "Lime", value: "#b4e96a" },
    { name: "Green", value: "#74e36f" },
    { name: "Cyan", value: "#73d7dc" },
  ];

  const [tiers, setTiers] = useState([
    { id: crypto.randomUUID(), name: "S", color: "#f2b674" },
    { id: crypto.randomUUID(), name: "A", color: "#efd47a" },
    { id: crypto.randomUUID(), name: "B", color: "#e8ea71" },
    { id: crypto.randomUUID(), name: "C", color: "#b4e96a" },
    { id: crypto.randomUUID(), name: "D", color: "#74e36f" },
    { id: crypto.randomUUID(), name: "F", color: "#73d7dc" },
  ]);

  const [images, setImages] = useState([]);
  const [hasLoadedSavedData, setHasLoadedSavedData] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [copySucceeded, setCopySucceeded] = useState(false);
  const [hoveredImageId, setHoveredImageId] = useState(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const tierListRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadSavedData = async () => {
      const savedData = await localforage.getItem("tier-list-data");

      if (savedData && isMounted) {
        setTiers(Array.isArray(savedData.tiers) ? savedData.tiers : []);
        setImages(
          (Array.isArray(savedData.images) ? savedData.images : [])
            .filter((image) => image.file instanceof Blob)
            .map((image) => ({
            ...image,
            url: URL.createObjectURL(image.file),
            }))
        );
      }

      if (isMounted) {
        setHasLoadedSavedData(true);
      }
    };

    loadSavedData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedData) {
      return;
    }

    localforage.setItem("tier-list-data", {
      tiers,
      images: images.map(({ id, file, name, tierId }) => ({
        id,
        file,
        name,
        tierId,
      })),
    });
  }, [tiers, images, hasLoadedSavedData]);

  const addTier = () => {
    const name = prompt("Tier name:");
    if (!name || !name.trim()) {
      return;
    }

    const colorChoice = prompt(
      `Choose a tier color (1-${tierColors.length}):\n${tierColors
        .map((color, index) => `${index + 1}: ${color.name}`)
        .join("\n")}`
    );
    const colorIndex = Number(colorChoice) - 1;

    if (!Number.isInteger(colorIndex) || !tierColors[colorIndex]) {
      return;
    }

    setTiers((previousTiers) => [
      ...previousTiers,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
          color: tierColors[colorIndex].value,
      },
    ]);
  };

  const removeTier = (tierId) => {
    setImages((previousImages) =>
      previousImages.map((image) =>
        image.tierId === tierId
          ? { ...image, tierId: null }
          : image
      )
    );

    setTiers((previousTiers) =>
      previousTiers.filter((tier) => tier.id !== tierId)
    );
  };

  const resetTierList = () => {
    const defaultTiers = [
      { name: "S", color: "#f2b674" },
      { name: "A", color: "#efd47a" },
      { name: "B", color: "#e8ea71" },
      { name: "C", color: "#b4e96a" },
      { name: "D", color: "#74e36f" },
      { name: "F", color: "#73d7dc" },
    ].map((tier) => ({ ...tier, id: crypto.randomUUID() }));

    setTiers(defaultTiers);
    setImages((previousImages) =>
      previousImages.map((image) => ({ ...image, tierId: null }))
    );
    setShowResetConfirmation(false);
  };

  const moveTier = (tierId, direction) => {
    setTiers((previousTiers) => {
      const index = previousTiers.findIndex((tier) => tier.id === tierId);
      const newIndex = index + direction;

      if (index === -1 || newIndex < 0 || newIndex >= previousTiers.length) {
        return previousTiers;
      }

      const nextTiers = [...previousTiers];
      [nextTiers[index], nextTiers[newIndex]] = [
        nextTiers[newIndex],
        nextTiers[index],
      ];
      return nextTiers;
    });
  };

  const addImageFiles = (files) => {
    const uploadedImages = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
      name: file.name,
      tierId: null,
    }));

    setImages((previousImages) => [
      ...previousImages,
      ...uploadedImages,
    ]);
  };

  const uploadImages = (event) => {
    addImageFiles(Array.from(event.target.files));
    event.target.value = "";
  };

  const pasteImage = (event) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean)
      .map((file) => new File([file], "pasted-image.png", {
        type: file.type,
      }));

    if (imageFiles.length === 0) return;

    event.preventDefault();
    addImageFiles(imageFiles);
  };

  const handleDragStart = (event, imageId) => {
    event.dataTransfer.setData("imageId", imageId);
    event.dataTransfer.effectAllowed = "move";
  };

  const allowDrop = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDropOnTier = (event, tierId) => {
    event.preventDefault();

    const imageId = event.dataTransfer.getData("imageId");

    setImages((previousImages) =>
      previousImages.map((image) =>
        image.id === imageId
          ? { ...image, tierId }
          : image
      )
    );
  };

  const handleDropOnImage = (event, targetImageId) => {
    event.preventDefault();

    const sourceImageId = event.dataTransfer.getData("imageId");
    if (!sourceImageId || sourceImageId === targetImageId) return;

    setImages((previousImages) => {
      const nextImages = [...previousImages];
      const sourceIndex = nextImages.findIndex(
        (image) => image.id === sourceImageId
      );
      const targetIndex = nextImages.findIndex(
        (image) => image.id === targetImageId
      );

      if (sourceIndex === -1 || targetIndex === -1) {
        return previousImages;
      }

      const [sourceImage] = nextImages.splice(sourceIndex, 1);
      const adjustedTargetIndex = nextImages.findIndex(
        (image) => image.id === targetImageId
      );
      sourceImage.tierId = nextImages[adjustedTargetIndex].tierId;
      nextImages.splice(adjustedTargetIndex, 0, sourceImage);

      return nextImages;
    });
  };

  const handleDropOnTray = (event) => {
    event.preventDefault();

    const imageId = event.dataTransfer.getData("imageId");

    setImages((previousImages) =>
      previousImages.map((image) =>
        image.id === imageId
          ? { ...image, tierId: null }
          : image
      )
    );
  };

  const deleteImage = (imageId) => {
    const imageToDelete = images.find(
      (image) => image.id === imageId
    );

    if (imageToDelete) {
      URL.revokeObjectURL(imageToDelete.url);
    }

    setImages((previousImages) =>
      previousImages.filter((image) => image.id !== imageId)
    );
  };

  const createScreenshotBlob = async () => {
    if (!tierListRef.current) return;

    const element = tierListRef.current;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#111",
        onclone: (clonedDocument) => {
          clonedDocument.querySelectorAll("button").forEach((button) =>
            button.remove()
          );
        },
      });

      return await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
    } catch (error) {
      console.error("Could not create the screenshot.", error);
    }
  };

  const saveScreenshot = async () => {
    const blob = await createScreenshotBlob();
    if (!blob) return;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "tier-list.png";
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setSaveSucceeded(true);
    setTimeout(() => setSaveSucceeded(false), 2000);
  };

  const copyScreenshot = async () => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      console.warn("Clipboard image copying is not supported by this browser.");
      return;
    }

    const blob = await createScreenshotBlob();
    if (!blob) return;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopySucceeded(true);
      setTimeout(() => setCopySucceeded(false), 2000);
    } catch (error) {
      console.warn("Could not copy the screenshot to the clipboard.", error);
    }
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const dataUrlToFile = (dataUrl, name) => {
    const [metadata, data] = dataUrl.split(",");
    const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || "image/png";
    const binary = atob(data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new File([bytes], name, { type: mimeType });
  };

  const exportTierList = async () => {
    const exportedImages = await Promise.all(
      images.map(async ({ id, file, name, tierId }) => ({
        id,
        name,
        tierId,
        dataUrl: await fileToDataUrl(file),
      }))
    );
    const exportData = JSON.stringify({ tiers, images: exportedImages }, null, 2);
    const downloadUrl = URL.createObjectURL(
      new Blob([exportData], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.download = "tier-list.json";
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const importTierList = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;

    try {
      const importedData = JSON.parse(await file.text());
      if (!Array.isArray(importedData.tiers) || !Array.isArray(importedData.images)) {
        throw new Error("Invalid tier list file");
      }

      const importedImages = importedData.images.map((image) => {
        const imageFile = dataUrlToFile(image.dataUrl, image.name || "imported-image.png");
        return {
          id: image.id || crypto.randomUUID(),
          url: URL.createObjectURL(imageFile),
          file: imageFile,
          name: image.name || imageFile.name,
          tierId: image.tierId ?? null,
        };
      });

      images.forEach((image) => URL.revokeObjectURL(image.url));
      setTiers(importedData.tiers);
      setImages(importedImages);
    } catch (error) {
      console.error("Could not import the tier list.", error);
      alert("That file is not a valid tier list export.");
    }
  };

  const imageStyle = {
    width: "100px",
    height: "150px",
    aspectRatio: "2 / 3",
    objectFit: "contain",
    backgroundColor: "#000",
    cursor: "grab",
    border: "2px solid #555",
    borderRadius: "4px",
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#111",
        minHeight: "100vh",
        color: "white",
        boxSizing: "border-box",
      }}
    >
      <h1>My Tier List</h1>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={addTier}
          style={{
            padding: "10px 16px",
            cursor: "pointer",
          }}
        >
          Add Tier
        </button>

        <label
          style={{
            padding: "10px 16px",
            backgroundColor: "#2563eb",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Upload Images

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={uploadImages}
            style={{ display: "none" }}
          />
        </label>

        <button
          type="button"
          onClick={saveScreenshot}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          {saveSucceeded ? "✓ Saved" : "Save Screenshot"}
        </button>

        <button
          type="button"
          onClick={copyScreenshot}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          {copySucceeded ? "✓ Copied" : "Copy to Clipboard"}
        </button>

        <button
          type="button"
          onClick={exportTierList}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          Export Tier List
        </button>

        <label
          style={{
            padding: "10px 16px",
            backgroundColor: "#555",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Import Tier List
          <input
            type="file"
            accept="application/json,.json"
            onChange={importTierList}
            style={{ display: "none" }}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowResetConfirmation(true)}
          style={{
            padding: "10px 16px",
            backgroundColor: "#aa2222",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {showResetConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          style={{
            padding: "16px",
            marginBottom: "20px",
            backgroundColor: "#2a2a2a",
            border: "1px solid #666",
            borderRadius: "6px",
          }}
        >
          <h2 id="reset-title" style={{ marginTop: 0 }}>
            Reset tier list?
          </h2>
          <p>This restores the default tiers and moves images to the tray.</p>
          <button
            type="button"
            onClick={resetTierList}
            style={{
              padding: "8px 12px",
              marginRight: "8px",
              backgroundColor: "#aa2222",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Confirm Reset
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirmation(false)}
            style={{ padding: "8px 12px", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      )}

      <div ref={tierListRef}>
      {tiers.map((tier) => (
        <div
          key={tier.id}
          style={{
            display: "flex",
            minHeight: "110px",
            marginBottom: "3px",
          }}
        >
          <div
            style={{
              width: "100px",
              flexShrink: 0,
              backgroundColor: tier.color,
              color: "black",
              fontWeight: "bold",
              fontSize: "28px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              padding: "5px",
              boxSizing: "border-box",
              overflowWrap: "anywhere",
            }}
          >
            {tier.name}
          </div>

          <div
            onDrop={(event) =>
              handleDropOnTier(event, tier.id)
            }
            onDragOver={allowDrop}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: "110px",
              backgroundColor: "#222",
              border: "1px solid #444",
              display: "flex",
              alignItems: "flex-start",
              alignContent: "flex-start",
              flexWrap: "wrap",
              gap: "5px",
              padding: "5px",
            }}
          >
            {images
              .filter((image) => image.tierId === tier.id)
              .map((image) => (
                <div
                  key={image.id}
                  onDrop={(event) => handleDropOnImage(event, image.id)}
                  onDragOver={allowDrop}
                  onMouseEnter={() => setHoveredImageId(image.id)}
                  onMouseLeave={() => setHoveredImageId(null)}
                  style={{ position: "relative" }}
                >
                  <img
                    src={image.url}
                    alt={image.name || `Image ${image.id}`}
                    draggable={true}
                    onDragStart={(event) =>
                      handleDragStart(event, image.id)
                    }
                    style={imageStyle}
                  />

                  <button
                    type="button"
                    onClick={() => deleteImage(image.id)}
                    title="Delete image"
                    style={{
                      position: "absolute",
                      top: "3px",
                      right: "3px",
                      width: "20px",
                      height: "20px",
                      padding: 0,
                      border: "none",
                      borderRadius: "50%",
                      backgroundColor: "#aa2222",
                      color: "white",
                      cursor: "pointer",
                      display: hoveredImageId === image.id ? "block" : "none",
                    }}
                  >
                    X
                  </button>
                </div>
              ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "42px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => moveTier(tier.id, -1)}
              disabled={tiers[0]?.id === tier.id}
              title="Move tier up"
              style={{ flex: 1, cursor: "pointer" }}
            >
              &uarr;
            </button>
            <button
              type="button"
              onClick={() => moveTier(tier.id, 1)}
              disabled={tiers[tiers.length - 1]?.id === tier.id}
              title="Move tier down"
              style={{ flex: 1, cursor: "pointer" }}
            >
              &darr;
            </button>
          </div>

          <button
            type="button"
            onClick={() => removeTier(tier.id)}
            title="Remove tier"
            style={{
              width: "50px",
              flexShrink: 0,
              backgroundColor: "#aa2222",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            X
          </button>
        </div>
      ))}
      </div>

      <h2 style={{ marginTop: "30px" }}>
        Uploaded Images
      </h2>

      <p style={{ color: "#bbb" }}>
        Drag images into a tier. Drag them back here to remove
        them from a tier.
      </p>

      <div
        tabIndex={0}
        onPaste={pasteImage}
        onDrop={handleDropOnTray}
        onDragOver={allowDrop}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignContent: "flex-start",
          gap: "10px",
          minHeight: "120px",
          padding: "10px",
          backgroundColor: "#1a1a1a",
          border: "2px dashed #666",
          borderRadius: "6px",
          cursor: "text",
        }}
      >
        {images
          .filter((image) => image.tierId === null)
          .map((image) => (
            <div
              key={image.id}
              onMouseEnter={() => setHoveredImageId(image.id)}
              onMouseLeave={() => setHoveredImageId(null)}
              style={{ position: "relative" }}
            >
            
              <img
              src={image.url}
              draggable
              onDragStart={(event) => handleDragStart(event, image.id)}
              style={imageStyle}
              />

              <button
                type="button"
                onClick={() => deleteImage(image.id)}
                title="Delete image"
                style={{
                  position: "absolute",
                  top: "3px",
                  right: "3px",
                  width: "20px",
                  height: "20px",
                  padding: 0,
                  border: "none",
                  borderRadius: "50%",
                  backgroundColor: "#aa2222",
                  color: "white",
                  cursor: "pointer",
                  display: hoveredImageId === image.id ? "block" : "none",
                }}
              >
                X
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

export default App; 