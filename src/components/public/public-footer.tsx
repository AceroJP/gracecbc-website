import Link from "next/link";
import {
  getLandingPageFontFamily,
  getLandingPageTypographyStyleVariables,
  type LandingPageContent,
} from "@/lib/landing-page";

type FooterLink = { label: string; href: string };

type Props = {
  footer: LandingPageContent["footer"];
  contact: LandingPageContent["contact"];
  links: FooterLink[];
};

export function PublicFooter({ footer, links }: Props) {\n  return (
    <footer
      className="bg-brand text-white"
      style={{ backgroundColor: footer.backgroundColor || undefined }}
    >
      <div
        className="mx-auto grid max-w-7xl gap-10 px-6 sm:px-10 md:grid-cols-[1fr_auto] md:items-end lg:px-12"
        data-section-text-align={footer.textAlign === "inherit" ? undefined : "true"}
        data-section-font-family={footer.fontFamily === "inherit" ? undefined : "true"}
        data-section-font-size={footer.fontSizeScale === 100 ? undefined : "true"}
        style={{
          paddingBlock: footer.paddingY,
          textAlign: footer.textAlign === "inherit" ? undefined : footer.textAlign,
          fontFamily: getLandingPageFontFamily(footer.fontFamily),
          ...getLandingPageTypographyStyleVariables(footer.fontSizeScale),
        }}
      >
        <div>
          {footer.title && (
            <p
              className="text-base font-semibold tracking-tight"
              style={{ color: footer.textColor || undefined }}
            >
              {footer.title}
            </p>
          )}
          {footer.text && (
            <p
              className="mt-2 text-sm leading-6"
              style={{ color: footer.textColor || undefined }}
            >
              {footer.text}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6 text-sm">
          {links.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-white/80">Links</p>
              <div className="mt-3 grid gap-2">
                {links.map((link) => (
                  <Link
                    className="w-fit text-white/90 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}\n                {contact.email && (
                  <a
                    className="w-fit text-white/90 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    href={`mailto:${contact.email}`}
                  >
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    className="w-fit text-white/90 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                  >
                    {contact.phone}
                  </a>
                )}
                {contact.mapUrl && (
                  <a
                    className="w-fit text-white/90 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    href={contact.mapUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Directions
                  </a>
                )}
                {contact.facebookUrl && (
                  <a
                    className="w-fit text-white/90 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    href={contact.facebookUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Facebook
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

