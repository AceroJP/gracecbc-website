export function PublicFooter() {
  return (
    <footer className="bg-brand text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:px-10 md:grid-cols-[1fr_auto] md:items-end lg:px-12">
        <div>
          <p className="text-base font-semibold tracking-tight">
            Grace Christian Baptist Church
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/65">
            This website is being prepared. Church contact details will be
            provided here when available.
          </p>
        </div>
        <p className="border-t border-white/15 pt-5 text-xs text-white/50 md:col-span-2">
          Church content and contact information are placeholders until
          confirmed.
        </p>
      </div>
    </footer>
  );
}
