'use client';

import { ArrowLeft, FileCode } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export default function AdminSubmissionWorkspace({
  project,
  theme,
  onBack,
  activeFileName,
  activeFileContent,
  onSelectFile,
  viewTab,
  onViewTabChange,
  previewHtml,
  previewPlaceholderHtml,
}) {
  const files = Array.isArray(project?.submittedFiles) && project.submittedFiles.length > 0
    ? project.submittedFiles
    : Array.isArray(project?.files) ? project.files : [];
  const submittedAt = project?.submittedAt ? new Date(project.submittedAt).toLocaleString() : '';

  if (!project) {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#050b08] text-emerald-300 font-mono text-xs">Resolving submission workspace...</div>;
  }

  return (
    <div className={`flex flex-col h-screen w-screen font-sans overflow-hidden select-none transition-colors duration-200 ${theme === 'dark' ? 'bg-[#050b08] text-slate-200' : 'bg-[#eef7f1] text-slate-800'}`}>
      <Toaster />
      <header className="flex h-14 items-center justify-between px-4 border-b z-10 shrink-0 transition-colors border-emerald-900/25 bg-[#07120c]/70 backdrop-blur-md">
        <div className="flex items-center gap-3 max-w-[70%] overflow-hidden">
          <button onClick={onBack} className={`p-1.5 rounded-lg transition-colors shrink-0 ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-emerald-50 text-emerald-700 hover:text-emerald-900'}`} title="Return to Admin Dashboard">
            <ArrowLeft size={14} />
          </button>
          <div className={`h-5 w-px shrink-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-emerald-200'}`} />
          <div className="min-w-0">
            <div className="font-bold text-xs tracking-wider bg-gradient-to-r from-emerald-300 to-lime-200 bg-clip-text text-transparent uppercase font-mono truncate">{project.name || 'Submitted Project'}</div>
            <div className={`text-[10px] font-mono truncate ${theme === 'dark' ? 'text-slate-500' : 'text-emerald-700'}`}>
              {project.submitted ? 'Submitted' : 'In Review'}{submittedAt ? ` • ${submittedAt}` : ''}{project.submittedBy ? ` • by ${project.submittedBy}` : ''}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex">
        <section className="w-72 shrink-0 border-r border-emerald-900/25 bg-[#07120c]/45 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-emerald-900/20">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Submission Files</div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">{files.length} files</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {files.map((file) => (
              <button key={file.id || file.name} type="button" onClick={() => onSelectFile(file)} className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-mono transition ${activeFileName === file.name ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20' : theme === 'dark' ? 'text-slate-400 hover:bg-slate-900/60' : 'text-slate-600 hover:bg-emerald-50'}`}>
                <FileCode size={13} />
                <span className="truncate">{file.name || 'Untitled file'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex-1 min-w-0 flex flex-col bg-[#050b08]">
          <div className="h-12 px-4 border-b border-emerald-900/30 bg-[#08140d]/60 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-emerald-900/30 bg-[#050b08] p-1">
              {['code', 'preview'].map((tab) => <button key={tab} type="button" onClick={() => onViewTabChange(tab)} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${viewTab === tab ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{tab}</button>)}
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Read Only</span>
          </div>
          {viewTab === 'code' ? (
            <div className="flex-1 p-4 overflow-auto custom-scrollbar">
              <div className="text-[11px] font-mono text-slate-400 mb-3">{activeFileName || 'Select a file to inspect'}</div>
              <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text selection:bg-rose-500/30 selection:text-white">{activeFileContent || 'No content found inside this file segment.'}</pre>
            </div>
          ) : (
            <div className="flex-1 w-full bg-[#050b08] relative"><iframe title="Admin Submission Preview" srcDoc={previewHtml || previewPlaceholderHtml} sandbox="allow-scripts" className="absolute inset-0 w-full h-full border-none" /></div>
          )}
        </section>
      </main>
    </div>
  );
}
