"use client";

import { useState } from "react";

type Props = {
  images: string[];
  title: string;
};

export default function ImageGallery({ images, title }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (images.length === 0) {
    return <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#555" }}>No image yet</div>;
  }

  if (images.length === 1) {
    return <img src={images[0]} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }

  return (
    <>
      <img
        src={images[activeIdx]}
        alt={`${title} — image ${activeIdx + 1}`}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {/* Thumbnail strip — overlaid at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "10px 10px",
          display: "flex",
          gap: 7,
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
          overflowX: "auto",
        }}
      >
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            aria-label={`View image ${i + 1}`}
            style={{
              flexShrink: 0,
              width: 52,
              height: 52,
              border: i === activeIdx
                ? "2px solid #ff4fd8"
                : "2px solid rgba(255,255,255,0.25)",
              borderRadius: 8,
              padding: 0,
              cursor: "pointer",
              overflow: "hidden",
              background: "none",
              transition: "border-color 120ms ease",
              boxShadow: i === activeIdx ? "0 0 0 1px rgba(255,79,216,0.4)" : "none",
            }}
          >
            <img
              src={url}
              alt={`${title} thumbnail ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </button>
        ))}
      </div>
    </>
  );
}
