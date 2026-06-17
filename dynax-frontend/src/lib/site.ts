// Central source of truth for brand + contact details.
// Update once here and it propagates across every public page & email footer.

export const SITE = {
  name: 'DynaX',
  company: 'Dynalimb Technologies',
  tagline: 'Connected rehabilitation, prosthetics & therapy care.',
  description:
    'DynaX connects patients with rehabilitation professionals, prosthetists, orthotists and therapists — with AI-assisted clinical tools, 3D scan collaboration and flexible care payments.',

  // Contact — product-facing addresses live on the product domain (dynax.app).
  phone: '+234 812 663 6975',
  phoneHref: 'tel:+2348126636975',
  email: 'support@dynax.app',
  emailHref: 'mailto:support@dynax.app',
  support: 'support@dynax.app',
  address: 'Lagos, Nigeria',

  // The product lives at dynax.app; the parent organisation is Dynalimb.
  url: 'https://dynax.app',
  orgSite: 'https://dynalimb.com',

  // Social (update with real handles)
  social: {
    linkedin: 'https://www.linkedin.com/company/dynalimb',
    twitter: 'https://twitter.com/dynalimb',
    instagram: 'https://instagram.com/dynalimb',
  },

  // Brand logo — self-hosted in /public/images so it always loads (no imgur
  // hotlink). `logo` is the colour version for light surfaces; `logoLight` is
  // a white knockout for dark surfaces. Swap these two files to rebrand.
  logo: '/images/logo.png',
  logoLight: '/images/logo-light.png',
} as const;

export const NAV_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Products', href: '/products' },
  { label: 'Patient Care', href: '/patient-care' },
  { label: 'Contact', href: '/contact' },
] as const;

// Portal entry points (role-based).
export const PORTALS = {
  patient: '/auth/login',
  prosthetistOrthotist: '/prosthetist-orthotist',
  physiotherapy: '/physiotherapy',
  admin: '/admin',
} as const;
