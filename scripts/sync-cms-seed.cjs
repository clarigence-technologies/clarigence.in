/* Copies the public content.json into the backend seed so a new database starts with the live site's content. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
const seedPath = path.join(root, 'backend/src/main/resources/cms-seed.json');
const slugify = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const services = content.services.map(({ name, slug, shortDescription, description, icon, imageUrl, displayOrder, active, capabilities, benefits, useCases }) => ({
  name, slug, shortDescription, description, icon, imageUrl: imageUrl || '', displayOrder, active: active !== false,
  capabilities: capabilities || [], benefits: benefits || [], useCases: useCases || ''
}));

const usedSlugs = new Set();
const portfolio = content.portfolio.map((project, index) => {
  let slug = project.slug || slugify(project.title);
  while (usedSlugs.has(slug)) slug += '-2';
  usedSlugs.add(slug);
  return {
    name: project.title, slug,
    shortDescription: project.shortDescription || project.description,
    description: project.description || project.shortDescription,
    icon: project.icon || 'window', imageUrl: project.imageUrl || '',
    displayOrder: project.displayOrder ?? (index + 1) * 10, active: project.active !== false,
    category: project.category || '', technologies: project.technologies || [],
    projectUrl: project.projectUrl || '', featured: Boolean(project.featured), concept: project.concept !== false
  };
});

const clients = (content.clients || []).map((client, index) => ({
  name: client.name, logoUrl: client.logoUrl, websiteUrl: client.websiteUrl || '',
  displayOrder: (index + 1) * 10, active: true
}));

fs.writeFileSync(seedPath, JSON.stringify({ services, portfolio, clients, documents: content.documents }, null, 2) + '\n');
console.log(`Seed updated: ${services.length} services, ${portfolio.length} projects, ${clients.length} clients, ${Object.keys(content.documents).length} documents.`);
