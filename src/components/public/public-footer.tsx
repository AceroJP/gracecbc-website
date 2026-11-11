import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import type { LandingPageContent } from "@/lib/landing-page";

export function PublicFooter({
  contact,
}: {
  contact: LandingPageContent["contact"] | null;
}) {
  return (
    <footer className="bg-brand text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:px-10 md:grid-cols-[1fr_auto] md:items-end lg:px-12">
        <div>
          <p className="text-base font-semibold tracking-tight">
            Grace Christian Baptist Church
          </p>
          {contact && (
            <div className="mt-2 flex max-w-xl flex-wrap gap-x-5 gap-y-2 text-sm leading-6 text-white/65">
              {contact.address && (
                <span className="inline-flex items-start gap-2">
                  <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {contact.address}
                </span>
              )}
              {contact.phone && (
                <a className="inline-flex min-h-8 items-center gap-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone aria-hidden="true" className="size-4 shrink-0" />
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a className="inline-flex min-h-8 items-center gap-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2" href={`mailto:${contact.email}`}>
                  <Mail aria-hidden="true" className="size-4 shrink-0" />
                  {contact.email}
                </a>
              )}
              {contact.facebookUrl && (
                <a className="inline-flex min-h-8 items-center gap-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2" href={contact.facebookUrl} rel="noopener noreferrer" target="_blank">
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                  Facebook
                </a>
              )}
              {contact.mapUrl && (
                <a className="inline-flex min-h-8 items-center gap-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2" href={contact.mapUrl} rel="noopener noreferrer" target="_blank">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  Map
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
