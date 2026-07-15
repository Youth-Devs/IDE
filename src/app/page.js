import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Code2,
  Eye,
  GitBranch,
  Globe2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Code2,
    eyebrow: '01 / Build',
    title: 'A focused editor for fast-moving ideas',
    description:
      'Write and organize projects in a workspace designed to keep the code in focus. Move from a blank canvas to a working prototype without leaving the browser.',
  },
  {
    icon: Sparkles,
    eyebrow: '02 / Assist',
    title: 'AI help when the next step is unclear',
    description:
      'Use the integrated assistant to explain unfamiliar code, generate a starting point, debug errors, and turn rough instructions into momentum.',
  },
  {
    icon: Terminal,
    eyebrow: '03 / Run',
    title: 'Your terminal, right beside the work',
    description:
      'Install dependencies, run scripts, inspect output, and manage your project with a Linux terminal that stays inside the same development flow.',
  },
  {
    icon: Eye,
    eyebrow: '04 / Preview',
    title: 'See the product take shape live',
    description:
      'Preview HTML and Next.js work as you build it. Shorten the distance between a code change and the experience your users will actually see.',
  },
  {
    icon: Users,
    eyebrow: '05 / Collaborate',
    title: 'A shared room for the whole team',
    description:
      'Bring teammates into the same project for hackathons and rapid builds. Share context, move in parallel, and keep decisions close to the code.',
  },
  {
    icon: Rocket,
    eyebrow: '06 / Ship',
    title: 'Go from finished to live with less friction',
    description:
      'Connect GitHub, push your changes, and deploy to Vercel when the project is ready. Your prototype gets a path to the real world.',
  },
];

