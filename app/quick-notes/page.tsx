"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  StickyNote, Plus, X, Trash2, Search, LayoutGrid, List,
  Paperclip, Download, FileText, Image, File, Bold, Italic,
  Underline, AlignLeft, List as ListIcon, ListOrdered, Palette,
  CheckCircle2, AlertCircle, Loader2, Edit3, Eye, ChevronDown, Clock, Star,
} from "lucide-react";
import { toggleQuickNoteFavorite } from "@/lib/actions";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NoteAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileExt: string;
  uploadedAt: string;
}

interface QuickNote {
  id: string;
  title: string;
  description: string;
  attachments: NoteAttachment[];
  isFavorited?: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

type ViewMode = "grid" | "list";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(ext: string) {
  const img = ["png", "jpg", "jpeg", "gif", "webp"];
  if (img.includes(ext)) return <Image className="w-4 h-4 text-blue-500" />;
  if (ext === "pdf") return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-slate-500" />;
}

// ─── Rich Text Toolbar ────────────────────────────────────────────────────────
const TEXT_COLORS = [
  "#1e293b", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
];

function RichTextEditor({
  value,
  onChange,
  placeholder = "Add a description…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Sync initial value
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []); // only on mount

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " ") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const textBeforeCursor = text.substring(0, offset);
          
          if (textBeforeCursor === "1." || textBeforeCursor.endsWith(" 1.")) {
            e.preventDefault();
            const suffix = text.substring(offset);
            const prefix = textBeforeCursor.substring(0, textBeforeCursor.length - 2);
            node.textContent = prefix + suffix;
            
            const newOffset = prefix.length;
            const newRange = document.createRange();
            newRange.setStart(node, newOffset);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            exec("insertOrderedList");
          } else if (textBeforeCursor === "-" || textBeforeCursor.endsWith(" -")) {
            e.preventDefault();
            const suffix = text.substring(offset);
            const prefix = textBeforeCursor.substring(0, textBeforeCursor.length - 1);
            node.textContent = prefix + suffix;
            
            const newOffset = prefix.length;
            const newRange = document.createRange();
            newRange.setStart(node, newOffset);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            exec("insertUnorderedList");
          }
        }
      }
    }
  };

  const ToolBtn = ({
    onClick, title, children, active,
  }: {
    onClick: () => void; title: string; children: React.ReactNode; active?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition-all ${active ? "bg-[#ed5c37]/10 text-[#ed5c37]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden focus-within:border-[#ed5c37]/40 focus-within:ring-2 focus-within:ring-[#ed5c37]/10 transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
        <ToolBtn onClick={() => exec("bold")} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Underline">
          <Underline className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Bullet List">
          <ListIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Numbered List">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Text Color */}
        <div className="relative" ref={colorPickerRef}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setShowColorPicker((p) => !p); }}
            title="Text Color"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center gap-1"
          >
            <Palette className="w-3.5 h-3.5" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 flex gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec("foreColor", color);
                    setShowColorPicker(false);
                  }}
                  className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <ToolBtn onClick={() => exec("removeFormat")} title="Clear Formatting">
          <span className="text-[10px] font-black px-1">Tx</span>
        </ToolBtn>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="min-h-[140px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm text-slate-700 outline-none leading-relaxed
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
      />
    </div>
  );
}

