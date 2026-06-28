"use client";

import React, { useState, useRef } from "react";
import { 
  Upload, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  ExternalLink, 
  FileText, 
  Loader2, 
  Trash2, 
  AlertCircle, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface UploadedFile {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  uploadedBy: string;
}

export default function CloudinaryUploadTestPage() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [uploadedResult, setUploadedResult] = useState<UploadedFile | null>(null);
  
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Handle file input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  // Process file selection and generate client-side preview
  const handleFileSelection = (file: File) => {
    setError(null);
    setSuccess(false);
    
    // Check file type (limit to images for this display showcase)
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WEBP, GIF).");
      return;
    }

    // Limit to 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("Image file size exceeds the 10MB limit.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  // Trigger file input click
  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Clear current selection
  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setSuccess(false);
    setUploadedResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload to API
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image.");
      }

      setUploadedResult({
        url: data.url,
        publicId: data.publicId,
        format: data.format,
        bytes: data.bytes,
        uploadedBy: data.uploadedBy,
      });
      setSuccess(true);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "An unexpected error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="page-header border-b border-slate-200/80 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#ed5c37]/10 p-2 rounded-xl text-[#ed5c37]">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="page-title text-2xl font-extrabold text-slate-900 tracking-tight">Cloudinary Media Lab</h1>
            <p className="page-desc text-slate-500 font-medium text-sm mt-1">
              Upload files from React components and instantly display optimized images served from the Cloudinary CDN.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upload Column */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#ed5c37]" /> Upload Console
              </h2>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Select an image file to upload securely to Cloudinary using signed requests.
              </p>
            </div>

            {/* Drag & Drop Zone */}
            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
                className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 group ${
                  dragActive
                    ? "border-[#ed5c37] bg-[#ed5c37]/5 ring-4 ring-[#ed5c37]/5"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                }`}
                id="dropzone-container"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="cloudinary-file-input"
                  className="hidden"
                  onChange={handleChange}
                  accept="image/*"
                />
                
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-[#ed5c37] group-hover:scale-105 shadow-sm border border-slate-100 transition-all">
                  <Upload className="w-6 h-6" />
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">
                    Drag & drop your image here, or <span className="text-[#ed5c37] hover:underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-400 font-semibold">
                    PNG, JPG, WEBP or GIF (Up to 10MB)
                  </p>
                </div>
              </div>
            ) : (
              // Selected File Preview & Upload Confirmation
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                <div className="aspect-video relative w-full bg-slate-100 border-b border-slate-200 flex items-center justify-center overflow-hidden">
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Upload Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="p-4 flex items-center justify-between gap-3 bg-white">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-[#ed5c37]/10 flex items-center justify-center text-[#ed5c37] shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-800 truncate" id="selected-file-name">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!uploading && !success && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                      title="Remove file"
                      id="remove-file-button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-shake" id="upload-error-banner">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-red-800">Upload Issue</h4>
                  <p className="text-xs text-red-700 font-semibold">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message Banner */}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 animate-fade-in" id="upload-success-banner">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 mt-0.5 font-black text-xs">
                  ✓
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-emerald-800">Successfully Uploaded!</h4>
                  <p className="text-[10px] text-emerald-600 font-semibold">Your image is now safely hosted on Cloudinary CDN server.</p>
                </div>
              </div>
            )}

            {/* Upload Action Button */}
            {selectedFile && !success && (
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={uploading}
                  className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 btn-primary py-3 px-4 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  id="submit-upload-button"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      Confirm Upload <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Reset Button (After Success) */}
            {success && (
              <button
                type="button"
                onClick={clearSelection}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                id="reset-upload-button"
              >
                Upload Another Image
              </button>
            )}
          </div>
        </div>

        {/* Display Column */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 space-y-6 min-h-[400px] flex flex-col justify-between">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#ed5c37]" /> CDN Display Preview
                </h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Images served from Cloudinary are globally cached, optimized, and fast.
                </p>
              </div>

              {!uploadedResult ? (
                // Empty state
                <div className="flex-1 border border-slate-100 bg-slate-50/30 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">Waiting for upload submission...</p>
                  <p className="text-[10px] text-slate-400/80 font-medium max-w-xs">
                    Once you upload an image, it will be rendered here dynamically using its secure Cloudinary URL.
                  </p>
                </div>
              ) : (
                // Loaded Image Display
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  
                  {/* The Displayed Image */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 aspect-video relative flex items-center justify-center shadow-inner group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedResult.url}
                      alt="Uploaded Cloudinary Content"
                      className="w-full h-full object-contain"
                      id="uploaded-image-preview"
                    />
                    
                    <a
                      href={uploadedResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 backdrop-blur-md opacity-0 group-hover:opacity-100 cursor-pointer shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open CDN Link
                    </a>
                  </div>

                  {/* Metadata table */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 block border-b border-slate-100">
                      Cloudinary Asset Metadata
                    </span>
                    <div className="divide-y divide-slate-100/50 bg-white">
                      {[
                        { label: "Public ID", value: uploadedResult.publicId, id: "metadata-public-id" },
                        { label: "File Format", value: uploadedResult.format.toUpperCase(), id: "metadata-format" },
                        { label: "Asset Size", value: `${(uploadedResult.bytes / 1024).toFixed(1)} KB`, id: "metadata-size" },
                        { label: "Uploader", value: uploadedResult.uploadedBy, id: "metadata-uploader" },
                      ].map((item) => (
                        <div key={item.label} className="px-4 py-2.5 flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-400">{item.label}</span>
                          <span className="text-slate-700 font-bold truncate max-w-[200px]" id={item.id}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Copy URL Zone */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={uploadedResult.url}
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 text-xs font-mono select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(uploadedResult.url)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm border ${
                        copied
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                      id="copy-url-button"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#ed5c37]" /> Copy URL
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Back link to project pages */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
              <Link 
                href="/dashboard"
                className="text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                ← Back to Dashboard
              </Link>
              <Link 
                href="/my-drive"
                className="text-[#ed5c37] hover:underline flex items-center gap-1.5 transition-all cursor-pointer"
              >
                Go to My Drive <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