const workflow = [
  ['01', 'Start with a workspace', 'Open a ready-to-use environment for your next idea, assignment, or hackathon build.'],
  ['02', 'Build with your team', 'Use the editor, terminal, AI assistant, and live preview as one connected loop.'],
  ['03', 'Share what you made', 'Sync with GitHub, deploy your project, and submit a polished result for review.'],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06110f] text-slate-100 selection:bg-emerald-300 selection:text-[#06110f]">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(34,211,238,0.12),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:auto,auto,72px_72px,72px_72px]" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="YouthDevs IDE home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_28px_rgba(52,211,153,0.16)]">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
          </span>
          <span className="font-mono text-sm font-bold tracking-[0.18em] text-white">YOUTHDEVS<span className="text-emerald-300">.IDE</span></span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition-colors hover:text-emerald-300">Features</a>
          <a href="#workflow" className="transition-colors hover:text-emerald-300">Workflow</a>
          <a href="#ship" className="transition-colors hover:text-emerald-300">Ship faster</a>
        </div>
        <Link href="/login" className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/50 hover:bg-white/5">
          Sign in
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-32 lg:pt-24">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            The browser-based build room
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-white sm:text-7xl lg:text-[5.6rem]">
            Turn big ideas into <span className="text-emerald-300">working software.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            YouthDevs IDE brings your editor, AI assistant, terminal, live preview, and deployment workflow into one focused cloud workspace built for learning, collaboration, and shipping.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/workspace" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-6 py-3.5 font-semibold text-[#06110f] shadow-[0_12px_40px_rgba(52,211,153,0.22)] transition hover:-translate-y-0.5 hover:bg-emerald-200">
              Start building free
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/[0.08]">
              Open your workspace
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500">
            <span className="flex items-center gap-2"><Check size={14} className="text-emerald-300" /> No setup overhead</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-emerald-300" /> Built for teams</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-emerald-300" /> Deploy when ready</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
          <div className="absolute -inset-10 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0c1b18]/95 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" /></div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">workspace / starter-app</span>
              <Code2 size={14} className="text-emerald-300" />
            </div>
            <div className="grid grid-cols-[0.75fr_1.5fr]">
              <div className="border-r border-white/10 p-4 font-mono text-[10px] text-slate-500">
                <div className="mb-4 uppercase tracking-[0.18em] text-slate-600">Explorer</div>
                <div className="space-y-3"><div className="text-emerald-300">src</div><div className="pl-3">app</div><div className="pl-6 text-slate-300">page.jsx</div><div className="pl-6">layout.jsx</div><div className="pl-3">components</div><div>package.json</div></div>
              </div>
              <div className="min-h-[290px] p-5 font-mono text-[11px] leading-6 sm:text-xs">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3 text-slate-500"><span>page.jsx</span><span className="text-emerald-300">● synced</span></div>
                <div><span className="text-fuchsia-300">export default</span> <span className="text-cyan-300">function</span> <span className="text-amber-200">BuildSomething</span>() {'{'}</div>
                <div className="pl-4 text-slate-400"><span className="text-fuchsia-300">return</span> (</div>
                <div className="pl-8 text-slate-300">&lt;<span className="text-emerald-300">Workspace</span></div>
                <div className="pl-12 text-slate-400">focus=<span className="text-amber-200">&quot;ship&quot;</span></div>
                <div className="pl-12 text-slate-400">team=<span className="text-amber-200">&quot;ready&quot;</span></div>
                <div className="pl-8 text-slate-300">/&gt;</div>
                <div className="pl-4 text-slate-400">);</div>
                <div>{'}'}</div>
                <div className="mt-8 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-emerald-200"><span className="text-slate-500">$</span> npm run dev <span className="ml-2 text-slate-500">ready in 1.2s</span></div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 font-mono text-[10px] text-slate-500"><span className="text-emerald-300">TERMINAL</span><span>localhost:3000</span><span className="ml-auto flex items-center gap-1 text-emerald-300"><Globe2 size={12} /> live preview</span></div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]" aria-label="IDE capabilities">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 px-6 sm:grid-cols-4 lg:px-8">
          {[[Zap, 'Instant feedback'], [Users, 'Team-ready'], [Terminal, 'Built-in terminal'], [Rocket, 'One-click shipping']].map(([Icon, label]) => <div key={label} className="flex items-center gap-3 px-4 py-5 text-xs font-medium text-slate-400 sm:px-6"><Icon size={16} className="text-emerald-300" />{label}</div>)}
        </div>
      </section>

      <section id="features" className="scroll-mt-24 relative z-10 mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="max-w-2xl"><p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-300">Everything in one loop</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">The tools you need to go from “what if?” to “it works.”</h2><p className="mt-5 text-lg leading-8 text-slate-400">Every part of the workspace is connected, so you can spend less time configuring your environment and more time making progress.</p></div>
        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, eyebrow, title, description }) => <article key={title} className="group rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/35 hover:bg-emerald-300/[0.06]"><div className="flex items-center justify-between"><span className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">{eyebrow}</span><Icon size={20} className="text-slate-500 transition-colors group-hover:text-emerald-300" /></div><h3 className="mt-10 text-xl font-semibold leading-snug text-white">{title}</h3><p className="mt-4 text-sm leading-7 text-slate-400">{description}</p></article>)}
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 relative z-10 border-y border-white/10 bg-[#091815]">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-32"><div><p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">A simple path forward</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Your flow stays in motion.</h2><p className="mt-6 max-w-md text-lg leading-8 text-slate-400">From first file to final URL, YouthDevs gives your team a clear place to work, experiment, and share the result.</p></div><div className="space-y-4">{workflow.map(([number, title, description]) => <div key={number} className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:grid-cols-[auto_1fr] sm:items-start"><span className="font-mono text-sm text-emerald-300">{number}</span><div><h3 className="text-lg font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{description}</p></div></div>)}</div></div>
      </section>

      <section id="ship" className="scroll-mt-24 relative z-10 mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32"><div className="overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/15 via-cyan-300/5 to-transparent p-8 sm:p-12 lg:flex lg:items-center lg:justify-between lg:p-16"><div className="max-w-2xl"><div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-emerald-200"><GitBranch size={15} /> Built to be shared</div><h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Make something worth showing.</h2><p className="mt-5 text-lg leading-8 text-slate-300">Create in a space that helps you learn faster, collaborate better, and leave every build with a link you can share.</p></div><Link href="/workspace" className="group mt-8 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-[#06110f] transition hover:-translate-y-0.5 hover:bg-emerald-100 lg:mt-0">Enter the IDE <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link></div></section>

      <footer className="relative z-10 border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><p className="max-w-2xl leading-6">YouthDevs IDE was created by YouthDevs, a non-profit fiscally sponsored by the Hack Club.</p><div className="flex items-center gap-5"><span className="flex items-center gap-1.5"><ShieldCheck size={14} /> A focused cloud workspace</span><Link href="/login" className="text-slate-300 transition hover:text-emerald-300">Sign in</Link></div></div></footer>
    </main>
  );
}