// ─── Note Modal (Create / Edit) ───────────────────────────────────────────────
function NoteModal({
  note,
  onClose,
  onSaved,
}: {
  note: QuickNote | null;
  onClose: () => void;
  onSaved: (note: QuickNote) => void;
}) {
  const isEdit = !!note;
  const [title, setTitle] = useState(note?.title ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [attachments, setAttachments] = useState<NoteAttachment[]>(note?.attachments ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        const res = await fetch(`/api/quick-notes/${note!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), description }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update note.");
        onSaved({ ...note!, title: title.trim(), description, attachments });
      } else {
        // Create note first
        const res = await fetch("/api/quick-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), description }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create note.");

        const newNoteId = data.id;
        const uploadedAttachments: NoteAttachment[] = [];

        // Upload any pending files
        if (pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            const fd = new FormData();
            fd.append("file", file);
            const uploadRes = await fetch(`/api/quick-notes/${newNoteId}/attachments`, {
              method: "POST",
              body: fd,
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) {
              throw new Error(uploadData.error || `Failed to upload ${file.name}`);
            }
            uploadedAttachments.push(uploadData.attachment);
          }
        }

        onSaved({
          id: newNoteId,
          title: title.trim(),
          description,
          attachments: uploadedAttachments,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      setError("File size exceeds 25MB limit.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (isEdit) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/quick-notes/${note!.id}/attachments`, {
          method: "POST", body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        setAttachments((prev) => [...prev, data.attachment]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    } else {
      setPendingFiles((prev) => [...prev, file]);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (att: NoteAttachment) => {
    if (!isEdit) return;
    try {
      const res = await fetch(`/api/quick-notes/${note!.id}/attachments?attachmentId=${att.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove attachment.");
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#ed5c37]/10 rounded-xl">
              <StickyNote className="w-5 h-5 text-[#ed5c37]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? "Edit Note" : "New Quick Note"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Title <span className="text-[#ed5c37]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#ed5c37]/40 focus:ring-2 focus:ring-[#ed5c37]/10 transition-all"
            />
          </div>

          {/* Description (Rich Text) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Description <span className="text-slate-400 font-medium">(optional)</span>
            </label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Attachments <span className="text-slate-400 font-medium">(optional)</span>
            </label>

            <input
              type="file"
              ref={fileRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-[#ed5c37]/40 text-slate-600 text-sm font-semibold rounded-2xl transition-all w-full justify-center disabled:opacity-60"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin text-[#ed5c37]" /> Uploading...</>
              ) : (
                <><Paperclip className="w-4 h-4" /> Attach File (max 25MB)</>
              )}
            </button>

            {(attachments.length > 0 || pendingFiles.length > 0) && (
              <div className="space-y-2 mt-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl group"
                  >
                    {getFileIcon(att.fileExt)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{att.fileName}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{formatFileSize(att.fileSize)}</p>
                    </div>
                    <a
                      href={att.filePath}
                      download={att.fileName}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {pendingFiles.map((file, idx) => {
                  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
                  return (
                    <div
                      key={`pending-${idx}`}
                      className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl group border-dashed"
                    >
                      {getFileIcon(fileExt)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                        <p className="text-[10px] text-amber-600 font-medium">Pending upload ({formatFileSize(file.size)})</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#ed5c37] hover:bg-[#d94f2c] text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-[#ed5c37]/30 flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Create Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Note Card (Grid) ─────────────────────────────────────────────────────────
function NoteCard({
  note, onEdit, onDelete, onToggleFavorite,
}: { note: QuickNote; onEdit: () => void; onDelete: () => void; onToggleFavorite: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      onClick={onEdit}
      className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#ed5c37]/20 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Color accent top bar */}
      <div className="h-1 bg-gradient-to-r from-[#ed5c37] to-orange-400 w-full" />

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">{note.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className={`p-1.5 rounded-lg transition-all ${
                note.isFavorited 
                  ? "text-amber-500 hover:bg-amber-50/50 bg-amber-50/20" 
                  : "text-slate-400 hover:text-amber-500 hover:bg-amber-50/50 opacity-0 group-hover:opacity-100"
              }`}
              title={note.isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star className={`w-3.5 h-3.5 ${note.isFavorited ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1.5 text-slate-400 hover:text-[#ed5c37] hover:bg-[#ed5c37]/10 rounded-lg transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Description preview */}
        {note.description && (
          <div
            className="text-xs text-slate-500 line-clamp-4 leading-relaxed
              [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
              [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_u]:underline"
            dangerouslySetInnerHTML={{ __html: note.description }}
          />
        )}

        <div className="flex-1" />

        {/* Attachment badge */}
        {note.attachments.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Paperclip className="w-3 h-3" />
            {note.attachments.length} file{note.attachments.length > 1 ? "s" : ""}
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium border-t border-slate-50 pt-2">
          <Clock className="w-3 h-3" />
          {formatDate(note.updatedAt ?? note.createdAt)}
        </div>
      </div>

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-3 p-5 z-10"
        >
          <Trash2 className="w-8 h-8 text-red-400" />
          <p className="text-sm font-bold text-slate-700 text-center">Delete this note?</p>
          <p className="text-xs text-slate-400 text-center">This action cannot be undone.</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="flex-1 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Note Row (List) ──────────────────────────────────────────────────────────
function NoteRow({
  note, onEdit, onDelete, onToggleFavorite,
}: { note: QuickNote; onEdit: () => void; onDelete: () => void; onToggleFavorite: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      onClick={onEdit}
      className="group flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#ed5c37]/20 hover:shadow-sm transition-all duration-200 cursor-pointer"
    >
      <div className="mt-0.5 p-2 bg-[#ed5c37]/10 rounded-xl shrink-0">
        <StickyNote className="w-4 h-4 text-[#ed5c37]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-bold text-slate-900 text-sm leading-snug">{note.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            {note.attachments.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                <Paperclip className="w-2.5 h-2.5" /> {note.attachments.length}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className={`p-1.5 rounded-lg transition-all ${
                note.isFavorited 
                  ? "text-amber-500 hover:bg-amber-50/50 bg-amber-50/20" 
                  : "text-slate-400 hover:text-amber-500 hover:bg-amber-50/50 opacity-0 group-hover:opacity-100"
              }`}
              title={note.isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star className={`w-3.5 h-3.5 ${note.isFavorited ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 text-slate-400 hover:text-[#ed5c37] hover:bg-[#ed5c37]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="px-2 py-1 text-[10px] font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {note.description && (
          <div
            className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed
              [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
              [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_u]:underline"
            dangerouslySetInnerHTML={{ __html: note.description }}
          />
        )}

        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <Clock className="w-3 h-3" />
          {formatDate(note.updatedAt ?? note.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuickNotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quick-notes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notes.");
      setNotes(data);
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleModalSaved = async (savedNote: QuickNote) => {
    setShowModal(false);
    setEditingNote(null);
    setToast({
      message: editingNote ? "Note updated successfully!" : "Note created successfully!",
      type: "success",
    });
    await fetchNotes();
  };

  const handleDelete = async (note: QuickNote) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/quick-notes/${note.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      setToast({ message: "Note deleted.", type: "success" });
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleFavorite = async (note: QuickNote) => {
    try {
      setIsSyncing(true);
      const res = await toggleQuickNoteFavorite(note.id);
      if (res && "error" in res) {
        setToast({ message: res.error || "Failed to update favorites", type: "error" });
      } else {
        setToast({
          message: note.isFavorited ? "Removed from favorites" : "Added to favorites",
          type: "success"
        });
        setNotes(prev =>
          prev.map(n => {
            if (n.id === note.id) {
              return { ...n, isFavorited: !n.isFavorited };
            }
            return n;
          })
        );
      }
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const openCreate = () => { setEditingNote(null); setShowModal(true); };
  const openEdit = (note: QuickNote) => { setEditingNote(note); setShowModal(true); };

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 relative">
      {/* Sync overlay */}
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#ed5c37] animate-pulse z-[100]" />
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#ed5c37]/10 rounded-2xl">
            <StickyNote className="w-6 h-6 text-[#ed5c37]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quick Notes</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {notes.length} note{notes.length !== 1 ? "s" : ""} · personal workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#ed5c37]/40 focus:ring-2 focus:ring-[#ed5c37]/10 transition-all w-56 shadow-sm"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-[#ed5c37]" : "text-slate-500 hover:text-slate-700"}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow-sm text-[#ed5c37]" : "text-slate-500 hover:text-slate-700"}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#ed5c37] hover:bg-[#d94f2c] text-white text-sm font-bold rounded-2xl transition-all shadow-sm shadow-[#ed5c37]/30 hover:shadow-[#ed5c37]/40"
          >
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[200px]">
                <div className="h-1 bg-slate-200 w-full" />
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="h-5 bg-slate-200 rounded-md w-3/4" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-slate-100 rounded-md w-full" />
                    <div className="h-3.5 bg-slate-100 rounded-md w-5/6" />
                    <div className="h-3.5 bg-slate-100 rounded-md w-4/5" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded-md w-1/4 mt-2" />
                  <div className="h-4 bg-slate-100 rounded-md w-1/2 mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-2xl">
                <div className="p-2.5 bg-slate-100 rounded-xl shrink-0 h-9 w-9" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded-md w-1/3" />
                  <div className="h-3 bg-slate-100 rounded-md w-5/6" />
                  <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <StickyNote className="w-14 h-14 text-slate-200" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-slate-900">
              {search ? "No notes match your search" : "No notes yet"}
            </p>
            <p className="text-sm text-slate-500 max-w-xs">
              {search ? "Try a different keyword." : "Create your first quick note to capture ideas, tasks, or anything you need."}
            </p>
          </div>
          {!search && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-6 py-3 bg-[#ed5c37] hover:bg-[#d94f2c] text-white text-sm font-bold rounded-2xl transition-all shadow-sm shadow-[#ed5c37]/30"
            >
              <Plus className="w-4 h-4" /> Create First Note
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredNotes.map((note) => (
            <div key={note.id} className="relative">
              <NoteCard
                note={note}
                onEdit={() => openEdit(note)}
                onDelete={() => handleDelete(note)}
                onToggleFavorite={() => handleToggleFavorite(note)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onEdit={() => openEdit(note)}
              onDelete={() => handleDelete(note)}
              onToggleFavorite={() => handleToggleFavorite(note)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NoteModal
          note={editingNote}
          onClose={() => { setShowModal(false); setEditingNote(null); }}
          onSaved={handleModalSaved}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-100 text-emerald-800"
            : "bg-red-50 border-red-100 text-red-800"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          }
          <span className="text-sm font-bold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
