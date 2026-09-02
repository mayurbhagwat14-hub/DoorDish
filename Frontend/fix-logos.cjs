const fs = require('fs');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Add import if missing
  if (!content.includes('normalizeImageUrl')) {
    content = content.replace(/import \{[^\}]*\} from [\'\"]@food\/utils\/common[\'\"];?/g, match => {
      return match.includes('normalizeImageUrl') ? match : match.replace('}', ', normalizeImageUrl }');
    });
    if (!content.includes('normalizeImageUrl')) {
        content = content.replace(/(import.*?\n)/, '$1import { normalizeImageUrl } from \"@food/utils/common\"\n');
    }
  }

  if (!content.includes('import { API_BASE_URL }')) {
    content = content.replace(/(import.*?\n)/, '$1import { API_BASE_URL } from \"@food/api/config\"\n');
  }

  // Replace setLogoUrl(cached.logo.url)
  content = content.replace(/setLogoUrl\(cached\.logo\.url\)/g, 'setLogoUrl(normalizeImageUrl(cached.logo.url, API_BASE_URL))');
  content = content.replace(/setLogoUrl\(settings\.logo\.url\)/g, 'setLogoUrl(normalizeImageUrl(settings.logo.url, API_BASE_URL))');

  fs.writeFileSync(path, content, 'utf8');
}

fixFile('src/modules/Food/components/user/DesktopNavbar.jsx');
fixFile('src/modules/Food/components/user/PageNavbar.jsx');
fixFile('src/modules/Food/components/admin/AdminSidebar.jsx');
