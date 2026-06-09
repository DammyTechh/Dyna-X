// Central source of truth for brand + contact details.
// Update once here and it propagates across every public page & email footer.

export const SITE = {
  name: 'DynaX',
  company: 'Dynalimb Technologies',
  tagline: 'Connected rehabilitation, prosthetics & therapy care.',
  description:
    'DynaX connects patients with rehabilitation professionals, prosthetists, orthotists and therapists — with AI-assisted clinical tools, 3D scan collaboration and flexible care payments.',

  // Contact
  phone: '+234 812 663 6975',
  phoneHref: 'tel:+2348126636975',
  email: 'hello@dynalimb.com',
  emailHref: 'mailto:hello@dynalimb.com',
  support: 'support@dynalimb.com',
  address: 'Lagos, Nigeria',

  // Social (update with real handles)
  social: {
    linkedin: 'https://www.linkedin.com/company/dynalimb',
    twitter: 'https://twitter.com/dynalimb',
    instagram: 'https://instagram.com/dynalimb',
  },

  // Logo: served from imgur. To self-host instead, drop the file at
  // /public/images/logo.png and change this back to '/images/logo.png'.
  logo: 'https://i.imgur.com/pHhGO2a.png',
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
