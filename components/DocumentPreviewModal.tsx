import React from 'react';
import { X, Download, FileText, FileCheck, FileSpreadsheet, FileCode, File } from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docName: string;
  docUrl: string;
  category?: string;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  docName,
  docUrl,
  category
}: DocumentPreviewModalProps) {
  if (!isOpen) return null;

  const ext = docName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isEmbeddable = ["pdf", "txt"].includes(ext);
  const isOfficeDoc = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
  const isLocalFile = docUrl.startsWith("/");

  const getDocIcon = (name: string) => {
    const fileExt = name.split(".").pop()?.toLowerCase();
    switch (fileExt) {
      case "pdf":
        return <FileCheck className="w-12 h-12 text-rose-500 mx-auto" />;
      case "xls":
      case "xlsx":
        return <FileSpreadsheet className="w-12 h-12 text-emerald-500 mx-auto" />;
      case "doc":
      case "docx":
        return <FileText className="w-12 h-12 text-blue-500 mx-auto" />;
      case "txt":
        return <File className="w-12 h-12 text-slate-400 mx-auto" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
        return <FileCode className="w-12 h-12 text-amber-500 mx-auto" />;
      default:
        return <File className="w-12 h-12 text-slate-500 mx-auto" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-slate-900 text-base break-all">{docName}</h3>
            {category && (
              <span className="px-2.5 py-0.5 bg-[#ed5c37]/10 text-[#ed5c37] rounded-md font-bold text-[10px] uppercase tracking-wider mt-1 inline-block">
                {category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 p-6 bg-slate-100 overflow-auto flex items-center justify-center min-h-[350px]">
          {isImage ? (
            <img
              src={docUrl}
              alt={docName}
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md"
            />
          ) : isEmbeddable ? (
            <iframe
              src={docUrl}
              className="w-full h-[60vh] rounded-xl border border-slate-200 shadow-inner bg-white"
              title={docName}
            />
          ) : isOfficeDoc && !isLocalFile ? (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docUrl)}`}
              className="w-full h-[60vh] rounded-xl border border-slate-200 shadow-inner bg-white"
              title={docName}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
              {getDocIcon(docName)}
              <h4 className="font-bold text-slate-800 text-sm mt-3 break-all">{docName}</h4>
              <p className="text-xs text-slate-400 mt-1">
                {isOfficeDoc && isLocalFile
                  ? "Office Document preview is only supported in production deployments."
                  : "This file format cannot be previewed in the browser."}
              </p>
              <a
                href={docUrl}
                download={docName}
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-[#ed5c37] text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
