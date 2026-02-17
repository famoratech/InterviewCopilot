"use client";

import { useState } from "react";

export default function ResumeUploader() {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle",
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setStatus("uploading");

    try {
      const res = await fetch("http://localhost:8000/upload-resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Detailed error logging
        const errorText = await res.text();
        console.error("Upload Error:", res.status, errorText);
        throw new Error("Upload failed");
      }

      setStatus("done");
    } catch (err) {
      console.error("Fetch Error:", err);
      setStatus("error");
    }
  };

  return (
    <div className="mb-4 p-4 bg-white border rounded shadow-sm">
      <h3 className="text-sm font-semibold mb-2">1. Upload Resume (Context)</h3>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {status === "uploading" && (
          <span className="text-yellow-600 text-xs">Uploading...</span>
        )}
        {status === "done" && (
          <span className="text-green-600 text-xs font-bold">✓ Ready</span>
        )}
        {status === "error" && (
          <span className="text-red-600 text-xs">❌ Error (See Console)</span>
        )}
      </div>
    </div>
  );
}
