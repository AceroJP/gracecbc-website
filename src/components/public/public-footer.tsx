import {
  getLandingPageFontFamily,
  getLandingPageTypographyStyleVariables,
  type LandingPageContent,
} from "@/lib/landing-page";

type Props = {
  footer: LandingPageContent["footer"];
};

export function PublicFooter({ footer }: Props) {
  return (
    <footer
      className="bg-brand text-white"
      style={{ backgroundColor: footer.backgroundColor || undefined }}
    >
      <div
        className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12"
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
    </footer>
  );
}
