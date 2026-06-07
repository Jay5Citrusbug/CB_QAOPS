import re
import os

replacements = {
    r'\b(border|bg|text)-slate-150\b': r'\1-slate-200',
    r'\b(border|bg|text)-slate-155\b': r'\1-slate-200',
    r'\b(border|bg|text)-slate-250\b': r'\1-slate-200',
    r'\b(border|bg|text)-slate-255\b': r'\1-slate-200',
    r'\b(border|bg|text)-slate-55\b': r'\1-slate-50',
    r'\b(border|bg|text)-slate-105\b': r'\1-slate-100',
    r'\btext-slate-405\b': 'text-slate-400',
    r'\btext-slate-450\b': 'text-slate-400',
    r'\btext-slate-455\b': 'text-slate-400',
    r'\btext-slate-550\b': 'text-slate-500',
    r'\btext-slate-555\b': 'text-slate-500',
    r'\btext-slate-650\b': 'text-slate-600',
    r'\btext-slate-655\b': 'text-slate-600',
    r'\btext-slate-705\b': 'text-slate-600',
    r'\btext-slate-850\b': 'text-slate-800',
    r'\btext-slate-855\b': 'text-slate-800',
    r'\btext-sky-350\b': 'text-sky-400',
    r'\btext-sky-355\b': 'text-sky-400',
    r'\btext-blue-705\b': 'text-blue-700',
    r'\btext-blue-750\b': 'text-blue-700',
    r'\b(bg|border|text)-red-105\b': r'\1-red-100',
    r'\btext-red-650\b': 'text-red-600',
    r'\btext-red-655\b': 'text-red-600',
    r'\b(bg|border|text)-amber-105\b': r'\1-amber-100',
    r'\bborder-amber-250\b': 'border-amber-200',
    r'\btext-amber-805\b': 'text-amber-800',
    r'\btext-indigo-805\b': 'text-indigo-800',
}

app_dir = os.path.abspath("app")

for root, dirs, files in os.walk(app_dir):
    for file in files:
        if file.endswith((".ts", ".tsx")):
            abs_path = os.path.join(root, file)
            try:
                with open(abs_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception:
                continue
                
            original = content
            for pattern, repl in replacements.items():
                content = re.sub(pattern, repl, content)
                
            if content != original:
                with open(abs_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                rel_path = os.path.relpath(abs_path, os.getcwd())
                print(f"[CLEANED] {rel_path}")
