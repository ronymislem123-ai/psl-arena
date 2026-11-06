import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div>
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan/80">404</div>
        <h1 className="mt-2 font-display text-3xl font-bold">Not found</h1>
        <p className="mt-2 text-fg-2">This battle, analysis or profile does not exist (or was deleted).</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-accent px-4 py-2 text-sm text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
