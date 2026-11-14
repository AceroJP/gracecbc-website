import Image from "next/image";
import { Mail, Map, MapPin, MessageCircle, Phone } from "lucide-react";
import type { LandingPageContactKey, LandingPageContent } from "@/lib/landing-page";

type ContactDetailsProps = {
  contact: LandingPageContent["contact"];
  imageUrls: Record<string, string | null>;
  sectionTextColor?: string;
};

export function ContactDetails({ contact, imageUrls, sectionTextColor }: ContactDetailsProps) {
  const items = [
    { key: "address", label: "Address", value: contact.address, href: "", icon: MapPin },
    { key: "phone", label: "Phone", value: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`, icon: Phone },
    { key: "email", label: "Email", value: contact.email, href: `mailto:${contact.email}`, icon: Mail },
    { key: "mapUrl", label: "Map", value: contact.mapUrl ? "Open map" : "", href: contact.mapUrl, icon: Map },
    { key: "facebookUrl", label: "Facebook", value: contact.facebookUrl ? "Visit Facebook" : "", href: contact.facebookUrl, icon: MessageCircle },
  ] satisfies Array<{ key: LandingPageContactKey; label: string; value: string; href: string; icon: typeof MapPin }>;

  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3">
      {items.filter((item) => item.value).map(({ key, label, value, href, icon: Icon }) => {
        const appearance = contact.appearance[key];
        const imageUrl = appearance.image.path ? imageUrls[`contact:${key}`] : null;
        const content = (
          <>
            {imageUrl ? (
              <Image alt="" aria-hidden="true" className="size-6 shrink-0 object-contain" height={24} src={imageUrl} unoptimized width={24} />
            ) : <Icon aria-hidden="true" className="size-6 shrink-0" />}
            <div className="min-w-0">
              <p className="font-semibold">{label}</p>
              <p className="mt-1 break-words text-sm leading-6 [overflow-wrap:anywhere]">{value}</p>
            </div>
          </>
        );
        const external = key === "mapUrl" || key === "facebookUrl";
        return (
          <div className="min-w-0 rounded-xl border border-current/20 text-foreground" key={key} style={{ color: appearance.textColor || sectionTextColor || undefined }}>
            {href ? (
              <a className="flex min-h-20 items-start gap-3 rounded-xl p-4 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" href={href} rel={external ? "noopener noreferrer" : undefined} target={external ? "_blank" : undefined}>
                {content}
              </a>
            ) : <div className="flex min-h-20 items-start gap-3 p-4">{content}</div>}
          </div>
        );
      })}
    </div>
  );
}
