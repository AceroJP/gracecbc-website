import {
  getLandingPageFontFamily,
  getLandingPageTypographyStyleVariables,
  type LandingPageContent,
} from "@/lib/landing-page";

export function PublicFooter({
  footer,
}: {
  footer: LandingPageContent["footer"];
}) {
  return (
    <footer className="bg-brand text-white">
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
            <p className="mt-2 text-sm leading-6" style={{ color: footer.textColor || undefined }}>
              {footer.text}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
