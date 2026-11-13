export const DEFAULT_COMPANY_CONTACT = Object.freeze({
  email: 'ztalentcoder@gmail.com',
  phone: '+255 622 923 299',
  location: 'Zanzibar',
});

export const DEFAULT_SOCIAL_PLATFORMS = Object.freeze([
  { platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/ztalentcoder/' },
  { platform: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/ztalentcoder' },
  { platform: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/255622923299' },
  { platform: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@ztalentcoder' },
]);

export function getCompanyContact(company) {
  return {
    email: company?.email || DEFAULT_COMPANY_CONTACT.email,
    phone: company?.phone || DEFAULT_COMPANY_CONTACT.phone,
    location: company?.location || DEFAULT_COMPANY_CONTACT.location,
  };
}

export function mergeSocialLinks(configuredLinks = []) {
  const configuredByPlatform = new Map();
  for (const link of configuredLinks) {
    const platform = link?.platform?.trim().toLowerCase();
    if (platform && link.url?.trim() && !configuredByPlatform.has(platform)) {
      configuredByPlatform.set(platform, link.url.trim());
    }
  }

  const knownPlatforms = new Set(DEFAULT_SOCIAL_PLATFORMS.map(({ platform }) => platform));
  const knownLinks = DEFAULT_SOCIAL_PLATFORMS.map((social) => ({
    ...social,
    url: configuredByPlatform.get(social.platform) || social.url,
  }));
  const additionalLinks = [...configuredByPlatform]
    .filter(([platform]) => !knownPlatforms.has(platform))
    .map(([platform, url]) => ({ platform, label: platform, url }));

  return [...knownLinks, ...additionalLinks];
}
