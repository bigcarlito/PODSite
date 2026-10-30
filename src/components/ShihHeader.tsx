import Link from "next/link";
import type { StoreBranding } from "@/lib/store-branding";
import { MobileNav } from "./MobileNav";
import { StoreArtwork } from "./StoreArtwork";
import { shihStorefront } from "@/lib/shih-storefront";

export function ShihHeader({ branding, count }: { branding: StoreBranding; count: number }) {
  return <header className="shih-header">
    <Link href="/" className="shih-logo" aria-label={branding.name}>{branding.theme.logoUrl ? <StoreArtwork src={branding.theme.logoUrl} alt={branding.name}/> : <><strong>{branding.name}</strong><span>{shihStorefront.tagline}</span></>}</Link>
    <p className="shih-header-note">{branding.storefront.eyebrow}</p>
    <nav className="shih-nav" aria-label="Main navigation">{branding.nav.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
    <div className="shih-header-dogs" aria-hidden="true">{branding.storefront.decorations?.[0] ? <StoreArtwork {...branding.storefront.decorations[0]} alt=""/> : <span>♡ &nbsp; ♡<br/><small>Small dogs. Big personalities.</small></span>}</div>
    <div className="shih-header-actions"><Link href="/search" aria-label="Search"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13" cy="13" r="9"/><path d="m20 20 9 9"/></svg></Link><Link href="/cart" aria-label={`Cart, ${count} items`} className="shih-cart"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4h5l4 18h17l4-13H7M11 26h16"/><circle cx="12" cy="29" r="1"/><circle cx="26" cy="29" r="1"/></svg><span>{count}</span></Link><MobileNav nav={branding.nav}/></div>
  </header>;
}
