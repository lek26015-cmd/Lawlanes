const fs = require('fs');

const file = '../lawslane-capdeal/src/components/layout/footer.tsx';
let content = fs.readFileSync(file, 'utf8');

// The footer has a few sections. Let's simplify the navigation heavily.
const navLinksRegex = /(<div className="grid grid-cols-2 gap-8 sm:grid-cols-3 xl:col-span-2">)[\s\S]*?(<\/div>\s*<\/div>)/;
const simpleNav = `$1
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-wider uppercase mb-4">{t('services')}</h3>
              <ul className="space-y-3">
                <li><Link href="/services/contracts/screenshot" className="text-base text-slate-600 hover:text-[#0B3979] flex items-center gap-2">{t('capAndDeal')}</Link></li>
              </ul>
            </div>
          $2`;

content = content.replace(navLinksRegex, simpleNav);
fs.writeFileSync(file, content);
console.log("Footer pruned");
