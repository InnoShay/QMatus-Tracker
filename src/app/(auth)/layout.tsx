import { LogoMark, Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between border-r border-line bg-rail p-12 lg:flex">
        <Wordmark withProduct />
        <div className="flex max-w-md flex-col gap-10">
          <LogoMark className="w-28" />
          <p className="text-[28px] leading-[36px] font-semibold tracking-[-0.02em] text-balance text-fg">
            One place for what the team committed, what’s blocked and what shipped.
          </p>
        </div>
        <p className="flex items-center gap-2 text-label text-fg-3">
          <span className="qm-notch" aria-hidden />
          Private by design: each team sees only its own work.
        </p>
      </aside>
      <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-6">
        <header className="mx-auto w-full max-w-[400px] lg:hidden">
          <Wordmark withProduct />
        </header>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</main>
        <footer className="mx-auto w-full max-w-[400px] text-meta text-fg-3">
          Access is by invitation. Ask a workspace admin if you need an account.
        </footer>
      </div>
    </div>
  );
}
